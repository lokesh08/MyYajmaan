import asyncio
import hashlib
import hmac
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

import config
import otp_service
from routers import payments


# ---- Razorpay signature verification --------------------------------

@pytest.fixture
def razorpay_keys(monkeypatch):
    monkeypatch.setattr(config, "RAZORPAY_KEY_ID", "rzp_test_key")
    monkeypatch.setattr(config, "RAZORPAY_KEY_SECRET", "test_secret")
    monkeypatch.setattr(config, "RAZORPAY_MOCK_MODE", False)
    monkeypatch.setattr(payments, "write_audit_log", lambda **kwargs: None)


def _verify(signature):
    payload = payments.VerifyPaymentIn(
        razorpay_order_id="order_1",
        razorpay_payment_id="pay_1",
        razorpay_signature=signature,
    )
    return asyncio.run(payments.verify_payment(payload, {"id": "user-1"}))


def test_valid_signature_is_accepted(razorpay_keys):
    good = hmac.new(b"test_secret", b"order_1|pay_1", hashlib.sha256).hexdigest()
    result = _verify(good)
    assert result["status"] == "success"
    assert result["sessionId"] == "pay_1"


def test_forged_signature_is_rejected(razorpay_keys):
    with pytest.raises(HTTPException) as caught:
        _verify("0" * 64)
    assert caught.value.status_code == 400
    assert caught.value.detail["code"] == "PAYMENT_VERIFICATION_FAILED"


def test_signature_for_a_different_order_is_rejected(razorpay_keys):
    other = hmac.new(b"test_secret", b"order_999|pay_1", hashlib.sha256).hexdigest()
    with pytest.raises(HTTPException):
        _verify(other)


def test_unconfigured_gateway_refuses_instead_of_pretending(monkeypatch):
    monkeypatch.setattr(config, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(config, "RAZORPAY_KEY_SECRET", "")
    monkeypatch.setattr(config, "RAZORPAY_MOCK_MODE", False)
    with pytest.raises(HTTPException) as caught:
        _verify("anything")
    assert caught.value.status_code == 503


def _mock_mode(monkeypatch, secure=False):
    monkeypatch.setattr(config, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(config, "RAZORPAY_KEY_SECRET", "")
    monkeypatch.setattr(config, "RAZORPAY_MOCK_MODE", True)
    monkeypatch.setattr(config, "COOKIE_SECURE", secure)


def test_mock_mode_creates_a_fake_order_without_keys(monkeypatch):
    _mock_mode(monkeypatch)
    order = asyncio.run(payments.create_order(payments.CreateOrderIn(amount=2720), {"id": "u1"}))
    assert order["mock"] is True
    assert order["order_id"].startswith("order_mock_")
    assert order["amount"] == 272000


def test_mock_mode_accepts_only_its_own_fake_payments(monkeypatch):
    _mock_mode(monkeypatch)
    ok = asyncio.run(payments.verify_payment(
        payments.VerifyPaymentIn(razorpay_order_id="order_mock_1", razorpay_payment_id="pay_mock_1",
                                 razorpay_signature="mock_signature"), {"id": "u1"}))
    assert ok["status"] == "success"
    with pytest.raises(HTTPException):  # a real-looking order id can't ride on mock mode
        asyncio.run(payments.verify_payment(
            payments.VerifyPaymentIn(razorpay_order_id="order_real", razorpay_payment_id="pay_1",
                                     razorpay_signature="mock_signature"), {"id": "u1"}))


def test_mock_mode_is_ignored_on_a_secure_deployment(monkeypatch):
    _mock_mode(monkeypatch, secure=True)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(payments.create_order(payments.CreateOrderIn(amount=100), {"id": "u1"}))
    assert caught.value.status_code == 503


# ---- OTP ------------------------------------------------------------

class FakeQuery:
    """Just enough of the supabase-py query builder for otp_service."""

    def __init__(self, db, table):
        self.db, self.table_name = db, table
        self.op, self.filters, self.payload, self.max = "select", [], None, None

    def select(self, *_a, **_k): return self
    def insert(self, row): self.op, self.payload = "insert", row; return self
    def update(self, row): self.op, self.payload = "update", row; return self
    def delete(self): self.op = "delete"; return self
    def eq(self, col, val): self.filters.append(lambda r: r.get(col) == val); return self
    def gte(self, col, val): self.filters.append(lambda r: r.get(col) >= val); return self
    def is_(self, col, _null): self.filters.append(lambda r: r.get(col) is None); return self
    def order(self, col, desc=False): self._order = (col, desc); return self
    def limit(self, n): self.max = n; return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table_name, [])
        if self.op == "insert":
            row = {"id": f"id{len(rows)}", "attempts": 0, "consumed_at": None,
                   "created_at": datetime.now(timezone.utc).isoformat(), **self.payload}
            rows.append(row)
            return type("R", (), {"data": [row]})
        matched = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "update":
            for r in matched:
                r.update(self.payload)
            return type("R", (), {"data": matched})
        if self.op == "delete":
            for r in matched:
                rows.remove(r)
            return type("R", (), {"data": matched})
        col, desc = getattr(self, "_order", ("created_at", True))
        matched.sort(key=lambda r: r.get(col), reverse=desc)
        return type("R", (), {"data": matched[: self.max] if self.max else matched})


class FakeDb:
    def __init__(self):
        self.tables = {"users": [{"id": "u1", "email": "a@b.com", "phone": "9876543210"}]}

    def table(self, name):
        return FakeQuery(self, name)


@pytest.fixture
def db(monkeypatch):
    fake = FakeDb()
    monkeypatch.setattr(otp_service, "service_supabase", fake)
    monkeypatch.setattr(config, "OTP_DEV_MODE", True)
    monkeypatch.setattr(config, "COOKIE_SECURE", False)
    monkeypatch.setattr(config, "OTP_RESEND_COOLDOWN_SECONDS", 30)
    monkeypatch.setattr(config, "OTP_MAX_ATTEMPTS", 3)
    return fake


USER = {"id": "u1", "email": "a@b.com", "phone": "9876543210"}


def _issue(channel="email"):
    return asyncio.run(otp_service.issue_otp(USER, channel))["dev_otp"]


def test_correct_code_verifies_and_stamps_user(db):
    code = _issue("email")
    otp_service.verify_otp(USER, "email", code)
    assert db.tables["users"][0]["email_verified_at"]
    assert db.tables["signup_otps"][0]["consumed_at"]


def test_code_for_one_channel_cannot_verify_the_other(db):
    email_code = _issue("email")
    _issue("phone")
    with pytest.raises(otp_service.OtpError) as caught:
        otp_service.verify_otp(USER, "phone", email_code)
    assert caught.value.code == "OTP_INVALID"


def test_code_is_single_use(db):
    code = _issue("email")
    otp_service.verify_otp(USER, "email", code)
    with pytest.raises(otp_service.OtpError) as caught:
        otp_service.verify_otp(USER, "email", code)
    assert caught.value.code == "OTP_NOT_FOUND"


def test_wrong_attempts_lock_the_code_even_for_the_right_answer(db):
    code = _issue("email")
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(3):
        with pytest.raises(otp_service.OtpError):
            otp_service.verify_otp(USER, "email", wrong)
    with pytest.raises(otp_service.OtpError) as caught:
        otp_service.verify_otp(USER, "email", code)
    assert caught.value.code == "OTP_LOCKED"


def test_expired_code_is_rejected(db):
    code = _issue("email")
    db.tables["signup_otps"][0]["expires_at"] = (
        datetime.now(timezone.utc) - timedelta(seconds=1)
    ).isoformat()
    with pytest.raises(otp_service.OtpError) as caught:
        otp_service.verify_otp(USER, "email", code)
    assert caught.value.code == "OTP_EXPIRED"


def test_resend_cooldown_blocks_back_to_back_sends(db):
    _issue("email")
    with pytest.raises(otp_service.OtpError) as caught:
        _issue("email")
    assert caught.value.code == "OTP_COOLDOWN"
    assert caught.value.retry_after > 0


def test_dev_mode_is_ignored_on_a_secure_deployment(monkeypatch):
    monkeypatch.setattr(config, "OTP_DEV_MODE", True)
    monkeypatch.setattr(config, "COOKIE_SECURE", True)
    assert otp_service.dev_mode_active() is False


def test_stored_value_is_a_hash_not_the_code(db):
    code = _issue("email")
    assert code not in str(db.tables["signup_otps"][0].values())


def test_phone_normalisation():
    assert otp_service.normalize_phone("+91 98765-43210") == "919876543210"
    assert otp_service.normalize_phone("9876543210") == "919876543210"


# ---- signup rewards are paid only on verification ------------------

def test_signup_rewards_credit_bonus_and_referrer(monkeypatch):
    import signup_rewards

    credits = []
    monkeypatch.setattr(signup_rewards, "credit_wallet", lambda **kw: credits.append(kw))
    monkeypatch.setattr(signup_rewards, "get_active_coupon_amount", lambda _t: 50)
    monkeypatch.setattr(signup_rewards, "write_audit_log", lambda **kw: None)
    monkeypatch.setattr(signup_rewards, "service_supabase", object())

    signup_rewards.grant_signup_rewards({"id": "new", "role": "user", "email": "a@b.com", "referred_by": "ref"})

    assert [(c["user_id"], c["amount"], c["reason"]) for c in credits] == [
        ("new", 25, "signup_bonus"),
        ("ref", 50, "referral_signup"),
    ]


def test_signup_rewards_skip_non_customers(monkeypatch):
    import signup_rewards

    credits = []
    monkeypatch.setattr(signup_rewards, "credit_wallet", lambda **kw: credits.append(kw))

    signup_rewards.grant_signup_rewards({"id": "p1", "role": "pandit"})

    assert credits == []


# ---- dynamic sitemap -----------------------------------------------

def test_dynamic_sitemap_lists_only_public_pages_as_valid_xml(monkeypatch):
    import xml.dom.minidom

    from routers import seo

    monkeypatch.setattr(config, "PUBLIC_SITE_URL", "https://example.com/")
    monkeypatch.setattr(config, "SITEMAP_INCLUDE_PANDITS", True)
    monkeypatch.setattr(seo, "SUPABASE_ANON_KEY", "anon")

    class Query:
        def __init__(self, rows): self.rows = rows
        def select(self, *_a): return self
        def eq(self, *_a): return self
        def order(self, *_a): return self
        def execute(self): return type("R", (), {"data": self.rows})

    class Client:
        def table(self, name):
            if name == "pujas":
                return Query([{"id": "p1", "created_at": "2026-01-05T10:00:00+00:00"}])
            return Query([{"id": "pd1&x", "created_at": None}])

    monkeypatch.setattr(seo, "create_supabase_client_for_key", lambda _key: Client())

    response = seo.sitemap_dynamic()
    document = xml.dom.minidom.parseString(response.body)  # valid XML, even with '&' in an id
    locs = [n.firstChild.data for n in document.getElementsByTagName("loc")]

    assert locs == ["https://example.com/book/p1", "https://example.com/pandit/pd1&x"]
    assert "<lastmod>2026-01-05</lastmod>" in response.body.decode()
    assert response.headers["cache-control"] == "public, max-age=3600"


def test_dynamic_sitemap_can_exclude_pandit_profiles(monkeypatch):
    from routers import seo

    monkeypatch.setattr(config, "PUBLIC_SITE_URL", "https://example.com")
    monkeypatch.setattr(config, "SITEMAP_INCLUDE_PANDITS", False)
    monkeypatch.setattr(seo, "SUPABASE_ANON_KEY", "anon")
    tables = []

    class Query:
        def select(self, *_a): return self
        def eq(self, *_a): return self
        def order(self, *_a): return self
        def execute(self): return type("R", (), {"data": []})

    class Client:
        def table(self, name):
            tables.append(name)
            return Query()

    monkeypatch.setattr(seo, "create_supabase_client_for_key", lambda _key: Client())
    seo.sitemap_dynamic()
    assert tables == ["pujas"]
