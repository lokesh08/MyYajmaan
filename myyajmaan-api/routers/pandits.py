from typing import Any, List

from fastapi import APIRouter, HTTPException

from db import (
    create_supabase_client_for_key,
    SUPABASE_ANON_KEY,
    convert_record_image_fields,
    convert_records_image_fields,
)
from models import PanditOut

router = APIRouter(prefix="/pandits", tags=["pandits"])


def _anon_client():
    key = SUPABASE_ANON_KEY
    if not key:
        raise RuntimeError("SUPABASE_ANON_KEY is not set in environment")
    return create_supabase_client_for_key(key)


def _extract_data_or_raise(resp: Any, single: bool = False):
    """Normalize postgrest response: raise on HTTP errors, return data (list or single)."""
    status = getattr(resp, "status_code", None)
    data = getattr(resp, "data", None)
    raw = getattr(resp, "raw", None)

    # HTTP error from PostgREST
    if status is not None and status >= 400:
        if status == 404:
            raise HTTPException(status_code=404, detail="Not found")
        detail = data or raw or f"PostgREST returned status {status}"
        raise HTTPException(status_code=500, detail=str(detail))

    # No explicit status; still check data
    if single:
        if not data:
            raise HTTPException(status_code=404, detail="Not found")
        return data
    return data or []


@router.get("/", response_model=List[PanditOut])
def list_pandits(limit: int = 50, offset: int = 0):
    supabase = _anon_client()
    resp = (
        supabase.table("pandits")
        .select("*")
        .order("created_at", desc=False)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    data = _extract_data_or_raise(resp, single=False)

    # Convert avatar/image/portrait fields to public URLs
    convert_records_image_fields(data, fields=["avatar_url", "image", "portrait_url"])

    # ensure frontend-friendly 'image' property exists (many client components use p.image)
    for rec in data:
        if rec.get("avatar_url") and not rec.get("image"):
            rec["image"] = rec["avatar_url"]

    return data


@router.get("/{pandit_id}", response_model=PanditOut)
def get_pandit(pandit_id: str):
    supabase = _anon_client()
    resp = supabase.table("pandits").select("*").eq("id", pandit_id).single().execute()
    data = _extract_data_or_raise(resp, single=True)
    convert_record_image_fields(data, fields=["avatar_url", "image", "portrait_url"])

    # ensure 'image' fallback
    if data.get("avatar_url") and not data.get("image"):
        data["image"] = data["avatar_url"]

    return data