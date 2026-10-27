"""
Razorpay payments (the only payment method offered to customers).

Flow:
  1. POST /payments/razorpay/order   -> creates a Razorpay order for
     the amount (server-side, using the secret key) and returns what
     the browser's Checkout needs (order id + PUBLIC key id).
  2. Browser opens Razorpay Checkout; the customer pays.
  3. POST /payments/razorpay/verify  -> checks Razorpay's signature
     with the secret key, so a forged "payment succeeded" message
     from the browser can't pass.

The key secret never leaves this server.
"""

import hashlib
import hmac
import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

import config
from audit import write_audit_log
from auth import api_error, get_current_user
from payment_verification import mark_payment_verified, record_payment_order

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments/razorpay", tags=["payments"])

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
MIN_AMOUNT_RUPEES = 1
MAX_AMOUNT_RUPEES = 500000

# Local mock mode (config.RAZORPAY_MOCK_MODE) uses these fixed values.
MOCK_ORDER_PREFIX = "order_mock_"
MOCK_SIGNATURE = "mock_signature"


class CreateOrderIn(BaseModel):
    amount: float = Field(gt=0)
    currency: str = "INR"


class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str = Field(min_length=1, max_length=100)
    razorpay_payment_id: str = Field(min_length=1, max_length=100)
    razorpay_signature: str = Field(min_length=1, max_length=200)


def _require_configured():
    if config.razorpay_mock_active():
        return
    if not config.razorpay_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=api_error(
                "PAYMENTS_NOT_CONFIGURED",
                "Online payments are not available right now. Please try again later.",
            ),
        )


@router.post("/order")
async def create_order(
    payload: CreateOrderIn,
    current_user: dict = Depends(get_current_user),
):
    _require_configured()

    if payload.currency.upper() != "INR":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error("UNSUPPORTED_CURRENCY", "Only INR payments are supported."),
        )
    if not (MIN_AMOUNT_RUPEES <= payload.amount <= MAX_AMOUNT_RUPEES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error("INVALID_AMOUNT", "This payment amount is not allowed."),
        )

    if config.razorpay_mock_active():
        logger.warning("[RAZORPAY_MOCK_MODE] Returning a fake order for INR %s", payload.amount)
        mock_order_id = f"{MOCK_ORDER_PREFIX}{uuid.uuid4().hex[:14]}"
        record_payment_order(str(current_user["id"]), mock_order_id, payload.amount)
        return {
            "order_id": mock_order_id,
            "amount": int(round(payload.amount * 100)),
            "currency": "INR",
            "key_id": "rzp_mock",
            "merchant_name": config.RAZORPAY_MERCHANT_NAME,
            "mock": True,
        }

    # Razorpay works in paise; round rather than truncate so 199.99
    # never becomes 199.98 through float error.
    amount_paise = int(round(payload.amount * 100))

    body = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"rcpt_{uuid.uuid4().hex[:24]}",
        "notes": {"user_id": str(current_user["id"])},
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                RAZORPAY_ORDERS_URL,
                json=body,
                auth=(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET),
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=api_error(
                "PAYMENT_GATEWAY_UNAVAILABLE",
                "The payment service is temporarily unavailable. Please try again.",
            ),
        )

    if response.status_code != 200:
        # Logged for us; the customer only sees a generic message.
        logger.error("Razorpay order creation failed (%s): %s", response.status_code, response.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=api_error(
                "PAYMENT_ORDER_FAILED",
                "We could not start your payment. Please try again.",
            ),
        )

    order = response.json()
    record_payment_order(str(current_user["id"]), order["id"], payload.amount, order.get("currency", "INR"))

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "key_id": config.RAZORPAY_KEY_ID,
        "merchant_name": config.RAZORPAY_MERCHANT_NAME,
    }


@router.post("/verify")
async def verify_payment(
    payload: VerifyPaymentIn,
    current_user: dict = Depends(get_current_user),
):
    _require_configured()

    if config.razorpay_mock_active():
        # Only fake orders created by this same mock mode can pass.
        if (
            payload.razorpay_order_id.startswith(MOCK_ORDER_PREFIX)
            and payload.razorpay_signature == MOCK_SIGNATURE
        ):
            mark_payment_verified(payload.razorpay_order_id, payload.razorpay_payment_id)
            return {
                "status": "success",
                "sessionId": payload.razorpay_payment_id,
                "orderId": payload.razorpay_order_id,
                "mock": True,
            }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error("PAYMENT_VERIFICATION_FAILED", "We could not verify this payment."),
        )

    signed = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode()
    expected = hmac.new(
        config.RAZORPAY_KEY_SECRET.encode(),
        signed,
        hashlib.sha256,
    ).hexdigest()

    # Constant-time comparison so the signature can't be guessed a
    # byte at a time from response timing.
    if not hmac.compare_digest(expected, payload.razorpay_signature):
        write_audit_log(
            action="PAYMENT_VERIFICATION_FAILED",
            actor_id=str(current_user["id"]),
            entity="payments",
            entity_id=payload.razorpay_payment_id,
            payload={"order_id": payload.razorpay_order_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(
                "PAYMENT_VERIFICATION_FAILED",
                "We could not verify this payment. If money was deducted it will be refunded automatically.",
            ),
        )

    mark_payment_verified(payload.razorpay_order_id, payload.razorpay_payment_id)

    return {
        "status": "success",
        "sessionId": payload.razorpay_payment_id,
        "orderId": payload.razorpay_order_id,
    }
