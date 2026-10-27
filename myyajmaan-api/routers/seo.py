"""
Dynamic half of the sitemap: every active puja and every approved Pandit
Ji profile, which live in the database (the static pages are listed in
the front-end's own sitemap.xml, generated at build time).

Declared in the front-end's robots.txt, so search engines discover it
automatically. It only ever lists what the public pages can already show:
active pujas, and Pandit Ji that admin has approved and kept active.
"""

import logging
from datetime import datetime
from typing import List, Optional
from xml.sax.saxutils import escape

from fastapi import APIRouter, Response

import config
from db import SUPABASE_ANON_KEY, create_supabase_client_for_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["seo"])

# Search engines cap a single sitemap at 50,000 URLs.
MAX_URLS = 50000


def _rows(query) -> List[dict]:
    try:
        return getattr(query.execute(), "data", None) or []
    except Exception:
        # A sitemap must never 500 -- serve whatever half loaded.
        logger.exception("Sitemap query failed")
        return []


def _lastmod(row: dict) -> Optional[str]:
    value = row.get("updated_at") or row.get("created_at")
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def _url_entry(base: str, path: str, row: dict, changefreq: str, priority: str) -> str:
    lastmod = _lastmod(row)
    return (
        "  <url>\n"
        f"    <loc>{escape(base + path)}</loc>\n"
        + (f"    <lastmod>{lastmod}</lastmod>\n" if lastmod else "")
        + f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>"
    )


@router.get("/sitemap-dynamic.xml", include_in_schema=False)
def sitemap_dynamic():
    base = config.PUBLIC_SITE_URL.rstrip("/")
    entries: List[str] = []

    if base and SUPABASE_ANON_KEY:
        client = create_supabase_client_for_key(SUPABASE_ANON_KEY)

        for row in _rows(
            client.table("pujas").select("id, created_at").eq("is_active", True).order("created_at")
        ):
            entries.append(_url_entry(base, f"/book/{row['id']}", row, "weekly", "0.8"))

        if config.SITEMAP_INCLUDE_PANDITS:
            for row in _rows(
                client.table("pandits")
                .select("id, created_at")
                .eq("is_active", True)
                .eq("verification_status", "approved")
                .order("created_at")
            ):
                entries.append(_url_entry(base, f"/pandit/{row['id']}", row, "weekly", "0.6"))

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries[:MAX_URLS])
        + "\n</urlset>\n"
    )

    return Response(
        content=body,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
