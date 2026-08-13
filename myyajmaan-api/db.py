# db.py
import os
import logging
from typing import List, Optional

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
logging.basicConfig(level=logging.INFO)

# Required env vars
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Optional bucket name for keys without explicit bucket
SUPABASE_PUBLIC_BUCKET = os.environ.get("SUPABASE_PUBLIC_BUCKET")  # e.g. "public"

if not SUPABASE_URL:
    logging.warning("SUPABASE_URL is not set in environment; many DB operations will fail.")

if not SUPABASE_SERVICE_ROLE_KEY:
    logging.warning("SUPABASE_SERVICE_ROLE_KEY is not set. Service client will not be available.")

# Create service-role client (server only)
service_supabase = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        service_supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logging.exception("Failed to create service_supabase client: %s", e)
        service_supabase = None

def create_supabase_client_for_key(key: str):
    """
    Create a Supabase client for a given key (anon or user JWT). Used for per-request clients.
    """
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL not configured")
    if not key:
        raise RuntimeError("Supabase key is required")
    return create_client(SUPABASE_URL, key)

# -----------------------
# Helpers for storage keys -> public URLs
# -----------------------
def _normalize_key(key: Optional[str]) -> Optional[str]:
    if not key:
        return None
    return key.lstrip("/")

def get_public_url_for_key(key: Optional[str], client=None) -> Optional[str]:
    """
    Convert a storage key (either 'bucket/path/to/object' or '/path/to/object' or 'path/to/object')
    into a public URL.

    Behavior:
    - If key already is an http(s) URL, return it unchanged.
    - If key starts with '/', treat it as path-only and use SUPABASE_PUBLIC_BUCKET (or 'public').
    - Otherwise: if value contains '/', interpret first segment as bucket and rest as path.
      * If that lookup fails, try fallback treating the whole normalized value as path with SUPABASE_PUBLIC_BUCKET.
    - Uses provided client (defaults to service_supabase).
    Returns the public URL on success, or the original key if conversion fails.
    """
    if not key:
        return None

    # already a full URL
    if isinstance(key, str) and (key.startswith("http://") or key.startswith("https://")):
        return key

    original = key
    has_leading_slash = isinstance(key, str) and key.startswith("/")
    k = _normalize_key(key)
    if not k:
        return None

    # don't attempt to parse URIs with scheme
    if "://" in k:
        return original

    client = client or service_supabase
    if client is None:
        logging.debug("service_supabase client not available; returning original key for %s", key)
        return original

    # helper to call storage.get_public_url defensively
    def try_get_public(bucket_name: str, object_path: str) -> Optional[str]:
        try:
            res = client.storage.from_(bucket_name).get_public_url(object_path)
            if isinstance(res, dict):
                return res.get("publicURL") or res.get("public_url") or res.get("publicUrl")
            return getattr(res, "publicURL", None) or getattr(res, "public_url", None) or getattr(res, "publicUrl", None)
        except Exception as ee:
            logging.debug("get_public_url failed for bucket=%s path=%s : %s", bucket_name, object_path, ee)
            return None

    # 1) If leading slash: treat as path-only (use default bucket)
    if has_leading_slash:
        bucket = SUPABASE_PUBLIC_BUCKET or "public"
        path = k
        url = try_get_public(bucket, path)
        if url:
            return url
        # fallback: try interpreting first segment as bucket (rare)
        parts = k.split("/", 1)
        if len(parts) == 2:
            fbucket, fpath = parts[0], parts[1]
            url2 = try_get_public(fbucket, fpath)
            if url2:
                return url2
        return original

    # 2) No leading slash: first try bucket/path interpretation
    parts = k.split("/", 1)
    if len(parts) == 2:
        bucket_guess, path_guess = parts[0], parts[1]
        url = try_get_public(bucket_guess, path_guess)
        if url:
            return url
        # fallback: treat whole k as path in default bucket
        bucket = SUPABASE_PUBLIC_BUCKET or "public"
        url2 = try_get_public(bucket, k)
        if url2:
            return url2
        return original
    else:
        # single segment: treat as path in default bucket
        bucket = SUPABASE_PUBLIC_BUCKET or "public"
        path = parts[0]
        url = try_get_public(bucket, path)
        if url:
            return url
        return original

def convert_record_image_fields(record: dict, fields: Optional[List[str]] = None):
    """
    Mutates a single record in-place converting configured fields that may contain storage keys
    into public URLs using get_public_url_for_key.
    """
    if not record:
        return record

    if fields is None:
        fields = ["image_url", "thumbnail_url", "portrait_url", "image", "thumb", "avatar_url"]

    for f in fields:
        if f in record and record.get(f):
            try:
                record[f] = get_public_url_for_key(record[f])
            except Exception:
                logging.debug("Failed to convert image field %s for record id=%s", f, record.get("id"))
    return record

def convert_records_image_fields(records: List[dict], fields: Optional[List[str]] = None):
    """
    Mutates list of records converting image fields for each.
    """
    if not records:
        return records
    for r in records:
        convert_record_image_fields(r, fields)
    return records