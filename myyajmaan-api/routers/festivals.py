from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Query

from db import (
    create_supabase_client_for_key,
    SUPABASE_ANON_KEY,
    convert_record_image_fields,
    convert_records_image_fields,
)
from models import FestivalOut

router = APIRouter(prefix="/festivals", tags=["festivals"])


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


@router.get("/", response_model=List[FestivalOut])
def list_festivals(
    limit: int = 50,
    offset: int = 0,
    highlight: Optional[bool] = Query(None, description="If true, return only highlighted festivals"),
):
    """
    List festivals. If `highlight=true` is provided, only return festivals where highlight is true.
    """
    supabase = _anon_client()

    qb = supabase.table("festivals").select("*").order("start_date", desc=False).limit(limit).offset(offset)

    # apply highlight filter server-side when requested
    if highlight is not None:
        qb = qb.eq("highlight", highlight)

    resp = qb.execute()
    data = _extract_data_or_raise(resp, single=False)

    # Convert any storage keys to public URLs before returning
    convert_records_image_fields(data, fields=["image_url"])
    return data


@router.get("/{festival_id}", response_model=FestivalOut)
def get_festival(festival_id: str):
    supabase = _anon_client()
    resp = supabase.table("festivals").select("*").eq("id", festival_id).single().execute()
    data = _extract_data_or_raise(resp, single=True)
    convert_record_image_fields(data, fields=["image_url"])
    return data