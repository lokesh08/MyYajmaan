"""
Tests for the in-house Panchang (panchang.py, GET /panchang).

Reference values were taken from Drik Panchang for the same city and
date; timings must agree within a few minutes (different publishers
differ by a minute or two from rounding / ayanamsa constants).
"""

from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient

import panchang
from main import app
from panchang_cities import CITY_COORDINATES, locate_city

client = TestClient(app)

# (city, date, expected) from drikpanchang.com
REFERENCES = [
    (
        "Jaipur", date(2026, 11, 24),
        {
            "sunrise": "06:53", "sunset": "17:34",
            "tithi": ("Purnima", "Shukla", "20:23"), "nakshatra": ("Krittika", "23:25"),
            "yoga": ("Parigha", "16:06"), "karana": ("Vishti", "10:05"),
            "rahu_kaal": ("14:54", "16:14"), "yamaganda": ("09:33", "10:53"),
            "gulika": ("12:13", "13:33"), "abhijit": ("11:52", "12:35"),
        },
    ),
    (
        "Mumbai", date(2027, 3, 21),
        {
            "sunrise": "06:42", "sunset": "18:50",
            "tithi": ("Chaturdashi", "Shukla", "18:21"), "nakshatra": ("Purva Phalguni", "22:06"),
            "yoga": ("Shula", "16:58"), "karana": ("Garaja", "07:31"),
            "rahu_kaal": ("17:19", "18:50"), "abhijit": ("12:22", "13:10"),
        },
    ),
]
TOLERANCE_MINUTES = 3


def _minutes(value):
    """'HH:MM' or ISO datetime -> minutes after midnight."""
    hhmm = value[11:16] if "T" in value else value
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _close(actual_iso, expected_hhmm):
    return abs(_minutes(actual_iso) - _minutes(expected_hhmm)) <= TOLERANCE_MINUTES


@pytest.mark.parametrize("city, day, expected", REFERENCES)
def test_matches_drik_panchang(city, day, expected):
    p = panchang.get_panchang(day, city)

    assert _close(p["sunrise"], expected["sunrise"]), p["sunrise"]
    assert _close(p["sunset"], expected["sunset"]), p["sunset"]

    name, paksha, ends = expected["tithi"]
    assert (p["tithi"]["name"], p["tithi"]["paksha"]) == (name, paksha)
    assert _close(p["tithi"]["ends_at"], ends), p["tithi"]["ends_at"]

    for key in ("nakshatra", "yoga", "karana"):
        name, ends = expected[key]
        assert p[key]["name"] == name, (key, p[key])
        assert _close(p[key]["ends_at"], ends), (key, p[key]["ends_at"])

    for key in ("rahu_kaal", "yamaganda", "gulika", "abhijit"):
        if key in expected:
            start, end = expected[key]
            span = p["muhurta"][key]
            assert _close(span["start"], start) and _close(span["end"], end), (key, span)


def test_day_structure_is_consistent():
    p = panchang.get_panchang(date(2026, 11, 24), "Jaipur")
    assert p["weekday"] == "Tuesday"
    assert p["timezone"] == "Asia/Kolkata"
    assert p["sunrise"] < p["sunset"]

    day = p["choghadiya"]["day"]
    night = p["choghadiya"]["night"]
    assert len(day) == len(night) == 8
    assert day[0]["start"] == p["sunrise"] and day[-1]["end"] == p["sunset"]
    assert night[0]["start"] == p["sunset"]
    for parts in (day, night):
        for a, b in zip(parts, parts[1:]):
            assert a["end"] == b["start"]
    assert day[0]["name"] == "Rog"  # Tuesday's day starts with Rog
    assert night[0]["name"] == "Kaal"  # Tuesday's night starts with Kaal
    assert {c["quality"] for c in day} <= {"good", "neutral", "bad"}
    # Rahu Kaal on Tuesday is the 7th eighth of the day
    assert p["muhurta"]["rahu_kaal"]["start"] == day[6]["start"]


def test_abhijit_not_applicable_on_wednesday():
    p = panchang.get_panchang(date(2026, 11, 25), "Jaipur")
    assert p["weekday"] == "Wednesday"
    assert p["muhurta"]["abhijit"]["applicable"] is False


@pytest.mark.parametrize(
    "index, expected",
    [(0, ("Pratipada", "Shukla")), (10, ("Ekadashi", "Shukla")), (14, ("Purnima", "Shukla")),
     (15, ("Pratipada", "Krishna")), (29, ("Amavasya", "Krishna"))],
)
def test_tithi_names(index, expected):
    assert panchang.tithi_name(index) == expected


@pytest.mark.parametrize("index, expected", [(0, "Kimstughna"), (1, "Bava"), (7, "Vishti"), (8, "Bava"), (56, "Vishti"), (57, "Shakuni"), (58, "Chatushpada"), (59, "Naga")])
def test_karana_names(index, expected):
    assert panchang.karana_name(index) == expected


def test_choghadiya_cycles_follow_the_weekday_tables():
    sunrise = datetime(2026, 11, 22, 6, 0, tzinfo=panchang.IST)
    sunset = datetime(2026, 11, 22, 18, 0, tzinfo=panchang.IST)
    sunday = panchang._choghadiya(sunrise, sunset, "Udveg", panchang.DAY_CHOGHADIYA_CYCLE)
    assert [c["name"] for c in sunday] == ["Udveg", "Chal", "Labh", "Amrit", "Kaal", "Shubh", "Rog", "Udveg"]
    assert sunday[0]["start"].endswith("06:00+05:30") and sunday[0]["end"].endswith("07:30+05:30")


# ---------------------------------------------------------------------
# Cities
# ---------------------------------------------------------------------

def test_every_app_city_has_coordinates_inside_india():
    assert len(CITY_COORDINATES) >= 192
    for city, (state, lat, lon) in CITY_COORDINATES.items():
        assert 6 <= lat <= 37 and 68 <= lon <= 98, city


def test_city_lookup_and_fallbacks():
    assert locate_city("  jaipur ")[:2] == ("Jaipur", "Rajasthan")
    assert locate_city("Navi   Mumbai")[0] == "Navi Mumbai"
    name, state, _, _, exact = locate_city("Newtown", "Goa")
    assert (name, state, exact) == ("Newtown", "Goa", False)
    assert locate_city(None)[:2] == ("Jaipur", "Rajasthan")
    assert locate_city("Atlantis", "Nowhere")[4] is False


# ---------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------

def test_endpoint_defaults_to_today_in_jaipur():
    resp = client.get("/panchang")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["city"]["name"] == "Jaipur"
    assert body["date"] == panchang.today_ist().isoformat()


def test_endpoint_city_and_date():
    body = client.get("/panchang", params={"city": "Mumbai", "date": "2027-03-21"}).json()
    assert body["city"]["name"] == "Mumbai" and body["tithi"]["name"] == "Chaturdashi"


def test_endpoint_rejects_bad_dates():
    assert client.get("/panchang", params={"date": "2070-01-01"}).status_code == 400
    assert client.get("/panchang", params={"date": "not-a-date"}).status_code == 422
