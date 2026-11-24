"""
Daily Panchang, calculated on our own server (no paid API).

Sun and Moon positions come from Skyfield with NASA JPL's DE421 ephemeris
(valid 1900-2053). From them, the standard Vedic definitions:

  Tithi      (Moon - Sun) longitude in 12° steps           30 per lunar month
  Nakshatra  sidereal Moon longitude in 13°20' steps        27
  Yoga       sidereal (Sun + Moon) in 13°20' steps          27
  Karana     half a tithi (6° steps)                        60 per month

Sidereal = tropical minus the Lahiri (Chitrapaksha) ayanamsa, the one
Drik Panchang and most Indian calendars use. Values are those prevailing
at local sunrise (the panchang convention), each with the time it ends.

Day timings use sunrise/sunset at the chosen city (upper limb, standard
refraction) and the usual divisions:
  Rahu Kaal / Yamaganda / Gulika  one of the 8 equal parts of daytime,
                                  by weekday
  Abhijit Muhurta                 the 8th of 15 daytime muhurtas
  Choghadiya                      8 parts of day and 8 of night

All times are Indian Standard Time (the app serves India only).
"""

import math
import os
from datetime import date as date_type, datetime, timedelta, timezone
from functools import lru_cache

from panchang_cities import locate_city

IST = timezone(timedelta(hours=5, minutes=30))
EPHEMERIS_DIR = os.getenv("EPHEMERIS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), ".ephemeris"))
EPHEMERIS_FILE = "de421.bsp"
MIN_DATE = date_type(1901, 1, 1)
MAX_DATE = date_type(2052, 12, 31)

TITHIS = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami",
    "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi",
]
NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
    "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha",
    "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]
YOGAS = [
    "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shula",
    "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan",
    "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti",
]
MOVABLE_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"]
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]  # date.weekday() order

# Which eighth of the daytime (1-based) each period falls in, by weekday.
RAHU_KAAL_PART = {"Monday": 2, "Tuesday": 7, "Wednesday": 5, "Thursday": 6, "Friday": 4, "Saturday": 3, "Sunday": 8}
YAMAGANDA_PART = {"Monday": 4, "Tuesday": 3, "Wednesday": 2, "Thursday": 1, "Friday": 7, "Saturday": 6, "Sunday": 5}
GULIKA_PART = {"Monday": 6, "Tuesday": 5, "Wednesday": 4, "Thursday": 3, "Friday": 2, "Saturday": 1, "Sunday": 7}

# Choghadiya: each part follows the previous in a fixed cycle; the first
# part of the day / night depends on the weekday.
DAY_CHOGHADIYA_CYCLE = ["Udveg", "Chal", "Labh", "Amrit", "Kaal", "Shubh", "Rog"]
NIGHT_CHOGHADIYA_CYCLE = ["Shubh", "Amrit", "Chal", "Rog", "Kaal", "Labh", "Udveg"]
DAY_CHOGHADIYA_START = {"Sunday": "Udveg", "Monday": "Amrit", "Tuesday": "Rog", "Wednesday": "Labh", "Thursday": "Shubh", "Friday": "Chal", "Saturday": "Kaal"}
NIGHT_CHOGHADIYA_START = {"Sunday": "Shubh", "Monday": "Chal", "Tuesday": "Kaal", "Wednesday": "Udveg", "Thursday": "Amrit", "Friday": "Rog", "Saturday": "Labh"}
CHOGHADIYA_QUALITY = {"Amrit": "good", "Shubh": "good", "Labh": "good", "Chal": "neutral", "Udveg": "bad", "Kaal": "bad", "Rog": "bad"}


class PanchangError(ValueError):
    """Bad input (date out of range...)."""


@lru_cache(maxsize=1)
def _sky():
    from skyfield.api import Loader

    loader = Loader(EPHEMERIS_DIR, verbose=False)
    eph = loader(EPHEMERIS_FILE)
    return loader.timescale(), eph


def lahiri_ayanamsa(jd_tt: float) -> float:
    """Lahiri (Chitrapaksha) ayanamsa in degrees: 23°51'25.5" at J2000 (Swiss Ephemeris), ~50.29"/year."""
    t = (jd_tt - 2451545.0) / 36525.0
    return 23.85709 + 1.39697 * t + 0.00031 * t * t


def _longitudes(t):
    """Apparent geocentric tropical ecliptic longitudes (Sun, Moon) in degrees; t may be an array."""
    from skyfield.framelib import ecliptic_frame

    ts, eph = _sky()
    earth = eph["earth"]
    _, sun_lon, _ = earth.at(t).observe(eph["sun"]).apparent().frame_latlon(ecliptic_frame)
    _, moon_lon, _ = earth.at(t).observe(eph["moon"]).apparent().frame_latlon(ecliptic_frame)
    return sun_lon.degrees, moon_lon.degrees


def _angles(t):
    """(elongation, sidereal moon, sidereal sun+moon) in degrees, 0-360."""
    sun, moon = _longitudes(t)
    ayan = lahiri_ayanamsa(t.tt)
    elong = (moon - sun) % 360.0
    moon_sid = (moon - ayan) % 360.0
    yoga = (sun + moon - 2 * ayan) % 360.0
    return elong, moon_sid, yoga


def _index(value, size):
    return int(math.floor(value / size)) % int(round(360.0 / size))


# Each element: (name, function from angles to index, angle step)
def _elements():
    return {
        "tithi": (lambda a: _index(a[0], 12.0)),
        "karana": (lambda a: _index(a[0], 6.0)),
        "nakshatra": (lambda a: _index(a[1], 360.0 / 27)),
        "yoga": (lambda a: _index(a[2], 360.0 / 27)),
    }


def tithi_name(index: int):
    """(name, paksha) for tithi index 0-29."""
    paksha = "Shukla" if index < 15 else "Krishna"
    n = index % 15
    if n == 14:
        return ("Purnima" if paksha == "Shukla" else "Amavasya"), paksha
    return TITHIS[n], paksha


def karana_name(index: int) -> str:
    """Karana for half-tithi index 0-59 (4 fixed karanas + 7 repeating)."""
    if index == 0:
        return "Kimstughna"
    if index >= 57:
        return ["Shakuni", "Chatushpada", "Naga"][index - 57]
    return MOVABLE_KARANAS[(index - 1) % 7]


def _ist(t) -> datetime:
    """IST, rounded to the nearest minute (as printed panchangs do)."""
    moment = t.utc_datetime().astimezone(IST) + timedelta(seconds=30)
    return moment.replace(second=0, microsecond=0)


def _find_end(ts, start_t, index_fn, hours=40):
    """First moment after start_t when index_fn(angles) changes (to ~20 s)."""
    jd0 = start_t.tt
    start_index = index_fn(_angles(start_t))
    # hourly scan, then bisection inside the hour where it changes
    steps = ts.tt_jd([jd0 + h / 24.0 for h in range(1, hours + 1)])
    elong, moon_sid, yoga = _angles(steps)
    prev = jd0
    for i in range(len(steps.tt)):
        if index_fn((elong[i], moon_sid[i], yoga[i])) != start_index:
            lo, hi = prev, steps.tt[i]
            while (hi - lo) * 86400 > 20:
                mid = (lo + hi) / 2
                if index_fn(_angles(ts.tt_jd(mid))) == start_index:
                    lo = mid
                else:
                    hi = mid
            return ts.tt_jd(hi)
        prev = steps.tt[i]
    return None


def _sun_events(ts, eph, lat, lon, day: date_type):
    """Sunrise and sunset for a local (IST) calendar day."""
    from skyfield import almanac
    from skyfield.api import wgs84

    observer = eph["earth"] + wgs84.latlon(lat, lon)
    start = datetime(day.year, day.month, day.day, tzinfo=IST)
    t0, t1 = ts.from_datetime(start), ts.from_datetime(start + timedelta(days=1))
    rises, _ = almanac.find_risings(observer, eph["sun"], t0, t1)
    sets, _ = almanac.find_settings(observer, eph["sun"], t0, t1)
    if not len(rises) or not len(sets):
        raise PanchangError("No sunrise/sunset at this location on that day.")
    return rises[0], sets[0]


def _span(start: datetime, end: datetime) -> dict:
    return {"start": start.isoformat(timespec="minutes"), "end": end.isoformat(timespec="minutes")}


def _part(start: datetime, end: datetime, which: int, parts: int) -> dict:
    """The which-th (1-based) of `parts` equal divisions of start..end."""
    step = (end - start) / parts
    return _span(start + step * (which - 1), start + step * which)


def _choghadiya(start: datetime, end: datetime, first: str, cycle) -> list:
    step = (end - start) / 8
    i = cycle.index(first)
    out = []
    for n in range(8):
        name = cycle[(i + n) % len(cycle)]
        out.append({"name": name, "quality": CHOGHADIYA_QUALITY[name], **_span(start + step * n, start + step * (n + 1))})
    return out


@lru_cache(maxsize=2048)
def _compute(day_iso: str, lat: float, lon: float) -> dict:
    day = date_type.fromisoformat(day_iso)
    ts, eph = _sky()
    sunrise_t, sunset_t = _sun_events(ts, eph, lat, lon, day)
    next_sunrise_t, _ = _sun_events(ts, eph, lat, lon, day + timedelta(days=1))
    sunrise, sunset, next_sunrise = _ist(sunrise_t), _ist(sunset_t), _ist(next_sunrise_t)
    weekday = WEEKDAYS[day.weekday()]

    angles = _angles(sunrise_t)
    fns = _elements()

    def element(key, name_fn):
        index = fns[key](angles)
        end_t = _find_end(ts, sunrise_t, fns[key])
        return index, name_fn(index), (_ist(end_t).isoformat(timespec="minutes") if end_t is not None else None)

    t_index, (t_name, paksha), t_end = element("tithi", tithi_name)
    n_index, n_name, n_end = element("nakshatra", lambda i: NAKSHATRAS[i])
    y_index, y_name, y_end = element("yoga", lambda i: YOGAS[i])
    k_index, k_name, k_end = element("karana", karana_name)

    abhijit = _part(sunrise, sunset, 8, 15)
    return {
        "date": day_iso,
        "weekday": weekday,
        "sunrise": sunrise.isoformat(timespec="minutes"),
        "sunset": sunset.isoformat(timespec="minutes"),
        "tithi": {"index": t_index + 1, "name": t_name, "paksha": paksha, "ends_at": t_end},
        "nakshatra": {"index": n_index + 1, "name": n_name, "ends_at": n_end},
        "yoga": {"index": y_index + 1, "name": y_name, "ends_at": y_end},
        "karana": {"name": k_name, "ends_at": k_end},
        "muhurta": {
            # Traditionally not considered on Wednesdays.
            "abhijit": {**abhijit, "applicable": weekday != "Wednesday"},
            "rahu_kaal": _part(sunrise, sunset, RAHU_KAAL_PART[weekday], 8),
            "yamaganda": _part(sunrise, sunset, YAMAGANDA_PART[weekday], 8),
            "gulika": _part(sunrise, sunset, GULIKA_PART[weekday], 8),
        },
        "choghadiya": {
            "day": _choghadiya(sunrise, sunset, DAY_CHOGHADIYA_START[weekday], DAY_CHOGHADIYA_CYCLE),
            "night": _choghadiya(sunset, next_sunrise, NIGHT_CHOGHADIYA_START[weekday], NIGHT_CHOGHADIYA_CYCLE),
        },
    }


def get_panchang(day: date_type, city: str = None, state: str = None) -> dict:
    if not (MIN_DATE <= day <= MAX_DATE):
        raise PanchangError(f"Panchang is available from {MIN_DATE.year} to {MAX_DATE.year}.")
    name, city_state, lat, lon, exact = locate_city(city, state)
    result = dict(_compute(day.isoformat(), lat, lon))
    result["city"] = {"name": name, "state": city_state, "lat": lat, "lon": lon, "exact": exact}
    result["timezone"] = "Asia/Kolkata"
    return result


def today_ist() -> date_type:
    return datetime.now(IST).date()
