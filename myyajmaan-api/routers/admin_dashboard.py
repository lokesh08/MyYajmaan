from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin dashboard service is not configured.")
    return service_supabase


def _count(table: str, **filters) -> int:
    query = _client().table(table).select("id", count="exact")
    for key, value in filters.items():
        query = query.eq(key, value)
    resp = query.execute()
    return getattr(resp, "count", None) or 0


@router.get("/summary")
async def get_dashboard_summary(current_user: dict = Depends(require_admin_roles())):
    client = _client()

    total_users = _count("users", role="user")
    total_pandits = _count("users", role="pandit")
    total_bookings = _count("bookings")

    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    revenue_resp = (
        client.table("bookings")
        .select("amount")
        .gte("created_at", month_start.isoformat())
        .neq("status", "cancelled")
        .execute()
    )
    revenue_rows = getattr(revenue_resp, "data", None) or []
    revenue_this_month = sum(float(row.get("amount") or 0) for row in revenue_rows)

    return {
        "total_users": total_users,
        "total_pandits": total_pandits,
        "total_bookings": total_bookings,
        "revenue_this_month": revenue_this_month,
    }


@router.get("/bookings-overview")
async def get_bookings_overview(
    days: int = Query(default=7, ge=1, le=90),
    current_user: dict = Depends(require_admin_roles()),
):
    since = datetime.now(timezone.utc) - timedelta(days=days - 1)
    since_date = since.date()

    resp = (
        _client()
        .table("bookings")
        .select("created_at")
        .gte("created_at", since.isoformat())
        .execute()
    )
    rows = getattr(resp, "data", None) or []

    counts_by_day = Counter()
    for row in rows:
        created_at = row.get("created_at")
        if not created_at:
            continue
        day = datetime.fromisoformat(created_at.replace("Z", "+00:00")).date()
        counts_by_day[day] += 1

    series = []
    for offset in range(days):
        day = since_date + timedelta(days=offset)
        series.append({"date": day.isoformat(), "count": counts_by_day.get(day, 0)})

    return {"series": series}


@router.get("/bookings-by-status")
async def get_bookings_by_status(current_user: dict = Depends(require_admin_roles())):
    resp = _client().table("bookings").select("status").execute()
    rows = getattr(resp, "data", None) or []

    tally = Counter((row.get("status") or "unknown") for row in rows)
    return {"statuses": [{"status": status_name, "count": count} for status_name, count in tally.items()]}


@router.get("/recent-bookings")
async def get_recent_bookings(
    limit: int = Query(default=5, ge=1, le=50),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = (
        client.table("bookings")
        .select("id, client_id, pandit_id, booking_date, date, amount, status, created_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    bookings = getattr(resp, "data", None) or []

    client_ids = [row["client_id"] for row in bookings if row.get("client_id")]
    pandit_ids = [row["pandit_id"] for row in bookings if row.get("pandit_id")]

    users_by_id = {}
    if client_ids:
        users_resp = client.table("users").select("id, full_name").in_("id", client_ids).execute()
        users_by_id = {row["id"]: row.get("full_name") for row in (getattr(users_resp, "data", None) or [])}

    pandits_by_id = {}
    if pandit_ids:
        pandits_resp = client.table("pandits").select("id, display_name").in_("id", pandit_ids).execute()
        pandits_by_id = {row["id"]: row.get("display_name") for row in (getattr(pandits_resp, "data", None) or [])}

    for row in bookings:
        row["client_name"] = users_by_id.get(row.get("client_id"), "N/A")
        row["pandit_name"] = pandits_by_id.get(row.get("pandit_id"), "N/A")
        row["date_display"] = row.get("booking_date") or row.get("date")

    return {"bookings": bookings}


@router.get("/top-pujas")
async def get_top_pujas(
    limit: int = Query(default=5, ge=1, le=20),
    current_user: dict = Depends(require_admin_roles()),
):
    # Legacy bookings.puja_id is not a foreign key to pujas.id, so counts are
    # grouped by the raw puja_id value and best-effort matched to a title.
    client = _client()
    resp = client.table("bookings").select("puja_id").execute()
    rows = getattr(resp, "data", None) or []

    tally = Counter(row["puja_id"] for row in rows if row.get("puja_id") is not None)
    top_ids = [puja_id for puja_id, _ in tally.most_common(limit)]

    titles_by_id = {}
    if top_ids:
        pujas_resp = client.table("pujas").select("id, title").execute()
        for puja in getattr(pujas_resp, "data", None) or []:
            titles_by_id[puja["id"]] = puja.get("title")

    return {
        "pujas": [
            {
                "puja_id": puja_id,
                "title": titles_by_id.get(puja_id, f"Puja #{puja_id}"),
                "booking_count": count,
            }
            for puja_id, count in tally.most_common(limit)
        ]
    }
