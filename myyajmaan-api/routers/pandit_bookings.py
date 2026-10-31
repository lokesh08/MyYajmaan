import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from decline_tracking import get_consecutive_declines
from invoicing import generate_invoice_pdf, get_or_create_invoice
from notifications import notify_user
from permissions import require_roles
from wallet import credit_wallet

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pandit/me/bookings", tags=["pandit-bookings"])

TAB_STATUSES = {
    "upcoming": ["pending_pandit", "confirmed"],
    "completed": ["completed"],
    "cancelled": ["cancelled", "declined"],
}


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Pandit portal service is not configured.")
    return service_supabase


def _get_pandit_or_404(client, user_id: str) -> dict:
    resp = client.table("pandits").select("id, verification_status, display_name, name").eq("user_id", user_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Pandit profile not found. Please complete onboarding first.")
    return rows[0]


def _puja_title_for(client, booking: dict) -> str:
    if booking.get("catalog_puja_id"):
        resp = client.table("pujas").select("title").eq("id", booking["catalog_puja_id"]).limit(1).execute()
        rows = getattr(resp, "data", None) or []
        if rows and rows[0].get("title"):
            return rows[0]["title"]
    return (booking.get("notes") or "").removeprefix("Puja: ").strip() or "Puja"


def _attach_customer_info(client, rows: list):
    client_ids = [row["client_id"] for row in rows if row.get("client_id")]
    if not client_ids:
        return rows

    resp = client.table("users").select("id, full_name, phone, email").in_("id", client_ids).execute()
    users_by_id = {u["id"]: u for u in (getattr(resp, "data", None) or [])}

    for row in rows:
        user = users_by_id.get(row.get("client_id")) or {}
        row["customer_name"] = user.get("full_name")
        row["customer_phone"] = user.get("phone")
        row["customer_email"] = user.get("email")

    return rows


@router.get("")
async def list_my_bookings(
    tab: str = Query(default="upcoming"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_roles("pandit")),
):
    if tab not in TAB_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid tab. Use upcoming, completed, or cancelled.")

    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    query = (
        client.table("bookings")
        .select("*", count="exact")
        .eq("pandit_id", pandit["id"])
        .in_("status", TAB_STATUSES[tab])
    )

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("booking_date", desc=(tab != "upcoming")).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0
    _attach_customer_info(client, rows)

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/counts")
async def get_booking_tab_counts(current_user: dict = Depends(require_roles("pandit"))):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    counts = {}
    for tab, statuses in TAB_STATUSES.items():
        resp = (
            client.table("bookings")
            .select("id", count="exact")
            .eq("pandit_id", pandit["id"])
            .in_("status", statuses)
            .execute()
        )
        counts[tab] = getattr(resp, "count", None) or 0

    return counts


@router.get("/declined-history")
async def list_my_declined_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_roles("pandit")),
):
    """
    Every booking this pandit ever declined, regardless of whether it
    was later reassigned away from them (bookings.pandit_id would no
    longer point to them in that case) -- plus their current
    consecutive-decline streak, so they see it coming before it turns
    into an admin alert.
    """
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    decline_resp = (
        client.table("booking_assignment_events")
        .select("id, booking_id, note, created_at", count="exact")
        .eq("action", "pandit_declined")
        .eq("previous_pandit_id", pandit["id"])
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
    _attach_customer_info(client, list(bookings_by_id.values()))

    items = []
    for event in page_events:
        booking = bookings_by_id.get(event["booking_id"])
        if not booking:
            continue
        items.append({"booking": booking, "declined_at": event["created_at"], "decline_reason": event.get("note")})

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "current_streak": get_consecutive_declines(client, pandit["id"]),
    }


class RespondIn(BaseModel):
    action: str = Field(pattern="^(accept|decline)$")
    reason: Optional[str] = Field(default=None, max_length=500)


@router.patch("/{booking_id}/respond")
async def respond_to_booking(
    booking_id: str,
    payload: RespondIn,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    resp = client.table("bookings").select("*").eq("id", booking_id).eq("pandit_id", pandit["id"]).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = rows[0]

    if booking.get("status") != "pending_pandit":
        raise HTTPException(status_code=400, detail="This booking has already been responded to.")

    if payload.action == "decline" and not (payload.reason or "").strip():
        raise HTTPException(status_code=400, detail="Please provide a reason for declining this booking.")

    # A second decline (i.e. this booking has already been reassigned once
    # by admin) is final -- there's no third Pandit Ji in this flow, so it
    # cancels outright with an automatic refund instead of going back to
    # admin silently again.
    is_repeat_decline = False
    if payload.action == "decline" and service_supabase is not None:
        prior_reassignment_resp = (
            service_supabase.table("booking_assignment_events")
            .select("id", count="exact")
            .eq("booking_id", booking_id)
            .eq("action", "admin_reassigned")
            .execute()
        )
        prior_reassignment_count = getattr(prior_reassignment_resp, "count", None) or len(
            getattr(prior_reassignment_resp, "data", None) or []
        )
        is_repeat_decline = prior_reassignment_count > 0

    refund_amount = 0.0
    if payload.action == "accept":
        columns = {"status": "confirmed"}
        action = "PANDIT_BOOKING_ACCEPTED"
    elif is_repeat_decline:
        refund_amount = float(booking.get("amount") or 0)
        columns = {
            "status": "cancelled",
            "cancelled_by": current_user["id"],
            "cancelled_reason": f"Pandit Ji declined again after reassignment: {payload.reason.strip()}",
            "refund_amount": refund_amount,
        }
        action = "PANDIT_BOOKING_DECLINED"
    else:
        columns = {
            "status": "declined",
            "cancelled_by": current_user["id"],
            "cancelled_reason": payload.reason.strip(),
        }
        action = "PANDIT_BOOKING_DECLINED"

    updated_resp = client.table("bookings").update(columns).eq("id", booking_id).select("*").execute()
    updated_rows = getattr(updated_resp, "data", None) or []
    if not updated_rows:
        raise HTTPException(status_code=500, detail="Could not update this booking.")

    write_audit_log(
        action=action,
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={"reason": payload.reason, "repeat_decline": is_repeat_decline} if payload.action == "decline" else {},
    )

    if payload.action == "accept":
        message = "Booking confirmed."
    elif is_repeat_decline:
        message = f"Booking declined and cancelled. Rs. {refund_amount:.0f} has been refunded to the customer's wallet."
    else:
        # Reassignment to another pandit is handled by admin as a
        # separate follow-up step, not automated here.
        message = "Booking declined. Admin will be notified to arrange another Pandit Ji for the customer."

    pandit_name = pandit.get("display_name") or pandit.get("name") or "Your Pandit Ji"
    if booking.get("client_id"):
        if payload.action == "accept":
            await notify_user(
                user_id=booking["client_id"],
                type="BOOKING_ACCEPTED",
                title="Booking confirmed",
                message=f"{pandit_name} has confirmed your booking.",
                link="/dashboard/bookings",
                metadata={"booking_id": booking_id},
            )
        elif is_repeat_decline:
            credit_wallet(
                user_id=booking["client_id"],
                amount=refund_amount,
                reason="booking_double_declined_refund",
                reference_type="booking",
                reference_id=booking_id,
            )
            await notify_user(
                user_id=booking["client_id"],
                type="BOOKING_DOUBLE_DECLINED",
                title="Booking cancelled",
                message=f"Unfortunately your Pandit Ji was unavailable again for your puja. Your payment of Rs. {refund_amount:.0f} has been refunded to your MyYajmaan wallet.",
                link="/dashboard/bookings",
                metadata={"booking_id": booking_id},
            )
        # First decline stays silent to the customer -- they keep seeing
        # "Awaiting Confirmation" until admin reassigns.

    if payload.action == "accept" and service_supabase is not None:
        # Records this as a real response (not just a decline) so a
        # pandit's full accept/decline history is queryable in one
        # place -- this is what breaks a consecutive-decline streak,
        # and what a durable "Declined" view relies on to tell a real
        # decline apart from a pandit who simply has no history yet.
        try:
            service_supabase.table("booking_assignment_events").insert(
                {
                    "booking_id": booking_id,
                    "previous_pandit_id": pandit["id"],
                    "action": "pandit_accepted",
                    "created_by": current_user["id"],
                }
            ).execute()
        except Exception:
            pass

    if payload.action == "decline" and service_supabase is not None:
        try:
            service_supabase.table("booking_assignment_events").insert(
                {
                    "booking_id": booking_id,
                    "previous_pandit_id": pandit["id"],
                    "action": "pandit_declined",
                    "note": payload.reason.strip(),
                    "created_by": current_user["id"],
                }
            ).execute()
            admins_resp = service_supabase.table("users").select("id").eq("role", "admin").execute()
            for admin_row in getattr(admins_resp, "data", None) or []:
                if is_repeat_decline:
                    await notify_user(
                        user_id=admin_row["id"],
                        type="BOOKING_DOUBLE_DECLINED",
                        title="Booking cancelled after second decline",
                        message=f"{pandit_name} declined a reassigned booking. It has been cancelled and the customer refunded automatically.",
                        link="/admin/bookings",
                        metadata={"booking_id": booking_id},
                    )
                else:
                    await notify_user(
                        user_id=admin_row["id"],
                        type="BOOKING_NEEDS_REASSIGNMENT",
                        title="Booking declined by Pandit Ji",
                        message=f"{pandit_name} declined a booking. It needs to be reassigned.",
                        link="/admin/bookings",
                        metadata={"booking_id": booking_id},
                    )
        except Exception:
            pass

    return {"message": message, "booking": updated_rows[0]}


@router.patch("/{booking_id}/complete")
async def mark_booking_completed(
    booking_id: str,
    current_user: dict = Depends(require_roles("pandit")),
):
    """Lets a pandit mark a confirmed booking as completed once the puja is actually done."""
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    resp = client.table("bookings").select("*").eq("id", booking_id).eq("pandit_id", pandit["id"]).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = rows[0]

    if booking.get("status") != "confirmed":
        raise HTTPException(status_code=400, detail="Only confirmed bookings can be marked completed.")

    updated_resp = (
        client.table("bookings")
        .update({"status": "completed"})
        .eq("id", booking_id)
        .select("*")
        .execute()
    )
    updated_rows = getattr(updated_resp, "data", None) or []

    write_audit_log(
        action="PANDIT_BOOKING_COMPLETED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={},
    )

    if booking.get("client_id"):
        pandit_name = pandit.get("display_name") or pandit.get("name") or "Your Pandit Ji"
        await notify_user(
            user_id=booking["client_id"],
            type="BOOKING_COMPLETED",
            title="Puja completed",
            message=f"Your puja with {pandit_name} is complete. Please leave your feedback.",
            link="/dashboard/bookings",
            metadata={"booking_id": booking_id},
        )

    # The Pandit Ji fee is not credited automatically -- admin releases it
    # from Wallet → Pandit Ji Earnings. Best-effort heads-up.
    try:
        pandit_name = pandit.get("display_name") or pandit.get("name") or "A Pandit Ji"
        fee = float(booking.get("pandit_fee_amount") or 0)
        admins_resp = client.table("users").select("id").eq("role", "admin").execute()
        for admin_row in getattr(admins_resp, "data", None) or []:
            await notify_user(
                user_id=admin_row["id"],
                type="PANDIT_EARNING_PENDING",
                title="Puja completed — Pandit Ji fee to release",
                message=f"{pandit_name} marked a puja as completed. Fee of Rs. {fee:.2f} is waiting to be released to their wallet.",
                link="/admin/wallet?tab=earnings",
                metadata={"booking_id": booking_id},
            )
    except Exception:
        logger.exception("Could not notify admins about completed booking %s", booking_id)

    # Generate both invoices now rather than waiting for the first
    # download -- best-effort, must never block the completion itself
    # that already succeeded. See invoicing.py for what each contains.
    final_booking = updated_rows[0] if updated_rows else booking
    if service_supabase is not None:
        try:
            pandit_name = pandit.get("display_name") or pandit.get("name") or "Pandit Ji"
            puja_title = _puja_title_for(client, final_booking)
            if final_booking.get("client_id"):
                customer_resp = client.table("users").select("full_name, phone").eq("id", final_booking["client_id"]).limit(1).execute()
                customer_rows = getattr(customer_resp, "data", None) or []
                customer_name = customer_rows[0].get("full_name") if customer_rows else "Customer"
                customer_phone = customer_rows[0].get("phone") if customer_rows else None
                get_or_create_invoice(
                    service_supabase,
                    booking=final_booking,
                    invoice_type="customer",
                    customer_name=customer_name or "Customer",
                    customer_phone=customer_phone,
                    pandit_name=pandit_name,
                    puja_title=puja_title,
                )
            get_or_create_invoice(
                service_supabase,
                booking=final_booking,
                invoice_type="pandit",
                pandit_name=pandit_name,
                pandit_phone=current_user.get("phone"),
                puja_title=puja_title,
            )
        except Exception:
            logger.exception("Could not generate invoices for booking %s", booking_id)

    return {"message": "Booking marked as completed.", "booking": final_booking}


@router.get("/{booking_id}/invoice")
async def download_my_payment_statement(
    booking_id: str,
    current_user: dict = Depends(require_roles("pandit")),
):
    """
    The Pandit Ji's own Payment Statement -- their fee for this specific
    booking, reflecting whichever price they were actually assigned at
    (see admin_bookings.py's reassign_booking() for how pandit_fee_amount
    tracks that through reassignment). Scoped to whichever pandit is
    *currently* on the booking -- only they were paid this amount.
    """
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    resp = client.table("bookings").select("*").eq("id", booking_id).eq("pandit_id", pandit["id"]).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = rows[0]
    if booking.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Your payment statement is available once this puja is marked completed.")

    pandit_name = pandit.get("display_name") or pandit.get("name") or "Pandit Ji"
    puja_title = _puja_title_for(client, booking)

    invoice_row = get_or_create_invoice(
        client,
        booking=booking,
        invoice_type="pandit",
        pandit_name=pandit_name,
        pandit_phone=current_user.get("phone"),
        puja_title=puja_title,
    )
    pdf_bytes = generate_invoice_pdf(invoice_row["snapshot"])
    filename = invoice_row["invoice_number"].replace("/", "-") + ".pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
