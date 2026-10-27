from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/coupons", tags=["admin-coupons"])

REFERRAL_TYPES = ("referral_signup", "referral_booking")
ALL_COUPON_TYPES = ("general",) + REFERRAL_TYPES
DISCOUNT_TYPES = ("percentage", "flat")


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin coupons service is not configured.")
    return service_supabase


def _apply_search(query, search: Optional[str]):
    if not search:
        return query
    term = sanitize_or_filter_term(search.strip().replace("%", ""))
    if not term:
        return query
    return query.or_(f"code.ilike.%{term}%,description.ilike.%{term}%")


def _usage_count(client, coupon_id: str) -> int:
    resp = client.table("coupon_usages").select("id", count="exact").eq("coupon_id", coupon_id).execute()
    return getattr(resp, "count", None) or 0


def _deactivate_other_referral_coupons(client, coupon_type: str, exclude_id: Optional[str] = None):
    """
    Keeps at most one active coupon per referral type, so it's never
    ambiguous which amount to credit at signup/first-booking time.
    """
    if coupon_type not in REFERRAL_TYPES:
        return

    query = (
        client.table("coupons")
        .update({"is_active": False})
        .eq("coupon_type", coupon_type)
        .eq("is_active", True)
    )
    if exclude_id:
        query = query.neq("id", exclude_id)
    query.execute()


@router.get("")
async def list_coupons_admin(
    type: str = Query(default="general"),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if type not in ("general", "referral"):
        raise HTTPException(status_code=400, detail="Invalid type filter.")

    client = _client()
    query = client.table("coupons").select("*", count="exact")
    query = _apply_search(query, search)

    if type == "general":
        query = query.eq("coupon_type", "general")
    else:
        query = query.in_("coupon_type", list(REFERRAL_TYPES))

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0

    for row in rows:
        row["usage_count"] = _usage_count(client, row["id"])

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{coupon_id}")
async def get_coupon_admin_detail(
    coupon_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("coupons").select("*").eq("id", coupon_id).single().execute()
    coupon = getattr(resp, "data", None)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found.")

    coupon["usage_count"] = _usage_count(client, coupon_id)
    return {"coupon": coupon}


class CouponIn(BaseModel):
    code: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=1, max_length=500)
    discount_type: str
    discount_value: float = Field(gt=0)
    max_discount_amount: Optional[float] = Field(default=None, gt=0)
    min_booking_amount: Optional[float] = Field(default=None, ge=0)
    applicable_puja_ids: List[str] = Field(default_factory=list)
    usage_limit_total: Optional[int] = Field(default=None, gt=0)
    usage_limit_per_user: Optional[int] = Field(default=None, gt=0)
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    is_active: bool = True
    coupon_type: str = "general"


def _validate_payload(payload: CouponIn):
    if payload.discount_type not in DISCOUNT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid discount type.")
    if payload.coupon_type not in ALL_COUPON_TYPES:
        raise HTTPException(status_code=400, detail="Invalid coupon type.")


def _coupon_columns(payload: CouponIn) -> dict:
    return {
        "code": payload.code.strip().upper(),
        "description": payload.description.strip(),
        "discount_type": payload.discount_type,
        "discount_value": payload.discount_value,
        "max_discount_amount": payload.max_discount_amount,
        "min_booking_amount": payload.min_booking_amount,
        "applicable_puja_ids": payload.applicable_puja_ids,
        "usage_limit_total": payload.usage_limit_total,
        "usage_limit_per_user": payload.usage_limit_per_user,
        "valid_from": payload.valid_from,
        "valid_until": payload.valid_until,
        "is_active": payload.is_active,
        "coupon_type": payload.coupon_type,
    }


@router.post("", status_code=201)
async def create_coupon(
    payload: CouponIn,
    current_user: dict = Depends(require_admin_roles()),
):
    _validate_payload(payload)
    client = _client()

    insert_payload = _coupon_columns(payload)
    insert_payload["created_by"] = current_user["id"]

    try:
        resp = client.table("coupons").insert(insert_payload).select("*").execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not create coupon: {exc}")

    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not create the coupon.")
    coupon = rows[0]

    if payload.is_active:
        _deactivate_other_referral_coupons(client, payload.coupon_type, exclude_id=coupon["id"])

    write_audit_log(
        action="ADMIN_COUPON_CREATED",
        actor_id=str(current_user["id"]),
        entity="coupons",
        entity_id=str(coupon["id"]),
        payload={"code": coupon.get("code"), "coupon_type": coupon.get("coupon_type")},
    )

    coupon["usage_count"] = 0
    return {"message": "Coupon created successfully.", "coupon": coupon}


@router.patch("/{coupon_id}")
async def update_coupon(
    coupon_id: str,
    payload: CouponIn,
    current_user: dict = Depends(require_admin_roles()),
):
    _validate_payload(payload)
    client = _client()

    existing_resp = client.table("coupons").select("id, code").eq("id", coupon_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Coupon not found.")

    try:
        resp = client.table("coupons").update(_coupon_columns(payload)).eq("id", coupon_id).select("*").execute()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not update coupon: {exc}")

    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not update the coupon.")
    coupon = rows[0]

    if payload.is_active:
        _deactivate_other_referral_coupons(client, payload.coupon_type, exclude_id=coupon_id)

    write_audit_log(
        action="ADMIN_COUPON_UPDATED",
        actor_id=str(current_user["id"]),
        entity="coupons",
        entity_id=coupon_id,
        payload={"code": coupon.get("code"), "coupon_type": coupon.get("coupon_type")},
    )

    coupon["usage_count"] = _usage_count(client, coupon_id)
    return {"message": "Coupon updated successfully.", "coupon": coupon}


@router.delete("/{coupon_id}")
async def delete_coupon(
    coupon_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("coupons").select("id, code").eq("id", coupon_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Coupon not found.")

    try:
        client.table("coupons").delete().eq("id", coupon_id).execute()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="This coupon has already been used by customers and can't be deleted. Deactivate it instead.",
        )

    write_audit_log(
        action="ADMIN_COUPON_DELETED",
        actor_id=str(current_user["id"]),
        entity="coupons",
        entity_id=coupon_id,
        payload={"code": existing.get("code")},
    )

    return {"message": "Coupon deleted successfully."}
