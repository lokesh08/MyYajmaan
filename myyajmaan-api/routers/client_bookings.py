import io
from datetime import date as date_cls, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import convert_record_image_fields, service_supabase
from invoicing import generate_invoice_pdf, get_or_create_invoice
from notifications import notify_user
from permissions import require_roles
from wallet import credit_wallet, debit_wallet

router = APIRouter(prefix="/me/bookings", tags=["client-bookings"])

# Same placeholder used by pandits.py/admin_pandits.py for every other
# pandit-facing photo in the app -- a bundled frontend asset (not a
# Supabase Storage key), so it's used as-is, never run through
# convert_record_image_fields().
PANDIT_PLACEHOLDER_IMAGE = "/images/panditPlaceholder.png"

TAB_STATUSES = {
    "upcoming": ["pending_pandit", "declined", "confirmed"],
    "completed": ["completed"],
    "cancelled": ["cancelled"],
}

RESCHEDULE_FEE = 500.0
CANCELLATION_FEE = 500.0
CUTOFF_HOURS = 6


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Booking service is not configured.")
    return service_supabase


def _attach_pandit_info(client, rows: list):
    pandit_ids = [row["pandit_id"] for row in rows if row.get("pandit_id")]
    if not pandit_ids:
        return rows

    resp = (
        client.table("pandits")
        .select("id, display_name, name, avatar_url, city")
        .in_("id", pandit_ids)
        .execute()
    )
    pandits_by_id = {p["id"]: p for p in (getattr(resp, "data", None) or [])}

    for row in rows:
        pandit = pandits_by_id.get(row.get("pandit_id")) or {}
        row["pandit_name"] = pandit.get("display_name") or pandit.get("name")
        # avatar_url is a raw Supabase Storage key (e.g. "pandits/xyz.jpg"),
        # not a usable <img src> on its own -- has to go through
        # get_public_url_for_key() first (same as every other pandit
        # photo in the app, see pandits.py). Falls back to the shared
        # placeholder when the pandit hasn't uploaded one at all.
        record = {"avatar_url": pandit.get("avatar_url") or PANDIT_PLACEHOLDER_IMAGE}
        convert_record_image_fields(record, fields=["avatar_url"])
        row["pandit_avatar"] = record["avatar_url"]
        row["pandit_city"] = pandit.get("city")

    return rows


def _attach_rich_pandit_info(client, booking: dict):
    """
    The full Pandit Ji profile card -- only worth resolving once the
    currently-assigned pandit has actually accepted (status is neither
    pending_pandit nor declined). Before that, the assigned pandit could
    still be reassigned away, so we deliberately don't reveal their
    contact info/bio yet -- see get_booking_detail()'s
    `pandit_details_available` flag.
    """
    booking["pandit_details_available"] = booking.get("status") not in ("pending_pandit", "declined")
    if not booking["pandit_details_available"] or not booking.get("pandit_id"):
        return booking

    resp = (
        client.table("pandits")
        .select("id, user_id, display_name, name, avatar_url, city, about, bio, experience_years, languages_spoken, rating_avg")
        .eq("id", booking["pandit_id"])
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    pandit = rows[0] if rows else {}

    pandit_phone = None
    if pandit.get("user_id"):
        user_resp = client.table("users").select("phone").eq("id", pandit["user_id"]).limit(1).execute()
        user_rows = getattr(user_resp, "data", None) or []
        pandit_phone = user_rows[0].get("phone") if user_rows else None

    avatar_record = {"avatar_url": pandit.get("avatar_url") or PANDIT_PLACEHOLDER_IMAGE}
    convert_record_image_fields(avatar_record, fields=["avatar_url"])

    booking["pandit_name"] = pandit.get("display_name") or pandit.get("name")
    booking["pandit_avatar"] = avatar_record["avatar_url"]
    booking["pandit_city"] = pandit.get("city")
    booking["pandit_about"] = pandit.get("about") or pandit.get("bio")
    booking["pandit_experience_years"] = pandit.get("experience_years")
    booking["pandit_languages"] = pandit.get("languages_spoken")
    booking["pandit_rating"] = pandit.get("rating_avg")
    booking["pandit_phone"] = pandit_phone
    return booking


async def _notify_pandit_of_booking_change(client, booking: dict, notif_type: str, title: str, message: str):
    """Best-effort: never let a notification failure break a cancel/reschedule that already succeeded."""
    if not booking.get("pandit_id"):
        return
    try:
        pandit_resp = client.table("pandits").select("user_id").eq("id", booking["pandit_id"]).limit(1).execute()
        pandit_rows = getattr(pandit_resp, "data", None) or []
        if pandit_rows and pandit_rows[0].get("user_id"):
            await notify_user(
                user_id=pandit_rows[0]["user_id"],
                type=notif_type,
                title=title,
                message=message,
                link="/pandit/bookings",
                metadata={"booking_id": booking.get("id")},
            )
    except Exception:
        pass


def _get_own_booking_or_404(client, user_id: str, booking_id: str) -> dict:
    resp = (
        client.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("client_id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return rows[0]


def _event_datetime(booking: dict) -> Optional[datetime]:
    """
    Best-effort combination of booking_date + muhurat_time_slot into a
    real datetime for the 6-hour cutoff checks. Timeslots are free text
    today (e.g. "10:00 AM"), not a structured type, so a slot that
    doesn't parse falls back to midnight on the booking date rather
    than blocking the whole reschedule/cancel flow.
    """

    raw_date = booking.get("booking_date") or booking.get("date")
    if not raw_date:
        return None

    if isinstance(raw_date, date_cls):
        booking_date = raw_date
    else:
        try:
            booking_date = datetime.strptime(str(raw_date), "%Y-%m-%d").date()
        except ValueError:
            return None

    slot_text = (booking.get("muhurat_time_slot") or booking.get("timeslot") or "").strip()
    for fmt in ("%I:%M %p", "%I %p", "%H:%M"):
        try:
            slot_time = datetime.strptime(slot_text, fmt).time()
            return datetime.combine(booking_date, slot_time, tzinfo=timezone.utc)
        except ValueError:
            continue

    return datetime.combine(booking_date, datetime.min.time(), tzinfo=timezone.utc)


def _hours_until_event(booking: dict) -> Optional[float]:
    event_dt = _event_datetime(booking)
    if event_dt is None:
        return None
    return (event_dt - datetime.now(timezone.utc)).total_seconds() / 3600


@router.get("")
async def list_my_bookings(
    tab: str = Query(default="upcoming"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_roles("user")),
):
    if tab not in TAB_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid tab. Use upcoming, completed, or cancelled.")

    client = _client()
    query = (
        client.table("bookings")
        .select("*", count="exact")
        .eq("client_id", current_user["id"])
        .in_("status", TAB_STATUSES[tab])
    )

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("booking_date", desc=(tab != "upcoming")).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0
    _attach_pandit_info(client, rows)

    if tab == "completed" and rows:
        booking_ids = [row["id"] for row in rows]
        reviews_resp = client.table("reviews").select("booking_id").in_("booking_id", booking_ids).execute()
        reviewed_ids = {r["booking_id"] for r in (getattr(reviews_resp, "data", None) or [])}
        for row in rows:
            row["has_review"] = row["id"] in reviewed_ids

    # Surface whether reschedule/cancel are currently allowed so the
    # frontend doesn't have to duplicate the 6-hour cutoff logic.
    for row in rows:
        hours_left = _hours_until_event(row)
        row["hours_until_event"] = hours_left
        row["can_reschedule"] = row["status"] in ("pending_pandit", "confirmed") and (
            hours_left is None or hours_left > CUTOFF_HOURS
        )
        row["can_cancel"] = row["status"] in ("pending_pandit", "confirmed")

    return {"items": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/counts")
async def get_booking_tab_counts(current_user: dict = Depends(require_roles("user"))):
    client = _client()
    counts = {}
    for tab, statuses in TAB_STATUSES.items():
        resp = (
            client.table("bookings")
            .select("id", count="exact")
            .eq("client_id", current_user["id"])
            .in_("status", statuses)
            .execute()
        )
        counts[tab] = getattr(resp, "count", None) or 0
    return counts


@router.get("/{booking_id}")
async def get_booking_detail(
    booking_id: str,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    booking = _get_own_booking_or_404(client, current_user["id"], booking_id)
    _attach_rich_pandit_info(client, booking)
    booking["puja_title"] = _puja_title_for(client, booking)
    hours_left = _hours_until_event(booking)
    booking["hours_until_event"] = hours_left
    booking["can_reschedule"] = booking["status"] in ("pending_pandit", "confirmed") and (
        hours_left is None or hours_left > CUTOFF_HOURS
    )
    booking["can_cancel"] = booking["status"] in ("pending_pandit", "confirmed")
    return {"booking": booking}


def _puja_title_for(client, booking: dict) -> str:
    if booking.get("catalog_puja_id"):
        resp = client.table("pujas").select("title").eq("id", booking["catalog_puja_id"]).limit(1).execute()
        rows = getattr(resp, "data", None) or []
        if rows and rows[0].get("title"):
            return rows[0]["title"]
    return (booking.get("notes") or "").removeprefix("Puja: ").strip() or "Puja"


@router.get("/{booking_id}/invoice")
async def download_my_invoice(
    booking_id: str,
    current_user: dict = Depends(require_roles("user")),
):
    """
    The customer's GST tax invoice -- only available once the Pandit Ji
    has marked the puja completed (mark_booking_completed() generates it
    at that point already; this lazily generates it too, so an older
    completed booking from before this feature shipped still works).
    """
    client = _client()
    booking = _get_own_booking_or_404(client, current_user["id"], booking_id)
    if booking.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Invoice is available once this puja is marked completed.")

    _attach_pandit_info(client, [booking])
    puja_title = _puja_title_for(client, booking)

    invoice_row = get_or_create_invoice(
        client,
        booking=booking,
        invoice_type="customer",
        customer_name=current_user.get("full_name") or "Customer",
        customer_phone=current_user.get("phone"),
        pandit_name=booking.get("pandit_name") or "Pandit Ji",
        puja_title=puja_title,
    )
    pdf_bytes = generate_invoice_pdf(invoice_row["snapshot"])
    filename = invoice_row["invoice_number"].replace("/", "-") + ".pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


class RescheduleIn(BaseModel):
    date: date_cls
    timeslot: str = Field(min_length=1, max_length=50)


@router.patch("/{booking_id}/reschedule")
async def reschedule_booking(
    booking_id: str,
    payload: RescheduleIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    booking = _get_own_booking_or_404(client, current_user["id"], booking_id)

    if booking.get("status") not in ("pending_pandit", "confirmed"):
        raise HTTPException(status_code=400, detail="Only upcoming bookings can be rescheduled.")

    hours_left = _hours_until_event(booking)
    if hours_left is not None and hours_left <= CUTOFF_HOURS:
        raise HTTPException(
            status_code=400,
            detail=f"Reschedule is only allowed more than {CUTOFF_HOURS} hours before your scheduled puja.",
        )

    if payload.date < datetime.now(timezone.utc).date():
        raise HTTPException(status_code=400, detail="Please choose a future date.")

    new_balance = debit_wallet(
        user_id=current_user["id"],
        amount=RESCHEDULE_FEE,
        reason="booking_reschedule_fee",
        reference_type="booking",
        reference_id=booking_id,
    )
    if new_balance is None:
        raise HTTPException(
            status_code=400,
            detail=f"Rescheduling costs Rs. {RESCHEDULE_FEE:.0f}. Please add money to your wallet and try again.",
        )

    new_date_str = str(payload.date)
    columns = {
        "booking_date": new_date_str,
        "date": new_date_str,
        "muhurat_time_slot": payload.timeslot,
        "timeslot": payload.timeslot,
        "status": "pending_pandit",  # the assigned Pandit Ji needs to reconfirm the new slot
        "reschedule_fee_charged": float(booking.get("reschedule_fee_charged") or 0) + RESCHEDULE_FEE,
        "rescheduled_at": datetime.now(timezone.utc).isoformat(),
    }
    # Only remember the very first original date/slot, so repeated
    # reschedules don't overwrite what the customer originally booked.
    if not booking.get("original_booking_date"):
        columns["original_booking_date"] = booking.get("booking_date") or booking.get("date")
        columns["original_muhurat_time_slot"] = booking.get("muhurat_time_slot") or booking.get("timeslot")

    resp = client.table("bookings").update(columns).eq("id", booking_id).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not reschedule this booking.")

    write_audit_log(
        action="CLIENT_BOOKING_RESCHEDULED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={
            "old_date": str(booking.get("booking_date") or booking.get("date")),
            "old_timeslot": booking.get("muhurat_time_slot") or booking.get("timeslot"),
            "new_date": new_date_str,
            "new_timeslot": payload.timeslot,
            "fee_charged": RESCHEDULE_FEE,
        },
    )

    await _notify_pandit_of_booking_change(
        client,
        booking,
        "BOOKING_RESCHEDULED",
        "Booking rescheduled",
        f"A customer rescheduled their booking to {new_date_str}. Please reconfirm.",
    )

    return {
        "message": f"Booking rescheduled. Rs. {RESCHEDULE_FEE:.0f} was deducted from your wallet.",
        "booking": rows[0],
    }


class CancelIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.patch("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    payload: CancelIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    booking = _get_own_booking_or_404(client, current_user["id"], booking_id)

    if booking.get("status") not in ("pending_pandit", "confirmed"):
        raise HTTPException(status_code=400, detail="Only upcoming bookings can be cancelled.")

    hours_left = _hours_until_event(booking)
    amount = float(booking.get("amount") or 0)

    within_cutoff = hours_left is not None and hours_left <= CUTOFF_HOURS
    if within_cutoff:
        fee = amount
        refund = 0.0
    else:
        fee = min(CANCELLATION_FEE, amount)
        refund = round(amount - fee, 2)

    columns = {
        "status": "cancelled",
        "cancelled_by": current_user["id"],
        "cancelled_reason": (payload.reason or "").strip() or None,
        "cancellation_fee": fee,
        "refund_amount": refund,
    }

    resp = client.table("bookings").update(columns).eq("id", booking_id).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not cancel this booking.")

    if refund > 0:
        credit_wallet(
            user_id=current_user["id"],
            amount=refund,
            reason="booking_cancellation_refund",
            reference_type="booking",
            reference_id=booking_id,
        )

    write_audit_log(
        action="CLIENT_BOOKING_CANCELLED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={
            "amount": amount,
            "fee": fee,
            "refund": refund,
            "within_cutoff": within_cutoff,
            "reason": payload.reason,
        },
    )

    message = (
        "Booking cancelled. As it was within 6 hours of the scheduled puja, no refund applies."
        if within_cutoff
        else f"Booking cancelled. Rs. {refund:.2f} has been refunded to your wallet."
    )

    await _notify_pandit_of_booking_change(
        client,
        booking,
        "BOOKING_CANCELLED",
        "Booking cancelled",
        "A customer cancelled their upcoming booking with you.",
    )

    return {"message": message, "booking": rows[0]}
