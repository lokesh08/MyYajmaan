import re
from datetime import date as date_cls, timedelta
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from audit import write_audit_log
from db import (
    create_supabase_client_for_key,
    SUPABASE_ANON_KEY,
    convert_record_image_fields,
    convert_records_image_fields,
    service_supabase,
)
from models import PanditBrowseOut, PanditOut, PujaOut
from permissions import optional_current_user

router = APIRouter(prefix="/pandits", tags=["pandits"])

# Bundled with the frontend (public/images/), not a Supabase Storage
# object. Shown whenever a pandit hasn't uploaded a display picture
# (their passport photo, once approved) yet.
PANDIT_PLACEHOLDER_IMAGE = "/images/panditPlaceholder.png"


def _apply_avatar_fallback(record: Optional[dict]):
    if not record:
        return record
    if not record.get("avatar_url"):
        record["avatar_url"] = PANDIT_PLACEHOLDER_IMAGE
    if not record.get("image"):
        record["image"] = record["avatar_url"]
    return record


def _anon_client():
    key = SUPABASE_ANON_KEY
    if not key:
        raise RuntimeError("SUPABASE_ANON_KEY is not set in environment")
    return create_supabase_client_for_key(key)


def _extract_data_or_raise(resp: Any, single: bool = False):
    """Normalize postgrest response: raise on HTTP errors, return data (list or single)."""
    status = getattr(resp, "status_code", None)
    data = getattr(resp, "data", None)
    raw = getattr(resp, "raw", None)

    # HTTP error from PostgREST
    if status is not None and status >= 400:
        if status == 404:
            raise HTTPException(status_code=404, detail="Not found")
        detail = data or raw or f"PostgREST returned status {status}"
        raise HTTPException(status_code=500, detail=str(detail))

    # No explicit status; still check data
    if single:
        if not data:
            raise HTTPException(status_code=404, detail="Not found")
        return data
    return data or []


WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
_SLOT_TIME_RE = re.compile(r"^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$", re.IGNORECASE)


def _parse_slot_to_24h(timeslot: Optional[str]) -> Optional[str]:
    """'07:00 AM' -> '07:00'. Same 12h format BookDateTime.jsx renders."""
    if not timeslot:
        return None
    match = _SLOT_TIME_RE.match(timeslot)
    if not match:
        return None
    hour, minute, ampm = int(match.group(1)), match.group(2), match.group(3).upper()
    hour = hour % 12
    if ampm == "PM":
        hour += 12
    return f"{hour:02d}:{minute}"


def _pandit_matches_city(pandit: dict, city: str) -> bool:
    city_lower = city.strip().lower()
    # The pandit's own registered city always counts. Service areas are
    # extra places they'll travel to -- often localities inside that
    # city ("Ajmeri Gate", "Adarsh Nagar") -- so declaring some must not
    # stop them matching their home city.
    if (pandit.get("city") or "").strip().lower() == city_lower:
        return True
    service_areas = pandit.get("service_areas") or []
    return any((area or "").strip().lower() == city_lower for area in service_areas)


def _pandit_matches_availability(pandit: dict, weekday_key: Optional[str], slot_24h: Optional[str]) -> bool:
    pattern = pandit.get("availability_pattern") or {}
    days = pattern.get("days") or []
    start_time = pattern.get("start_time")
    end_time = pattern.get("end_time")
    if not days or not start_time or not end_time:
        # Hasn't set a pattern yet -- treat as available rather than
        # hiding them entirely.
        return True
    if weekday_key and weekday_key not in days:
        return False
    if slot_24h and not (start_time <= slot_24h < end_time):
        return False
    return True


def _resolve_pandit_prices(supabase, pandit_ids: List[str], puja_id: Optional[str] = None) -> dict:
    """
    {pandit_id: {puja_id: price}} for every active pandit_puja row among
    the given pandits (or just the one puja_id, if given) -- price is
    price_override when set, else the puja's own base_price. Pandit Ji
    never set a general price themselves; this is the only real source
    of what they actually charge.
    """
    if not pandit_ids:
        return {}

    query = (
        supabase.table("pandit_puja")
        .select("pandit_id, puja_id, price_override")
        .in_("pandit_id", pandit_ids)
        .eq("active", True)
    )
    if puja_id:
        query = query.eq("puja_id", puja_id)
    relations = _extract_data_or_raise(query.execute(), single=False)
    if not relations:
        return {}

    puja_ids = list({row["puja_id"] for row in relations})
    pujas_resp = supabase.table("pujas").select("id, base_price").in_("id", puja_ids).execute()
    base_price_by_puja = {row["id"]: row.get("base_price") for row in _extract_data_or_raise(pujas_resp, single=False)}

    prices_by_pandit: dict = {}
    for row in relations:
        price = row.get("price_override")
        if price is None:
            price = base_price_by_puja.get(row["puja_id"])
        if price is None:
            continue
        prices_by_pandit.setdefault(row["pandit_id"], {})[row["puja_id"]] = float(price)
    return prices_by_pandit


def _attach_starting_prices(data: List[dict], prices_by_pandit: dict):
    for rec in data:
        puja_prices = prices_by_pandit.get(rec["id"])
        rec["starting_price"] = min(puja_prices.values()) if puja_prices else None


def _fetch_approved_pandits(supabase) -> List[dict]:
    resp = (
        supabase.table("pandits")
        .select("*")
        # Only pandits admin has approved (and is currently keeping
        # active) are bookable from the public app.
        .eq("is_active", True)
        .eq("verification_status", "approved")
        .order("created_at", desc=False)
        .execute()
    )
    return _extract_data_or_raise(resp, single=False)


@router.get("", response_model=List[PanditOut])
def list_pandits(
    limit: int = 50,
    offset: int = 0,
    city: Optional[str] = None,
    date: Optional[str] = None,
    timeslot: Optional[str] = None,
    puja_id: Optional[str] = None,
):
    supabase = _anon_client()
    data = _fetch_approved_pandits(supabase)

    # City/availability filtering happens here (not via .offset/.limit
    # above) since it needs the full approved set to filter first --
    # this table is small enough that fetching it all is cheap.
    if city:
        data = [rec for rec in data if _pandit_matches_city(rec, city)]

    if date or timeslot:
        weekday_key = None
        if date:
            try:
                weekday_key = WEEKDAY_KEYS[date_cls.fromisoformat(date).weekday()]
            except ValueError:
                weekday_key = None
        slot_24h = _parse_slot_to_24h(timeslot)
        data = [rec for rec in data if _pandit_matches_availability(rec, weekday_key, slot_24h)]

    prices_by_pandit = _resolve_pandit_prices(supabase, [rec["id"] for rec in data], puja_id)

    if puja_id:
        # Booking-flow context: only pandits who actually offer this
        # puja are selectable, priced at exactly what they charge for
        # it -- not some unrelated flat number.
        data = [rec for rec in data if puja_id in prices_by_pandit.get(rec["id"], {})]
        for rec in data:
            rec["price"] = prices_by_pandit[rec["id"]][puja_id]
    else:
        # Browse/homepage context: "starting from" the cheapest puja
        # they offer, or nothing shown if they haven't added any yet.
        _attach_starting_prices(data, prices_by_pandit)

    data = data[offset : offset + limit]

    # Convert avatar/image/portrait fields to public URLs
    convert_records_image_fields(data, fields=["avatar_url", "image", "portrait_url"])

    for rec in data:
        _apply_avatar_fallback(rec)

    return data


BROWSE_SORTS = ("recommended", "price_asc", "price_desc")


@router.get("/browse", response_model=PanditBrowseOut)
def browse_pandits(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
    name: Optional[str] = None,
    pincode: Optional[str] = None,
    sort: str = "recommended",
):
    """
    The yajmaan-facing "Find Pandit Ji" page: every approved Pandit Ji,
    filtered by name / PIN code, optionally sorted by their cheapest
    puja price, one page at a time with the total for the pager.
    Declared before /{pandit_id} so "browse" isn't read as an id.
    """
    if sort not in BROWSE_SORTS:
        raise HTTPException(status_code=422, detail=f"sort must be one of: {', '.join(BROWSE_SORTS)}")

    supabase = _anon_client()
    data = _fetch_approved_pandits(supabase)

    # Filtered here rather than in PostgREST: sorting by price needs
    # the whole filtered set priced anyway, and it keeps user input out
    # of hand-built or_() filter strings.
    name_q = (name or "").strip().lower()
    if name_q:
        data = [
            rec for rec in data
            if name_q in (rec.get("display_name") or "").lower()
            or name_q in (rec.get("name") or "").lower()
        ]

    # Prefix match, so a partly typed PIN ("3050") already narrows the
    # list and a full 6-digit one is an exact match.
    pin_q = "".join((pincode or "").split())
    if pin_q:
        data = [rec for rec in data if str(rec.get("pin") or "").replace(" ", "").startswith(pin_q)]

    _attach_starting_prices(data, _resolve_pandit_prices(supabase, [rec["id"] for rec in data]))

    if sort in ("price_asc", "price_desc"):
        # Pandit Ji who haven't added any puja yet have no price -- they
        # go last either way. sorted() is stable, so equal prices keep
        # the default (oldest approved first) order.
        priced = [rec for rec in data if rec["starting_price"] is not None]
        unpriced = [rec for rec in data if rec["starting_price"] is None]
        priced.sort(key=lambda rec: rec["starting_price"], reverse=(sort == "price_desc"))
        data = priced + unpriced

    total = len(data)
    start = (page - 1) * page_size
    items = data[start : start + page_size]

    convert_records_image_fields(items, fields=["avatar_url", "image", "portrait_url"])
    for rec in items:
        _apply_avatar_fallback(rec)

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{pandit_id}", response_model=PanditOut)
def get_pandit(
    pandit_id: str,
    current_user: Optional[dict] = Depends(optional_current_user),
):
    supabase = _anon_client()
    resp = (
        supabase.table("pandits")
        .select("*")
        .eq("id", pandit_id)
        .eq("is_active", True)
        .eq("verification_status", "approved")
        .single()
        .execute()
    )
    data = _extract_data_or_raise(resp, single=True)
    convert_record_image_fields(data, fields=["avatar_url", "image", "portrait_url"])
    _apply_avatar_fallback(data)

    puja_prices = _resolve_pandit_prices(supabase, [pandit_id]).get(pandit_id)
    data["starting_price"] = min(puja_prices.values()) if puja_prices else None

    write_audit_log(
        action="PANDIT_VIEWED",
        actor_id=str(current_user["id"]) if current_user else None,
        entity="pandits",
        entity_id=pandit_id,
        payload={"name": data.get("display_name") or data.get("name")},
    )

    return data


@router.get("/{pandit_id}/pujas", response_model=List[PujaOut])
def get_pandit_pujas(pandit_id: str):
    """
    Pujas a specific pandit actually performs, via the pandit_puja
    relation table. Applies each row's price_override (if set) over
    the puja's own base_price.
    """
    supabase = _anon_client()

    relation_resp = (
        supabase
        .table("pandit_puja")
        .select("puja_id, price_override")
        .eq("pandit_id", pandit_id)
        .eq("active", True)
        .execute()
    )
    relations = _extract_data_or_raise(relation_resp, single=False)

    if not relations:
        return []

    price_overrides = {row["puja_id"]: row.get("price_override") for row in relations}
    puja_ids = list(price_overrides.keys())

    pujas_resp = (
        supabase
        .table("pujas")
        .select("*")
        .in_("id", puja_ids)
        .eq("is_active", True)
        .execute()
    )
    pujas = _extract_data_or_raise(pujas_resp, single=False)

    for puja in pujas:
        override = price_overrides.get(puja["id"])
        if override is not None:
            puja["base_price"] = override

    convert_records_image_fields(pujas, fields=["thumbnail_url", "image_url"])
    return pujas


# A booking in one of these holds the Pandit Ji's slot; declined /
# cancelled / completed ones don't.
SLOT_HOLDING_STATUSES = ("pending_pandit", "confirmed")
SCHEDULE_MAX_DAYS = 120


@router.get("/{pandit_id}/schedule")
def get_pandit_schedule(pandit_id: str, from_date: Optional[str] = None, days: int = 60):
    """
    When a Pandit Ji can take a booking: their weekly availability
    pattern plus the (date, timeslot) pairs already held by bookings in
    the window. The booking wizard combines this with its own slot list
    to pre-pick the next free date & time when a yajmaan books from the
    Pandit Ji's page (see src/utils/panditAvailability.js). Only dates
    and times -- nothing about who booked.
    Not in response_cache's whitelist: it must reflect new bookings.
    """
    try:
        start = date_cls.fromisoformat(from_date) if from_date else date_cls.today()
    except ValueError:
        raise HTTPException(status_code=422, detail="from_date must be YYYY-MM-DD")
    days = max(1, min(days, SCHEDULE_MAX_DAYS))
    end = start + timedelta(days=days)

    supabase = _anon_client()
    resp = (
        supabase.table("pandits")
        .select("id, availability_pattern, pin, city")
        .eq("id", pandit_id)
        .eq("is_active", True)
        .eq("verification_status", "approved")
        .single()
        .execute()
    )
    pandit = _extract_data_or_raise(resp, single=True)

    booked = []
    # Bookings are private to their customer under RLS -- read with the
    # service client, and hand back only date + time.
    if service_supabase is not None:
        bookings_resp = (
            service_supabase.table("bookings")
            .select("booking_date, timeslot")
            .eq("pandit_id", pandit_id)
            .in_("status", list(SLOT_HOLDING_STATUSES))
            .gte("booking_date", start.isoformat())
            .lt("booking_date", end.isoformat())
            .execute()
        )
        for row in _extract_data_or_raise(bookings_resp, single=False):
            if row.get("booking_date") and row.get("timeslot"):
                booked.append({"date": str(row["booking_date"])[:10], "timeslot": row["timeslot"]})

    return {
        "pandit_id": pandit_id,
        "availability_pattern": pandit.get("availability_pattern") or {},
        "pin": pandit.get("pin"),
        "city": pandit.get("city"),
        "from_date": start.isoformat(),
        "to_date": end.isoformat(),
        "booked": booked,
    }
