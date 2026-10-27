import csv
import io
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from audit import write_audit_log
from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])

DATE_RANGE_DAYS = {
    "last_7_days": 7,
    "last_30_days": 30,
    "last_90_days": 90,
}


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin reports service is not configured.")
    return service_supabase


def _resolve_range(date_range: str):
    days = DATE_RANGE_DAYS.get(date_range, 30)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    prev_start = start - timedelta(days=days)
    return start, now, prev_start, start


def _fetch_bookings(client, start, end, puja_id: Optional[str], city: Optional[str]):
    """
    NOTE: bookings.puja_id is a legacy integer column, not a real
    foreign key to pujas.id (same limitation already documented in
    admin_dashboard.py's get_top_pujas) — the puja filter here is
    best-effort for that reason. City comes via
    bookings.address_id -> client_addresses.city, which is only
    populated when a booking actually recorded a delivery address.
    """
    query = (
        client.table("bookings")
        .select("id, client_id, puja_id, amount, status, address_id, created_at")
        .gte("created_at", start.isoformat())
        .lt("created_at", end.isoformat())
        .neq("status", "cancelled")
    )

    if puja_id:
        try:
            query = query.eq("puja_id", int(puja_id))
        except (TypeError, ValueError):
            query = query.eq("puja_id", puja_id)

    resp = query.execute()
    rows = getattr(resp, "data", None) or []

    if city:
        address_ids = [r["address_id"] for r in rows if r.get("address_id")]
        city_by_address = {}
        if address_ids:
            addr_resp = client.table("client_addresses").select("id, city").in_("id", address_ids).execute()
            city_by_address = {a["id"]: a.get("city") for a in (getattr(addr_resp, "data", None) or [])}
        rows = [r for r in rows if city_by_address.get(r.get("address_id")) == city]

    return rows


@router.get("/summary")
async def get_reports_summary(
    date_range: str = Query(default="last_30_days"),
    puja_id: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    start, end, prev_start, prev_end = _resolve_range(date_range)

    current_rows = _fetch_bookings(client, start, end, puja_id, city)
    prev_rows = _fetch_bookings(client, prev_start, prev_end, puja_id, city)

    def summarize(rows):
        total_bookings = len(rows)
        total_revenue = sum(float(r.get("amount") or 0) for r in rows)
        unique_users = len({r["client_id"] for r in rows if r.get("client_id")})
        avg_order_value = (total_revenue / total_bookings) if total_bookings else 0
        return total_bookings, total_revenue, unique_users, avg_order_value

    bookings, revenue, users, avg_value = summarize(current_rows)
    prev_bookings, prev_revenue, prev_users, prev_avg_value = summarize(prev_rows)

    def pct_change(current, previous):
        if not previous:
            return None
        return round(((current - previous) / previous) * 100, 1)

    return {
        "total_bookings": bookings,
        "total_bookings_change": pct_change(bookings, prev_bookings),
        "total_revenue": round(revenue, 2),
        "total_revenue_change": pct_change(revenue, prev_revenue),
        "unique_users": users,
        "unique_users_change": pct_change(users, prev_users),
        "avg_order_value": round(avg_value, 2),
        "avg_order_value_change": pct_change(avg_value, prev_avg_value),
    }


@router.get("/trend")
async def get_reports_trend(
    puja_id: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    now = datetime.now(timezone.utc)
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    last_month_end = this_month_start

    this_month_rows = _fetch_bookings(client, this_month_start, now, puja_id, city)
    last_month_rows = _fetch_bookings(client, last_month_start, last_month_end, puja_id, city)

    def daily_counts(rows, period_start):
        counts = Counter()
        for row in rows:
            created_at = row.get("created_at")
            if not created_at:
                continue
            day = datetime.fromisoformat(created_at.replace("Z", "+00:00")).date()
            counts[(day - period_start.date()).days] += 1
        return counts

    this_counts = daily_counts(this_month_rows, this_month_start)
    last_counts = daily_counts(last_month_rows, last_month_start)

    days_in_period = (now.date() - this_month_start.date()).days + 1
    series = [
        {
            "day": offset + 1,
            "this_month": this_counts.get(offset, 0),
            "last_month": last_counts.get(offset, 0),
        }
        for offset in range(days_in_period)
    ]

    return {"series": series}


@router.get("/top-cities")
async def get_top_cities(
    date_range: str = Query(default="last_30_days"),
    puja_id: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    start, end, _, _ = _resolve_range(date_range)
    rows = _fetch_bookings(client, start, end, puja_id, None)

    address_ids = [r["address_id"] for r in rows if r.get("address_id")]
    city_by_address = {}
    if address_ids:
        addr_resp = client.table("client_addresses").select("id, city").in_("id", address_ids).execute()
        city_by_address = {a["id"]: a.get("city") for a in (getattr(addr_resp, "data", None) or [])}

    tally = Counter()
    unresolved = 0
    for row in rows:
        city_name = city_by_address.get(row.get("address_id"))
        if city_name:
            tally[city_name] += 1
        else:
            unresolved += 1

    total = sum(tally.values()) + unresolved
    cities = [
        {
            "city": name,
            "count": count,
            "percent": round((count / total) * 100) if total else 0,
        }
        for name, count in tally.most_common(6)
    ]
    if unresolved:
        cities.append(
            {
                "city": "Others / Unknown",
                "count": unresolved,
                "percent": round((unresolved / total) * 100) if total else 0,
            }
        )

    return {"cities": cities}


@router.get("/export")
async def export_reports(
    date_range: str = Query(default="last_30_days"),
    puja_id: Optional[str] = Query(default=None),
    city: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    start, end, _, _ = _resolve_range(date_range)
    rows = _fetch_bookings(client, start, end, puja_id, city)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Booking ID", "Client ID", "Amount", "Status", "Created At"])
    for row in rows:
        writer.writerow(
            [row.get("id"), row.get("client_id"), row.get("amount"), row.get("status"), row.get("created_at")]
        )
    buffer.seek(0)

    write_audit_log(
        action="ADMIN_REPORTS_EXPORTED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        payload={"date_range": date_range, "puja_id": puja_id, "city": city, "row_count": len(rows)},
    )

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bookings_report.csv"},
    )
