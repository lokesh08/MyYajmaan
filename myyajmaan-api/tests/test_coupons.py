from datetime import datetime, timedelta, timezone

from routers.coupons import evaluate_coupon


def active_coupon(**overrides):
    now = datetime.now(timezone.utc)
    coupon = {
        "id": "coupon-1",
        "code": "DIWALI200",
        "discount_type": "flat",
        "discount_value": 200,
        "max_discount_amount": None,
        "min_booking_amount": 500,
        "applicable_puja_ids": [],
        "usage_limit_total": None,
        "usage_limit_per_user": 1,
        "valid_from": (now - timedelta(days=1)).isoformat(),
        "valid_until": (now + timedelta(days=1)).isoformat(),
        "is_active": True,
    }
    coupon.update(overrides)
    return coupon


def test_evaluate_coupon_applies_flat_discount():
    result = evaluate_coupon(active_coupon(), 800, "puja-1", 0, 0)

    assert result == {"valid": True, "discount": 200.0, "finalAmount": 600.0}


def test_evaluate_coupon_caps_percentage_discount():
    coupon = active_coupon(
        discount_type="percentage",
        discount_value=25,
        max_discount_amount=100,
        min_booking_amount=0,
    )

    result = evaluate_coupon(coupon, 800, "puja-1", 0, 0)

    assert result == {"valid": True, "discount": 100.0, "finalAmount": 700.0}


def test_evaluate_coupon_rejects_per_user_usage_limit():
    result = evaluate_coupon(active_coupon(), 800, "puja-1", 1, 1)

    assert result == {
        "valid": False,
        "code": "COUPON_USAGE_LIMIT_REACHED",
        "message": "You have already used this coupon.",
    }
