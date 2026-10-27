"""
Tests for the security/validation hardening pass:

  - payment_verification.py: a booking/top-up can only consume a REAL,
    verified, unspent, amount-matching payment.
  - The role/ownership boundary between the three roles, proven at the
    real HTTP layer (not just unit-testing the dependency in isolation)
    -- a pandit-role session hitting a customer-only endpoint, and vice
    versa, and a non-admin hitting an admin-only endpoint.
  - The CSRF header requirement.
  - Security response headers.
  - The PostgREST filter-injection fix (sanitize_or_filter_term).
  - Upload validation (validate_image_upload).
"""

import asyncio
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from db import sanitize_or_filter_term, validate_image_upload
from main import app
from auth import get_current_user


client = TestClient(app)


# ---------------------------------------------------------------------
# payment_verification.py
# ---------------------------------------------------------------------

class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table_name = db, table
        self.op, self.filters, self.payload, self.max = "select", [], None, None

    def select(self, *_a, **_k): return self
    def insert(self, row): self.op, self.payload = "insert", row; return self
    def update(self, row): self.op, self.payload = "update", row; return self
    def eq(self, col, val): self.filters.append(lambda r: r.get(col) == val); return self
    def limit(self, n): self.max = n; return self

    def execute(self):
        rows = self.db.tables.setdefault(self.table_name, [])
        if self.op == "insert":
            row = {"id": f"id{len(rows)}", **self.payload}
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


@pytest.fixture
def db(monkeypatch):
    import payment_verification as pv
    fake = FakeDb()
    monkeypatch.setattr(pv, "service_supabase", fake)
    return fake


def _pay(db, user_id="u1", amount=1500.0, status="verified", payment_id="pay_1"):
    import payment_verification as pv
    pv.record_payment_order(user_id, "order_1", amount)
    if status in ("verified", "consumed"):
        pv.mark_payment_verified("order_1", payment_id)
    if status == "consumed":
        db.tables["payment_verifications"][0]["status"] = "consumed"
    return payment_id


def test_consume_succeeds_for_the_paying_user_with_the_right_amount(db):
    import payment_verification as pv
    payment_id = _pay(db)
    pv.consume_verified_payment(user_id="u1", payment_id=payment_id, expected_amount=1500.0, reference_type="booking")
    assert db.tables["payment_verifications"][0]["status"] == "consumed"


def test_consume_rejects_a_fabricated_payment_ref(db):
    import payment_verification as pv
    with pytest.raises(pv.PaymentNotVerifiedError) as caught:
        pv.consume_verified_payment(user_id="u1", payment_id="not_a_real_payment", expected_amount=1500.0, reference_type="booking")
    assert caught.value.code == "PAYMENT_NOT_FOUND"


def test_consume_rejects_another_users_payment(db):
    import payment_verification as pv
    payment_id = _pay(db, user_id="attacker")
    with pytest.raises(pv.PaymentNotVerifiedError) as caught:
        pv.consume_verified_payment(user_id="victim", payment_id=payment_id, expected_amount=1500.0, reference_type="booking")
    assert caught.value.code == "PAYMENT_NOT_FOUND"


def test_consume_rejects_a_mismatched_amount(db):
    """Paying Rs 1 for a Rs 5000 booking must not succeed."""
    import payment_verification as pv
    payment_id = _pay(db, amount=1.0)
    with pytest.raises(pv.PaymentNotVerifiedError) as caught:
        pv.consume_verified_payment(user_id="u1", payment_id=payment_id, expected_amount=5000.0, reference_type="booking")
    assert caught.value.code == "PAYMENT_AMOUNT_MISMATCH"


def test_consume_rejects_reuse_of_an_already_consumed_payment(db):
    """The same payment_ref can't pay for two bookings."""
    import payment_verification as pv
    payment_id = _pay(db)
    pv.consume_verified_payment(user_id="u1", payment_id=payment_id, expected_amount=1500.0, reference_type="booking")
    with pytest.raises(pv.PaymentNotVerifiedError) as caught:
        pv.consume_verified_payment(user_id="u1", payment_id=payment_id, expected_amount=1500.0, reference_type="booking")
    assert caught.value.code == "PAYMENT_ALREADY_USED"


def test_consume_rejects_an_order_that_was_never_verified(db):
    import payment_verification as pv
    pv.record_payment_order("u1", "order_2", 1500.0)  # created, never verified
    with pytest.raises(pv.PaymentNotVerifiedError):
        pv.consume_verified_payment(user_id="u1", payment_id="pay_never_verified", expected_amount=1500.0, reference_type="booking")


def test_consume_requires_a_payment_ref_at_all(db):
    import payment_verification as pv
    with pytest.raises(pv.PaymentNotVerifiedError) as caught:
        pv.consume_verified_payment(user_id="u1", payment_id="", expected_amount=1500.0, reference_type="booking")
    assert caught.value.code == "PAYMENT_REF_REQUIRED"


def test_small_rounding_difference_is_tolerated(db):
    import payment_verification as pv
    payment_id = _pay(db, amount=1499.6)
    pv.consume_verified_payment(user_id="u1", payment_id=payment_id, expected_amount=1500.0, reference_type="booking")


# ---------------------------------------------------------------------
# Role / ownership boundary -- real HTTP layer
# ---------------------------------------------------------------------

def _as(role, user_id="test-user-id", **extra):
    async def fake_current_user():
        return {"id": user_id, "role": role, "full_name": "Test", "email": "t@example.com", **extra}
    app.dependency_overrides[get_current_user] = fake_current_user


def _csrf(**kw):
    kw.setdefault("headers", {})["X-Requested-With"] = "XMLHttpRequest"
    return kw


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


def test_pandit_token_cannot_reach_customer_only_endpoint():
    _as("pandit")
    response = client.get("/me/addresses", **_csrf())
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "INSUFFICIENT_PERMISSIONS"


def test_customer_token_cannot_reach_pandit_only_endpoint():
    _as("user")
    response = client.get("/pandit/me/pujas", **_csrf())
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "INSUFFICIENT_PERMISSIONS"


def test_customer_token_cannot_reach_admin_endpoint():
    _as("user")
    response = client.get("/admin/dashboard/summary", **_csrf())
    assert response.status_code == 403


def test_pandit_token_cannot_reach_admin_endpoint():
    _as("pandit")
    response = client.get("/admin/users/counts", **_csrf())
    assert response.status_code == 403


def test_unauthenticated_request_is_rejected_not_silently_scoped_to_nobody():
    async def raise_unauthenticated():
        raise HTTPException(status_code=401, detail={"code": "NOT_AUTHENTICATED", "message": "Please log in."})
    app.dependency_overrides[get_current_user] = raise_unauthenticated
    response = client.get("/me/addresses", **_csrf())
    assert response.status_code == 401


def test_matching_role_is_allowed_through_to_the_route(monkeypatch):
    """Sanity check the above 403s are about role, not something else broken."""
    import routers.client_addresses as client_addresses
    monkeypatch.setattr(client_addresses, "_client", lambda: type("C", (), {
        "table": lambda self, name: type("Q", (), {
            "select": lambda self, *a, **k: self,
            "eq": lambda self, *a, **k: self,
            "order": lambda self, *a, **k: self,
            "execute": lambda self: type("R", (), {"data": []}),
        })(),
    })())
    _as("user")
    response = client.get("/me/addresses", **_csrf())
    assert response.status_code == 200


# ---------------------------------------------------------------------
# CSRF header requirement
# ---------------------------------------------------------------------

def test_post_without_csrf_header_is_rejected():
    response = client.post("/auth/login", json={"email": "a@b.com", "password": "x"})
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "CSRF_HEADER_MISSING"


def test_post_with_csrf_header_reaches_the_route():
    # Reaches real route logic (wrong credentials -> its own 4xx), proving
    # the middleware let it through rather than blocking it.
    response = client.post("/auth/login", json={"email": "a@b.com", "password": "x"}, headers={"X-Requested-With": "XMLHttpRequest"})
    assert response.status_code != 403 or response.json().get("detail", {}).get("code") != "CSRF_HEADER_MISSING"


def test_get_requests_never_need_the_csrf_header():
    response = client.get("/")
    assert response.status_code == 200


# ---------------------------------------------------------------------
# Security response headers
# ---------------------------------------------------------------------

def test_security_headers_present_on_every_response():
    response = client.get("/")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "geolocation=(self)" in response.headers["permissions-policy"]


# ---------------------------------------------------------------------
# PostgREST filter-injection fix
# ---------------------------------------------------------------------

def test_sanitize_or_filter_term_strips_structural_characters():
    assert sanitize_or_filter_term("a,role.eq.admin") == "arole.eq.admin".replace(".", "")  # commas AND dots stripped
    assert "," not in sanitize_or_filter_term("x,y,z")
    assert "(" not in sanitize_or_filter_term("a(b)c")
    assert sanitize_or_filter_term("normal search term") == "normal search term"


def test_register_duplicate_check_no_longer_builds_a_raw_or_filter():
    """
    The fix replaced .or_(f"email.eq.{email},phone.eq.{phone}") with two
    separate .eq() calls -- assert the source no longer contains the
    vulnerable pattern (a regression here would silently reopen the hole).
    """
    import inspect
    import routers.auth as auth_router
    source = inspect.getsource(auth_router.register)
    live_code = "\n".join(line for line in source.splitlines() if not line.strip().startswith("#"))
    assert ".or_(" not in live_code
    assert '.eq("email", email)' in live_code
    assert '.eq("phone", phone)' in live_code


# ---------------------------------------------------------------------
# Upload validation
# ---------------------------------------------------------------------

def _tiny_png_bytes() -> bytes:
    from io import BytesIO
    from PIL import Image
    buf = BytesIO()
    Image.new("RGB", (4, 4), color=(255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


def test_validate_image_upload_accepts_a_real_image():
    validate_image_upload("image/png", _tiny_png_bytes())  # must not raise


def test_validate_image_upload_rejects_non_image_bytes():
    with pytest.raises(HTTPException) as caught:
        validate_image_upload("image/png", b"<script>alert(1)</script>")
    assert caught.value.status_code == 400


def test_validate_image_upload_rejects_disallowed_content_type():
    with pytest.raises(HTTPException):
        validate_image_upload("application/x-msdownload", _tiny_png_bytes())


def test_validate_image_upload_rejects_oversized_file():
    import db as db_module
    with pytest.raises(HTTPException):
        validate_image_upload("image/png", b"\x89PNG" + b"0" * (db_module.MAX_IMAGE_UPLOAD_BYTES + 1))


def test_validate_image_upload_rejects_empty_file():
    with pytest.raises(HTTPException):
        validate_image_upload("image/png", b"")
