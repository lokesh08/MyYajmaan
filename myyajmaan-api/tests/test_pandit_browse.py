from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import permissions
from routers import client_addresses, pandits


class FakeQuery:
    """Just enough of the PostgREST builder for these routes: eq/in_
    filters, order, limit."""

    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]
        self._limit = None
        self._orders = []
        self._single = False

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, column, value):
        self.rows = [row for row in self.rows if row.get(column) == value]
        return self

    def in_(self, column, values):
        self.rows = [row for row in self.rows if row.get(column) in values]
        return self

    def gte(self, column, value):
        self.rows = [row for row in self.rows if str(row.get(column)) >= value]
        return self

    def lt(self, column, value):
        self.rows = [row for row in self.rows if str(row.get(column)) < value]
        return self

    def single(self):
        self._single = True
        return self

    def order(self, column, desc=False):
        self._orders.append((column, desc))
        return self

    def limit(self, count):
        self._limit = count
        return self

    def execute(self):
        # First .order() is the primary key: apply them last-to-first
        # (sort is stable).
        for column, desc in reversed(self._orders):
            self.rows.sort(key=lambda row: row.get(column) or 0, reverse=desc)
        rows = self.rows[: self._limit] if self._limit is not None else self.rows
        if self._single:
            return SimpleNamespace(data=rows[0] if rows else None, status_code=200)
        return SimpleNamespace(data=rows, status_code=200)


class FakeSupabase:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return FakeQuery(self.tables.get(name, []))


def _pandit(pid, name, pin, created_at):
    return {
        "id": pid,
        "name": name,
        "display_name": name,
        "pin": pin,
        "city": "Ajmer",
        "is_active": True,
        "verification_status": "approved",
        "created_at": created_at,
    }


TABLES = {
    "pandits": [
        _pandit("p1", "Yogesh Sharma", "411001", 1),
        _pandit("p2", "Nidhi Sharma", "411002", 2),
        _pandit("p3", "Lokesh Sharma", "305001", 3),
        _pandit("p4", "Ankita Verma", "305001", 4),  # no pujas -> no price
        {**_pandit("p5", "Pending Pandit", "305001", 5), "verification_status": "pending"},
    ],
    "pandit_puja": [
        {"pandit_id": "p1", "puja_id": "a", "price_override": 2500, "active": True},
        {"pandit_id": "p1", "puja_id": "b", "price_override": None, "active": True},
        {"pandit_id": "p2", "puja_id": "a", "price_override": 1500, "active": True},
        {"pandit_id": "p3", "puja_id": "a", "price_override": 1499, "active": True},
        {"pandit_id": "p3", "puja_id": "b", "price_override": 900, "active": False},
    ],
    "pujas": [{"id": "a", "base_price": 3000}, {"id": "b", "base_price": 2100}],
}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(pandits, "_anon_client", lambda: FakeSupabase(TABLES))
    monkeypatch.setattr(pandits, "convert_records_image_fields", lambda *_a, **_k: None)
    app = FastAPI()
    app.include_router(pandits.router)
    return TestClient(app)


def _ids(resp):
    return [item["id"] for item in resp.json()["items"]]


def test_browse_lists_only_approved_pandits_with_total(client):
    resp = client.get("/pandits/browse")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 4
    assert _ids(resp) == ["p1", "p2", "p3", "p4"]
    # cheapest active puja; inactive p3/b (900) doesn't count
    prices = {item["id"]: item["starting_price"] for item in body["items"]}
    assert prices == {"p1": 2100, "p2": 1500, "p3": 1499, "p4": None}


def test_browse_paginates(client):
    resp = client.get("/pandits/browse", params={"page": 2, "page_size": 3})
    assert resp.json()["total"] == 4
    assert _ids(resp) == ["p4"]


def test_browse_filters_by_name_case_insensitively(client):
    assert _ids(client.get("/pandits/browse", params={"name": "  sharMA "})) == ["p1", "p2", "p3"]


def test_browse_filters_by_pincode_prefix(client):
    assert _ids(client.get("/pandits/browse", params={"pincode": "305001"})) == ["p3", "p4"]
    assert _ids(client.get("/pandits/browse", params={"pincode": "4110"})) == ["p1", "p2"]


def test_browse_sorts_by_price_with_unpriced_last(client):
    assert _ids(client.get("/pandits/browse", params={"sort": "price_asc"})) == ["p3", "p2", "p1", "p4"]
    assert _ids(client.get("/pandits/browse", params={"sort": "price_desc"})) == ["p1", "p2", "p3", "p4"]


def test_browse_rejects_unknown_sort(client):
    assert client.get("/pandits/browse", params={"sort": "nope"}).status_code == 422


def test_browse_is_not_mistaken_for_a_pandit_id(client):
    # /pandits/{id} is declared after /browse
    assert "items" in client.get("/pandits/browse").json()


SCHEDULE_TABLES = {
    "pandits": [
        {
            **_pandit("p1", "Lokesh Sharma", "305001", 1),
            "availability_pattern": {"days": ["sat", "sun"], "start_time": "17:00", "end_time": "21:00"},
        }
    ],
    "bookings": [
        {"pandit_id": "p1", "booking_date": "2026-11-28", "timeslot": "06:00 PM", "status": "confirmed", "client_id": "secret"},
        {"pandit_id": "p1", "booking_date": "2026-11-29", "timeslot": "07:00 PM", "status": "pending_pandit"},
        {"pandit_id": "p1", "booking_date": "2026-11-28", "timeslot": "07:00 PM", "status": "cancelled"},
        {"pandit_id": "p1", "booking_date": "2027-03-01", "timeslot": "06:00 PM", "status": "confirmed"},  # outside window
        {"pandit_id": "p2", "booking_date": "2026-11-28", "timeslot": "08:00 PM", "status": "confirmed"},
    ],
}


@pytest.fixture
def schedule_client(monkeypatch):
    fake = FakeSupabase(SCHEDULE_TABLES)
    monkeypatch.setattr(pandits, "_anon_client", lambda: fake)
    monkeypatch.setattr(pandits, "service_supabase", fake)
    app = FastAPI()
    app.include_router(pandits.router)
    return TestClient(app)


def test_schedule_returns_pattern_and_only_slot_holding_bookings(schedule_client):
    body = schedule_client.get("/pandits/p1/schedule", params={"from_date": "2026-11-27", "days": 30}).json()
    assert body["availability_pattern"]["days"] == ["sat", "sun"]
    assert body["pin"] == "305001"
    assert sorted(body["booked"], key=lambda b: b["date"]) == [
        {"date": "2026-11-28", "timeslot": "06:00 PM"},
        {"date": "2026-11-29", "timeslot": "07:00 PM"},
    ]


def test_schedule_never_exposes_who_booked(schedule_client):
    body = schedule_client.get("/pandits/p1/schedule", params={"from_date": "2026-11-27"}).json()
    assert all(set(b) == {"date", "timeslot"} for b in body["booked"])


def test_schedule_rejects_bad_date_and_unknown_pandit(schedule_client):
    assert schedule_client.get("/pandits/p1/schedule", params={"from_date": "soon"}).status_code == 422
    assert schedule_client.get("/pandits/nobody/schedule").status_code == 404


def _address_client(monkeypatch, user, tables):
    monkeypatch.setattr(client_addresses, "service_supabase", FakeSupabase(tables))
    app = FastAPI()
    app.include_router(client_addresses.router)
    # Stand in for the session cookie; require_roles' role check still runs.
    app.dependency_overrides[permissions.get_current_user] = lambda: user
    return TestClient(app)


def test_default_pincode_prefers_the_default_address(monkeypatch):
    tables = {
        "client_addresses": [
            {"client_id": "u1", "pincode": "411001", "is_default": False, "created_at": 2},
            {"client_id": "u1", "pincode": "305001", "is_default": True, "created_at": 1},
            {"client_id": "u2", "pincode": "110001", "is_default": True, "created_at": 3},
        ]
    }
    http = _address_client(monkeypatch, {"id": "u1", "role": "user"}, tables)
    assert http.get("/me/addresses/default-pincode").json() == {"pincode": "305001"}


def test_default_pincode_falls_back_to_pandit_profile_pin(monkeypatch):
    tables = {"client_addresses": [], "pandits": [{"user_id": "u9", "pin": "302001"}]}
    http = _address_client(monkeypatch, {"id": "u9", "role": "pandit"}, tables)
    assert http.get("/me/addresses/default-pincode").json() == {"pincode": "302001"}


def test_default_pincode_is_none_without_any_address(monkeypatch):
    http = _address_client(monkeypatch, {"id": "a1", "role": "admin"}, {"client_addresses": []})
    assert http.get("/me/addresses/default-pincode").json() == {"pincode": None}


def test_default_pincode_requires_login(monkeypatch):
    monkeypatch.setattr(client_addresses, "service_supabase", FakeSupabase({}))
    app = FastAPI()
    app.include_router(client_addresses.router)
    assert TestClient(app).get("/me/addresses/default-pincode").status_code == 401
