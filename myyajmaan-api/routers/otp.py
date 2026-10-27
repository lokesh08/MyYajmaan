"""
One-time email + phone verification for self-registered accounts
(customer / Yajmaan and Pandit Ji).

A new account starts with signup_verification_pending = TRUE and can't
log in (see routers/auth.py) until both the email OTP and the phone OTP
have been entered once. These endpoints are public -- the person has no
session yet -- so they are keyed by email, only ever act on accounts
that are still pending, and are protected by per-channel cooldown /
hourly send limits and a wrong-attempt lockout (see otp_service.py).
"""

import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

import otp_service
from audit import write_audit_log
from db import service_supabase
from signup_rewards import grant_signup_rewards

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/otp", tags=["auth-otp"])

PENDING_COLUMNS = "id, email, phone, signup_verification_pending, email_verified_at, phone_verified_at"


class SendOtpIn(BaseModel):
    email: EmailStr
    # "email", "phone" or "both"
    channel: str = "both"


class VerifyOtpIn(BaseModel):
    email: EmailStr
    channel: str
    code: str


class StatusIn(BaseModel):
    email: EmailStr


def _find_pending_user(email: str) -> Optional[dict]:
    if service_supabase is None:
        return None
    result = (
        service_supabase.table("users")
        .select(PENDING_COLUMNS)
        .eq("email", str(email).strip().lower())
        .eq("signup_verification_pending", True)
        .limit(1)
        .execute()
    )
    rows = getattr(result, "data", None) or []
    return rows[0] if rows else None


def _state(user: dict) -> dict:
    return {
        "email_verified": bool(user.get("email_verified_at")),
        "phone_verified": bool(user.get("phone_verified_at")),
    }


async def send_signup_otps(user: dict, channels=otp_service.CHANNELS) -> list:
    """
    Not an endpoint -- also used by registration to send the first
    pair of codes. Never raises: each channel reports its own outcome
    so one failing provider doesn't hide the other's result.
    """

    results = []
    for channel in channels:
        if user.get(f"{channel}_verified_at"):
            results.append({"channel": channel, "sent": False, "already_verified": True})
            continue
        try:
            extra = await otp_service.issue_otp(user, channel)
            results.append({"channel": channel, "sent": True, **extra})
        except otp_service.OtpError as exc:
            results.append({
                "channel": channel,
                "sent": False,
                "error_code": exc.code,
                "message": exc.message,
                "retry_after": exc.retry_after,
            })
        except Exception:
            logger.exception("Unexpected failure sending %s OTP", channel)
            results.append({
                "channel": channel,
                "sent": False,
                "error_code": "OTP_DELIVERY_FAILED",
                "message": "We could not send the code. Please try again.",
            })
    return results


@router.post("/send")
async def send_otp(payload: SendOtpIn):
    user = _find_pending_user(payload.email)

    # Same generic answer whether or not the address belongs to a
    # pending signup, so this can't be used to probe which emails exist.
    if not user:
        return {"results": [], "email_verified": False, "phone_verified": False}

    channels = otp_service.CHANNELS if payload.channel == "both" else (payload.channel,)
    channels = tuple(c for c in channels if c in otp_service.CHANNELS)

    results = await send_signup_otps(user, channels)
    return {"results": results, **_state(user)}


@router.post("/verify")
async def verify_otp(payload: VerifyOtpIn):
    user = _find_pending_user(payload.email)

    if not user:
        return {
            "verified": False,
            "error_code": "OTP_NOT_FOUND",
            "message": "No pending verification found for this account.",
        }

    if payload.channel not in otp_service.CHANNELS:
        return {"verified": False, "error_code": "OTP_UNAVAILABLE", "message": "Unknown verification type."}

    try:
        otp_service.verify_otp(user, payload.channel, payload.code)
    except otp_service.OtpError as exc:
        return {"verified": False, "error_code": exc.code, "message": exc.message, **_state(user)}

    # Re-read so both timestamps are current, then release the account
    # only once BOTH channels are verified.
    refreshed = _find_pending_user(payload.email) or user
    state = _state(refreshed)
    fully_verified = state["email_verified"] and state["phone_verified"]

    if fully_verified:
        # Conditional on the flag still being set, so two simultaneous
        # final verifications can't both pass and pay the rewards twice.
        released = (
            service_supabase.table("users")
            .update({"signup_verification_pending": False})
            .eq("id", user["id"])
            .eq("signup_verification_pending", True)
            .execute()
        )
        if getattr(released, "data", None):
            full = service_supabase.table("users").select("id, role, email, referred_by").eq("id", user["id"]).limit(1).execute()
            rows = getattr(full, "data", None) or []
            grant_signup_rewards(rows[0] if rows else {**user, "role": None})
        write_audit_log(
            action="AUTH_SIGNUP_VERIFIED",
            actor_id=str(user["id"]),
            entity="users",
            entity_id=str(user["id"]),
            payload={"email": user.get("email")},
        )

    return {"verified": True, "fully_verified": fully_verified, **state}


@router.post("/status")
async def otp_status(payload: StatusIn):
    user = _find_pending_user(payload.email)
    if not user:
        return {"pending": False, "email_verified": False, "phone_verified": False}
    return {"pending": True, **_state(user)}
