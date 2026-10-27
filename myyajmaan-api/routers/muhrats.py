from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException

from db import SUPABASE_ANON_KEY, create_supabase_client_for_key

router = APIRouter(prefix="/muhrat", tags=["muhrats"])


def _anon_client():
    key = SUPABASE_ANON_KEY
    if not key:
        raise RuntimeError("SUPABASE_ANON_KEY is not set in environment")
    return create_supabase_client_for_key(key)


def _extract_data_or_raise(resp: Any, single: bool = False):
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


@router.get("/next")
def get_next_muhrat():
    supabase = _anon_client()

    now = datetime.utcnow().isoformat()
    resp = (
        supabase.table("muhrats")
        .select("*")
        .eq("active", True)
        .lte("start_at", now)
        .gte("end_at", now)
        .order("start_at", desc=False)
        .limit(1)
        .execute()
    )

    rows = _extract_data_or_raise(resp, single=False)
    if not rows:
        return {"active": False}

    row = rows[0]
    return {
        "active": bool(row.get("active", False)),
        "id": row.get("id"),
        "title": row.get("title"),
        "description": row.get("description"),
        "start_at": row.get("start_at"),
        "end_at": row.get("end_at"),
        "discount_percent": row.get("discount_percent"),
        "puja_discounts": row.get("puja_discounts") or [],
        "created_at": row.get("created_at"),
    }
