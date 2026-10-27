from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from audit import write_audit_log
from db import (
    create_supabase_client_for_key,
    SUPABASE_ANON_KEY,
    convert_record_image_fields,
    convert_records_image_fields,
)
from models import PujaOut
from permissions import optional_current_user

router = APIRouter(prefix="/pujas", tags=["pujas"])


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


@router.get("", response_model=List[PujaOut])
def list_pujas(
    limit: int = 50,
    offset: int = 0,
    listing_type: Optional[str] = None,
    puja_type: Optional[str] = None,
):
    supabase = _anon_client()
    query = supabase.table("pujas").select("*").eq("is_active", True)

    if listing_type:
        query = query.eq("listing_type", listing_type)
    if puja_type:
        query = query.eq("puja_type", puja_type)

    resp = (
        query
        .order("created_at", desc=False)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    data = _extract_data_or_raise(resp, single=False)

    # Convert image keys (thumbnail_url, image_url) to public URLs
    convert_records_image_fields(data, fields=["thumbnail_url", "image_url"])
    return data


@router.get("/{puja_id}", response_model=PujaOut)
def get_puja(
    puja_id: str,
    current_user: Optional[dict] = Depends(optional_current_user),
):
    supabase = _anon_client()
    resp = supabase.table("pujas").select("*").eq("id", puja_id).eq("is_active", True).single().execute()
    data = _extract_data_or_raise(resp, single=True)
    convert_record_image_fields(data, fields=["thumbnail_url", "image_url"])

    write_audit_log(
        action="PUJA_VIEWED",
        actor_id=str(current_user["id"]) if current_user else None,
        entity="pujas",
        entity_id=puja_id,
        payload={"title": data.get("title")},
    )

    return data