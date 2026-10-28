"""
Server-side ledger for Razorpay payments (see routers/payments.py),
so anything that "spends" a payment_ref -- creating a booking,
confirming a package-puja payment, topping up a wallet -- checks it
against a REAL payment this server created and verified, instead of
trusting whatever amount/ref the client sends back.

Without this, POST /bookings (or any other endpoint that just stored
a client-supplied payment_ref) would create a fully "paid" record for
any amount, with a made-up reference, and no money ever changing
hands -- this module is what closes that gap.

Usage, from an endpoint that requires a real payment:

    from payment_verification import consume_verified_payment, PaymentNotVerifiedError

    try:
        consume_verified_payment(
            user_id=current_user["id"],
            payment_id=payload.payment_ref,
            expected_amount=payload.amount,
            reference_type="booking",
        )
    except PaymentNotVerifiedError as exc:
        raise HTTPException(status_code=400, detail=api_error("PAYMENT_NOT_VERIFIED", exc.message))

    # ... only now create the booking / confirm the payment / credit
    # the wallet. If that later step fails, the payment stays marked
    # "consumed" rather than being replayable -- a rare, support-fixable
    # edge case that's far safer than allowing reuse.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from db import service_supabase

logger = logging.getLogger(__name__)

# A payment is accepted for a claimed amount within this many rupees of
# what was actually paid, to absorb harmless float/rounding differences
# between the frontend's price calculation and what was charged --
# never enough to matter, nowhere near enough to under-pay for a puja.
AMOUNT_TOLERANCE_RUPEES = 1.0


class PaymentNotVerifiedError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def record_payment_order(user_id: str, order_id: str, amount_rupees: float, currency: str = "INR") -> None:
    """Called right after a Razorpay (or mock) order is created."""

    if service_supabase is None:
        return
    try:
        service_supabase.table("payment_verifications").insert({
            "user_id": user_id,
            "order_id": order_id,
            "amount": round(amount_rupees, 2),
            "currency": currency,
            "status": "created",
        }).execute()
    except Exception:
        # A booking/top-up made against this order will simply fail its
        # verified-payment check below and the customer sees a clear
        # error -- better than pretending the order was tracked.
        logger.exception("Could not record payment order %s for user %s", order_id, user_id)


def mark_payment_verified(order_id: str, payment_id: str) -> None:
    """Called right after Razorpay's signature has been checked."""

    if service_supabase is None:
        return
    try:
        service_supabase.table("payment_verifications").update({
            "payment_id": payment_id,
            "status": "verified",
            "verified_at": datetime.now(timezone.utc).isoformat(),
        }).eq("order_id", order_id).eq("status", "created").execute()
    except Exception:
        logger.exception("Could not mark payment order %s verified", order_id)


def consume_verified_payment(
    user_id: str,
    payment_id: Optional[str],
    expected_amount: float,
    reference_type: str,
    reference_id: Optional[str] = None,
) -> None:
    """
    Spends a verified payment exactly once. Raises PaymentNotVerifiedError
    (never lets a caller proceed) unless ALL of these hold:

      - a payment_verifications row exists for this payment_id,
      - it belongs to `user_id` (one customer can't spend another's payment),
      - it is still "verified" (not already consumed elsewhere -- checked
        via a conditional UPDATE, so two concurrent requests reusing the
        same payment_ref can't both succeed),
      - its recorded amount is within AMOUNT_TOLERANCE_RUPEES of
        `expected_amount` (a customer can't pay a little and claim a lot).
    """

    if not payment_id or not payment_id.strip():
        raise PaymentNotVerifiedError("PAYMENT_REF_REQUIRED", "A payment reference is required.")

    if service_supabase is None:
        raise PaymentNotVerifiedError("PAYMENT_SERVICE_UNAVAILABLE", "Payment verification is not available right now.")

    lookup = (
        service_supabase.table("payment_verifications")
        .select("id, user_id, amount, status")
        .eq("payment_id", payment_id.strip())
        .limit(1)
        .execute()
    )
    rows = getattr(lookup, "data", None) or []

    if not rows:
        raise PaymentNotVerifiedError(
            "PAYMENT_NOT_FOUND",
            "We could not verify this payment. If money was deducted, please contact support.",
        )

    row = rows[0]

    if row["user_id"] != user_id:
        # Someone else's payment_ref replayed against this account.
        raise PaymentNotVerifiedError("PAYMENT_NOT_FOUND", "We could not verify this payment.")

    if abs(float(row["amount"]) - float(expected_amount)) > AMOUNT_TOLERANCE_RUPEES:
        raise PaymentNotVerifiedError(
            "PAYMENT_AMOUNT_MISMATCH",
            "The verified payment does not match the amount for this request.",
        )

    if row["status"] != "verified":
        raise PaymentNotVerifiedError(
            "PAYMENT_ALREADY_USED",
            "This payment has already been used." if row["status"] == "consumed"
            else "This payment could not be verified.",
        )

    # Conditional on status still being "verified" -- the row this
    # UPDATE actually touches is the only caller allowed to proceed, so
    # a second, concurrent attempt to spend the same payment_ref finds
    # zero rows updated and fails closed instead of double-spending.
    consumed = (
        service_supabase.table("payment_verifications")
        .update({
            "status": "consumed",
            "consumed_at": datetime.now(timezone.utc).isoformat(),
            "consumed_reference_type": reference_type,
            "consumed_reference_id": reference_id,
        })
        .eq("id", row["id"])
        .eq("status", "verified")
        .execute()
    )
    if not getattr(consumed, "data", None):
        raise PaymentNotVerifiedError("PAYMENT_ALREADY_USED", "This payment has already been used.")


def release_consumed_payment(payment_id: str) -> None:
    """
    Undoes consume_verified_payment() when the thing it paid for could
    not be created afterwards (e.g. the booking insert failed), so the
    customer's money isn't stranded on a payment that can never be used
    again -- they can retry with the same payment instead of paying twice.
    """
    if service_supabase is None or not payment_id:
        return
    try:
        service_supabase.table("payment_verifications").update({
            "status": "verified",
            "consumed_at": None,
            "consumed_reference_type": None,
            "consumed_reference_id": None,
        }).eq("payment_id", payment_id.strip()).eq("status", "consumed").execute()
    except Exception:
        logger.exception("Could not release consumed payment %s", payment_id)


def attach_consumed_reference(payment_id: str, reference_id: str) -> None:
    """
    Best-effort: fills in the real reference_id once it exists (e.g. the
    booking's own id, only known after the row is inserted). Traceability
    only -- consume_verified_payment() above is what actually prevents reuse.
    """
    if service_supabase is None:
        return
    try:
        service_supabase.table("payment_verifications").update({
            "consumed_reference_id": reference_id,
        }).eq("payment_id", payment_id).execute()
    except Exception:
        logger.exception("Could not attach reference %s to payment %s", reference_id, payment_id)
