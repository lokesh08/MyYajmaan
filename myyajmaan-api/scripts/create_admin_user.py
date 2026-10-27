"""One-off script to provision the single admin account.

Usage (from myyajmaan-api/ with the venv activated):
    python scripts/create_admin_user.py
"""
import os
import sys

import httpx
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from db import service_supabase  # noqa: E402

ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD = "admin1234"
ADMIN_FULL_NAME = "Admin"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def create_or_get_auth_user() -> str:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=15.0) as client:
        create_resp = client.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=headers,
            json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD,
                "email_confirm": True,
            },
        )

        if create_resp.status_code in (200, 201):
            return create_resp.json()["id"]

        # Already exists: look it up instead.
        list_resp = client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=headers,
            params={"email": ADMIN_EMAIL},
        )
        list_resp.raise_for_status()
        users = list_resp.json().get("users", [])
        for user in users:
            if user.get("email", "").lower() == ADMIN_EMAIL:
                return user["id"]

        raise RuntimeError(
            f"Could not create or find auth user: {create_resp.status_code} {create_resp.text}"
        )


def main():
    if service_supabase is None:
        raise RuntimeError("service_supabase is not configured. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.")

    auth_uid = create_or_get_auth_user()
    print(f"Auth user ready: {auth_uid}")

    profile_result = (
        service_supabase.table("users")
        .upsert(
            {
                "auth_uid": auth_uid,
                "email": ADMIN_EMAIL,
                "full_name": ADMIN_FULL_NAME,
                "role": "admin",
                "is_active": True,
                "is_email_verified": True,
            },
            on_conflict="auth_uid",
        )
        .execute()
    )
    profile = profile_result.data[0]
    user_id = profile["id"]
    print(f"public.users row ready: {user_id}")

    service_supabase.table("admin_roles").upsert(
        {
            "user_id": user_id,
            "role_type": "super_admin",
        },
        on_conflict="user_id",
    ).execute()
    print("admin_roles row ready: super_admin")

    print("\nAdmin account is ready.")
    print(f"  email:    {ADMIN_EMAIL}")
    print(f"  password: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    main()
