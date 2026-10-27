import time
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from audit import write_audit_log
from db import convert_records_image_fields, service_supabase, upload_image_to_bucket, validate_image_upload
from permissions import require_roles

router = APIRouter(prefix="/pandit/me/bookings/{booking_id}/photos", tags=["pandit-photos"])

# Keeps Supabase Storage usage bounded -- a few completion photos per
# booking is the point, not an unlimited photo dump. Enforced here (not
# just in the UI) since this is the only thing that actually protects
# storage.
MAX_PHOTOS_PER_BOOKING = 3


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Pandit portal service is not configured.")
    return service_supabase


def _get_own_booking_or_404(client, pandit_user_id: str, booking_id: str) -> dict:
    pandit_resp = client.table("pandits").select("id").eq("user_id", pandit_user_id).limit(1).execute()
    pandit_rows = getattr(pandit_resp, "data", None) or []
    if not pandit_rows:
        raise HTTPException(status_code=404, detail="Pandit profile not found.")
    pandit_id = pandit_rows[0]["id"]

    resp = (
        client.table("bookings")
        .select("id, pandit_id, status")
        .eq("id", booking_id)
        .eq("pandit_id", pandit_id)
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return {"pandit_id": pandit_id, "booking": rows[0]}


@router.get("")
async def list_booking_photos(
    booking_id: str,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    _get_own_booking_or_404(client, current_user["id"], booking_id)

    resp = (
        client.table("booking_photos")
        .select("*")
        .eq("booking_id", booking_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    convert_records_image_fields(rows, fields=["image_url"])

    return {"items": rows}


@router.post("")
async def upload_booking_photos(
    booking_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(require_roles("pandit")),
):
    if not files:
        raise HTTPException(status_code=400, detail="Please select at least one photo to upload.")

    client = _client()
    context = _get_own_booking_or_404(client, current_user["id"], booking_id)
    pandit_id = context["pandit_id"]

    existing_resp = client.table("booking_photos").select("id", count="exact").eq("booking_id", booking_id).execute()
    existing_count = getattr(existing_resp, "count", None) or 0
    remaining = MAX_PHOTOS_PER_BOOKING - existing_count
    if remaining <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"This booking already has the maximum of {MAX_PHOTOS_PER_BOOKING} photos.",
        )
    if len(files) > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"You can add {remaining} more photo(s) to this booking (max {MAX_PHOTOS_PER_BOOKING} total).",
        )

    saved_rows = []
    for index, file in enumerate(files):
        if not file.filename:
            continue
        content = await file.read()
        if not content:
            continue
        validate_image_upload(file.content_type, content)
        ext = ""
        if "." in file.filename:
            ext = "." + file.filename.rsplit(".", 1)[-1].lower()

        path = f"bookings/{booking_id}/photo-{int(time.time() * 1000)}-{index}{ext}"
        image_url = upload_image_to_bucket(content, file.content_type or "", path)

        insert_resp = (
            client.table("booking_photos")
            .insert({"booking_id": booking_id, "pandit_id": pandit_id, "image_url": image_url})
            .select("*")
            .execute()
        )
        rows = getattr(insert_resp, "data", None) or []
        if rows:
            saved_rows.append(rows[0])

    if not saved_rows:
        raise HTTPException(status_code=400, detail="No valid photos were uploaded.")

    write_audit_log(
        action="PANDIT_BOOKING_PHOTOS_UPLOADED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={"count": len(saved_rows)},
    )

    convert_records_image_fields(saved_rows, fields=["image_url"])
    return {"message": f"{len(saved_rows)} photo(s) uploaded successfully.", "items": saved_rows}
