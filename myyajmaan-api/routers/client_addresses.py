from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from permissions import require_roles

router = APIRouter(prefix="/me/addresses", tags=["client-addresses"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Address service is not configured.")
    return service_supabase


def _get_own_address_or_404(client, user_id: str, address_id: str) -> dict:
    resp = (
        client.table("client_addresses")
        .select("*")
        .eq("id", address_id)
        .eq("client_id", user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Address not found.")
    return rows[0]


def _clear_existing_default(client, user_id: str):
    client.table("client_addresses").update({"is_default": False}).eq(
        "client_id", user_id
    ).eq("is_default", True).execute()


@router.get("")
async def list_my_addresses(current_user: dict = Depends(require_roles("user"))):
    client = _client()
    resp = (
        client.table("client_addresses")
        .select("*")
        .eq("client_id", current_user["id"])
        .order("is_default", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": getattr(resp, "data", None) or []}


class AddressIn(BaseModel):
    label: str = Field(min_length=1, max_length=50)
    address_line: str = Field(min_length=1, max_length=500)
    state: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=120)
    pincode: str = Field(min_length=1, max_length=12)
    is_default: bool = False


@router.post("")
async def add_address(
    payload: AddressIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()

    existing_resp = (
        client.table("client_addresses")
        .select("id", count="exact")
        .eq("client_id", current_user["id"])
        .execute()
    )
    is_first_address = (getattr(existing_resp, "count", None) or 0) == 0
    make_default = payload.is_default or is_first_address

    if make_default:
        _clear_existing_default(client, current_user["id"])

    columns = {
        "client_id": current_user["id"],
        "label": payload.label.strip(),
        "address_line": payload.address_line.strip(),
        "state": payload.state.strip(),
        "city": payload.city.strip(),
        "pincode": payload.pincode.strip(),
        "is_default": make_default,
    }

    resp = client.table("client_addresses").insert(columns).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not save this address.")

    write_audit_log(
        action="CLIENT_ADDRESS_ADDED",
        actor_id=str(current_user["id"]),
        entity="client_addresses",
        entity_id=str(rows[0]["id"]),
        payload={"label": columns["label"], "city": columns["city"]},
    )

    return {"message": "Address added successfully.", "address": rows[0]}


class AddressUpdateIn(BaseModel):
    label: str = Field(min_length=1, max_length=50)
    address_line: str = Field(min_length=1, max_length=500)
    state: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=120)
    pincode: str = Field(min_length=1, max_length=12)


@router.patch("/{address_id}")
async def update_address(
    address_id: str,
    payload: AddressUpdateIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    _get_own_address_or_404(client, current_user["id"], address_id)

    columns = {
        "label": payload.label.strip(),
        "address_line": payload.address_line.strip(),
        "state": payload.state.strip(),
        "city": payload.city.strip(),
        "pincode": payload.pincode.strip(),
    }
    resp = client.table("client_addresses").update(columns).eq("id", address_id).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not update this address.")

    write_audit_log(
        action="CLIENT_ADDRESS_UPDATED",
        actor_id=str(current_user["id"]),
        entity="client_addresses",
        entity_id=address_id,
        payload=columns,
    )

    return {"message": "Address updated successfully.", "address": rows[0]}


@router.patch("/{address_id}/default")
async def set_default_address(
    address_id: str,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    _get_own_address_or_404(client, current_user["id"], address_id)

    _clear_existing_default(client, current_user["id"])
    resp = (
        client.table("client_addresses")
        .update({"is_default": True})
        .eq("id", address_id)
        .select("*")
        .execute()
    )
    rows = getattr(resp, "data", None) or []

    write_audit_log(
        action="CLIENT_ADDRESS_DEFAULT_SET",
        actor_id=str(current_user["id"]),
        entity="client_addresses",
        entity_id=address_id,
        payload={},
    )

    return {"message": "Default address updated.", "address": rows[0] if rows else None}


@router.delete("/{address_id}")
async def delete_address(
    address_id: str,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    address = _get_own_address_or_404(client, current_user["id"], address_id)

    client.table("client_addresses").delete().eq("id", address_id).execute()

    # If the deleted address was the default and other addresses remain,
    # promote the most recently added one so there's always a sensible
    # default whenever at least one address exists.
    if address.get("is_default"):
        remaining_resp = (
            client.table("client_addresses")
            .select("id")
            .eq("client_id", current_user["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        remaining = getattr(remaining_resp, "data", None) or []
        if remaining:
            client.table("client_addresses").update({"is_default": True}).eq(
                "id", remaining[0]["id"]
            ).execute()

    write_audit_log(
        action="CLIENT_ADDRESS_DELETED",
        actor_id=str(current_user["id"]),
        entity="client_addresses",
        entity_id=address_id,
        payload={"label": address.get("label")},
    )

    return {"message": "Address deleted successfully."}
