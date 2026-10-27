from datetime import date
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


@router.get("", response_model=List[FestivalOut])
def list_festivals(
    limit: int = 50,
    offset: int = 0,
    highlight: Optional[bool] = Query(None, description="If true, return only highlighted festivals"),
    upcoming_only: bool = Query(
        True,
        description=(
            "If true (default), only festivals that haven't ended yet are "
            "returned, soonest first — so the list is always relevant "
            "to whatever month the app is opened in. Pass false to see "
            "the full calendar including past festivals."
        ),
    ),
):
    """
    List festivals, soonest-upcoming first by default. This is what
    drives the Home page's festivals section: with no params it
    naturally returns whichever festivals are coming up relative to
    today, so opening the app in a different month surfaces different
    festivals without any client-side date logic.

    `highlight=true` still works as an extra filter on top of that,
    for anything that wants only hand-picked festivals.
    """
    supabase = _anon_client()

    qb = supabase.table("festivals").select("*")

    if upcoming_only:
        today = date.today().isoformat()
        # Multi-day festivals (e.g. Navratri) stay listed until their
        # end_date passes, not just their start_date.
        qb = qb.or_(
            f"end_date.gte.{today},"
            f"and(end_date.is.null,start_date.gte.{today})"
        )

    if highlight is not None:
        qb = qb.eq("highlight", highlight)

    resp = qb.order("start_date", desc=False).limit(limit).offset(offset).execute()
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