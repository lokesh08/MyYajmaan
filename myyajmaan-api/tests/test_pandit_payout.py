"""
Tests for the Pandit Ji payout flow:

  - Completing a puja does NOT credit the Pandit Ji's wallet; admin
    releases the fee from Wallet → Pandit Ji Earnings (once only).
  - Admin can see the full bank details of an open withdrawal request
    (audit-logged), and "Mark as Paid" needs the transfer's UTR + method.
  - The Pandit Ji wallet shows fees still waiting for release.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

import permissions
import wallet
from auth import get_current_user
from main import app
from routers import admin_wallet, pandit_bookings, pandit_wallet

client = TestClient(app)
HEADERS = {"X-Requested-With": "XMLHttpRequest"}

ADMIN = {"id": "admin-1", "role": "admin", "email": "admin@example.com"}
PANDIT_USER = {"id": "pandit-user-1", "role": "pandit", "email": "pandit@example.com", "phone": "9999999999"}


class Result:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class FakeQuery:
    """In-memory PostgREST builder: just enough of select/insert/update + filters."""

    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters = []
        self.op, self.payload = "select", None
        self.want_count = False
        self.single_row = False
        self.bounds = None
        self._negate = False

    # --- operations ---
    def select(self, *_cols, count=None):
        self.want_count = self.want_count or bool(count)
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    # --- filters ---
    def _add(self, fn):
        negate, self._negate = self._negate, False
        self.filters.append((lambda r: not fn(r)) if negate else fn)
        return self

    @property
    def not_(self):
        self._negate = True
        return self

    def eq(self, col, value):
        return self._add(lambda r: r.get(col) == value)

    def in_(self, col, values):
        return self._add(lambda r: r.get(col) in values)

    def is_(self, col, value):
        assert value == "null"
        return self._add(lambda r: r.get(col) is None)

    def order(self, *_a, **_k):
        return self

    def limit(self, _n):
        return self

    def range(self, start, end):
        self.bounds = (start, end)
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
            return Result([dict(r) for r in matched])
        out = [dict(r) for r in matched]
        if self.bounds:
            out = out[self.bounds[0]: self.bounds[1] + 1]
        if self.single_row:
            return Result(out[0] if out else None)
        return Result(out, count=len(matched) if self.want_count else None)


class FakeDb:
    def __init__(self, **tables):
        self.tables = {name: [dict(r) for r in rows] for name, rows in tables.items()}

    def table(self, name):
        return FakeQuery(self, name)


class AdminRolesClient:
    def table(self, _name):
        return FakeQuery(FakeDb(admin_roles=[{"user_id": "admin-1", "role_type": "super_admin"}]), "admin_roles")


def _booking(**overrides):
    return {
        "id": "booking-1",
        "client_id": "customer-1",
        "pandit_id": "pandit-1",
        "catalog_puja_id": "puja-1",
        "status": "completed",
        "amount": 2500,
        "pandit_fee_amount": 2000,
        "refund_amount": 0,
        "booking_date": "2026-10-30",
        "updated_at": "2026-10-30T10:00:00Z",
        "pandit_payout_released_at": None,
        **overrides,
    }


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb(
        users=[
            {"id": "admin-1", "role": "admin", "full_name": "Admin", "wallet_balance": 0},
            {"id": "pandit-user-1", "role": "pandit", "full_name": "Lokesh Sharma", "wallet_balance": 0},
            {"id": "customer-1", "role": "user", "full_name": "Test Customer", "wallet_balance": 0},
        ],
        pandits=[{"id": "pandit-1", "user_id": "pandit-user-1", "display_name": "Lokesh Sharma", "city": "Ajmer"}],
        pujas=[{"id": "puja-1", "title": "Sundarkand Path"}],
        bookings=[_booking()],
        complaints=[],
        wallet_transactions=[],
        wallet_withdrawal_requests=[],
        pandit_bank_details=[],
    )
    for module in (admin_wallet, pandit_wallet, pandit_bookings, wallet):
        monkeypatch.setattr(module, "service_supabase", fake)
    monkeypatch.setattr(permissions, "service_supabase", AdminRolesClient())

    audit = []
    notes = []

    async def fake_notify(**kw):
        notes.append(kw)

    for module in (admin_wallet, pandit_wallet, pandit_bookings, wallet):
        monkeypatch.setattr(module, "write_audit_log", lambda **kw: audit.append(kw))
    for module in (admin_wallet, pandit_wallet, pandit_bookings):
        monkeypatch.setattr(module, "notify_user", fake_notify)
    monkeypatch.setattr(pandit_bookings, "get_or_create_invoice", lambda *a, **k: None)
    fake.audit, fake.notes = audit, notes
    yield fake
    app.dependency_overrides.clear()


def _login(user):
    async def fake_user():
        return user

    app.dependency_overrides[get_current_user] = fake_user


def _balance(db, user_id="pandit-user-1"):
    return next(u for u in db.tables["users"] if u["id"] == user_id)["wallet_balance"]


# ---------------------------------------------------------------------
# Completing a puja
# ---------------------------------------------------------------------

def test_completing_puja_does_not_credit_wallet_but_notifies_admin(db):
    db.tables["bookings"] = [_booking(status="confirmed")]
    _login(PANDIT_USER)

    resp = client.patch("/pandit/me/bookings/booking-1/complete", headers=HEADERS)

    assert resp.status_code == 200, resp.text
    assert db.tables["bookings"][0]["status"] == "completed"
    assert _balance(db) == 0
    assert db.tables["wallet_transactions"] == []
    admin_notes = [n for n in db.notes if n["type"] == "PANDIT_EARNING_PENDING"]
    assert [n["user_id"] for n in admin_notes] == ["admin-1"]
    assert admin_notes[0]["link"] == "/admin/wallet?tab=earnings"


# ---------------------------------------------------------------------
# Admin: Pandit Ji earnings
# ---------------------------------------------------------------------

def test_list_pending_earnings(db):
    db.tables["bookings"].append(_booking(id="booking-2", pandit_payout_released_at="2026-10-30T12:00:00Z"))
    db.tables["bookings"].append(_booking(id="booking-3", status="confirmed"))
    db.tables["complaints"].append({"booking_id": "booking-1", "status": "open"})
    _login(ADMIN)

    resp = client.get("/admin/wallet/pandit-earnings", headers=HEADERS)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert [r["id"] for r in body["items"]] == ["booking-1"]
    item = body["items"][0]
    assert item["pandit_name"] == "Lokesh Sharma"
    assert item["customer_name"] == "Test Customer"
    assert item["puja_title"] == "Sundarkand Path"
    assert item["has_open_complaint"] is True

    released = client.get("/admin/wallet/pandit-earnings", params={"status": "released"}, headers=HEADERS).json()
    assert [r["id"] for r in released["items"]] == ["booking-2"]


def test_release_credits_wallet_once(db):
    _login(ADMIN)

    resp = client.post("/admin/wallet/pandit-earnings/booking-1/release", json={}, headers=HEADERS)

    assert resp.status_code == 200, resp.text
    assert _balance(db) == 2000
    booking = db.tables["bookings"][0]
    assert booking["pandit_payout_released_at"] and booking["pandit_payout_released_by"] == "admin-1"
    assert booking["pandit_payout_amount"] == 2000
    [txn] = db.tables["wallet_transactions"]
    assert (txn["reason"], txn["reference_type"], txn["reference_id"]) == ("pandit_booking_earning", "bookings", "booking-1")
    assert any(n["type"] == "EARNING_RELEASED" and n["user_id"] == "pandit-user-1" for n in db.notes)

    again = client.post("/admin/wallet/pandit-earnings/booking-1/release", json={}, headers=HEADERS)
    assert again.status_code == 409
    assert _balance(db) == 2000
    assert len(db.tables["wallet_transactions"]) == 1


def test_release_rejects_unfinished_booking(db):
    db.tables["bookings"] = [_booking(status="confirmed")]
    _login(ADMIN)

    resp = client.post("/admin/wallet/pandit-earnings/booking-1/release", json={}, headers=HEADERS)

    assert resp.status_code == 400
    assert _balance(db) == 0


def test_release_partial_amount_needs_note_and_cannot_exceed_fee(db):
    _login(ADMIN)
    url = "/admin/wallet/pandit-earnings/booking-1/release"

    assert client.post(url, json={"amount": 2500}, headers=HEADERS).status_code == 400
    assert client.post(url, json={"amount": 1500}, headers=HEADERS).status_code == 400
    assert _balance(db) == 0

    resp = client.post(url, json={"amount": 1500, "admin_notes": "Late arrival, Rs. 500 refunded"}, headers=HEADERS)
    assert resp.status_code == 200, resp.text
    assert _balance(db) == 1500


def test_release_old_booking_without_fee_needs_amount(db):
    db.tables["bookings"] = [_booking(pandit_fee_amount=None)]
    _login(ADMIN)
    url = "/admin/wallet/pandit-earnings/booking-1/release"

    assert client.post(url, json={}, headers=HEADERS).status_code == 400
    assert client.post(url, json={"amount": 1800}, headers=HEADERS).status_code == 200
    assert _balance(db) == 1800


def test_release_rolls_back_if_wallet_credit_fails(db, monkeypatch):
    monkeypatch.setattr(admin_wallet, "credit_wallet", lambda **kw: None)
    _login(ADMIN)

    resp = client.post("/admin/wallet/pandit-earnings/booking-1/release", json={}, headers=HEADERS)

    assert resp.status_code == 500
    assert db.tables["bookings"][0]["pandit_payout_released_at"] is None


def test_release_requires_admin(db):
    _login(PANDIT_USER)
    resp = client.post("/admin/wallet/pandit-earnings/booking-1/release", json={}, headers=HEADERS)
    assert resp.status_code == 403
    assert _balance(db) == 0


# ---------------------------------------------------------------------
# Admin: withdrawals
# ---------------------------------------------------------------------

@pytest.fixture
def withdrawal(db, monkeypatch):
    monkeypatch.setattr(admin_wallet, "decrypt_value", lambda token: token and token.removeprefix("enc:"))
    db.tables["pandit_bank_details"] = [
        {
            "pandit_id": "pandit-1",
            "account_holder_name": "Lokesh Sharma",
            "bank_name": "SBI",
            "account_no_enc": "enc:123456789012",
            "ifsc_enc": "enc:SBIN0001234",
            "upi_id_enc": "enc:lokesh@upi",
        }
    ]
    next(u for u in db.tables["users"] if u["id"] == "pandit-user-1")["wallet_balance"] = 2000
    db.tables["wallet_withdrawal_requests"] = [
        {"id": "wd-1", "pandit_id": "pandit-1", "user_id": "pandit-user-1", "amount": 1500, "status": "pending", "requested_at": "2026-10-31T09:00:00Z"}
    ]
    return db.tables["wallet_withdrawal_requests"][0]


def test_list_withdrawals_keeps_bank_details_masked(withdrawal):
    _login(ADMIN)
    item = client.get("/admin/wallet/withdrawals", headers=HEADERS).json()["items"][0]
    assert item["bank_details"]["account_number_masked"].endswith("9012")
    assert "123456789012" not in str(item)


def test_reveal_bank_details_is_audited(db, withdrawal):
    _login(ADMIN)

    resp = client.get("/admin/wallet/withdrawals/wd-1/bank-details", headers=HEADERS)

    assert resp.status_code == 200, resp.text
    assert resp.json() == {
        "account_holder_name": "Lokesh Sharma",
        "bank_name": "SBI",
        "account_number": "123456789012",
        "ifsc": "SBIN0001234",
        "upi_id": "lokesh@upi",
    }
    assert any(a["action"] == "ADMIN_PANDIT_BANK_DETAILS_VIEWED" and a["actor_id"] == "admin-1" for a in db.audit)


def test_reveal_bank_details_only_for_open_requests_and_admins(db, withdrawal):
    _login(PANDIT_USER)
    assert client.get("/admin/wallet/withdrawals/wd-1/bank-details", headers=HEADERS).status_code == 403

    withdrawal["status"] = "paid"
    _login(ADMIN)
    assert client.get("/admin/wallet/withdrawals/wd-1/bank-details", headers=HEADERS).status_code == 400


def test_mark_paid_requires_transfer_reference(db, withdrawal):
    _login(ADMIN)
    url = "/admin/wallet/withdrawals/wd-1"

    assert client.patch(url, json={"action": "mark_paid"}, headers=HEADERS).status_code == 400
    assert client.patch(url, json={"action": "mark_paid", "payout_reference": "UTR123456"}, headers=HEADERS).status_code == 400
    assert withdrawal["status"] == "pending" and _balance(db) == 2000

    resp = client.patch(url, json={"action": "mark_paid", "payout_reference": " UTR123456 ", "payout_method": "imps"}, headers=HEADERS)

    assert resp.status_code == 200, resp.text
    assert withdrawal["status"] == "paid"
    assert (withdrawal["payout_reference"], withdrawal["payout_method"]) == ("UTR123456", "imps")
    assert _balance(db) == 500
    paid_note = next(n for n in db.notes if n["type"] == "WITHDRAWAL_PAID")
    assert "UTR123456" in paid_note["message"]


def test_approve_and_reject_do_not_need_reference(db, withdrawal):
    _login(ADMIN)
    assert client.patch("/admin/wallet/withdrawals/wd-1", json={"action": "approve"}, headers=HEADERS).status_code == 200
    assert withdrawal["status"] == "approved"
    assert _balance(db) == 2000


# ---------------------------------------------------------------------
# Pandit Ji wallet
# ---------------------------------------------------------------------

def test_pandit_wallet_shows_fees_awaiting_release(db):
    db.tables["bookings"].append(_booking(id="booking-2", pandit_fee_amount=1100))
    db.tables["bookings"].append(_booking(id="booking-3", pandit_payout_released_at="2026-10-30T12:00:00Z"))
    next(u for u in db.tables["users"] if u["id"] == "pandit-user-1")["wallet_balance"] = 2000
    db.tables["wallet_withdrawal_requests"] = [
        {"id": "wd-1", "pandit_id": "pandit-1", "user_id": "pandit-user-1", "amount": 500, "status": "pending", "requested_at": "2026-10-31T09:00:00Z"}
    ]
    _login(PANDIT_USER)

    body = client.get("/pandit/me/wallet", headers=HEADERS).json()

    assert body["balance"] == 2000
    assert body["available_balance"] == 1500
    assert body["awaiting_release_count"] == 2
    assert body["awaiting_release_amount"] == 3100


def test_full_flow_release_then_withdraw(db, monkeypatch):
    db.tables["pandit_bank_details"] = [{"pandit_id": "pandit-1"}]
    _login(PANDIT_USER)
    early = client.post("/pandit/me/wallet/withdraw", json={"amount": 2000}, headers=HEADERS)
    assert early.status_code == 400  # nothing released yet

    _login(ADMIN)
    assert client.post("/admin/wallet/pandit-earnings/booking-1/release", json={}, headers=HEADERS).status_code == 200

    _login(PANDIT_USER)
    resp = client.post("/pandit/me/wallet/withdraw", json={"amount": 2000}, headers=HEADERS)
    assert resp.status_code == 200, resp.text
    assert db.tables["wallet_withdrawal_requests"][0]["status"] == "pending"
