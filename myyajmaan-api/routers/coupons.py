from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import service_supabase
from permissions import require_roles

router = APIRouter(prefix="/coupons", tags=["coupons"])


class CouponValidationIn(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    amount: float = Field(gt=0)
    puja_id: Optional[str] = None


def _service_client():
    if service_supabase is None:
        raise HTTPException(
            status_code=500,
            detail="Coupons service is not configured.",
        )
    return service_supabase


def _extract_data_or_raise(resp: Any):
    status = getattr(resp, "status_code", None)
    data = getattr(resp, "data", None)
    raw = getattr(resp, "raw", None)
    if status is not None and status >= 400:
        detail = data or raw or f"PostgREST returned status {status}"
        raise HTTPException(status_code=500, detail=str(detail))
    return data or []


def _coupon_error(code: str, message: str) -> dict:
    return {"valid": False, "code": code, "message": message}


def _as_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def evaluate_coupon(
    coupon: dict,
    amount: float,
    puja_id: Optional[str],
    user_usage_count: int,
    total_usage_count: int,
) -> dict:
    now = datetime.now(timezone.utc)
    valid_from = _as_datetime(coupon.get("valid_from"))
    valid_until = _as_datetime(coupon.get("valid_until"))

    if not coupon.get("is_active", False):
        return _coupon_error("COUPON_INACTIVE", "This coupon is no longer active.")
    if valid_from and now < valid_from:
        return _coupon_error("COUPON_NOT_STARTED", "This coupon is not available yet.")
    if valid_until and now > valid_until:
        return _coupon_error("COUPON_EXPIRED", "This coupon has expired.")
    if amount < float(coupon.get("min_booking_amount") or 0):
        return _coupon_error("MINIMUM_BOOKING_NOT_MET", "Your booking does not meet this coupon's minimum amount.")

    applicable_puja_ids = coupon.get("applicable_puja_ids") or []
    if applicable_puja_ids and puja_id not in applicable_puja_ids:
        return _coupon_error("COUPON_NOT_APPLICABLE", "This coupon is not valid for the selected puja.")
    if coupon.get("usage_limit_total") is not None and total_usage_count >= coupon["usage_limit_total"]:
        return _coupon_error("COUPON_USAGE_LIMIT_REACHED", "This coupon has reached its redemption limit.")
    if coupon.get("usage_limit_per_user") is not None and user_usage_count >= coupon["usage_limit_per_user"]:
        return _coupon_error("COUPON_USAGE_LIMIT_REACHED", "You have already used this coupon.")

    amount_decimal = Decimal(str(amount))
    discount_value = Decimal(str(coupon["discount_value"]))
    if coupon["discount_type"] == "percentage":
        discount = amount_decimal * discount_value / Decimal("100")
        max_discount = coupon.get("max_discount_amount")
        if max_discount is not None:
            discount = min(discount, Decimal(str(max_discount)))
    else:
        discount = discount_value

    discount = min(discount, amount_decimal)
    return {
        "valid": True,
        "id": coupon["id"],
        "code": coupon["code"],
        "discount": float(discount),
        "finalAmount": float(amount_decimal - discount),
    }


@router.get("")
def list_active_coupons():
    now = datetime.now(timezone.utc).isoformat()
    response = (
        _service_client().table("coupons")
        .select("id, code, description, discount_type, discount_value, max_discount_amount, min_booking_amount, applicable_puja_ids, valid_until")
        .eq("is_active", True)
        .eq("coupon_type", "general")
        .or_(f"valid_from.is.null,valid_from.lte.{now}")
        .or_(f"valid_until.is.null,valid_until.gte.{now}")
        .order("created_at", desc=True)
        .execute()
    )
    return _extract_data_or_raise(response)


@router.post("/validate")
def validate_coupon(payload: CouponValidationIn, current_user: dict = Depends(require_roles("user"))):
    response = (
        _service_client().table("coupons")
        .select("*")
        .eq("code", payload.code.strip().upper())
        .limit(1)
        .execute()
    )
    coupons = _extract_data_or_raise(response)
    if not coupons:
        return _coupon_error("COUPON_NOT_FOUND", "Enter a valid coupon code.")

    coupon = coupons[0]
    if coupon.get("coupon_type", "general") != "general":
        return _coupon_error(
            "COUPON_NOT_APPLICABLE",
            "This reward is applied automatically to the eligible referral account.",
        )

    # Hard rule, not admin-configurable: a given user can redeem a given
    # coupon at most once, ever -- checked here rather than left to
    # usage_limit_per_user (which previously was never actually enforced,
    # since this endpoint never knew who was asking).
    own_usage_response = (
        _service_client().table("coupon_usages")
        .select("id", count="exact")
        .eq("coupon_id", coupon["id"])
        .eq("user_id", current_user["id"])
        .execute()
    )
    own_usage_count = getattr(own_usage_response, "count", None) or len(_extract_data_or_raise(own_usage_response))
    if own_usage_count > 0:
        return _coupon_error("COUPON_ALREADY_USED", "You've already used this coupon.")

    usage_response = (
        _service_client().table("coupon_usages")
        .select("id", count="exact")
        .eq("coupon_id", coupon["id"])
        .execute()
    )
    total_usage_count = getattr(usage_response, "count", None) or len(_extract_data_or_raise(usage_response))
    return evaluate_coupon(coupon, payload.amount, payload.puja_id, own_usage_count, total_usage_count)
