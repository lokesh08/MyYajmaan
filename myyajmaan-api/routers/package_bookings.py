"""
Package Puja bookings -- customer-facing half. Unlike a normal booking
(POST /bookings), a package booking is created with no Pandit Ji and no
amount: the Yajmaan submits a request, admin reviews it, calls them,
and sets a price (see routers/admin_package_bookings.py) before any
payment happens. Once paid and a Pandit Ji is assigned, the booking
becomes an ordinary status="pending_pandit" record and every other
part of the system (accept/decline/complete, reassignment, invoicing,
reviews, complaints) handles it completely unchanged -- confirmed none
of those routers branch on booking_type.

See the 20260915000000_package_pujas.sql migration for the schema, and
fancy-nibbling-peacock.md's plan for the full status lifecycle:
pending_review -> quoted -> paid_pending_assignment -> pending_pandit
(existing) -> ... (existing).
"""

import logging
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import api_error
from audit import write_audit_log
from db import service_supabase
from notifications import notify_user
from payment_verification import PaymentNotVerifiedError, consume_verified_payment
from permissions import require_roles

router = APIRouter(prefix="/package-bookings", tags=["package-bookings"])
logger = logging.getLogger(__name__)


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Booking service is not configured.")
    return service_supabase


def _get_own_package_booking_or_404(client, user_id: str, booking_id: str) -> dict:
    resp = (
        client.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("client_id", user_id)
        .eq("booking_type", "package")
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Package booking not found.")
    return rows[0]


async def _notify_admins(client, **kwargs):
    admins_resp = client.table("users").select("id").eq("role", "admin").execute()
    for admin_row in getattr(admins_resp, "data", None) or []:
        try:
            await notify_user(user_id=admin_row["id"], **kwargs)
        except Exception:
            logger.exception("Could not notify admin %s", admin_row["id"])


class PackageBookingIn(BaseModel):
    catalog_puja_id: str
    date: date_type
    timeslot: str
    contact_name: str = Field(min_length=1, max_length=200)
    contact_phone: str = Field(min_length=1, max_length=30)
    address_line: str = Field(min_length=1, max_length=500)
    address_city: str = Field(min_length=1, max_length=120)
    address_state: str = Field(min_length=1, max_length=120)
    address_pincode: str = Field(min_length=1, max_length=20)
    event_details: str = Field(min_length=1, max_length=3000)


@router.post("", status_code=201)
async def create_package_booking(
    payload: PackageBookingIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()

    puja_resp = client.table("pujas").select("id, title, puja_type").eq("id", payload.catalog_puja_id).limit(1).execute()
    puja_rows = getattr(puja_resp, "data", None) or []
    if not puja_rows:
        raise HTTPException(status_code=404, detail="Puja not found.")
    puja = puja_rows[0]
    if puja.get("puja_type") != "package":
        raise HTTPException(status_code=400, detail="This puja is not a package puja.")

    record = {
        "client_id": current_user["id"],
        "catalog_puja_id": payload.catalog_puja_id,
        "date": str(payload.date),
        "booking_date": str(payload.date),
        "timeslot": payload.timeslot,
        "muhurat_time_slot": payload.timeslot,
        "contact_name": payload.contact_name.strip(),
        "contact_phone": payload.contact_phone.strip(),
        "address_line": payload.address_line.strip(),
        "address_city": payload.address_city.strip(),
        "address_state": payload.address_state.strip(),
        "address_pincode": payload.address_pincode.strip(),
        "event_details": payload.event_details.strip(),
        "booking_type": "package",
        "status": "pending_review",
        "pandit_id": None,
        "amount": None,
    }
    resp = client.table("bookings").insert(record).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not submit this request. Please try again.")
    booking = rows[0]

    write_audit_log(
        action="PACKAGE_BOOKING_CREATED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking["id"],
        payload={"catalog_puja_id": payload.catalog_puja_id, "puja_title": puja.get("title"), "date": str(payload.date)},
    )

    customer_name = current_user.get("full_name") or "A customer"
    await _notify_admins(
        client,
        type="PACKAGE_BOOKING_CREATED",
        title="New package puja request",
        message=f"{customer_name} requested {puja.get('title')} for {payload.date}. Please review and share a quote.",
        link="/admin/package-pujas",
        metadata={"booking_id": booking["id"]},
    )

    return {"booking": booking}


@router.get("/mine")
async def list_my_package_bookings(
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    resp = (
        client.table("bookings")
        .select("*")
        .eq("client_id", current_user["id"])
        .eq("booking_type", "package")
        .order("created_at", desc=True)
        .execute()
    )
    rows = getattr(resp, "data", None) or []

    puja_ids = [row["catalog_puja_id"] for row in rows if row.get("catalog_puja_id")]
    pujas_by_id = {}
    if puja_ids:
        pujas_resp = client.table("pujas").select("id, title").in_("id", puja_ids).execute()
        pujas_by_id = {p["id"]: p for p in (getattr(pujas_resp, "data", None) or [])}
    for row in rows:
        row["puja_title"] = (pujas_by_id.get(row.get("catalog_puja_id")) or {}).get("title")

    return {"items": rows}


@router.post("/{booking_id}/cancel")
async def cancel_package_booking(
    booking_id: str,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    booking = _get_own_package_booking_or_404(client, current_user["id"], booking_id)
    if booking.get("status") not in ("pending_review", "quoted"):
        raise HTTPException(status_code=400, detail="This request can no longer be cancelled -- please contact support.")

    client.table("bookings").update({
        "status": "cancelled",
        "cancelled_by": current_user["id"],
        "cancelled_reason": "Withdrawn by the Yajmaan before payment.",
    }).eq("id", booking_id).execute()

    write_audit_log(
        action="PACKAGE_BOOKING_CANCELLED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={"cancelled_by": "customer"},
    )

    return {"message": "Your request has been cancelled."}


class ConfirmPaymentIn(BaseModel):
    payment_ref: str = Field(min_length=1, max_length=200)


@router.post("/{booking_id}/confirm-payment")
async def confirm_package_payment(
    booking_id: str,
    payload: ConfirmPaymentIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    booking = _get_own_package_booking_or_404(client, current_user["id"], booking_id)
    if booking.get("status") != "quoted":
        raise HTTPException(status_code=400, detail="This request isn't awaiting payment.")

    # The amount to check against is the admin's own quote already on
    # the booking (never client input), so this can only be marked paid
    # by a real, verified Razorpay payment for that exact amount.
    try:
        consume_verified_payment(
            user_id=current_user["id"],
            payment_id=payload.payment_ref,
            expected_amount=float(booking.get("amount") or 0),
            reference_type="package_booking",
            reference_id=booking_id,
        )
    except PaymentNotVerifiedError as exc:
        raise HTTPException(status_code=400, detail=api_error(exc.code, exc.message))

    resp = (
        client.table("bookings")
        .update({"status": "paid_pending_assignment", "payment_ref": payload.payment_ref.strip()})
        .eq("id", booking_id)
        .select("*")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not record this payment. Please try again.")

    write_audit_log(
        action="PACKAGE_BOOKING_PAID",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={"amount": booking.get("amount"), "payment_ref": payload.payment_ref},
    )

    customer_name = current_user.get("full_name") or "A customer"
    await _notify_admins(
        client,
        type="PACKAGE_BOOKING_PAID",
        title="Package puja payment received",
        message=f"{customer_name} has paid for their package puja. Please assign a Pandit Ji.",
        link="/admin/package-pujas",
        metadata={"booking_id": booking_id},
    )

    return {"booking": rows[0]}
