from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from postgrest.exceptions import APIError
from pydantic import BaseModel

from audit import write_audit_log
from db import (
    LARGE_IMAGE_MAX_WIDTH,
    THUMBNAIL_MAX_WIDTH,
    convert_record_image_fields,
    convert_records_image_fields,
    sanitize_or_filter_term,
    service_supabase,
    upload_image_to_bucket,
    webp_variant,
)
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/pujas", tags=["admin-pujas"])

LISTING_TYPES = ("normal", "trending", "featured")
PUJA_TYPES = ("normal", "package")
IMAGE_FIELDS = ["thumbnail_url", "image_url"]


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin puja service is not configured.")
    return service_supabase


def _apply_search(query, search: Optional[str]):
    if not search:
        return query
    term = sanitize_or_filter_term(search.strip().replace("%", ""))
    if not term:
        return query
    return query.or_(f"title.ilike.%{term}%,category.ilike.%{term}%,code.ilike.%{term}%")


def _parse_benefits(benefits: Optional[str]) -> list:
    if not benefits:
        return []
    return [item.strip() for item in benefits.split(",") if item.strip()]


async def _read_upload(file: Optional[UploadFile]) -> Optional[bytes]:
    if file is None or not file.filename:
        return None
    content = await file.read()
    return content or None


def _store_image(content: bytes, file: UploadFile, puja_id: str, kind: str, max_width: int) -> str:
    """
    Stores a resized WebP (pujas/<id>/<kind>.webp). Uploaded originals are
    often 3-4 MB PNGs, which made the puja lists tens of MB on a phone.
    Falls back to the original bytes and extension if conversion fails.
    """
    webp = webp_variant(content, max_width)
    if webp:
        return upload_image_to_bucket(webp, "image/webp", f"pujas/{puja_id}/{kind}.webp")

    ext = ""
    if "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower()
    return upload_image_to_bucket(content, file.content_type or "", f"pujas/{puja_id}/{kind}{ext}")


async def _upload_puja_images(
    image: Optional[UploadFile], thumbnail: Optional[UploadFile], puja_id: str
) -> tuple:
    """
    Returns (image_key, thumb_key); either is None when nothing was sent.
    A new main image without its own thumbnail also gets a matching card
    thumbnail made from it, so the list never shows the old picture.
    """
    image_bytes = await _read_upload(image)
    thumb_bytes = await _read_upload(thumbnail)

    image_key = _store_image(image_bytes, image, puja_id, "big", LARGE_IMAGE_MAX_WIDTH) if image_bytes else None
    if thumb_bytes:
        thumb_key = _store_image(thumb_bytes, thumbnail, puja_id, "thumb", THUMBNAIL_MAX_WIDTH)
    elif image_bytes:
        thumb_key = _store_image(image_bytes, image, puja_id, "thumb", THUMBNAIL_MAX_WIDTH)
    else:
        thumb_key = None
    return image_key, thumb_key


@router.get("")
async def list_pujas_admin(
    search: Optional[str] = Query(default=None),
    listing_type: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if listing_type and listing_type not in LISTING_TYPES:
        raise HTTPException(status_code=400, detail="Invalid listing type filter.")

    client = _client()

    # Admin needs to see disabled pujas too, so no is_active filter here
    # (unlike the public /pujas endpoint used by the storefront).
    query = client.table("pujas").select("*", count="exact")
    query = _apply_search(query, search)
    if listing_type:
        query = query.eq("listing_type", listing_type)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0
    convert_records_image_fields(rows, fields=IMAGE_FIELDS)

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{puja_id}")
async def get_puja_admin_detail(
    puja_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("pujas").select("*").eq("id", puja_id).single().execute()
    puja = getattr(resp, "data", None)
    if not puja:
        raise HTTPException(status_code=404, detail="Puja not found.")

    convert_record_image_fields(puja, fields=IMAGE_FIELDS)
    return {"puja": puja}


# Multipart forms drop empty fields, so the admin form sends this value
# to mean "not linked to any festival".
NO_FESTIVAL = "none"


def _is_missing_festival_column(error: APIError) -> bool:
    # PGRST204 = column not in PostgREST's schema cache, i.e. the
    # 20261124000000_puja_festival_link.sql migration hasn't run yet.
    return getattr(error, "code", None) == "PGRST204" and "festival_name" in (getattr(error, "message", "") or "")


def _write_puja(run, payload: dict):
    """
    Runs an insert/update; if the database doesn't have pujas.festival_name
    yet, saves everything else instead of failing the whole edit -- unless
    the admin actually chose a festival, which then needs the migration.
    """
    try:
        return run(payload)
    except APIError as error:
        if not _is_missing_festival_column(error) or "festival_name" not in payload:
            raise
        if payload.get("festival_name"):
            raise HTTPException(
                status_code=400,
                detail="Festival linking needs a database update (migration 20261124000000_puja_festival_link.sql). Save without a festival, or run the migration first.",
            )
        return run({k: v for k, v in payload.items() if k != "festival_name"})


def _clean_festival_name(value: Optional[str]) -> Optional[str]:
    """Festival-specific pujas are linked to festivals.title (see admin_festivals.py)."""
    clean = " ".join((value or "").split())
    if not clean or clean.lower() == NO_FESTIVAL:
        return None
    return clean[:120]


@router.post("", status_code=201)
async def create_puja(
    title: str = Form(...),
    category: Optional[str] = Form(default=None),
    duration_minutes: Optional[int] = Form(default=None),
    base_price: Optional[float] = Form(default=None),
    description: Optional[str] = Form(default=None),
    benefits: Optional[str] = Form(default=None),
    listing_type: str = Form(default="normal"),
    puja_type: str = Form(default="normal"),
    is_active: bool = Form(default=True),
    festival_name: Optional[str] = Form(default=None),
    image: Optional[UploadFile] = File(default=None),
    thumbnail: Optional[UploadFile] = File(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Puja name is required.")

    if listing_type not in LISTING_TYPES:
        raise HTTPException(status_code=400, detail="Invalid listing type.")

    if puja_type not in PUJA_TYPES:
        raise HTTPException(status_code=400, detail="Invalid puja type.")

    client = _client()

    insert_payload = {
        "title": clean_title,
        "category": (category or "").strip() or None,
        "duration_minutes": duration_minutes,
        "base_price": base_price,
        "description": (description or "").strip() or None,
        "listing_type": listing_type,
        "puja_type": puja_type,
        "is_active": is_active,
        "metadata": {"benefits": _parse_benefits(benefits)},
        "created_by": current_user["id"],
        "updated_by": current_user["id"],
    }

    if _clean_festival_name(festival_name):
        insert_payload["festival_name"] = _clean_festival_name(festival_name)

    resp = _write_puja(lambda payload: client.table("pujas").insert(payload).select("*").execute(), insert_payload)
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not create the puja.")
    puja = rows[0]

    image_key, thumb_key = await _upload_puja_images(image, thumbnail, puja["id"])

    if image_key or thumb_key:
        image_update = {}
        if image_key:
            image_update["image_url"] = image_key
        if thumb_key:
            image_update["thumbnail_url"] = thumb_key

        upd_resp = client.table("pujas").update(image_update).eq("id", puja["id"]).select("*").execute()
        upd_rows = getattr(upd_resp, "data", None) or []
        if upd_rows:
            puja = upd_rows[0]

    write_audit_log(
        action="ADMIN_PUJA_CREATED",
        actor_id=str(current_user["id"]),
        entity="pujas",
        entity_id=str(puja["id"]),
        payload={"title": puja.get("title"), "listing_type": puja.get("listing_type")},
    )

    convert_record_image_fields(puja, fields=IMAGE_FIELDS)
    return {"message": "Puja created successfully.", "puja": puja}


@router.patch("/{puja_id}")
async def update_puja(
    puja_id: str,
    title: Optional[str] = Form(default=None),
    category: Optional[str] = Form(default=None),
    duration_minutes: Optional[int] = Form(default=None),
    base_price: Optional[float] = Form(default=None),
    description: Optional[str] = Form(default=None),
    benefits: Optional[str] = Form(default=None),
    listing_type: Optional[str] = Form(default=None),
    puja_type: Optional[str] = Form(default=None),
    is_active: Optional[bool] = Form(default=None),
    festival_name: Optional[str] = Form(default=None),
    image: Optional[UploadFile] = File(default=None),
    thumbnail: Optional[UploadFile] = File(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("pujas").select("id, title").eq("id", puja_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Puja not found.")

    if listing_type is not None and listing_type not in LISTING_TYPES:
        raise HTTPException(status_code=400, detail="Invalid listing type.")

    if puja_type is not None and puja_type not in PUJA_TYPES:
        raise HTTPException(status_code=400, detail="Invalid puja type.")

    update_payload = {"updated_by": current_user["id"]}

    if title is not None:
        clean_title = title.strip()
        if not clean_title:
            raise HTTPException(status_code=400, detail="Puja name is required.")
        update_payload["title"] = clean_title

    if category is not None:
        update_payload["category"] = category.strip() or None
    if duration_minutes is not None:
        update_payload["duration_minutes"] = duration_minutes
    if base_price is not None:
        update_payload["base_price"] = base_price
    if description is not None:
        update_payload["description"] = description.strip() or None
    if benefits is not None:
        # pujas.metadata isn't used for anything else today, so a full
        # replace here is safe and avoids an extra read-modify-write.
        update_payload["metadata"] = {"benefits": _parse_benefits(benefits)}
    if listing_type is not None:
        update_payload["listing_type"] = listing_type
    if puja_type is not None:
        update_payload["puja_type"] = puja_type
    if is_active is not None:
        update_payload["is_active"] = is_active
    if festival_name is not None:
        update_payload["festival_name"] = _clean_festival_name(festival_name)

    image_key, thumb_key = await _upload_puja_images(image, thumbnail, puja_id)
    if image_key:
        update_payload["image_url"] = image_key
    if thumb_key:
        update_payload["thumbnail_url"] = thumb_key

    resp = _write_puja(lambda payload: client.table("pujas").update(payload).eq("id", puja_id).select("*").execute(), update_payload)
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not update the puja.")
    puja = rows[0]

    write_audit_log(
        action="ADMIN_PUJA_UPDATED",
        actor_id=str(current_user["id"]),
        entity="pujas",
        entity_id=puja_id,
        payload={
            "title": puja.get("title"),
            "fields_changed": [key for key in update_payload if key != "updated_by"],
        },
    )

    convert_record_image_fields(puja, fields=IMAGE_FIELDS)
    return {"message": "Puja updated successfully.", "puja": puja}


class SetPujaStatusIn(BaseModel):
    is_active: bool


@router.patch("/{puja_id}/status")
async def set_puja_status(
    puja_id: str,
    payload: SetPujaStatusIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("pujas").select("id, title, is_active").eq("id", puja_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Puja not found.")

    client.table("pujas").update(
        {"is_active": payload.is_active, "updated_by": current_user["id"]}
    ).eq("id", puja_id).execute()

    write_audit_log(
        action="ADMIN_PUJA_STATUS_CHANGED",
        actor_id=str(current_user["id"]),
        entity="pujas",
        entity_id=puja_id,
        payload={
            "title": existing.get("title"),
            "old_is_active": existing.get("is_active"),
            "new_is_active": payload.is_active,
        },
    )

    return {"message": "Puja status updated.", "is_active": payload.is_active}


@router.delete("/{puja_id}")
async def delete_puja(
    puja_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("pujas").select("id, title").eq("id", puja_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Puja not found.")

    # NOTE: bookings.puja_id is a legacy INTEGER column from the very
    # first schema (001_create_booking_tables.sql) and was never
    # migrated to reference pujas.id (UUID) — the live booking flow
    # still runs on the separate static pujaCatalog.js, not this
    # table, so no real booking can reference this puja today. There
    # is nothing to safely check against yet; once the booking flow
    # is migrated onto the pujas table (a separate, larger change),
    # a real FK-based guard should be added back here.

    client.table("pujas").delete().eq("id", puja_id).execute()

    write_audit_log(
        action="ADMIN_PUJA_DELETED",
        actor_id=str(current_user["id"]),
        entity="pujas",
        entity_id=puja_id,
        payload={"title": existing.get("title")},
    )

    return {"message": "Puja deleted successfully."}
