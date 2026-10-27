import logging
import os

from fastapi import APIRouter, Depends

from auth import get_current_user
from db import service_supabase
from referral_utils import ensure_referral_code

router = APIRouter(prefix="", tags=["referrals"])

logger = logging.getLogger(__name__)

REFERRAL_REASONS = ("referral_signup", "referral_first_booking")


def _format_currency(value) -> str:
    if value is None:
        return "—"
    return f"₹{value:g}"


def _active_coupon_display(coupon_type: str) -> str:
    if service_supabase is None:
        return "—"

    try:
        resp = (
            service_supabase
            .table("coupons")
            .select("discount_value")
            .eq("coupon_type", coupon_type)
            .eq("is_active", True)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return _format_currency(rows[0]["discount_value"]) if rows else "—"
    except Exception:
        logger.exception("Could not load active coupon display for %s", coupon_type)
        return "—"


@router.get("/referral")
def get_referral_summary(current_user: dict = Depends(get_current_user)):
    """
    Real referral summary for the logged-in user: their own shareable
    code/link, the currently admin-configured reward amounts, their
    spendable wallet balance ("Your Earnings"), and their lifetime
    referral earnings ("Total Earned") — both derived from the
    wallet_transactions ledger, never a separately cached total.
    """

    code = ensure_referral_code(current_user["id"], full_name=current_user.get("full_name")) or "—"
    base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
    share_url = f"{base_url.rstrip('/')}/register?ref={code}"

    total_earned = 0.0
    if service_supabase is not None:
        try:
            resp = (
                service_supabase
                .table("wallet_transactions")
                .select("amount")
                .eq("user_id", current_user["id"])
                .in_("reason", REFERRAL_REASONS)
                .execute()
            )
            rows = getattr(resp, "data", None) or []
            total_earned = sum(float(row.get("amount") or 0) for row in rows)
        except Exception:
            logger.exception("Could not sum referral earnings for user %s", current_user["id"])

    return {
        "code": code,
        "signupReward": _active_coupon_display("referral_signup"),
        "bookingReward": _active_coupon_display("referral_booking"),
        "earnings": _format_currency(current_user.get("wallet_balance") or 0),
        "totalEarned": _format_currency(total_earned),
        "shareUrl": share_url,
    }
