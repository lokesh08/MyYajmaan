import io
import os
import logging
import re
from typing import List, Optional

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_PUBLIC_BUCKET = os.getenv("SUPABASE_PUBLIC_BUCKET", "images")

if not SUPABASE_URL:
    logging.warning("SUPABASE_URL is not configured")

if not SUPABASE_SERVICE_ROLE_KEY:
    logging.warning("SUPABASE_SERVICE_ROLE_KEY is not configured")

service_supabase = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        service_supabase = create_client(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        )
        logging.info("Supabase service client initialized")
    except Exception as exc:
        logging.exception(
            "Failed to initialize Supabase service client: %s",
            exc,
        )
        service_supabase = None


def create_supabase_client_for_key(key: str):
    """
    Creates a Supabase client using an anon key or user access token.
    """

    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not configured")

    if not key:
        raise RuntimeError("Supabase key is required")

    return create_client(SUPABASE_URL, key)


def _normalize_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None

    return key.lstrip("/")


def get_public_url_for_key(
    key: Optional[str],
    client=None,
) -> Optional[str]:
    """
    Converts a Supabase Storage path into a public URL.

    Supported values:

    images/pandits/pandit-1.jpg
    /pandits/pandit-1.jpg
    pandits/pandit-1.jpg
    https://...
    """

    if not key:
        return None

    if isinstance(key, str):
        if key.startswith("http://") or key.startswith("https://"):
            return key

        if key.startswith("/images/"):
            # A static asset bundled with the frontend (served from its
            # own public/images/ folder), not a Supabase Storage object.
            # Leave it exactly as given so the frontend resolves it
            # against its own origin, instead of treating it as a
            # storage key in the default bucket below.
            return key

    original_key = key
    has_leading_slash = (
        isinstance(key, str) and key.startswith("/")
    )

    normalized_key = _normalize_key(key)

    if not normalized_key:
        return None

    if "://" in normalized_key:
        return original_key

    storage_client = client or service_supabase

    if storage_client is None:
        return original_key

    def try_get_public_url(
        bucket_name: str,
        object_path: str,
    ) -> Optional[str]:
        try:
            result = (
                storage_client
                .storage
                .from_(bucket_name)
                .get_public_url(object_path)
            )

            # The installed supabase-py / storage3 client returns the
            # public URL as a plain string. Older SDK versions (and the
            # JS SDK) return a dict/object with a publicUrl field, so
            # both shapes are handled here.
            if isinstance(result, str):
                return result or None

            if isinstance(result, dict):
                return (
                    result.get("publicUrl")
                    or result.get("publicURL")
                    or result.get("public_url")
                )

            return (
                getattr(result, "publicUrl", None)
                or getattr(result, "publicURL", None)
                or getattr(result, "public_url", None)
            )

        except Exception as exc:
            logging.debug(
                "Could not create public URL for %s/%s: %s",
                bucket_name,
                object_path,
                exc,
            )
            return None

    default_bucket = SUPABASE_PUBLIC_BUCKET or "images"

    # Example: /pandits/pandit-1.jpg
    if has_leading_slash:
        public_url = try_get_public_url(
            default_bucket,
            normalized_key,
        )

        return public_url or original_key

    parts = normalized_key.split("/", 1)

    # Example: images/pandits/pandit-1.jpg
    if len(parts) == 2:
        bucket_guess = parts[0]
        object_path_guess = parts[1]

        public_url = try_get_public_url(
            bucket_guess,
            object_path_guess,
        )

        if public_url:
            return public_url

        # Fallback: treat the complete value as a path
        # inside the configured default bucket.
        public_url = try_get_public_url(
            default_bucket,
            normalized_key,
        )

        return public_url or original_key

    # Example: pandit-1.jpg
    public_url = try_get_public_url(
        default_bucket,
        normalized_key,
    )

    return public_url or original_key


def convert_record_image_fields(
    record: dict,
    fields: Optional[List[str]] = None,
):
    """
    Converts image/storage fields in one database record.
    """

    if not record:
        return record

    if fields is None:
        fields = [
            "image_url",
            "thumbnail_url",
            "portrait_url",
            "image",
            "thumb",
            "avatar_url",
        ]

    for field in fields:
        if record.get(field):
            try:
                record[field] = get_public_url_for_key(
                    record[field]
                )
            except Exception as exc:
                logging.debug(
                    "Could not convert image field %s: %s",
                    field,
                    exc,
                )

    return record


def convert_records_image_fields(
    records: List[dict],
    fields: Optional[List[str]] = None,
):
    """
    Converts image/storage fields in multiple database records.
    """

    if not records:
        return records

    for record in records:
        convert_record_image_fields(record, fields)

    return records


def upload_image_to_bucket(
    file_bytes: bytes,
    content_type: str,
    path: str,
    client=None,
) -> str:
    """
    Uploads raw image bytes to Supabase Storage and returns a
    storage key in the "bucket/path" form get_public_url_for_key()
    already knows how to resolve.

    `path` should already be unique/stable for the record it
    belongs to (e.g. "pujas/<puja_id>/big.jpg") so repeat uploads
    (edits) simply overwrite the same object instead of piling up
    orphaned files.
    """

    storage_client = client or service_supabase

    if storage_client is None:
        raise RuntimeError("Supabase storage client is not configured")

    bucket = SUPABASE_PUBLIC_BUCKET or "images"

    storage_client.storage.from_(bucket).upload(
        path,
        file_bytes,
        {"content-type": content_type or "application/octet-stream", "upsert": "true"},
    )

    return f"{bucket}/{path}"


# Sizes for catalogue images (puja cards / detail banner). Uploaded
# originals are often 3-4 MB PNGs; at these widths and WebP they're
# ~30-150 KB and still sharp on high-density phone screens.
THUMBNAIL_MAX_WIDTH = 480
LARGE_IMAGE_MAX_WIDTH = 1200


def webp_variant(content: bytes, max_width: int, quality: int = 80) -> Optional[bytes]:
    """
    Re-encodes an image as WebP no wider than `max_width` (never
    upscaled). Returns None if it can't -- callers then keep the original
    bytes, so a decoding problem never blocks an upload.
    """
    try:
        from PIL import Image, ImageOps

        with Image.open(io.BytesIO(content)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
            if img.width > max_width:
                img = img.resize((max_width, round(img.height * max_width / img.width)), Image.LANCZOS)
            out = io.BytesIO()
            img.save(out, format="WEBP", quality=quality, method=6)
            return out.getvalue()
    except Exception:
        logging.exception("Could not create a WebP variant; keeping the original image.")
        return None


# Allowed for every "photo" upload in the app (booking completion
# photos, review photos, Pandit Ji documents/profile photo). Nothing
# else -- an unrestricted upload accepts arbitrary file types (e.g. an
# .html/.svg file that could run script if ever opened directly, or a
# huge file with no size limit at all) stored in the same public bucket
# every legitimate photo is served from.
ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB


def validate_image_upload(content_type: Optional[str], content: bytes) -> None:
    """
    Raises HTTPException(400) unless `content` looks like a small,
    genuinely-image file. Checked here, once, for every photo upload
    endpoint rather than trusting the browser-supplied filename/
    Content-Type alone (both are just what the client claims, not
    verified) -- Pillow actually decoding the bytes as an image is
    what makes this a real check, not a string comparison.
    """
    from fastapi import HTTPException

    if not content:
        raise HTTPException(status_code=400, detail="This file is empty.")

    if len(content) > MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"This file is too large. Please upload an image under {MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )

    if content_type and content_type.lower() not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPEG, PNG, WEBP or HEIC image.")

    try:
        from PIL import Image

        with Image.open(io.BytesIO(content)) as image:
            image.verify()
    except Exception:
        raise HTTPException(status_code=400, detail="This file is not a valid image.")


def sanitize_or_filter_term(term: str) -> str:
    """
    Strips the characters PostgREST's filter-expression syntax treats as
    structural (comma separates conditions, parentheses group them,
    periods separate column/operator/value) from a value that's about
    to be interpolated into a raw .or_(f"col.ilike.%{term}%,...") call.

    An admin search box's free-text `term` is the only untrusted part of
    that string; everything else is a fixed, code-authored template. A
    `,` (or `(`/`)`/`.`) inside `term` would otherwise be read by
    PostgREST as ending the current condition and starting another --
    e.g. injecting an extra column comparison of the attacker's choice
    -- rather than as a literal character to search for. `%`/`_`
    (ILIKE wildcards) are left to each call site, since some legitimately
    strip them and some don't.
    """
    return re.sub(r"[,().]", "", term)