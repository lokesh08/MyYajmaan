from unittest.mock import MagicMock

from starlette.requests import Request

from routers import auth


def make_request(headers=None):
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/auth/login",
            "headers": headers or [],
            "client": ("203.0.113.10", 54321),
        }
    )


def test_login_history_records_device_and_ip(monkeypatch):
    table = MagicMock()
    table.insert.return_value.execute.return_value = MagicMock()
    client = MagicMock()
    client.table.return_value = table
    monkeypatch.setattr(auth, "service_supabase", client)

    request = make_request(
        [
            (b"user-agent", b"Mozilla/5.0 (Linux; Android 14)"),
            (b"x-device-id", b"device-123"),
        ]
    )

    auth.write_login_history("user-123", request, "success")

    client.table.assert_called_once_with("login_history")
    table.insert.assert_called_once_with(
        {
            "user_id": "user-123",
            "login_status": "success",
            "device_id": "device-123",
            "device_name": "Mozilla/5.0 (Linux; Android 14)",
            "device_type": "android",
            "ip_address": "203.0.113.10",
        }
    )
