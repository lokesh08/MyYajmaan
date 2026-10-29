"""
Tests for the UX/performance pass:

  - Admin list search: six admin routers called sanitize_or_filter_term
    without importing it, so any ?search= crashed with a 500.
  - db.webp_variant: catalogue images re-encoded as small WebP.
  - routers/admin_pujas.py: uploaded puja images are stored as resized
    WebP, a main image without its own thumbnail gets a matching one,
    and a failed conversion still stores the original.
"""

import asyncio
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import permissions
from auth import get_current_user
from db import webp_variant
from main import app
from routers import (
    admin_complaints,
    admin_coupons,
    admin_muhrats,
    admin_package_bookings,
    admin_pujas,
    admin_users,
)

client = TestClient(app)
HEADERS = {"X-Requested-With": "XMLHttpRequest"}


class AnyQuery:
    """Accepts any PostgREST builder chain and returns no rows."""

    def __getattr__(self, _name):
        return lambda *_a, **_k: self

    def execute(self):
        return type("R", (), {"data": [], "count": 0})()


class AnyClient:
    def table(self, _name):
        return AnyQuery()


class AdminRolesClient:
    def table(self, _name):
        query = AnyQuery()
        query.execute = lambda: type("R", (), {"data": [{"role_type": "super_admin"}]})()
        return query


@pytest.fixture
def as_super_admin(monkeypatch):
    async def fake_admin():
        return {"id": "admin-1", "role": "admin", "email": "admin@example.com"}

    app.dependency_overrides[get_current_user] = fake_admin
    monkeypatch.setattr(permissions, "service_supabase", AdminRolesClient())
    yield
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "module, url",
    [
        (admin_users, "/admin/users"),
        (admin_pujas, "/admin/pujas"),
        (admin_coupons, "/admin/coupons"),
        (admin_muhrats, "/admin/muhrats"),
        (admin_complaints, "/admin/complaints"),
        (admin_package_bookings, "/admin/package-bookings"),
    ],
)
def test_admin_list_search_does_not_crash(as_super_admin, monkeypatch, module, url):
    monkeypatch.setattr(module, "service_supabase", AnyClient())
    resp = client.get(url, params={"search": "ganesh"}, headers=HEADERS)
    assert resp.status_code == 200, resp.text


# ---------------------------------------------------------------------
# db.webp_variant
# ---------------------------------------------------------------------

def _png(width, height, mode="RGB"):
    out = io.BytesIO()
    # Half-transparent in RGBA, so there's real alpha for WebP to keep.
    Image.new(mode, (width, height), (200, 120, 40, 128)[: len(mode)]).save(out, format="PNG")
    return out.getvalue()


def _decode(data):
    return Image.open(io.BytesIO(data))


def test_webp_variant_shrinks_wide_images_keeping_aspect_ratio():
    out = webp_variant(_png(1536, 1024), 480)
    img = _decode(out)
    assert img.format == "WEBP"
    assert img.size == (480, 320)


def test_webp_variant_never_upscales():
    img = _decode(webp_variant(_png(300, 200), 1200))
    assert img.size == (300, 200)


def test_webp_variant_keeps_transparency():
    img = _decode(webp_variant(_png(100, 100, "RGBA"), 480))
    assert img.mode == "RGBA"


def test_webp_variant_returns_none_for_non_images():
    assert webp_variant(b"definitely not an image", 480) is None


# ---------------------------------------------------------------------
# routers/admin_pujas.py upload handling
# ---------------------------------------------------------------------

class FakeUpload:
    def __init__(self, content, filename="photo.png", content_type="image/png"):
        self._content, self.filename, self.content_type = content, filename, content_type

    async def read(self):
        return self._content


@pytest.fixture
def stored(monkeypatch):
    calls = []

    def fake_upload(data, content_type, path):
        calls.append({"path": path, "content_type": content_type, "size": len(data), "data": data})
        return f"images/{path}"

    monkeypatch.setattr(admin_pujas, "upload_image_to_bucket", fake_upload)
    return calls


def test_main_image_alone_also_produces_a_matching_webp_thumbnail(stored):
    image_key, thumb_key = asyncio.run(admin_pujas._upload_puja_images(FakeUpload(_png(1536, 1024)), None, "p1"))

    assert image_key == "images/pujas/p1/big.webp"
    assert thumb_key == "images/pujas/p1/thumb.webp"
    sizes = {c["path"]: _decode(c["data"]).size for c in stored}
    assert sizes["pujas/p1/big.webp"] == (1200, 800)
    assert sizes["pujas/p1/thumb.webp"] == (480, 320)
    assert all(c["content_type"] == "image/webp" for c in stored)


def test_separate_thumbnail_is_used_when_sent(stored):
    image_key, thumb_key = asyncio.run(
        admin_pujas._upload_puja_images(FakeUpload(_png(1536, 1024)), FakeUpload(_png(600, 600)), "p2")
    )
    assert (image_key, thumb_key) == ("images/pujas/p2/big.webp", "images/pujas/p2/thumb.webp")
    thumb = next(c for c in stored if c["path"] == "pujas/p2/thumb.webp")
    assert _decode(thumb["data"]).size == (480, 480)


def test_no_files_means_no_change(stored):
    assert asyncio.run(admin_pujas._upload_puja_images(None, None, "p3")) == (None, None)
    assert stored == []


def test_unconvertible_upload_falls_back_to_the_original(stored):
    raw = b"not decodable by Pillow"
    image_key, thumb_key = asyncio.run(
        admin_pujas._upload_puja_images(FakeUpload(raw, "photo.heic", "image/heic"), None, "p4")
    )
    assert image_key == "images/pujas/p4/big.heic"
    assert thumb_key == "images/pujas/p4/thumb.heic"
    assert all(c["data"] == raw and c["content_type"] == "image/heic" for c in stored)


# ---------------------------------------------------------------------
# /auth/me for logged-out visitors
# ---------------------------------------------------------------------

def test_auth_me_answers_a_plain_guest_without_an_error():
    guest = TestClient(app)
    resp = guest.get("/auth/me", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json() == {"user": None}


def test_auth_me_still_401s_when_only_the_refresh_cookie_is_left():
    # The frontend refreshes the session on exactly this 401, so a
    # returning user whose 1-hour access cookie expired stays signed in.
    returning = TestClient(app)
    returning.cookies.set("myyajmaan_refresh", "some-refresh-token")
    resp = returning.get("/auth/me", headers=HEADERS)
    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "NOT_AUTHENTICATED"
