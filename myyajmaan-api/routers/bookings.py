from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any
from db import create_supabase_client_for_key, SUPABASE_ANON_KEY
from models import BookingIn, BookingOut
from auth import get_current_user, get_bearer_token

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _client_for_token(token: str):
    # Use user token if available, otherwise fall back to anon key
    key = token or SUPABASE_ANON_KEY
    if not key:
        raise RuntimeError("No token or anon key available for Supabase client")
    return create_supabase_client_for_key(key)


def _extract_data_or_raise(resp: Any, single: bool = False):
    """Normalize postgrest response: raise on HTTP errors, return data (list or single)."""
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


@router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingIn,
    user: dict = Depends(get_current_user),
    token: str = Depends(get_bearer_token),
):
    supabase = _client_for_token(token)
    record = {
        "user_id": user["id"],
        "pandit_id": payload.pandit_id,
        "booking_date": str(payload.booking_date),
        "timeslot": str(payload.timeslot),
        "notes": payload.notes,
    }
    resp = supabase.table("bookings").insert(record).select("*").execute()
    data = _extract_data_or_raise(resp, single=False)
    # insert(...).select("*") returns a list with the created row
    if not data:
        raise HTTPException(status_code=500, detail="Failed to create booking")
    return data[0]


@router.get("/me", response_model=List[BookingOut])
async def list_my_bookings(
    user: dict = Depends(get_current_user), token: str = Depends(get_bearer_token)
):
    supabase = _client_for_token(token)
    resp = (
        supabase.table("bookings")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return _extract_data_or_raise(resp, single=False)


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: str, user: dict = Depends(get_current_user), token: str = Depends(get_bearer_token)
):
    supabase = _client_for_token(token)

    get_resp = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
    get_data = _extract_data_or_raise(get_resp, single=True)

    if get_data.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not permitted")

    del_resp = supabase.table("bookings").delete().eq("id", booking_id).execute()
    # PostgREST returns deleted rows; treat HTTP errors via helper
    _extract_data_or_raise(del_resp, single=False)
    return None