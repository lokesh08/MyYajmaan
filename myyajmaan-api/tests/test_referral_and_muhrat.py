from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_referral_endpoint_returns_expected_shape():
    response = client.get("/referral")

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
