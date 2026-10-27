import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import convert_records_image_fields, service_supabase
from decline_tracking import get_consecutive_declines
from invoicing import generate_invoice_pdf, get_or_create_invoice
from notifications import notify_user
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/bookings", tags=["admin-bookings"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin booking service is not configured.")
    return service_supabase


def _attach_details(client, rows: list):
    client_ids = [row["client_id"] for row in rows if row.get("client_id")]
    pandit_ids = [row["pandit_id"] for row in rows if row.get("pandit_id")]
    puja_ids = [row["catalog_puja_id"] for row in rows if row.get("catalog_puja_id")]
    coupon_ids = [row["coupon_id"] for row in rows if row.get("coupon_id")]

    pandits = client.table("pandits").select("id, user_id, display_name, name, price, city").in_("id", pandit_ids).execute() if pandit_ids else None
    pandits_by_id = {row["id"]: row for row in (getattr(pandits, "data", None) or [])}

    # One combined users lookup for both customers and assigned pandits'
    # own contact info (pandits.phone/email don't exist -- they live on
    # the linked users row, same as everywhere else in this app).
    pandit_user_ids = [p["user_id"] for p in pandits_by_id.values() if p.get("user_id")]
    all_user_ids = list({*client_ids, *pandit_user_ids})
    users = client.table("users").select("id, full_name, email, phone").in_("id", all_user_ids).execute() if all_user_ids else None
    users_by_id = {row["id"]: row for row in (getattr(users, "data", None) or [])}

    pujas = client.table("pujas").select("id, title, base_price").in_("id", puja_ids).execute() if puja_ids else None
    pujas_by_id = {row["id"]: row for row in (getattr(pujas, "data", None) or [])}

    coupons = client.table("coupons").select("id, code, description, discount_type, discount_value").in_("id", coupon_ids).execute() if coupon_ids else None
    coupons_by_id = {row["id"]: row for row in (getattr(coupons, "data", None) or [])}

    for row in rows:
        customer = users_by_id.get(row.get("client_id")) or {}
        pandit = dict(pandits_by_id.get(row.get("pandit_id")) or {})
        pandit_user = users_by_id.get(pandit.get("user_id")) or {}
        pandit["phone"] = pandit_user.get("phone")
        pandit["email"] = pandit_user.get("email")
        puja = pujas_by_id.get(row.get("catalog_puja_id")) or {}
        row["customer"] = customer
        row["pandit"] = pandit
        row["puja"] = puja
        row["puja_title"] = puja.get("title") or (row.get("notes") or "").removeprefix("Puja: ").strip() or "Puja"
        row["coupon"] = coupons_by_id.get(row.get("coupon_id"))
    return rows


@router.get("")
async def list_bookings(
    status: str = Query(default="all"),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    query = client.table("bookings").select("*", count="exact")
    if status != "all":
        query = query.eq("status", status)
    start = (page - 1) * page_size
    resp = query.order("created_at", desc=True).range(start, start + page_size - 1).execute()
    rows = _attach_details(client, getattr(resp, "data", None) or [])
    if search:
        term = search.strip().lower()
        rows = [row for row in rows if term in (row["customer"].get("full_name") or "").lower() or term in (row["pandit"].get("display_name") or row["pandit"].get("name") or "").lower() or term in row["puja_title"].lower()]
    return {"items": rows, "total": getattr(resp, "count", None) or 0, "page": page, "page_size": page_size}


@router.get("/declined-history")
async def list_declined_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Every booking ever declined by a Pandit Ji, regardless of current
    status -- unlike the "declined" status filter on GET /bookings
    (which drops a booking the moment it's reassigned, since
    reassign_booking() overwrites bookings.pandit_id), this stays
    visible so admin can see "Pandit 1 declined, Pandit 2 was
    reassigned" as a lasting record, not just an in-the-moment queue.
    """
    client = _client()

    decline_resp = (
        client.table("booking_assignment_events")
        .select("id, booking_id, previous_pandit_id, note, created_at", count="exact")
        .eq("action", "pandit_declined")
        .order("created_at", desc=True)
        .execute()
    )
    decline_events = getattr(decline_resp, "data", None) or []
    total = getattr(decline_resp, "count", None) or 0

    start = (page - 1) * page_size
    page_events = decline_events[start : start + page_size]
    booking_ids = [e["booking_id"] for e in page_events]

    bookings_resp = client.table("bookings").select("*").in_("id", booking_ids).execute() if booking_ids else None
    bookings_by_id = {row["id"]: row for row in (getattr(bookings_resp, "data", None) or [])}
    _attach_details(client, list(bookings_by_id.values()))

    # Most recent admin_reassigned event per booking, so a booking
    # declined and reassigned more than once still shows who it's with
    # now, not an earlier hop.
    reassign_resp = (
        client.table("booking_assignment_events")
        .select("booking_id, assigned_pandit_id, created_at")
        .eq("action", "admin_reassigned")
        .in_("booking_id", booking_ids)
        .order("created_at", desc=True)
        .execute()
        if booking_ids
        else None
    )
    reassigned_to_by_booking = {}
    for row in getattr(reassign_resp, "data", None) or []:
        reassigned_to_by_booking.setdefault(row["booking_id"], row["assigned_pandit_id"])

    declining_pandit_ids = [e["previous_pandit_id"] for e in page_events if e.get("previous_pandit_id")]
    reassigned_pandit_ids = list(reassigned_to_by_booking.values())
    all_pandit_ids = list({*declining_pandit_ids, *reassigned_pandit_ids})
    pandits_resp = client.table("pandits").select("id, display_name, name, city").in_("id", all_pandit_ids).execute() if all_pandit_ids else None
    pandits_by_id = {row["id"]: row for row in (getattr(pandits_resp, "data", None) or [])}

    items = []
    for event in page_events:
        booking = bookings_by_id.get(event["booking_id"])
        if not booking:
            continue
        declined_by = pandits_by_id.get(event.get("previous_pandit_id"))
        reassigned_pandit_id = reassigned_to_by_booking.get(event["booking_id"])
        reassigned_to = pandits_by_id.get(reassigned_pandit_id) if reassigned_pandit_id else None
        items.append(
            {
                "booking": booking,
                "declined_at": event["created_at"],
                "decline_reason": event.get("note"),
                "declined_by": declined_by,
                "reassigned_to": reassigned_to,
            }
        )

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{booking_id}")
async def get_booking(booking_id: str, current_user: dict = Depends(require_admin_roles())):
    client = _client()
    resp = client.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
    rows = _attach_details(client, getattr(resp, "data", None) or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    history = client.table("booking_assignment_events").select("*").eq("booking_id", booking_id).order("created_at", desc=True).execute()

    # Puja-completion photos the Pandit Ji uploaded (see pandit_photos.py)
    # -- admin can review these too, same read as that endpoint, just
    # without the "is this your own booking" ownership check.
    photos_resp = client.table("booking_photos").select("*").eq("booking_id", booking_id).order("created_at", desc=True).execute()
    photos = getattr(photos_resp, "data", None) or []
    convert_records_image_fields(photos, fields=["image_url"])

    return {"booking": rows[0], "assignment_history": getattr(history, "data", None) or [], "photos": photos}


@router.get("/{booking_id}/invoice")
async def download_booking_invoice(
    booking_id: str,
    type: str = Query(default="customer"),
    current_user: dict = Depends(require_admin_roles()),
):
    """Admin can pull either document for any booking, once completed."""
    if type not in ("customer", "pandit"):
        raise HTTPException(status_code=400, detail="type must be 'customer' or 'pandit'.")

    client = _client()
    resp = client.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
    rows = _attach_details(client, getattr(resp, "data", None) or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = rows[0]
    if booking.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Invoice is available once this puja is marked completed.")

    pandit_info = booking.get("pandit") or {}
    customer_info = booking.get("customer") or {}
    pandit_name = pandit_info.get("display_name") or pandit_info.get("name") or "Pandit Ji"

    invoice_row = get_or_create_invoice(
        client,
        booking=booking,
        invoice_type=type,
        customer_name=customer_info.get("full_name") or "Customer",
        customer_phone=customer_info.get("phone"),
        pandit_name=pandit_name,
        pandit_phone=pandit_info.get("phone"),
        puja_title=booking.get("puja_title") or "Puja",
    )
    pdf_bytes = generate_invoice_pdf(invoice_row["snapshot"])
    filename = invoice_row["invoice_number"].replace("/", "-") + ".pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{booking_id}/eligible-pandits")
async def list_eligible_pandits(booking_id: str, current_user: dict = Depends(require_admin_roles())):
    client = _client()
    booking_resp = client.table("bookings").select("catalog_puja_id, booking_type, pandit_fee_amount").eq("id", booking_id).limit(1).execute()
    booking_rows = getattr(booking_resp, "data", None) or []
    if not booking_rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = booking_rows[0]
    # A pandit profile without a linked user_id has no portal login -- they
    # could never see or respond to a booking assigned to them, so they're
    # excluded here regardless of how "eligible" their catalog listing looks.
    pandits = (
        getattr(
            client.table("pandits")
            .select("id, user_id, display_name, name, price, city")
            .eq("is_active", True)
            .eq("verification_status", "approved")
            .not_.is_("user_id", "null")
            .order("display_name")
            .execute(),
            "data",
            None,
        )
        or []
    )
    puja_id = booking.get("catalog_puja_id")
    if booking.get("booking_type") == "package":
        # No per-pandit catalog price for a package puja -- any approved,
        # active Pandit Ji is eligible, priced at the already-quoted flat
        # amount (see reassign_booking()'s matching branch).
        flat_price = booking.get("pandit_fee_amount")
        pandits = [dict(pandit, price=flat_price) for pandit in pandits]
    elif puja_id:
        relation_resp = client.table("pandit_puja").select("pandit_id, price_override").eq("puja_id", puja_id).eq("active", True).execute()
        prices = {row["pandit_id"]: row.get("price_override") for row in (getattr(relation_resp, "data", None) or [])}
        pandits = [dict(pandit, price=prices[pandit["id"]] if prices[pandit["id"]] is not None else pandit.get("price")) for pandit in pandits if pandit["id"] in prices]
    return {"items": pandits}


class ReassignIn(BaseModel):
    pandit_id: str
    note: Optional[str] = Field(default=None, max_length=500)


@router.post("/{booking_id}/reassign")
async def reassign_booking(booking_id: str, payload: ReassignIn, current_user: dict = Depends(require_admin_roles())):
    client = _client()
    booking_resp = client.table("bookings").select("*").eq("id", booking_id).limit(1).execute()
    booking_rows = getattr(booking_resp, "data", None) or []
    if not booking_rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = booking_rows[0]
    if booking.get("status") != "declined":
        raise HTTPException(status_code=400, detail="Only a declined booking can be reassigned.")
    pandit_resp = client.table("pandits").select("id, user_id, display_name, name, price, is_active, verification_status").eq("id", payload.pandit_id).limit(1).execute()
    pandit_rows = getattr(pandit_resp, "data", None) or []
    if not pandit_rows or not pandit_rows[0].get("is_active") or pandit_rows[0].get("verification_status") != "approved":
        raise HTTPException(status_code=400, detail="Choose an approved active Pandit Ji.")
    if not pandit_rows[0].get("user_id"):
        raise HTTPException(status_code=400, detail="This Pandit Ji does not have a portal login yet, so they cannot receive booking assignments. Choose a Pandit Ji who has completed portal registration.")
    replacement = pandit_rows[0]
    if booking.get("booking_type") == "package":
        # A package puja has no per-pandit catalog price (see
        # package_bookings.py/admin_package_bookings.py) -- admin already
        # quoted ONE flat price for the job regardless of who ends up
        # doing it, so reassignment always carries that same price
        # forward rather than looking up a pandit_puja override.
        assigned_price = float(booking.get("pandit_fee_amount") or 0)
    elif booking.get("catalog_puja_id"):
        relation = client.table("pandit_puja").select("price_override, active").eq("pandit_id", payload.pandit_id).eq("puja_id", booking["catalog_puja_id"]).limit(1).execute()
        relation_rows = getattr(relation, "data", None) or []
        if not relation_rows or not relation_rows[0].get("active"):
            raise HTTPException(status_code=400, detail="This Pandit Ji does not offer the booked puja.")
        assigned_price = float(relation_rows[0].get("price_override") or replacement.get("price") or 0)
    else:
        assigned_price = float(replacement.get("price") or 0)
    # Compared against the current Pandit Ji's own fee, not the total the
    # customer paid (that also bundles GST/platform/premium fees, a unit
    # mismatch that used to silently undercount this) -- this is the base
    # both the customer's and the new pandit's invoices key off later.
    platform_covered_amount = max(0, round(assigned_price - float(booking.get("pandit_fee_amount") or 0), 2))
    # Deliberately NOT "confirmed" -- the new Pandit Ji still has to accept,
    # exactly like a fresh assignment. The customer keeps seeing "Awaiting
    # Confirmation" (StatusPill treats pending_pandit/declined the same)
    # until that accept actually happens.
    updated = client.table("bookings").update({"pandit_id": payload.pandit_id, "status": "pending_pandit", "reassigned_at": datetime.now(timezone.utc).isoformat(), "pandit_fee_amount": assigned_price}).eq("id", booking_id).select("*").execute()
    updated_rows = getattr(updated, "data", None) or []
    if not updated_rows:
        raise HTTPException(status_code=500, detail="Could not reassign this booking.")
    client.table("booking_assignment_events").insert({"booking_id": booking_id, "previous_pandit_id": booking.get("pandit_id"), "assigned_pandit_id": payload.pandit_id, "action": "admin_reassigned", "assigned_price": assigned_price, "platform_covered_amount": platform_covered_amount, "note": (payload.note or "").strip() or None, "created_by": current_user["id"]}).execute()
    write_audit_log(action="ADMIN_BOOKING_REASSIGNED", actor_id=str(current_user["id"]), entity="bookings", entity_id=booking_id, payload={"previous_pandit_id": booking.get("pandit_id"), "assigned_pandit_id": payload.pandit_id, "platform_covered_amount": platform_covered_amount, "note": payload.note})
    replacement_name = replacement.get("display_name") or replacement.get("name") or "a new Pandit Ji"
    if booking.get("client_id"):
        await notify_user(user_id=booking["client_id"], type="BOOKING_REASSIGNED_AWAITING_CONFIRMATION", title="Pandit Ji updated for your puja", message=f"Unfortunately, your previously selected Pandit Ji is not available for your puja. We've assigned {replacement_name}, an experienced Pandit Ji, and are awaiting their confirmation.", link="/dashboard/bookings", metadata={"booking_id": booking_id})
    if replacement.get("user_id"):
        await notify_user(user_id=replacement["user_id"], type="BOOKING_ASSIGNED_BY_ADMIN", title="Booking assigned", message="You have been assigned a new booking by the admin team. Please accept or decline.", link="/pandit/bookings", metadata={"booking_id": booking_id})
    return {"message": "Booking reassigned. Awaiting the new Pandit Ji's confirmation; the customer has been notified.", "booking": updated_rows[0], "platform_covered_amount": platform_covered_amount}