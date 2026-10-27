"""
Tests for the two follow-up hardening items:

  - login_rate_limit.py: brute-force protection shared by /auth/login
    and /admin/auth/login (both go through supabase_password_login).
  - client_wallet.py::topup_wallet now requires a real, verified,
    amount-matching Razorpay payment -- same ledger bookings.py and
    package_bookings.py already consume from.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import config
import login_rate_limit
from payment_verification import PaymentNotVerifiedError


# ---------------------------------------------------------------------
# Shared fake Supabase (extends the pattern used elsewhere in this test
# suite with .gte(), since rate-limit queries filter by a time cutoff).
# ---------------------------------------------------------------------

class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table_name = db, table
        self.op, self.filters, self.payload, self.max = "select", [], None, None

    def select(self, *_a, **_k): return self
    def insert(self, row): self.op, self.payload = "insert", row; return self
    def update(self, row): self.op, self.payload = "update", row; return self
    def eq(self, col, val): self.filters.append(lambda r: r.get(col) == val); return self
    def gte(self, col, val): self.filters.append(lambda r: r.get(col) >= val); return self
    def limit(self, n): self.max = n; return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table_name, [])
        if self.op == "insert":
            # created_at has DEFAULT now() in the real schema -- simulate
            # that here, since record_login_attempt()/credit_wallet() etc.
            # don't set it themselves either.
            row = {"id": f"id{len(rows)}", "created_at": datetime.now(timezone.utc).isoformat(), **self.payload}
            rows.append(row)
            return type("R", (), {"data": [row]})
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
            return type("R", (), {"data": matched})
        return type("R", (), {"data": matched[: self.max] if self.max else matched})


class FakeDb:
    def __init__(self):
        self.tables = {}

    def table(self, name):
        return FakeQuery(self, name)


def _seed_failure(db, email, minutes_ago=0, ip="1.2.3.4"):
    ts = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
    db.tables.setdefault("login_attempts", []).append(
        {"id": f"a{len(db.tables.get('login_attempts', []))}", "email": email, "ip_address": ip, "success": False, "created_at": ts}
    )


# ---------------------------------------------------------------------
# login_rate_limit.py
# ---------------------------------------------------------------------

@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(login_rate_limit, "service_supabase", fake)
    monkeypatch.setattr(config, "LOGIN_MAX_FAILED_ATTEMPTS", 3)
    monkeypatch.setattr(config, "LOGIN_MAX_FAILED_ATTEMPTS_PER_IP", 6)
    monkeypatch.setattr(config, "LOGIN_LOCKOUT_WINDOW_MINUTES", 15)
    return fake


def test_no_prior_failures_passes(db):
    login_rate_limit.check_login_rate_limit("new@example.com", "1.2.3.4")  # must not raise


def test_blocks_after_max_failed_attempts_for_one_email(db):
    for _ in range(3):
        _seed_failure(db, "victim@example.com")
    with pytest.raises(login_rate_limit.LoginRateLimitedError) as caught:
        login_rate_limit.check_login_rate_limit("victim@example.com", "9.9.9.9")
    assert caught.value.code == "LOGIN_RATE_LIMITED"
    assert caught.value.retry_after_seconds > 0


def test_email_match_is_case_and_whitespace_insensitive(db):
    for _ in range(3):
        _seed_failure(db, "victim@example.com")
    with pytest.raises(login_rate_limit.LoginRateLimitedError):
        login_rate_limit.check_login_rate_limit("  Victim@Example.com  ", "9.9.9.9")


def test_failures_outside_the_window_do_not_count(db):
    for _ in range(3):
        _seed_failure(db, "victim@example.com", minutes_ago=20)  # older than the 15-min window
    login_rate_limit.check_login_rate_limit("victim@example.com", "9.9.9.9")  # must not raise


def test_different_emails_are_tracked_independently(db):
    for _ in range(3):
        _seed_failure(db, "victim@example.com")
    login_rate_limit.check_login_rate_limit("someone-else@example.com", "9.9.9.9")  # must not raise


def test_per_ip_limit_blocks_credential_stuffing_across_many_emails(db):
    for i in range(6):
        _seed_failure(db, f"target{i}@example.com", ip="10.0.0.1")
    with pytest.raises(login_rate_limit.LoginRateLimitedError):
        login_rate_limit.check_login_rate_limit("yet-another@example.com", "10.0.0.1")


def test_per_ip_limit_does_not_affect_a_different_ip(db):
    for i in range(6):
        _seed_failure(db, f"target{i}@example.com", ip="10.0.0.1")
    login_rate_limit.check_login_rate_limit("fresh@example.com", "203.0.113.5")  # must not raise


def test_missing_ip_only_checks_the_per_email_limit(db):
    login_rate_limit.check_login_rate_limit("nobody@example.com", None)  # must not raise, no crash


def test_a_lookup_failure_fails_open_rather_than_locking_everyone_out(db, monkeypatch):
    """
    A DB hiccup while checking the rate limit must not become a
    site-wide login outage -- the check logs and lets the attempt
    proceed, same as every other best-effort write in this codebase.
    """
    def broken_table(_name):
        raise RuntimeError("simulated DB outage")

    monkeypatch.setattr(db, "table", broken_table)
    login_rate_limit.check_login_rate_limit("anyone@example.com", "1.2.3.4")  # must not raise


def test_record_login_attempt_writes_a_row(db):
    login_rate_limit.record_login_attempt("someone@example.com", "1.2.3.4", success=False)
    rows = db.tables["login_attempts"]
    assert len(rows) == 1
    assert rows[0]["email"] == "someone@example.com"
    assert rows[0]["success"] is False


# ---------------------------------------------------------------------
# Wired into supabase_password_login -- shared by /auth/login and
# /admin/auth/login, so testing it once here covers both.
# ---------------------------------------------------------------------

class FakeResponse:
    def __init__(self, status_code, json_data):
        self.status_code = status_code
        self._json = json_data

    def json(self):
        return self._json


class FakeAsyncClient:
    """Stands in for httpx.AsyncClient so no real network call happens."""

    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, *_a, **_k):
        return self._response


class FakeRequest:
    def __init__(self, ip="203.0.113.9"):
        self.headers = {}
        self.client = type("C", (), {"host": ip})


@pytest.fixture
def login_env(monkeypatch):
    import httpx
    import routers.auth as auth_router

    fake_db = FakeDb()
    monkeypatch.setattr(login_rate_limit, "service_supabase", fake_db)
    monkeypatch.setattr(auth_router, "service_supabase", fake_db)
    monkeypatch.setattr(auth_router, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(auth_router, "SUPABASE_ANON_KEY", "anon-key")
    monkeypatch.setattr(config, "LOGIN_MAX_FAILED_ATTEMPTS", 3)
    monkeypatch.setattr(config, "LOGIN_MAX_FAILED_ATTEMPTS_PER_IP", 50)
    monkeypatch.setattr(config, "LOGIN_LOCKOUT_WINDOW_MINUTES", 15)
    return fake_db


def _login(monkeypatch, status_code, json_data=None):
    import httpx
    import routers.auth as auth_router

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_k: FakeAsyncClient(FakeResponse(status_code, json_data or {})))
    return asyncio.run(
        auth_router.supabase_password_login(email="victim@example.com", password="wrong", request=FakeRequest())
    )


def test_wrong_password_is_recorded_as_a_failure(login_env, monkeypatch):
    with pytest.raises(HTTPException) as caught:
        _login(monkeypatch, 400)
    assert caught.value.status_code == 401
    assert caught.value.detail["code"] == "INVALID_CREDENTIALS"
    assert len(login_env.tables["login_attempts"]) == 1
    assert login_env.tables["login_attempts"][0]["success"] is False


def test_fifth_wrong_password_is_rate_limited_not_passed_to_supabase(login_env, monkeypatch):
    import httpx

    for _ in range(3):
        try:
            _login(monkeypatch, 400)
        except HTTPException:
            pass

    # The call limit is reached -- this attempt must be rejected before
    # ever constructing an httpx client (proven by making AsyncClient
    # raise if it's touched at all).
    def must_not_be_called(**_k):
        raise AssertionError("httpx.AsyncClient should not be called once rate-limited")

    monkeypatch.setattr(httpx, "AsyncClient", must_not_be_called)
    import routers.auth as auth_router

    with pytest.raises(HTTPException) as caught:
        asyncio.run(auth_router.supabase_password_login(email="victim@example.com", password="wrong", request=FakeRequest()))
    assert caught.value.status_code == 429
    assert caught.value.detail["code"] == "LOGIN_RATE_LIMITED"


def test_a_successful_login_is_recorded_as_a_success(login_env, monkeypatch):
    import httpx
    import routers.auth as auth_router

    monkeypatch.setattr(
        httpx, "AsyncClient",
        lambda **_k: FakeAsyncClient(FakeResponse(200, {"access_token": "tok", "refresh_token": "rtok", "expires_in": 3600})),
    )
    result = asyncio.run(
        auth_router.supabase_password_login(email="legit@example.com", password="right", request=FakeRequest())
    )
    assert result["access_token"] == "tok"
    rows = login_env.tables["login_attempts"]
    assert rows[-1]["success"] is True


def test_self_service_password_confirmation_is_never_rate_limited(login_env, monkeypatch):
    """
    client_settings.py / admin_settings.py call supabase_password_login
    with no `request` to re-check an already-authenticated user's own
    current password -- that must never be throttled or logged as a
    public login attempt, even after other calls have failed a lot.
    """
    import httpx
    import routers.auth as auth_router

    for _ in range(10):
        _seed_failure_for(login_env, "legit@example.com")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_k: FakeAsyncClient(FakeResponse(400, {})))
    with pytest.raises(HTTPException) as caught:
        asyncio.run(auth_router.supabase_password_login(email="legit@example.com", password="typo"))  # no request=
    assert caught.value.detail["code"] == "INVALID_CREDENTIALS"  # not LOGIN_RATE_LIMITED
    assert len(login_env.tables.get("login_attempts", [])) == 10  # unchanged -- nothing recorded for this call


def _seed_failure_for(db, email):
    ts = datetime.now(timezone.utc).isoformat()
    db.tables.setdefault("login_attempts", []).append(
        {"id": f"a{len(db.tables.get('login_attempts', []))}", "email": email, "ip_address": "1.1.1.1", "success": False, "created_at": ts}
    )


# ---------------------------------------------------------------------
# Wallet top-up now requires a real, verified payment
# ---------------------------------------------------------------------

class PVFakeQuery(FakeQuery):
    pass


class PVFakeDb(FakeDb):
    pass


@pytest.fixture
def wallet_env(monkeypatch):
    import payment_verification as pv
    import routers.client_wallet as client_wallet

    fake = PVFakeDb()
    monkeypatch.setattr(pv, "service_supabase", fake)
    monkeypatch.setattr(client_wallet, "credit_wallet", lambda **kw: 1500.0)
    monkeypatch.setattr(client_wallet, "write_audit_log", lambda **kw: None)
    return fake


def _pay(db, user_id="u1", amount=500.0, payment_id="pay_topup_1"):
    import payment_verification as pv
    pv.record_payment_order(user_id, "order_1", amount)
    pv.mark_payment_verified("order_1", payment_id)
    return payment_id


def test_topup_succeeds_with_a_real_verified_payment(wallet_env, monkeypatch):
    import routers.client_wallet as client_wallet

    payment_id = _pay(wallet_env, user_id="u1", amount=500.0)
    result = asyncio.run(
        client_wallet.topup_wallet(
            client_wallet.TopupIn(amount=500.0, payment_ref=payment_id),
            current_user={"id": "u1"},
        )
    )
    assert result["balance"] == 1500.0
    assert wallet_env.tables["payment_verifications"][0]["status"] == "consumed"


def test_topup_rejects_a_fabricated_payment_ref(wallet_env):
    import routers.client_wallet as client_wallet

    with pytest.raises(HTTPException) as caught:
        asyncio.run(
            client_wallet.topup_wallet(
                client_wallet.TopupIn(amount=100000.0, payment_ref="made_up_ref"),
                current_user={"id": "attacker"},
            )
        )
    assert caught.value.status_code == 400
    assert caught.value.detail["code"] == "PAYMENT_NOT_FOUND"


def test_topup_rejects_paying_less_than_the_claimed_amount(wallet_env):
    import routers.client_wallet as client_wallet

    payment_id = _pay(wallet_env, user_id="u1", amount=1.0)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(
            client_wallet.topup_wallet(
                client_wallet.TopupIn(amount=100000.0, payment_ref=payment_id),
                current_user={"id": "u1"},
            )
        )
    assert caught.value.detail["code"] == "PAYMENT_AMOUNT_MISMATCH"


def test_topup_cannot_reuse_the_same_payment_twice(wallet_env):
    import routers.client_wallet as client_wallet

    payment_id = _pay(wallet_env, user_id="u1", amount=500.0)
    asyncio.run(
        client_wallet.topup_wallet(
            client_wallet.TopupIn(amount=500.0, payment_ref=payment_id), current_user={"id": "u1"},
        )
    )
    with pytest.raises(HTTPException) as caught:
        asyncio.run(
            client_wallet.topup_wallet(
                client_wallet.TopupIn(amount=500.0, payment_ref=payment_id), current_user={"id": "u1"},
            )
        )
    assert caught.value.detail["code"] == "PAYMENT_ALREADY_USED"


def test_topup_payment_ref_is_required():
    import routers.client_wallet as client_wallet
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        client_wallet.TopupIn(amount=500.0, payment_ref="")
