import logging

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any
from auth import api_error, get_bearer_token
from db import create_supabase_client_for_key, service_supabase, SUPABASE_ANON_KEY
from models import BookingIn, BookingOut
from notifications import notify_user
from payment_verification import (
    PaymentNotVerifiedError,
    attach_consumed_reference,
    consume_verified_payment,
    release_consumed_payment,
)
from permissions import require_roles
from wallet import credit_wallet, get_active_coupon_amount

router = APIRouter(prefix="/bookings", tags=["bookings"])
logger = logging.getLogger(__name__)


def _client_for_token(token: str):
    # Use user token if available, otherwise fall back to anon key
    key = token or SUPABASE_ANON_KEY
    if not key:
        raise RuntimeError("No token or anon key available for Supabase client")
    return create_supabase_client_for_key(key)


def _extract_data_or_raise(resp: Any, single: bool = False):
    """Normalize postgrest response: raise on HTTP errors, return data (list or single)."""
    status = getattr(resp, "status_code", None)
    data = getattr(resp, "data", None)
    raw = getattr(resp, "raw", None)

    if status is not None and status >= 400:
        if status == 404:
            raise HTTPException(status_code=404, detail="Not found")
        detail = data or raw or f"PostgREST returned status {status}"
        raise HTTPException(status_code=500, detail=str(detail))

    if single:
        if not data:
            raise HTTPException(status_code=404, detail="Not found")
        return data
    return data or []


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingIn,
    user: dict = Depends(require_roles("user")),
    token: str = Depends(get_bearer_token),
):
    supabase = _client_for_token(token)

    # A booking must be backed by a real, verified payment for exactly
    # this amount -- not just whatever payment_ref/amount the client
    # happens to send. See payment_verification.py: this only succeeds
    # for a payment this server itself created and verified via
    # Razorpay, belonging to this user, unspent, and matching the
    # claimed amount (within a small rounding tolerance). Skipped for a
    # free (₹0) booking, e.g. a fully coupon-covered puja.
    if payload.amount and payload.amount > 0:
        try:
            consume_verified_payment(
                user_id=user["id"],
                payment_id=payload.payment_ref,
                expected_amount=payload.amount,
                reference_type="booking",
            )
        except PaymentNotVerifiedError as exc:
            raise HTTPException(status_code=400, detail=api_error(exc.code, exc.message))

    # Checked before inserting: whether this booking is the user's
    # first ever, which is what triggers the referral "first booking"
    # reward for whoever referred them.
    is_first_booking = False
    if service_supabase is not None:
        try:
            prior_resp = (
                service_supabase
                .table("bookings")
                .select("id", count="exact")
                .eq("client_id", user["id"])
                .execute()
            )
            is_first_booking = (getattr(prior_resp, "count", None) or 0) == 0
        except Exception:
            logger.exception("Could not check prior booking count for user %s", user["id"])

    record = {
        "client_id": user["id"],
        "pandit_id": payload.pandit_id,
        "catalog_puja_id": payload.catalog_puja_id,
        "puja_id": payload.puja_id,
        "package_id": payload.package_id,
        "date": str(payload.date),
        "booking_date": str(payload.date),
        "timeslot": str(payload.timeslot),
        "muhurat_time_slot": str(payload.timeslot),
        "amount": payload.amount,
        "payment_ref": payload.payment_ref,
        "coupon_id": payload.coupon_id,
        "coupon_discount": payload.coupon_discount or 0,
        "notes": payload.notes,
        "address_id": payload.address_id,
        "contact_name": payload.contact_name,
        "contact_phone": payload.contact_phone,
        "address_line": payload.address_line,
        "address_city": payload.address_city,
        "address_state": payload.address_state,
        "address_pincode": payload.address_pincode,
        "special_instructions": payload.special_instructions,
        "payment_method": payload.payment_method,
        "package_tier": payload.package_tier,
        "premium_fee": payload.premium_fee or 0,
        "gst_amount": payload.gst_amount or 0,
        "platform_fee": payload.platform_fee or 0,
        # Original and current Pandit Ji fee both start equal at booking
        # time. `original_pandit_fee_amount` never changes afterward (the
        # customer's invoice always uses it); `pandit_fee_amount` is
        # updated on reassignment (see admin_bookings.py) to track
        # whichever pandit is actually owed the money.
        "original_pandit_fee_amount": payload.pandit_fee_amount,
        "pandit_fee_amount": payload.pandit_fee_amount,
        # Awaiting the assigned Pandit Ji's accept/decline response
        # (Pandit Ji Portal -> Manage Bookings) rather than
        # auto-confirming.
        "status": "pending_pandit",
    }
    # Inserted with the service client, like the rest of the customer
    # routes (client_bookings.py): the customer is already authenticated
    # by require_roles() and client_id comes from that server-side
    # profile, never from the request. Going through the user's own
    # token made this depend on bookings' RLS policy resolving
    # users.auth_uid, which Supabase Cloud's default RLS on `users` can
    # silently break -- failing the insert *after* the payment was spent.
    writer = service_supabase if service_supabase is not None else supabase
    try:
        resp = writer.table("bookings").insert(record).execute()
        data = _extract_data_or_raise(resp, single=False)
        if not data:
            raise HTTPException(status_code=500, detail=api_error("BOOKING_CREATE_FAILED", "Your booking could not be saved."))
    except Exception:
        logger.exception("Booking insert failed for user %s, payment %s", user["id"], payload.payment_ref)
        # The payment was consumed above; hand it back so the customer
        # can retry with it rather than having paid for nothing.
        if payload.amount and payload.amount > 0:
            release_consumed_payment(payload.payment_ref)
        raise

    created_booking = data[0]

    if service_supabase is not None:
        try:
            service_supabase.table("booking_assignment_events").insert(
                {
                    "booking_id": created_booking["id"],
                    "assigned_pandit_id": payload.pandit_id,
                    "action": "created",
                    # The Pandit Ji's own fee, not the full payable total
                    # (payload.amount includes GST/platform/premium fees
                    # on top) -- assigned_price must stay in the same
                    # units reassign_booking() later compares it against.
                    "assigned_price": payload.pandit_fee_amount,
                    "created_by": user["id"],
                }
            ).execute()
        except Exception:
            logger.exception("Could not record initial assignment for booking %s", created_booking["id"])

    # Records coupon redemption so admin's usage counts are accurate
    # (previously nothing ever wrote to coupon_usages). Best-effort —
    # must not fail the booking that already succeeded.
    if payload.coupon_id and service_supabase is not None:
        try:
            service_supabase.table("coupon_usages").insert(
                {
                    "coupon_id": payload.coupon_id,
                    "user_id": user["id"],
                    "booking_id": created_booking.get("id"),
                    "discount_applied": payload.coupon_discount or 0,
                }
            ).execute()
        except Exception:
            logger.exception("Could not record coupon usage for booking %s", created_booking.get("id"))

    # Referral "first booking" reward for whoever referred this user.
    if is_first_booking and service_supabase is not None:
        try:
            user_resp = (
                service_supabase
                .table("users")
                .select("referred_by, referral_first_booking_rewarded")
                .eq("id", user["id"])
                .single()
                .execute()
            )
            user_row = getattr(user_resp, "data", None) or {}
            referred_by = user_row.get("referred_by")
            already_rewarded = user_row.get("referral_first_booking_rewarded")

            if referred_by and not already_rewarded:
                reward_amount = get_active_coupon_amount("referral_booking")
                if reward_amount:
                    credit_wallet(
                        user_id=referred_by,
                        amount=reward_amount,
                        reason="referral_first_booking",
                        reference_type="booking",
                        reference_id=created_booking.get("id"),
                    )
                    service_supabase.table("users").update(
                        {"referral_first_booking_rewarded": True}
                    ).eq("id", user["id"]).execute()
        except Exception:
            logger.exception("Could not process referral first-booking reward for user %s", user["id"])

    # Notify the assigned Pandit Ji and every admin -- best-effort,
    # must never fail a booking that already succeeded.
    if service_supabase is not None:
        try:
            customer_name = user.get("full_name") or "A customer"

            pandit_resp = (
                service_supabase.table("pandits")
                .select("user_id, display_name, name")
                .eq("id", payload.pandit_id)
                .limit(1)
                .execute()
            )
            pandit_rows = getattr(pandit_resp, "data", None) or []
            if pandit_rows and pandit_rows[0].get("user_id"):
                pandit_name = pandit_rows[0].get("display_name") or pandit_rows[0].get("name") or "Pandit Ji"
                await notify_user(
                    user_id=pandit_rows[0]["user_id"],
                    type="BOOKING_RECEIVED",
                    title="New booking request",
                    message=f"{customer_name} has requested a booking with you on {payload.date}.",
                    link="/pandit/bookings",
                    metadata={"booking_id": created_booking.get("id")},
                )

            admins_resp = service_supabase.table("users").select("id").eq("role", "admin").execute()
            for admin_row in getattr(admins_resp, "data", None) or []:
                pandit_name = (pandit_rows[0].get("display_name") or pandit_rows[0].get("name")) if pandit_rows else "a Pandit Ji"
                await notify_user(
                    user_id=admin_row["id"],
                    type="BOOKING_CREATED",
                    title="New puja booking",
                    message=f"{customer_name} booked {pandit_name} for {payload.date}.",
                    link="/admin/wallet",
                    metadata={"booking_id": created_booking.get("id")},
                )
        except Exception:
            logger.exception("Could not send booking-created notifications for booking %s", created_booking.get("id"))

    return data[0]


@router.get("/me", response_model=List[BookingOut])
async def list_my_bookings(
    user: dict = Depends(require_roles("user")), token: str = Depends(get_bearer_token)
):
    supabase = _client_for_token(token)
    resp = (
        supabase.table("bookings")
        .select("*")
        .eq("client_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return _extract_data_or_raise(resp, single=False)


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: str, user: dict = Depends(require_roles("user")), token: str = Depends(get_bearer_token)
):
    supabase = _client_for_token(token)

    get_resp = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    get_data = _extract_data_or_raise(get_resp, single=True)

    # Bookings are owned by client_id (there is no user_id column on this
    # table -- every other query here and in client_bookings.py uses
    # client_id); comparing against the wrong column meant this check
    # denied everyone, including the real owner, every time.
    if get_data.get("client_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not permitted")

    del_resp = supabase.table("bookings").delete().eq("id", booking_id).execute()
    # PostgREST returns deleted rows; treat HTTP errors via helper
    _extract_data_or_raise(del_resp, single=False)
    return None