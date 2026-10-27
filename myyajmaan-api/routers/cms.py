import html
import re
from typing import Any, Dict, List, Optional

import bleach
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from permissions import require_admin_roles

PUBLIC_KEYS = {
    "privacy-policy": "policy",
    "terms-and-conditions": "policy",
    "cancellation-refund": "policy",
    "booking-journey": "journey",
    "yajmaan-benefits": "benefits",
    "pandit-benefits": "benefits",
}
MARKUP_RE = re.compile(r"<[^>]*>|javascript\s*:|data\s*:\s*text/html", re.IGNORECASE)
# No standalone "javascript:"/"data:" check here: that pattern matched
# ordinary prose too often (policy text routinely defines terms like
# "Contact Data:" or "Technical Data:"), and it's redundant anyway --
# bleach.clean() below already restricts every allowed href to
# protocols=["http", "https", "mailto"], so a javascript:/data: URI
# can't survive in an <a href> regardless of this pre-check.
RICH_TEXT_BLOCKED_RE = re.compile(r"<(script|style|iframe|object|embed|form)|\son[a-z]+\s*=", re.IGNORECASE)
ALLOWED_RICH_TEXT_TAGS = ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h2", "h3", "blockquote", "a"]
ALLOWED_RICH_TEXT_ATTRIBUTES = {"a": ["href", "target", "rel"]}

public_router = APIRouter(prefix="/cms", tags=["cms"])
admin_router = APIRouter(prefix="/admin/cms", tags=["admin-cms"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="CMS service is not configured.")
    return service_supabase


def _clean_text(value: Any, field_name: str, maximum: int, required: bool = True) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{field_name} must be plain text.")
    text = value.strip()
    if required and not text:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty.")
    if len(text) > maximum:
        raise HTTPException(status_code=400, detail=f"{field_name} must be {maximum} characters or fewer.")
    if MARKUP_RE.search(text) or any(ord(char) < 32 and char not in "\n\r\t" for char in text):
        raise HTTPException(status_code=400, detail=f"{field_name} contains unsupported markup or control characters.")
    return text


def _clean_rich_text(value: Any, field_name: str, maximum: int) -> str:
    if not isinstance(value, str):
        raise HTTPException(status_code=400, detail=f"{field_name} must be rich text.")
    # Quill stores some pasted source markup as HTML entities. Decode it
    # before validation so it is sanitized and rendered as markup, not text.
    text = html.unescape(value).strip()
    if not text:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty.")
    if len(text) > maximum:
        raise HTTPException(status_code=400, detail=f"{field_name} must be {maximum} characters or fewer.")
    if RICH_TEXT_BLOCKED_RE.search(text) or any(ord(char) < 32 and char not in "\n\r\t" for char in text):
        raise HTTPException(status_code=400, detail=f"{field_name} contains unsupported markup.")
    clean_html = bleach.clean(
        text,
        tags=ALLOWED_RICH_TEXT_TAGS,
        attributes=ALLOWED_RICH_TEXT_ATTRIBUTES,
        protocols=["http", "https", "mailto"],
        strip=True,
    ).strip()
    visible_text = bleach.clean(clean_html, tags=[], strip=True).strip()
    if not visible_text:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be empty.")
    return clean_html


def _sanitize_rich_text_for_display(value: Any) -> str:
    """Safely normalizes legacy CMS versions saved before entity decoding."""
    if not isinstance(value, str):
        return ""
    return bleach.clean(
        html.unescape(value),
        tags=ALLOWED_RICH_TEXT_TAGS,
        attributes=ALLOWED_RICH_TEXT_ATTRIBUTES,
        protocols=["http", "https", "mailto"],
        strip=True,
    ).strip()


def _public_content(key: str, content: Any) -> Any:
    if PUBLIC_KEYS.get(key) != "policy" or not isinstance(content, dict):
        return content
    normalized = dict(content)
    normalized["body"] = _sanitize_rich_text_for_display(normalized.get("body"))
    return normalized


def _validate_cards(cards: Any, label: str, minimum: int = 1, maximum: int = 6) -> List[dict]:
    if not isinstance(cards, list) or not minimum <= len(cards) <= maximum:
        raise HTTPException(status_code=400, detail=f"{label} require between {minimum} and {maximum} cards.")
    clean_cards: List[dict] = []
    for index, card in enumerate(cards, start=1):
        if not isinstance(card, dict):
            raise HTTPException(status_code=400, detail=f"{label} card {index} is invalid.")
        card_title = _clean_text(card.get("title"), f"{label} card {index} title", 60)
        card_description = _clean_text(card.get("description"), f"{label} card {index} description", 220)
        if len(card_title.split()) > 8 or len(card_description.split()) > 40:
            raise HTTPException(status_code=400, detail=f"{label} card {index} exceeds the word limit.")
        clean_cards.append({"title": card_title, "description": card_description})
    return clean_cards


def _validate_content(key: str, content: Dict[str, Any]) -> Dict[str, Any]:
    content_type = PUBLIC_KEYS.get(key)
    if not content_type:
        raise HTTPException(status_code=404, detail="Unknown CMS page.")
    if not isinstance(content, dict):
        raise HTTPException(status_code=400, detail="CMS content must be an object.")

    title = _clean_text(content.get("title"), "Title", 120)
    description = _clean_text(content.get("description"), "Description", 400)
    if content_type == "policy":
        return {
            "title": title,
            "description": description,
            "body": _clean_rich_text(content.get("body"), "Page content", 80000),
        }
    if content_type == "journey":
        if len(title.split()) > 12:
            raise HTTPException(status_code=400, detail="Journey title must contain 12 words or fewer.")
        if len(description.split()) > 35:
            raise HTTPException(status_code=400, detail="Journey description must contain 35 words or fewer.")
        return {"title": title, "description": description, "cards": _validate_cards(content.get("cards"), "Journey", 1, 6)}

    return {"title": title, "description": description, "cards": _validate_cards(content.get("cards"), "Benefits")}


@public_router.get("/{key}")
async def get_public_content(key: str):
    if key not in PUBLIC_KEYS:
        raise HTTPException(status_code=404, detail="Unknown CMS page.")
    result = _client().table("cms_content_versions").select("content, created_at, version").eq("key", key).order("version", desc=True).limit(1).execute()
    rows = getattr(result, "data", None) or []
    return {"content": _public_content(key, rows[0]["content"]) if rows else None, "updated_at": rows[0].get("created_at") if rows else None, "version": rows[0].get("version") if rows else None}


class CmsContentIn(BaseModel):
    content: Dict[str, Any]


@admin_router.get("")
async def list_cms_content(current_user: dict = Depends(require_admin_roles())):
    result = _client().table("cms_content_versions").select("key, content, created_at, version").order("version", desc=True).execute()
    by_key = {}
    for row in getattr(result, "data", None) or []:
        by_key.setdefault(row["key"], row)
    return {"items": [{"key": key, "type": content_type, "content": by_key.get(key, {}).get("content"), "updated_at": by_key.get(key, {}).get("created_at"), "version": by_key.get(key, {}).get("version")} for key, content_type in PUBLIC_KEYS.items()]}


@admin_router.put("/{key}")
async def save_cms_content(key: str, payload: CmsContentIn, current_user: dict = Depends(require_admin_roles())):
    content = _validate_content(key, payload.content)
    client = _client()
    current = client.table("cms_content_versions").select("version").eq("key", key).order("version", desc=True).limit(1).execute()
    current_rows = getattr(current, "data", None) or []
    version = int(current_rows[0]["version"]) + 1 if current_rows else 1
    client.table("cms_content").upsert({"key": key, "content": content, "updated_by": current_user["id"]}, on_conflict="key").execute()
    result = client.table("cms_content_versions").insert({"key": key, "version": version, "content": content, "created_by": current_user["id"]}).select("key, content, created_at, version").execute()
    rows = getattr(result, "data", None) or []
    write_audit_log(action="ADMIN_CMS_UPDATED", actor_id=str(current_user["id"]), entity="cms_content", entity_id=key, payload={"key": key, "version": version})
    return {"message": "CMS content saved as a new version.", "item": rows[0] if rows else None}