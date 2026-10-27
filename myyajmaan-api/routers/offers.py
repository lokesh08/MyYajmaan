from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException

from db import service_supabase

router = APIRouter(prefix="/offers", tags=["offers"])


def _service_client():
    if service_supabase is None:
        raise HTTPException(
            status_code=500,
            detail="Offers service is not configured.",
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


@router.get("")
def list_active_offers():
    now = datetime.now(timezone.utc).isoformat()
    response = (
        _service_client().table("offers")
        .select("id, title, description, image_url, coupon_id, start_date, end_date, display_order")
        .eq("is_active", True)
        .or_(f"start_date.is.null,start_date.lte.{now}")
        .or_(f"end_date.is.null,end_date.gte.{now}")
        .order("display_order", desc=False)
        .execute()
    )
    return _extract_data_or_raise(response)
