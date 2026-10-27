"""
Invoice generation for completed bookings.

Two documents come out of the same booking, deliberately different:

- The **customer's Tax Invoice** -- two taxable lines (Pandit Ji's
  service fee, GST-free; MyYajmaan's platform fee, GST-liable) built to
  the shape CGST Rule 46 requires for a tax invoice: serial number
  (unique per financial year), supplier/recipient details, taxable
  value, tax rate/amount split by place of supply (CGST+SGST if the
  customer's state matches the registered company state, else IGST),
  and a signature line. The amount on this document is fixed at what
  the customer actually paid and never changes, even if the booking is
  later reassigned to a different Pandit Ji.
- The **Pandit Ji's Payment Statement** -- a single line (their own fee,
  no GST -- the platform doesn't collect GST on the pandit's behalf here)
  reflecting *whichever pandit actually completed the puja*, which may
  differ from the customer's original fee if the booking was reassigned
  (see admin_bookings.py's reassign_booking() and bookings.py's
  create_booking() for where original_pandit_fee_amount vs
  pandit_fee_amount get set). Not a GST tax invoice, so it doesn't share
  Rule 46's numbering requirement -- it gets its own separate series.

NOTE ON TAX CORRECTNESS: the SAC code and the "GST applies only to the
platform's fee" treatment below are built to your explicit instructions
and a general-purpose structural reading of Rule 46 -- they are not a
substitute for your CA/tax advisor's sign-off before these are relied on
for actual GST filing. The SAC code is admin-editable (Admin Settings ->
Invoice / GST Details) specifically so a correction never needs a code
change.
"""

import io
import logging
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app_settings import (
    GST_PERCENTAGE_KEY,
    INVOICE_COMPANY_ADDRESS_KEY,
    INVOICE_COMPANY_GSTIN_KEY,
    INVOICE_COMPANY_NAME_KEY,
    INVOICE_COMPANY_STATE_KEY,
    INVOICE_SAC_CODE_KEY,
    get_setting,
)

logger = logging.getLogger(__name__)

# Official CBIC GST state/UT codes. Keys match public.cities.state values
# exactly (confirmed against the live table) so a booking's address_state
# / a pandit's city lookup can be used as-is, no normalization needed.
INDIAN_STATE_GST_CODES = {
    "Jammu and Kashmir": "01",
    "Himachal Pradesh": "02",
    "Punjab": "03",
    "Chandigarh": "04",
    "Uttarakhand": "05",
    "Haryana": "06",
    "Delhi": "07",
    "Rajasthan": "08",
    "Uttar Pradesh": "09",
    "Bihar": "10",
    "Sikkim": "11",
    "Arunachal Pradesh": "12",
    "Nagaland": "13",
    "Manipur": "14",
    "Mizoram": "15",
    "Tripura": "16",
    "Meghalaya": "17",
    "Assam": "18",
    "West Bengal": "19",
    "Jharkhand": "20",
    "Odisha": "21",
    "Chhattisgarh": "22",
    "Madhya Pradesh": "23",
    "Gujarat": "24",
    "Dadra and Nagar Haveli and Daman and Diu": "26",
    "Maharashtra": "27",
    "Karnataka": "29",
    "Goa": "30",
    "Lakshadweep": "31",
    "Kerala": "32",
    "Tamil Nadu": "33",
    "Puducherry": "34",
    "Andaman and Nicobar Islands": "35",
    "Telangana": "36",
    "Andhra Pradesh": "37",
    "Ladakh": "38",
}


def financial_year_for(dt: datetime) -> str:
    """Indian financial year (Apr 1 - Mar 31), e.g. 2026-09-10 -> "2026-27"."""
    year = dt.year
    if dt.month < 4:
        return f"{year - 1}-{str(year)[-2:]}"
    return f"{year}-{str(year + 1)[-2:]}"


def get_company_settings() -> dict:
    return {
        "name": get_setting(INVOICE_COMPANY_NAME_KEY, "") or "",
        "gstin": get_setting(INVOICE_COMPANY_GSTIN_KEY, "") or "",
        "address": get_setting(INVOICE_COMPANY_ADDRESS_KEY, "") or "",
        "state": get_setting(INVOICE_COMPANY_STATE_KEY, "") or "",
        "sac_code": get_setting(INVOICE_SAC_CODE_KEY, "998599") or "998599",
        "gst_percentage": float(get_setting(GST_PERCENTAGE_KEY, 0) or 0),
    }


def _place_of_supply(customer_state: Optional[str], company_state: Optional[str]) -> dict:
    """
    CGST+SGST when the customer's state matches the registered company
    state; IGST otherwise -- including when company_state isn't
    configured yet, since IGST doesn't require guessing a home state.
    """
    same_state = bool(company_state) and bool(customer_state) and customer_state.strip().lower() == company_state.strip().lower()
    return {
        "type": "CGST_SGST" if same_state else "IGST",
        "customer_state_code": INDIAN_STATE_GST_CODES.get(customer_state or "", "--"),
        "company_state_code": INDIAN_STATE_GST_CODES.get(company_state or "", "--"),
    }


def _round2(value) -> float:
    return round(float(value or 0), 2)


def build_customer_invoice_snapshot(
    *,
    booking: dict,
    invoice_number: str,
    customer_name: str,
    customer_phone: Optional[str],
    puja_title: str,
    pandit_name: str,
) -> dict:
    company = get_company_settings()
    supply = _place_of_supply(booking.get("address_state"), company.get("state"))

    pandit_fee_line = _round2(
        (booking.get("original_pandit_fee_amount") or 0)
        + (booking.get("premium_fee") or 0)
        - (booking.get("coupon_discount") or 0)
    )
    platform_fee = _round2(booking.get("platform_fee"))
    gst_amount = _round2(booking.get("gst_amount"))
    gst_percentage = company["gst_percentage"]

    if supply["type"] == "CGST_SGST":
        half_rate = gst_percentage / 2
        cgst = sgst = _round2(gst_amount / 2)
        igst = 0.0
    else:
        half_rate = 0
        cgst = sgst = 0.0
        igst = gst_amount

    grand_total = _round2(pandit_fee_line + platform_fee + gst_amount)
    booking_amount = _round2(booking.get("amount"))
    if abs(grand_total - booking_amount) > 0.5:
        logger.warning(
            "Customer invoice for booking %s doesn't reconcile: computed total %.2f vs bookings.amount %.2f",
            booking.get("id"), grand_total, booking_amount,
        )

    return {
        "invoice_number": invoice_number,
        "document_title": "Tax Invoice",
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "company": company,
        "recipient": {
            "name": customer_name,
            "phone": customer_phone,
            "address": ", ".join(filter(None, [booking.get("address_line"), booking.get("address_city"), booking.get("address_state"), booking.get("address_pincode")])),
            "state": booking.get("address_state"),
        },
        "booking": {
            "id": booking.get("id"),
            "puja_title": puja_title,
            "pandit_name": pandit_name,
            "booking_date": str(booking.get("booking_date") or booking.get("date") or ""),
            "timeslot": booking.get("muhurat_time_slot") or booking.get("timeslot"),
        },
        "place_of_supply": supply,
        "gst_percentage": gst_percentage,
        "half_gst_rate": half_rate,
        "line_items": [
            item for item in [
                {
                    "description": "Pandit Ji Service Fee" + (" (incl. Premium Package Fee)" if booking.get("package_tier") == "premium" else ""),
                    "sac_code": None,
                    "taxable_value": pandit_fee_line,
                    "tax_rate": None,
                    "tax_amount": None,
                    "note": "Not subject to GST on this invoice.",
                },
                # Omitted entirely (not just zeroed) when there's no
                # platform fee at all -- e.g. a Package Puja booking,
                # whose single admin-quoted price has no separate
                # platform-fee/GST component. A "Rs. 0.00 at 18%" line
                # would be confusing on a real tax invoice, not just
                # redundant.
                {
                    "description": "Platform / Convenience Fee",
                    "sac_code": company["sac_code"],
                    "taxable_value": platform_fee,
                    "tax_rate": gst_percentage,
                    "tax_amount": gst_amount,
                    "note": None,
                } if platform_fee > 0 else None,
            ] if item is not None
        ],
        "totals": {
            "taxable_value": _round2(pandit_fee_line + platform_fee),
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "grand_total": grand_total,
        },
    }


def build_pandit_invoice_snapshot(
    *,
    booking: dict,
    invoice_number: str,
    pandit_name: str,
    pandit_phone: Optional[str],
    puja_title: str,
) -> dict:
    company = get_company_settings()
    fee_line = _round2((booking.get("pandit_fee_amount") or 0) + (booking.get("premium_fee") or 0))

    return {
        "invoice_number": invoice_number,
        "document_title": "Payment Statement",
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "company": company,
        "recipient": {
            "name": pandit_name,
            "phone": pandit_phone,
            "address": None,
            "state": None,
        },
        "booking": {
            "id": booking.get("id"),
            "puja_title": puja_title,
            "pandit_name": pandit_name,
            "booking_date": str(booking.get("booking_date") or booking.get("date") or ""),
            "timeslot": booking.get("muhurat_time_slot") or booking.get("timeslot"),
        },
        "place_of_supply": None,
        "gst_percentage": 0,
        "line_items": [
            {
                "description": "Puja Service Fee" + (" (incl. Premium Package Fee)" if booking.get("package_tier") == "premium" else ""),
                "sac_code": None,
                "taxable_value": fee_line,
                "tax_rate": None,
                "tax_amount": None,
                "note": "No GST applies -- this is a payment statement, not a tax invoice.",
            },
        ],
        "totals": {
            "taxable_value": fee_line,
            "cgst": 0.0,
            "sgst": 0.0,
            "igst": 0.0,
            "grand_total": fee_line,
        },
    }


INVOICE_PREFIXES = {"customer": "INV", "pandit": "PAY"}


def get_or_create_invoice(
    service_client,
    *,
    booking: dict,
    invoice_type: str,
    customer_name: str = "",
    customer_phone: Optional[str] = None,
    pandit_name: str = "",
    pandit_phone: Optional[str] = None,
    puja_title: str = "Puja",
) -> dict:
    """
    Returns the existing `invoices` row for this (booking, invoice_type)
    pair, generating and persisting one first if it doesn't exist yet.
    Safe to call repeatedly (e.g. once at completion time, again on
    every later download) -- the invoice number and snapshot, once
    issued, never change, so a re-download always reproduces the exact
    same document even if company settings or puja prices change later.
    """
    existing = (
        service_client.table("invoices")
        .select("*")
        .eq("booking_id", booking["id"])
        .eq("invoice_type", invoice_type)
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing, "data", None) or []
    if existing_rows:
        return existing_rows[0]

    issued_at = datetime.now(timezone.utc)
    fy = financial_year_for(issued_at)
    prefix = INVOICE_PREFIXES[invoice_type]
    number_resp = service_client.rpc("next_invoice_number", {"fy": fy, "p_prefix": prefix}).execute()
    invoice_number = getattr(number_resp, "data", None)
    if not invoice_number:
        raise RuntimeError(f"Could not allocate an invoice number for booking {booking['id']}")

    if invoice_type == "customer":
        snapshot = build_customer_invoice_snapshot(
            booking=booking,
            invoice_number=invoice_number,
            customer_name=customer_name,
            customer_phone=customer_phone,
            puja_title=puja_title,
            pandit_name=pandit_name,
        )
    else:
        snapshot = build_pandit_invoice_snapshot(
            booking=booking,
            invoice_number=invoice_number,
            pandit_name=pandit_name,
            pandit_phone=pandit_phone,
            puja_title=puja_title,
        )

    insert_resp = (
        service_client.table("invoices")
        .insert({
            "booking_id": booking["id"],
            "invoice_type": invoice_type,
            "invoice_number": invoice_number,
            "financial_year": fy,
            "issued_at": issued_at.isoformat(),
            "snapshot": snapshot,
        })
        .select("*")
        .execute()
    )
    rows = getattr(insert_resp, "data", None) or []
    if not rows:
        raise RuntimeError(f"Could not save the generated invoice for booking {booking['id']}")
    return rows[0]


def _rupees(value) -> str:
    return f"Rs. {float(value or 0):,.2f}"


def generate_invoice_pdf(snapshot: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title=f"{snapshot['document_title']} {snapshot['invoice_number']}",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("InvoiceTitle", parent=styles["Title"], fontSize=16, textColor=colors.HexColor("#7A1F2D"), spaceAfter=2)
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8.5, textColor=colors.HexColor("#555555"))
    normal = styles["Normal"]
    right_small = ParagraphStyle("RightSmall", parent=small, alignment=TA_RIGHT)
    center_small = ParagraphStyle("CenterSmall", parent=small, alignment=TA_CENTER)

    company = snapshot["company"]
    story = []

    story.append(Paragraph(company["name"] or "MyYajmaan", title_style))
    company_lines = []
    if company.get("address"):
        company_lines.append(company["address"])
    if company.get("state"):
        company_lines.append(company["state"])
    company_lines.append(f"GSTIN: {company['gstin']}" if company.get("gstin") else "GSTIN: not configured")
    story.append(Paragraph(" | ".join(company_lines), small))
    story.append(Spacer(1, 10 * mm))

    header_table = Table(
        [
            [Paragraph(f"<b>{snapshot['document_title']}</b>", styles["Heading3"]), Paragraph(f"<b>Invoice No:</b> {snapshot['invoice_number']}", normal)],
            ["", Paragraph(f"<b>Date:</b> {snapshot['issued_at'][:10]}", normal)],
        ],
        colWidths=[90 * mm, 82 * mm],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(header_table)
    story.append(Spacer(1, 6 * mm))

    recipient = snapshot["recipient"]
    bill_to_lines = [f"<b>Bill To:</b> {recipient.get('name') or '-'}"]
    if recipient.get("address"):
        bill_to_lines.append(recipient["address"])
    if recipient.get("phone"):
        bill_to_lines.append(f"Phone: {recipient['phone']}")
    story.append(Paragraph("<br/>".join(bill_to_lines), normal))
    story.append(Spacer(1, 4 * mm))

    booking = snapshot["booking"]
    booking_lines = (
        f"<b>Booking Reference:</b> {booking['id']}<br/>"
        f"<b>Puja:</b> {booking['puja_title']} &nbsp;&nbsp; <b>Pandit Ji:</b> {booking['pandit_name']}<br/>"
        f"<b>Puja Date:</b> {booking['booking_date']} {booking.get('timeslot') or ''}"
    )
    story.append(Paragraph(booking_lines, normal))
    story.append(Spacer(1, 6 * mm))

    is_tax_invoice = snapshot["place_of_supply"] is not None
    if is_tax_invoice:
        head = ["Description", "SAC", "Taxable Value", "Tax Rate", "Tax Amount"]
        widths = [65 * mm, 20 * mm, 30 * mm, 25 * mm, 32 * mm]
    else:
        head = ["Description", "Amount"]
        widths = [130 * mm, 42 * mm]

    rows = [head]
    for item in snapshot["line_items"]:
        if is_tax_invoice:
            rows.append([
                Paragraph(item["description"] + (f"<br/><i><font size=7.5>{item['note']}</font></i>" if item.get("note") else ""), small),
                item["sac_code"] or "-",
                _rupees(item["taxable_value"]),
                f"{item['tax_rate']}%" if item.get("tax_rate") else "-",
                _rupees(item["tax_amount"]) if item.get("tax_amount") else "-",
            ])
        else:
            rows.append([
                Paragraph(item["description"] + (f"<br/><i><font size=7.5>{item['note']}</font></i>" if item.get("note") else ""), small),
                _rupees(item["taxable_value"]),
            ])

    line_table = Table(rows, colWidths=widths, repeatRows=1)
    line_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7A1F2D")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5D2B8")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(line_table)
    story.append(Spacer(1, 4 * mm))

    totals = snapshot["totals"]
    if is_tax_invoice:
        supply = snapshot["place_of_supply"]
        totals_rows = [["Taxable Value", _rupees(totals["taxable_value"])]]
        if supply["type"] == "CGST_SGST":
            totals_rows.append([f"CGST ({snapshot['half_gst_rate']}%)", _rupees(totals["cgst"])])
            totals_rows.append([f"SGST ({snapshot['half_gst_rate']}%)", _rupees(totals["sgst"])])
        else:
            totals_rows.append([f"IGST ({snapshot['gst_percentage']}%)", _rupees(totals["igst"])])
        totals_rows.append(["Grand Total", _rupees(totals["grand_total"])])
    else:
        totals_rows = [["Total Payable", _rupees(totals["grand_total"])]]

    totals_table = Table(totals_rows, colWidths=[130 * mm, 42 * mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, colors.HexColor("#7A1F2D")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 4 * mm))

    if is_tax_invoice:
        supply = snapshot["place_of_supply"]
        story.append(Paragraph(
            f"Place of Supply: {snapshot['recipient'].get('state') or 'Not provided'} "
            f"(State Code: {supply['customer_state_code']})",
            small,
        ))

    story.append(Spacer(1, 14 * mm))
    story.append(Paragraph("This is a system-generated document and does not require a physical signature.", small))
    if is_tax_invoice and not company.get("gstin"):
        story.append(Paragraph("Note: company GSTIN is not yet configured in Admin Settings.", small))

    doc.build(story)
    return buffer.getvalue()
