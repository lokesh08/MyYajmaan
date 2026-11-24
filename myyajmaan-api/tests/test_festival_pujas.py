"""
Tests for festival-specific pujas:

  - Admin -> Festivals: add / edit / delete festival dates (validation,
    duplicates, admin only), and the distinct names for the dropdown.
  - Admin -> Pujas: link a puja to a festival by name, or clear it.
  - Public puja output carries festival_name for the booking page.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

import permissions
from auth import get_current_user
from main import app
from models import PujaOut
from routers import admin_festivals, admin_pujas

client = TestClient(app)
HEADERS = {"X-Requested-With": "XMLHttpRequest"}


class Result:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters, self.op, self.payload, self.single_row = [], "select", None, False

    def select(self, *_a, **_k):
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, col, value):
        self.filters.append(lambda r: r.get(col) == value)
        return self

    def or_(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a):
        return self

    def single(self):
        self.single_row = True
        return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.op == "insert":
            row = {"id": str(uuid.uuid4()), **self.payload}
            rows.append(row)
            return Result([dict(row)])
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
        if self.op == "delete":
            self.db.tables[self.table] = [r for r in rows if r not in matched]
            return Result([dict(r) for r in matched])
        out = [dict(r) for r in matched]
        return Result(out[0] if self.single_row else out) if not self.single_row else Result(out[0] if out else None)


class FakeDb:
    def __init__(self, **tables):
        self.tables = tables

    def table(self, name):
        return FakeQuery(self, name)


class AdminRoles:
    def table(self, _name):
        return FakeQuery(FakeDb(admin_roles=[{"user_id": "admin-1", "role_type": "super_admin"}]), "admin_roles")


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb(
        festivals=[
            {"id": "f1", "title": "Holi", "start_date": "2027-03-22", "end_date": None},
            {"id": "f2", "title": "Diwali", "start_date": "2027-10-29", "end_date": None},
            {"id": "f3", "title": "diwali ", "start_date": "2026-11-08", "end_date": None},
        ],
        pujas=[{"id": "p1", "title": "Holika Dahan Puja", "festival_name": None, "metadata": {}}],
    )
    monkeypatch.setattr(admin_festivals, "service_supabase", fake)
    monkeypatch.setattr(admin_pujas, "service_supabase", fake)
    monkeypatch.setattr(admin_festivals, "write_audit_log", lambda **_k: None)
    monkeypatch.setattr(admin_pujas, "write_audit_log", lambda **_k: None)
    monkeypatch.setattr(permissions, "service_supabase", AdminRoles())

    async def fake_admin():
        return {"id": "admin-1", "role": "admin"}

    app.dependency_overrides[get_current_user] = fake_admin
    yield fake
    app.dependency_overrides.clear()


def _festival(**overrides):
    return {"title": "Holika Dahan", "start_date": "2027-03-21", **overrides}


# ---------------------------------------------------------------------
# Admin -> Festivals
# ---------------------------------------------------------------------

def test_add_single_day_festival(db):
    resp = client.post("/admin/festivals", json=_festival(end_date="2027-03-21", description="  Bonfire  "), headers=HEADERS)

    assert resp.status_code == 201, resp.text
    row = next(f for f in db.tables["festivals"] if f["title"] == "Holika Dahan")
    assert row["start_date"] == "2027-03-21"
    assert row["end_date"] is None  # same as start -> single day
    assert row["description"] == "Bonfire"


def test_add_multi_day_festival(db):
    resp = client.post("/admin/festivals", json=_festival(title="Sharad Navratri", start_date="2027-10-01", end_date="2027-10-09"), headers=HEADERS)
    assert resp.status_code == 201, resp.text
    assert resp.json()["festival"]["end_date"] == "2027-10-09"


def test_end_before_start_is_refused(db):
    resp = client.post("/admin/festivals", json=_festival(end_date="2027-03-20"), headers=HEADERS)
    assert resp.status_code == 400


def test_blank_name_and_bad_date_are_refused(db):
    assert client.post("/admin/festivals", json=_festival(title="   "), headers=HEADERS).status_code in (400, 422)
    assert client.post("/admin/festivals", json=_festival(start_date="not-a-date"), headers=HEADERS).status_code in (400, 422)
    assert client.post("/admin/festivals", json={"title": "X"}, headers=HEADERS).status_code in (400, 422)


def test_same_festival_same_date_is_refused(db):
    resp = client.post("/admin/festivals", json=_festival(title="Holi", start_date="2027-03-22"), headers=HEADERS)
    assert resp.status_code == 409


def test_edit_and_delete_festival(db):
    resp = client.patch("/admin/festivals/f1", json=_festival(title="Holi", start_date="2027-03-23"), headers=HEADERS)
    assert resp.status_code == 200, resp.text
    assert next(f for f in db.tables["festivals"] if f["id"] == "f1")["start_date"] == "2027-03-23"

    assert client.delete("/admin/festivals/f1", headers=HEADERS).status_code == 200
    assert all(f["id"] != "f1" for f in db.tables["festivals"])
    assert client.delete("/admin/festivals/f1", headers=HEADERS).status_code == 404
    assert client.patch("/admin/festivals/missing", json=_festival(), headers=HEADERS).status_code == 404


def test_festival_names_are_distinct_and_sorted(db):
    names = client.get("/admin/festivals/names", headers=HEADERS).json()["names"]
    assert names == ["diwali", "Diwali", "Holi"] or names == ["Diwali", "diwali", "Holi"]
    assert len(names) == 3


def test_festivals_admin_only(db):
    async def customer():
        return {"id": "u1", "role": "user"}

    app.dependency_overrides[get_current_user] = customer
    assert client.get("/admin/festivals", headers=HEADERS).status_code == 403
    assert client.post("/admin/festivals", json=_festival(), headers=HEADERS).status_code == 403


# ---------------------------------------------------------------------
# Admin -> Pujas: festival link
# ---------------------------------------------------------------------

def test_link_puja_to_festival(db):
    resp = client.patch("/admin/pujas/p1", data={"festival_name": "  Holika   Dahan "}, headers=HEADERS)
    assert resp.status_code == 200, resp.text
    assert db.tables["pujas"][0]["festival_name"] == "Holika Dahan"


def test_unlink_puja_from_festival(db):
    db.tables["pujas"][0]["festival_name"] = "Holi"
    resp = client.patch("/admin/pujas/p1", data={"festival_name": "none"}, headers=HEADERS)
    assert resp.status_code == 200, resp.text
    assert db.tables["pujas"][0]["festival_name"] is None


def test_editing_other_fields_keeps_the_link(db):
    db.tables["pujas"][0]["festival_name"] = "Holi"
    resp = client.patch("/admin/pujas/p1", data={"description": "New text"}, headers=HEADERS)
    assert resp.status_code == 200, resp.text
    assert db.tables["pujas"][0]["festival_name"] == "Holi"


def test_new_puja_without_festival_does_not_send_the_field(db):
    resp = client.post("/admin/pujas", data={"title": "Shiv Puja", "festival_name": "none"}, headers=HEADERS)
    assert resp.status_code == 201, resp.text
    created = next(p for p in db.tables["pujas"] if p["title"] == "Shiv Puja")
    assert "festival_name" not in created


def test_new_puja_with_festival(db):
    resp = client.post("/admin/pujas", data={"title": "Diwali Puja", "festival_name": "Diwali"}, headers=HEADERS)
    assert resp.status_code == 201, resp.text
    assert next(p for p in db.tables["pujas"] if p["title"] == "Diwali Puja")["festival_name"] == "Diwali"


def test_public_puja_output_includes_festival_name():
    assert PujaOut(id="p1", festival_name="Holi").model_dump()["festival_name"] == "Holi"
    assert PujaOut(id="p1").model_dump()["festival_name"] is None


# ---------------------------------------------------------------------
# Before the migration has run (no pujas.festival_name column)
# ---------------------------------------------------------------------

class NoFestivalColumnDb(FakeDb):
    """Rejects any write that mentions festival_name, like PostgREST does without the column."""

    def table(self, name):
        query = super().table(name)
        real_execute = query.execute

        def execute():
            if query.op in ("insert", "update") and "festival_name" in (query.payload or {}):
                from postgrest.exceptions import APIError
                raise APIError({"message": "Could not find the 'festival_name' column of 'pujas' in the schema cache", "code": "PGRST204", "hint": None, "details": None})
            return real_execute()

        query.execute = execute
        return query


@pytest.fixture
def old_db(db, monkeypatch):
    old = NoFestivalColumnDb(pujas=[{"id": "p1", "title": "Holika Dahan Puja", "metadata": {}}])
    monkeypatch.setattr(admin_pujas, "service_supabase", old)
    return old


def test_editing_a_puja_still_works_before_the_migration(old_db):
    resp = client.patch("/admin/pujas/p1", data={"description": "Updated", "festival_name": "none"}, headers=HEADERS)
    assert resp.status_code == 200, resp.text
    assert old_db.tables["pujas"][0]["description"] == "Updated"


def test_creating_a_puja_still_works_before_the_migration(old_db):
    assert client.post("/admin/pujas", data={"title": "Shiv Puja", "festival_name": "none"}, headers=HEADERS).status_code == 201


def test_choosing_a_festival_before_the_migration_explains_why(old_db):
    resp = client.patch("/admin/pujas/p1", data={"festival_name": "Holika Dahan"}, headers=HEADERS)
    assert resp.status_code == 400
    assert "migration" in resp.text
    assert "festival_name" not in old_db.tables["pujas"][0]
