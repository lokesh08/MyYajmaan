"""
Package Puja bookings -- admin-facing half. See package_bookings.py for
the customer-facing half and the 20260915000000_package_pujas.sql
migration for the schema.

Deliberately its own router/section (not folded into admin_bookings.py)
per your ask for a separate, transparent place to handle these -- the
early lifecycle here (review -> quote -> wait for payment -> assign a
Pandit Ji) has no equivalent in the normal booking flow. Once a Pandit
Ji is assigned, the booking becomes an ordinary status="pending_pandit"
record and shows up in the regular Admin > Bookings list too (nothing
here excludes it) -- same booking, just past the package-specific part
of its life.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import sanitize_or_filter_term, service_supabase
from notifications import notify_user
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/package-bookings", tags=["admin-package-bookings"])

# The package-specific portion of the lifecycle -- once a Pandit Ji is
# assigned, status becomes the existing "pending_pandit" and this
# section's job for that booking is basically done.
STATUS_VALUES = ("pending_review", "quoted", "paid_pending_assignment")


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin package booking service is not configured.")
    return service_supabase


def _apply_search(query, search: Optional[str]):
    if not search:
        return query
    term = sanitize_or_filter_term(search.strip().replace("%", ""))
    if not term:
        return query
    return query.or_(f"contact_name.ilike.%{term}%,contact_phone.ilike.%{term}%,event_details.ilike.%{term}%")


def _attach_details(client, rows: list) -> list:
    client_ids = [row["client_id"] for row in rows if row.get("client_id")]
    puja_ids = [row["catalog_puja_id"] for row in rows if row.get("catalog_puja_id")]

    users_by_id = {}
    if client_ids:
        users_resp = client.table("users").select("id, full_name, email, phone").in_("id", client_ids).execute()
        users_by_id = {row["id"]: row for row in (getattr(users_resp, "data", None) or [])}

    pujas_by_id = {}
    if puja_ids:
        pujas_resp = client.table("pujas").select("id, title").in_("id", puja_ids).execute()
        pujas_by_id = {row["id"]: row for row in (getattr(pujas_resp, "data", None) or [])}

    for row in rows:
        row["customer"] = users_by_id.get(row.get("client_id"))
        row["puja"] = pujas_by_id.get(row.get("catalog_puja_id"))
    return rows


@router.get("/counts")
async def get_package_booking_status_counts(
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    counts = {}
    for tab in ("all",) + STATUS_VALUES:
        query = client.table("bookings").select("id", count="exact").eq("booking_type", "package")
        query = _apply_search(query, search)
        if tab != "all":
            query = query.eq("status", tab)
        else:
            # "All" here still means "still in the package-specific
            # part of its life" -- once a Pandit Ji is assigned it
            # belongs to the regular Admin > Bookings list instead.
            query = query.in_("status", list(STATUS_VALUES))
        resp = query.execute()
        counts[tab] = getattr(resp, "count", None) or 0
    return counts


@router.get("")
async def list_package_bookings(
    status_filter: str = Query(default="all", alias="status"),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if status_filter not in ("all",) + STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status filter.")

    client = _client()
    query = client.table("bookings").select("*", count="exact").eq("booking_type", "package")
    query = _apply_search(query, search)
    if status_filter != "all":
        query = query.eq("status", status_filter)
    else:
        query = query.in_("status", list(STATUS_VALUES))

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    _attach_details(client, rows)

    return {
        "items": rows,
        "total": getattr(resp, "count", None) or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{booking_id}")
async def get_package_booking_detail(
    booking_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("bookings").select("*").eq("id", booking_id).eq("booking_type", "package").limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Package booking not found.")
    booking = rows[0]
    _attach_details(client, [booking])

    if booking.get("quoted_by"):
        quoted_by_resp = client.table("users").select("full_name").eq("id", booking["quoted_by"]).limit(1).execute()
        quoted_by_rows = getattr(quoted_by_resp, "data", None) or []
        booking["quoted_by_name"] = quoted_by_rows[0].get("full_name") if quoted_by_rows else None

    history_resp = (
        client.table("booking_assignment_events")
        .select("*")
        .eq("booking_id", booking_id)
        .order("created_at")
        .execute()
    )
    history = getattr(history_resp, "data", None) or []
    pandit_ids = [row["assigned_pandit_id"] for row in history if row.get("assigned_pandit_id")]
    if pandit_ids:
        pandits_resp = client.table("pandits").select("id, display_name, name").in_("id", pandit_ids).execute()
        pandits_by_id = {p["id"]: p for p in (getattr(pandits_resp, "data", None) or [])}
        for row in history:
            pandit = pandits_by_id.get(row.get("assigned_pandit_id"))
            row["assigned_pandit_name"] = (pandit.get("display_name") or pandit.get("name")) if pandit else None
    booking["assignment_history"] = history

    return {"booking": booking}


class QuoteIn(BaseModel):
    amount: float = Field(gt=0)
    note: Optional[str] = Field(default=None, max_length=1000)


@router.post("/{booking_id}/quote")
async def quote_package_booking(
    booking_id: str,
    payload: QuoteIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    existing_resp = client.table("bookings").select("id, status, client_id, catalog_puja_id").eq("id", booking_id).eq("booking_type", "package").limit(1).execute()
    existing_rows = getattr(existing_resp, "data", None) or []
    if not existing_rows:
        raise HTTPException(status_code=404, detail="Package booking not found.")
    booking = existing_rows[0]
    if booking.get("status") != "pending_review":
        raise HTTPException(status_code=400, detail="A quote can only be shared while this request is Pending Review.")

    # payload.note is deliberately not persisted to a column -- it's
    # context for the customer's notification only, and still fully
    # traceable afterward via the audit log entry written just below
    # (the admin detail modal's "quote history" reads from there).
    now = datetime.now(timezone.utc).isoformat()
    resp = (
        client.table("bookings")
        .update({
            "quoted_price": payload.amount,
            "amount": payload.amount,
            "quoted_at": now,
            "quoted_by": current_user["id"],
            "status": "quoted",
        })
        .eq("id", booking_id)
        .select("*")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not save this quote.")

    write_audit_log(
        action="PACKAGE_BOOKING_QUOTED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={"amount": payload.amount, "note": payload.note},
    )

    if booking.get("client_id"):
        note_suffix = f" Note from our team: {payload.note.strip()}" if payload.note and payload.note.strip() else ""
        await notify_user(
            user_id=booking["client_id"],
            type="PACKAGE_BOOKING_QUOTED",
            title="Your package puja quote is ready",
            message=f"Your quote is Rs. {payload.amount:.2f}. Please complete payment in your Package Requests to confirm your booking.{note_suffix}",
            link="/dashboard/bookings?tab=package",
            metadata={"booking_id": booking_id},
        )

    return {"booking": rows[0]}


class AssignPanditIn(BaseModel):
    pandit_id: str


@router.post("/{booking_id}/assign-pandit")
async def assign_pandit_to_package_booking(
    booking_id: str,
    payload: AssignPanditIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    existing_resp = client.table("bookings").select("*").eq("id", booking_id).eq("booking_type", "package").limit(1).execute()
    existing_rows = getattr(existing_resp, "data", None) or []
    if not existing_rows:
        raise HTTPException(status_code=404, detail="Package booking not found.")
    booking = existing_rows[0]
    if booking.get("status") != "paid_pending_assignment":
        raise HTTPException(status_code=400, detail="A Pandit Ji can only be assigned after payment is received.")

    pandit_resp = client.table("pandits").select("id, user_id, display_name, name, is_active, verification_status").eq("id", payload.pandit_id).limit(1).execute()
    pandit_rows = getattr(pandit_resp, "data", None) or []
    if not pandit_rows or not pandit_rows[0].get("is_active") or pandit_rows[0].get("verification_status") != "approved":
        raise HTTPException(status_code=400, detail="Choose an approved, active Pandit Ji.")
    pandit = pandit_rows[0]
    if not pandit.get("user_id"):
        # A pandit profile without a linked portal account can never log in
        # to accept/decline -- this is a "catalog only" listing, not a real
        # pandit account. Silently assigning them would leave the booking
        # stuck with nobody able to act on it.
        raise HTTPException(status_code=400, detail="This Pandit Ji does not have a portal login yet, so they cannot receive booking assignments. Choose a Pandit Ji who has completed portal registration.")

    amount = float(booking.get("amount") or 0)
    resp = (
        client.table("bookings")
        .update({
            "pandit_id": payload.pandit_id,
            "status": "pending_pandit",
            "original_pandit_fee_amount": amount,
            "pandit_fee_amount": amount,
        })
        .eq("id", booking_id)
        .select("*")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not assign this Pandit Ji.")

    client.table("booking_assignment_events").insert({
        "booking_id": booking_id,
        "assigned_pandit_id": payload.pandit_id,
        "action": "admin_assigned",
        "assigned_price": amount,
        "created_by": current_user["id"],
    }).execute()

    write_audit_log(
        action="PACKAGE_BOOKING_PANDIT_ASSIGNED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={"pandit_id": payload.pandit_id, "amount": amount},
    )

    pandit_name = pandit.get("display_name") or pandit.get("name") or "a new Pandit Ji"
    if booking.get("client_id"):
        await notify_user(
            user_id=booking["client_id"],
            type="PACKAGE_BOOKING_PANDIT_ASSIGNED",
            title="Pandit Ji assigned to your package puja",
            message=f"{pandit_name} has been assigned to your puja and is awaiting confirmation.",
            link="/dashboard/bookings",
            metadata={"booking_id": booking_id},
        )
    if pandit.get("user_id"):
        await notify_user(
            user_id=pandit["user_id"],
            type="BOOKING_ASSIGNED_BY_ADMIN",
            title="Booking assigned",
            message="You have been assigned a new booking. Please accept or decline.",
            link="/pandit/bookings",
            metadata={"booking_id": booking_id},
        )

    return {"booking": rows[0]}


class CancelPackageBookingIn(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


@router.post("/{booking_id}/cancel")
async def cancel_package_booking_admin(
    booking_id: str,
    payload: CancelPackageBookingIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    existing_resp = client.table("bookings").select("id, status, client_id").eq("id", booking_id).eq("booking_type", "package").limit(1).execute()
    existing_rows = getattr(existing_resp, "data", None) or []
    if not existing_rows:
        raise HTTPException(status_code=404, detail="Package booking not found.")
    booking = existing_rows[0]
    if booking.get("status") not in STATUS_VALUES:
        raise HTTPException(status_code=400, detail="This request is already past the point where it can be cancelled here.")

    client.table("bookings").update({
        "status": "cancelled",
        "cancelled_by": current_user["id"],
        "cancelled_reason": payload.reason.strip(),
    }).eq("id", booking_id).execute()

    write_audit_log(
        action="PACKAGE_BOOKING_CANCELLED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={"cancelled_by": "admin", "reason": payload.reason},
    )

    if booking.get("client_id"):
        await notify_user(
            user_id=booking["client_id"],
            type="PACKAGE_BOOKING_CANCELLED",
            title="Your package puja request was cancelled",
            message=f"Reason: {payload.reason.strip()}",
            link="/dashboard/bookings?tab=package",
            metadata={"booking_id": booking_id},
        )

    return {"message": "Request cancelled."}
