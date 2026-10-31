from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_referral_endpoint_returns_expected_shape(monkeypatch):
    # /referral needs a logged-in user (this test used to call it
    # anonymously and always got a 401).
    from auth import get_current_user
    from routers import referrals

    async def fake_user():
        return {"id": "user-1", "role": "user", "full_name": "Test User", "wallet_balance": 0}

    app.dependency_overrides[get_current_user] = fake_user
    monkeypatch.setattr(referrals, "ensure_referral_code", lambda *_a, **_k: "TESTUSER1234")
    monkeypatch.setattr(referrals, "service_supabase", None)
    try:
        response = client.get("/referral")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert "code" in payload
    assert "signupReward" in payload
    assert "bookingReward" in payload
    assert "earnings" in payload
    assert "totalEarned" in payload


def test_muhrat_endpoint_returns_active_false_when_none():
    response = client.get("/muhrat/next")

    assert response.status_code == 200
    payload = response.json()
    assert payload.get("active") in (False, None)
