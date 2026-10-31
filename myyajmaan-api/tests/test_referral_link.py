"""
Tests for the Refer & Earn link flow:

  - GET /referral gives a shareable link to the public site's register
    page (it used an APP_BASE_URL env var that was never set on Render,
    so live links pointed at localhost).
  - A friend who registers from /register?ref=CODE is linked to the
    referrer (users.referred_by), whatever the code's case.
  - Once that friend is verified, the referrer gets the referral reward.
"""

import pytest
from fastapi.testclient import TestClient

import config
import referral_utils
import signup_rewards
from auth import get_current_user
from main import app
from routers import auth as auth_router
from routers import referrals

client = TestClient(app)
HEADERS = {"X-Requested-With": "XMLHttpRequest"}


class Result:
    def __init__(self, data):
        self.data = data
        self.error = None


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.filters = []
        self.op, self.payload = "select", None

    def select(self, *_a, **_k):
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def upsert(self, payload, **_k):
        self.op, self.payload = "upsert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def eq(self, col, value):
        self.filters.append(lambda r: r.get(col) == value)
        return self

    def in_(self, col, values):
        self.filters.append(lambda r: r.get(col) in values)
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, _n):
        return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table, [])
        if self.op in ("insert", "upsert"):
            row = {"id": f"{self.table}-{len(rows) + 1}", **self.payload}
            rows.append(row)
            return Result([dict(row)])
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
        return Result([dict(r) for r in matched])


class FakeDb:
    def __init__(self, **tables):
        self.tables = tables

    def table(self, name):
        return FakeQuery(self, name)


# ---------------------------------------------------------------------
# GET /referral
# ---------------------------------------------------------------------

@pytest.fixture
def logged_in(monkeypatch):
    async def fake_user():
        return {"id": "user-1", "role": "user", "full_name": "Asmita Sharma", "wallet_balance": 25}

    app.dependency_overrides[get_current_user] = fake_user
    monkeypatch.setattr(referrals, "ensure_referral_code", lambda *_a, **_k: "ASMITASHAR8139")
    monkeypatch.setattr(referrals, "service_supabase", None)
    yield
    app.dependency_overrides.clear()


def test_referral_share_url_uses_public_site(logged_in, monkeypatch):
    monkeypatch.delenv("APP_BASE_URL", raising=False)
    monkeypatch.setattr(config, "PUBLIC_SITE_URL", "https://www.myyajmaan.com/")

    body = client.get("/referral", headers=HEADERS).json()

    assert body["code"] == "ASMITASHAR8139"
    assert body["shareUrl"] == "https://www.myyajmaan.com/register?ref=ASMITASHAR8139"
    assert "localhost" not in body["shareUrl"]


def test_referral_share_url_app_base_url_still_wins(logged_in, monkeypatch):
    monkeypatch.setenv("APP_BASE_URL", "https://staging.myyajmaan.com")
    monkeypatch.setattr(config, "PUBLIC_SITE_URL", "https://www.myyajmaan.com")

    body = client.get("/referral", headers=HEADERS).json()

    assert body["shareUrl"] == "https://staging.myyajmaan.com/register?ref=ASMITASHAR8139"


def test_referral_rewards_is_public(monkeypatch):
    app.dependency_overrides.clear()
    db = FakeDb(
        coupons=[
            {"coupon_type": "referral_signup", "is_active": True, "discount_value": 25},
            {"coupon_type": "referral_booking", "is_active": True, "discount_value": 51},
            {"coupon_type": "referral_booking", "is_active": False, "discount_value": 999},
        ]
    )
    monkeypatch.setattr(referrals, "service_supabase", db)

    resp = client.get("/referral/rewards", headers=HEADERS)

    assert resp.status_code == 200
    assert resp.json() == {"signupReward": "₹25", "bookingReward": "₹51"}


def test_referral_rewards_when_not_configured(monkeypatch):
    monkeypatch.setattr(referrals, "service_supabase", FakeDb(coupons=[]))
    assert client.get("/referral/rewards", headers=HEADERS).json() == {"signupReward": "—", "bookingReward": "—"}


def test_referral_requires_login():
    app.dependency_overrides.clear()
    assert client.get("/referral", headers=HEADERS).status_code == 401


# ---------------------------------------------------------------------
# POST /auth/register with ?ref= code
# ---------------------------------------------------------------------

@pytest.fixture
def register_env(monkeypatch):
    db = FakeDb(
        users=[{"id": "referrer-1", "email": "asmita@example.com", "phone": "9000000001", "role": "user"}],
        referrals=[{"user_id": "referrer-1", "code": "ASMITASHAR8139"}],
    )
    monkeypatch.setattr(auth_router, "service_supabase", db)
    monkeypatch.setattr(referral_utils, "service_supabase", db)

    async def fake_signup(**kw):
        return {"id": f"auth-{kw['email']}"}, None

    async def fake_otps(_profile):
        return {}

    monkeypatch.setattr(auth_router, "supabase_signup", fake_signup)
    monkeypatch.setattr(auth_router, "send_signup_otps", fake_otps)
    monkeypatch.setattr(auth_router, "ensure_referral_code", lambda *_a, **_k: "NEWCODE1")
    monkeypatch.setattr(auth_router, "write_audit_log", lambda **_k: None)
    return db


def _register(ref=None, email="friend@example.com", phone="9000000002"):
    payload = {
        "email": email,
        "password": "secret123",
        "full_name": "Friend Kumar",
        "phone": phone,
        "agreed_to_terms": True,
    }
    if ref is not None:
        payload["referral_code"] = ref
    return client.post("/auth/register", json=payload, headers=HEADERS)


def _new_user(db, email="friend@example.com"):
    return next(u for u in db.tables["users"] if u.get("email") == email)


def test_register_from_referral_link_links_referrer(register_env):
    resp = _register(ref="asmitashar8139")  # case doesn't matter

    assert resp.status_code < 300, resp.text
    assert _new_user(register_env)["referred_by"] == "referrer-1"


def test_register_with_unknown_code_still_succeeds(register_env):
    resp = _register(ref="NOSUCHCODE")

    assert resp.status_code < 300, resp.text
    assert "referred_by" not in _new_user(register_env)


def test_register_without_code_is_unchanged(register_env):
    resp = _register()

    assert resp.status_code < 300, resp.text
    assert "referred_by" not in _new_user(register_env)


# ---------------------------------------------------------------------
# Reward once the referred friend is verified
# ---------------------------------------------------------------------

def test_verified_referred_user_rewards_referrer(monkeypatch):
    credits = []
    monkeypatch.setattr(signup_rewards, "service_supabase", object())
    monkeypatch.setattr(signup_rewards, "credit_wallet", lambda **kw: credits.append(kw) or 100.0)
    monkeypatch.setattr(signup_rewards, "get_active_coupon_amount", lambda _t: 25.0)
    monkeypatch.setattr(signup_rewards, "write_audit_log", lambda **_k: None)

    signup_rewards.grant_signup_rewards({"id": "friend-1", "role": "user", "referred_by": "referrer-1"})

    assert {(c["user_id"], c["reason"]) for c in credits} == {
        ("friend-1", "signup_bonus"),
        ("referrer-1", "referral_signup"),
    }
