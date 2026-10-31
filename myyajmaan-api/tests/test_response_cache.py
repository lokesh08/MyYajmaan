"""
Tests for response_cache.ResponseCacheMiddleware: public GET lists are
served from memory, nothing personal is cached, and any successful write
clears the cache.
"""

from fastapi import FastAPI, Response
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

import response_cache
from main import app as real_app
from routers import referrals

calls = {"n": 0}


def build_app():
    app = FastAPI()
    app.add_middleware(response_cache.ResponseCacheMiddleware)

    def counted(payload):
        calls["n"] += 1
        return {**payload, "call": calls["n"]}

    @app.get("/pujas")
    def pujas(listing_type: str = ""):
        return counted({"listing_type": listing_type})

    @app.get("/pandits")
    def pandits(puja_id: str = "", date: str = ""):
        return counted({"puja_id": puja_id})

    @app.get("/me/wallet")
    def wallet():
        return counted({"private": True})

    @app.get("/festivals")
    def festivals(fail: bool = False):
        if fail:
            return JSONResponse({"detail": "boom"}, status_code=500)
        return counted({})

    @app.get("/offers")
    def offers(response: Response):
        response.set_cookie("session", "secret")
        return counted({})

    @app.post("/admin/pujas")
    def admin_save(ok: bool = True):
        if not ok:
            return JSONResponse({"detail": "bad"}, status_code=400)
        return {"saved": True}

    return app


client = TestClient(build_app())


def setup_function():
    calls["n"] = 0


def test_public_list_is_served_from_cache():
    first = client.get("/pujas")
    second = client.get("/pujas")
    assert first.json() == second.json() == {"listing_type": "", "call": 1}
    assert first.headers["x-cache"] == "MISS"
    assert second.headers["x-cache"] == "HIT"
    assert "max-age=30" in second.headers["cache-control"]
    assert calls["n"] == 1


def test_query_params_are_part_of_the_key():
    a = client.get("/pujas", params={"listing_type": "trending"}).json()
    b = client.get("/pujas", params={"listing_type": "featured"}).json()
    c = client.get("/pujas", params={"listing_type": "trending"}).json()
    assert a["call"] == 1 and b["call"] == 2 and c["call"] == 1


def test_pandit_availability_search_is_never_cached():
    client.get("/pandits", params={"puja_id": "p1", "date": "2026-11-05"})
    again = client.get("/pandits", params={"puja_id": "p1", "date": "2026-11-05"})
    assert again.json()["call"] == 2
    assert "x-cache" not in again.headers
    # the plain public list still is
    client.get("/pandits")
    assert client.get("/pandits").headers["x-cache"] == "HIT"


def test_personal_paths_are_never_cached():
    client.get("/me/wallet")
    again = client.get("/me/wallet")
    assert again.json()["call"] == 2
    assert "x-cache" not in again.headers
    assert "cache-control" not in again.headers


def test_errors_are_not_cached():
    assert client.get("/festivals", params={"fail": True}).status_code == 500
    assert client.get("/festivals", params={"fail": True}).status_code == 500
    assert client.get("/festivals").headers["x-cache"] == "MISS"


def test_cookies_are_not_replayed_from_cache():
    first = client.get("/offers")
    assert "session" in first.headers.get("set-cookie", "")
    second = client.get("/offers")
    assert second.headers["x-cache"] == "HIT"
    assert "set-cookie" not in second.headers


def test_successful_write_clears_the_cache():
    client.get("/pujas")
    client.post("/admin/pujas")
    fresh = client.get("/pujas")
    assert fresh.headers["x-cache"] == "MISS"
    assert fresh.json()["call"] == 2


def test_failed_write_keeps_the_cache():
    client.get("/pujas")
    client.post("/admin/pujas", params={"ok": False})
    assert client.get("/pujas").headers["x-cache"] == "HIT"


def test_entries_expire(monkeypatch):
    client.get("/pujas")
    real = response_cache.time.monotonic
    monkeypatch.setattr(response_cache.time, "monotonic", lambda: real() + response_cache.TTL_SECONDS + 1)
    assert client.get("/pujas").headers["x-cache"] == "MISS"


def test_cache_can_be_switched_off(monkeypatch):
    monkeypatch.setattr(response_cache, "TTL_SECONDS", 0)
    client.get("/pujas")
    again = client.get("/pujas")
    assert again.json()["call"] == 2
    assert "x-cache" not in again.headers


def test_cache_size_is_capped(monkeypatch):
    monkeypatch.setattr(response_cache, "MAX_ENTRIES", 3)
    for i in range(6):
        client.get("/pujas", params={"listing_type": f"t{i}"})
    assert len(response_cache._store) == 3


def test_real_app_caches_referral_rewards_and_keeps_cors(monkeypatch):
    lookups = {"n": 0}

    def fake_display(coupon_type):
        lookups["n"] += 1
        return "₹25" if coupon_type == "referral_signup" else "₹51"

    monkeypatch.setattr(referrals, "_active_coupon_display", fake_display)
    real = TestClient(real_app)
    origin = {"Origin": "http://localhost:3000"}
    first = real.get("/referral/rewards", headers=origin)
    second = real.get("/referral/rewards", headers=origin)
    assert first.json() == second.json() == {"signupReward": "₹25", "bookingReward": "₹51"}
    assert second.headers["x-cache"] == "HIT"
    assert lookups["n"] == 2  # one per reward, only for the first request
    # security + CORS headers still applied on a cached answer
    assert second.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert second.headers.get("x-content-type-options") == "nosniff"


def test_real_app_never_caches_the_logged_in_referral_summary():
    real = TestClient(real_app)
    resp = real.get("/referral")
    assert resp.status_code == 401
    assert "x-cache" not in resp.headers
