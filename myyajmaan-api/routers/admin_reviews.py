from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import get_public_url_for_key, service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/reviews", tags=["admin-reviews"])


def _resolve_review_photos(rows: list):
    """
    reviews.photo_urls/cover_photo_url hold raw Supabase Storage keys
    (see upload_image_to_bucket in db.py) -- convert_record_image_fields
    only handles single string fields, not an array like photo_urls, so
    this is the array-aware equivalent for review rows specifically.
    """
    for row in rows:
        row["photo_urls"] = [get_public_url_for_key(key) for key in (row.get("photo_urls") or [])]
        if row.get("cover_photo_url"):
            row["cover_photo_url"] = get_public_url_for_key(row["cover_photo_url"])
    return rows

STATUS_VALUES = ("pending", "published", "hidden")
MAX_PUBLISHED = 20


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin reviews service is not configured.")
    return service_supabase


def _attach_client_names(client, rows: list):
    client_ids = [row["client_id"] for row in rows if row.get("client_id")]
    if not client_ids:
        return rows

    resp = client.table("users").select("id, full_name").in_("id", client_ids).execute()
    names_by_id = {u["id"]: u.get("full_name") for u in (getattr(resp, "data", None) or [])}

    for row in rows:
        row["client_name"] = names_by_id.get(row.get("client_id"))

    return rows


@router.get("/counts")
async def get_review_status_counts(
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    counts = {}

    for tab in ("all",) + STATUS_VALUES:
        query = client.table("reviews").select("id", count="exact")
        if tab != "all":
            query = query.eq("status", tab)
        resp = query.execute()
        counts[tab] = getattr(resp, "count", None) or 0

    return counts


@router.get("")
async def list_reviews_admin(
    status_filter: str = Query(default="all", alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if status_filter not in ("all",) + STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status filter.")

    client = _client()
    query = client.table("reviews").select("*", count="exact")
    if status_filter != "all":
        query = query.eq("status", status_filter)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0
    _attach_client_names(client, rows)
    _resolve_review_photos(rows)

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{review_id}")
async def get_review_admin_detail(
    review_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("reviews").select("*").eq("id", review_id).single().execute()
    review = getattr(resp, "data", None)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")

    _attach_client_names(client, [review])
    _resolve_review_photos([review])
    return {"review": review}


class CoverPhotoIn(BaseModel):
    photo_index: int = Field(ge=0)


@router.patch("/{review_id}/cover-photo")
async def set_review_cover_photo(
    review_id: str,
    payload: CoverPhotoIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Picks which of a review's uploaded photos represents it on the home
    page Testimonials carousel -- takes an index into the review's own
    photo_urls (not a URL directly), so the raw storage key gets stored
    consistently with how photo_urls itself is stored.
    """
    client = _client()
    resp = client.table("reviews").select("id, photo_urls").eq("id", review_id).single().execute()
    review = getattr(resp, "data", None)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")

    raw_photo_urls = review.get("photo_urls") or []
    if payload.photo_index >= len(raw_photo_urls):
        raise HTTPException(status_code=400, detail="This review does not have a photo at that position.")

    cover_key = raw_photo_urls[payload.photo_index]
    client.table("reviews").update({"cover_photo_url": cover_key}).eq("id", review_id).execute()

    write_audit_log(
        action="ADMIN_REVIEW_COVER_PHOTO_SET",
        actor_id=str(current_user["id"]),
        entity="reviews",
        entity_id=review_id,
        payload={"photo_index": payload.photo_index},
    )

    return {"message": "Cover photo updated.", "cover_photo_url": get_public_url_for_key(cover_key)}


class ReviewStatusIn(BaseModel):
    status: str = Field(pattern="^(pending|published|hidden)$")


@router.patch("/{review_id}/status")
async def set_review_status(
    review_id: str,
    payload: ReviewStatusIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("reviews").select("id, status, photo_urls, cover_photo_url").eq("id", review_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Review not found.")

    if payload.status == "published" and existing.get("status") != "published":
        count_resp = (
            client.table("reviews")
            .select("id", count="exact")
            .eq("status", "published")
            .execute()
        )
        published_count = getattr(count_resp, "count", None) or 0
        if published_count >= MAX_PUBLISHED:
            raise HTTPException(
                status_code=400,
                detail=f"You can publish at most {MAX_PUBLISHED} testimonials on the home page. Unpublish one first.",
            )

    update_payload = {"status": payload.status}
    if payload.status == "published":
        update_payload["published_at"] = datetime.now(timezone.utc).isoformat()
        # Defaults the cover photo to the first uploaded one if admin
        # published without explicitly picking one -- never overrides a
        # choice already made via PATCH .../cover-photo.
        if not existing.get("cover_photo_url") and existing.get("photo_urls"):
            update_payload["cover_photo_url"] = existing["photo_urls"][0]

    client.table("reviews").update(update_payload).eq("id", review_id).execute()

    write_audit_log(
        action="ADMIN_REVIEW_STATUS_CHANGED",
        actor_id=str(current_user["id"]),
        entity="reviews",
        entity_id=review_id,
        payload={"old_status": existing.get("status"), "new_status": payload.status},
    )

    return {"message": "Review status updated.", "status": payload.status}


@router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("reviews").select("id").eq("id", review_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Review not found.")

    client.table("reviews").delete().eq("id", review_id).execute()

    write_audit_log(
        action="ADMIN_REVIEW_DELETED",
        actor_id=str(current_user["id"]),
        entity="reviews",
        entity_id=review_id,
        payload={},
    )

    return {"message": "Review deleted successfully."}
