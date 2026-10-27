from typing import Callable, Optional

from fastapi import Cookie, Depends, HTTPException, status

from auth import get_current_user
from db import service_supabase

ACCESS_COOKIE = "myyajmaan_access"


def require_roles(*allowed_roles: str) -> Callable:
    """
    Generic role-protection dependency.

    Example:

        current_user: dict = Depends(
            require_roles("admin")
        )

    Or:

        current_user: dict = Depends(
            require_roles("pandit", "admin")
        )
    """

    async def role_dependency(
        current_user: dict = Depends(get_current_user),
    ):
        user_role = current_user.get("role")

        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": (
                        "You do not have permission "
                        "to perform this action."
                    ),
                },
            )

        return current_user

    return role_dependency


def require_admin_roles(*allowed_roles: str) -> Callable:
    """Require a base admin account with one of the configured admin scopes."""

    async def admin_role_dependency(
        current_user: dict = Depends(get_current_user),
    ):
        if current_user.get("role") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "INSUFFICIENT_PERMISSIONS",
                    "message": "You do not have permission to perform this action.",
                },
            )

        if service_supabase is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "code": "DATABASE_NOT_CONFIGURED",
                    "message": "Admin permissions are not configured.",
                },
            )

        result = (
            service_supabase
            .table("admin_roles")
            .select("role_type")
            .eq("user_id", current_user["id"])
            .limit(1)
            .execute()
        )
        roles = getattr(result, "data", None) or []
        admin_role = roles[0].get("role_type") if roles else None

        if admin_role != "super_admin" and admin_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ADMIN_SCOPE_REQUIRED",
                    "message": "Your admin role cannot perform this action.",
                },
            )

        return current_user

    return admin_role_dependency


async def optional_current_user(
    myyajmaan_access: Optional[str] = Cookie(
        default=None,
        alias=ACCESS_COOKIE,
    ),
):
    """
    Optional authentication dependency.

    Returns the user when logged in.
    Returns None for public requests.
    """

    if not myyajmaan_access:
        return None

    try:
        return await get_current_user(
            myyajmaan_access=myyajmaan_access,
        )
    except HTTPException:
        return None