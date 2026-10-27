import time
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from audit import write_audit_log
from db import get_public_url_for_key, service_supabase, upload_image_to_bucket, validate_image_upload
from notifications import notify_user
from permissions import require_roles

router = APIRouter(prefix="/reviews", tags=["reviews"])

# Keeps Supabase Storage usage bounded -- a few feedback photos per
# review is the point, not an unlimited photo dump. Enforced here (not
# just in the UI) since this is the only thing that actually protects
# storage.
MAX_REVIEW_PHOTOS = 3


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Reviews service is not configured.")
    return service_supabase


@router.get("/published")
def list_published_reviews(limit: int = Query(default=20, ge=1, le=20)):
    """
    Reviews admin has published, for the Home page Testimonials
    section. Capped at 20 to match the admin publish limit.
    """
    client = _client()

    resp = (
        client.table("reviews")
        .select("id, client_id, pandit_id, rating, comment, puja_title, published_at, cover_photo_url")
        .eq("status", "published")
        .order("published_at", desc=True)
        .limit(limit)
        .execute()
    )
    reviews = getattr(resp, "data", None) or []

    client_ids = [row["client_id"] for row in reviews if row.get("client_id")]
    names_by_id = {}
    if client_ids:
        users_resp = client.table("users").select("id, full_name").in_("id", client_ids).execute()
        names_by_id = {u["id"]: u.get("full_name") for u in (getattr(users_resp, "data", None) or [])}

    pandit_ids = [row["pandit_id"] for row in reviews if row.get("pandit_id")]
    cities_by_pandit = {}
    if pandit_ids:
        pandits_resp = client.table("pandits").select("id, city").in_("id", pandit_ids).execute()
        cities_by_pandit = {p["id"]: p.get("city") for p in (getattr(pandits_resp, "data", None) or [])}

    for row in reviews:
        full_name = names_by_id.get(row.get("client_id")) or "A MyYajmaan customer"
        # Only the first name is shown publicly, matching common
        # testimonial-display practice.
        row["customer_name"] = full_name.split(" ")[0]
        row["location"] = cities_by_pandit.get(row.get("pandit_id"))
        row["puja_title"] = row.get("puja_title") or "Puja booking"
        if row.get("cover_photo_url"):
            row["cover_photo_url"] = get_public_url_for_key(row["cover_photo_url"])
        row.pop("client_id", None)
        row.pop("pandit_id", None)

    return reviews


@router.post("")
async def submit_review(
    booking_id: str = Form(...),
    rating: int = Form(...),
    comment: str = Form(default=""),
    puja_title: str = Form(default=""),
    photos: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(require_roles("user")),
):
    """
    Customer feedback on a completed booking. Lands as status='pending'
    for admin to review before it can ever appear in the home page
    Testimonials section (GET /reviews/published only returns
    status='published' rows).
    """

    if not (1 <= rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")

    if len(photos or []) > MAX_REVIEW_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Please attach at most {MAX_REVIEW_PHOTOS} photos.")

    client = _client()

    booking_resp = (
        client.table("bookings")
        .select("id, client_id, pandit_id, status")
        .eq("id", booking_id)
        .eq("client_id", current_user["id"])
        .limit(1)
        .execute()
    )
    booking_rows = getattr(booking_resp, "data", None) or []
    if not booking_rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = booking_rows[0]

    if booking.get("status") != "completed":
        raise HTTPException(status_code=400, detail="You can only leave feedback for a completed booking.")

    existing_resp = client.table("reviews").select("id").eq("booking_id", booking_id).limit(1).execute()
    if getattr(existing_resp, "data", None):
        raise HTTPException(status_code=400, detail="You've already submitted feedback for this booking.")

    photo_urls = []
    for index, photo in enumerate(photos or []):
        if not photo.filename:
            continue
        content = await photo.read()
        if not content:
            continue
        validate_image_upload(photo.content_type, content)
        ext = "." + photo.filename.rsplit(".", 1)[-1].lower() if "." in photo.filename else ""
        path = f"reviews/{booking_id}/photo-{int(time.time() * 1000)}-{index}{ext}"
        photo_urls.append(upload_image_to_bucket(content, photo.content_type or "", path))

    columns = {
        "booking_id": booking_id,
        "client_id": current_user["id"],
        "pandit_id": booking["pandit_id"],
        "rating": rating,
        "comment": comment.strip() or None,
        "puja_title": puja_title.strip() or None,
        "photo_urls": photo_urls,
        "status": "pending",
    }

    resp = client.table("reviews").insert(columns).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not submit your feedback.")

    write_audit_log(
        action="CLIENT_REVIEW_SUBMITTED",
        actor_id=str(current_user["id"]),
        entity="reviews",
        entity_id=str(rows[0]["id"]),
        payload={"booking_id": booking_id, "rating": rating, "photo_count": len(photo_urls)},
    )

    try:
        admins_resp = client.table("users").select("id").eq("role", "admin").execute()
        customer_name = current_user.get("full_name") or "A customer"
        for admin_row in getattr(admins_resp, "data", None) or []:
            await notify_user(
                user_id=admin_row["id"],
                type="REVIEW_SUBMITTED",
                title="New review awaiting moderation",
                message=f"{customer_name} left a {rating}-star review.",
                link="/admin/testimonials",
                metadata={"review_id": rows[0]["id"]},
            )
    except Exception:
        pass

    saved = rows[0]
    saved["photo_urls"] = [get_public_url_for_key(key) for key in (saved.get("photo_urls") or [])]
    return {"message": "Thank you! Your feedback has been submitted for review.", "review": saved}
