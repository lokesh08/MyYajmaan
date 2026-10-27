from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import convert_records_image_fields, service_supabase
from permissions import require_roles

router = APIRouter(prefix="/pandit/me/pujas", tags=["pandit-pujas"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Pandit portal service is not configured.")
    return service_supabase


def _get_pandit_or_404(client, user_id: str) -> dict:
    resp = client.table("pandits").select("id, verification_status").eq("user_id", user_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Pandit profile not found. Please complete onboarding first.")
    return rows[0]


def _attach_puja_info(client, rows: list):
    puja_ids = [row["puja_id"] for row in rows if row.get("puja_id")]
    if not puja_ids:
        return rows

    resp = (
        client.table("pujas")
        .select("id, title, thumbnail_url, image_url, duration_minutes, base_price, category")
        .in_("id", puja_ids)
        .execute()
    )
    pujas_by_id = {p["id"]: p for p in (getattr(resp, "data", None) or [])}
    convert_records_image_fields(list(pujas_by_id.values()), fields=["thumbnail_url", "image_url"])

    for row in rows:
        row["puja"] = pujas_by_id.get(row.get("puja_id"))

    return rows


@router.get("")
async def list_my_pujas(current_user: dict = Depends(require_roles("pandit"))):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    resp = (
        client.table("pandit_puja")
        .select("*")
        .eq("pandit_id", pandit["id"])
        .order("created_at", desc=True)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    _attach_puja_info(client, rows)

    return {"items": rows}


class PujaSelectionIn(BaseModel):
    puja_id: str
    price_override: float = Field(gt=0)


class AddPujasIn(BaseModel):
    pujas: List[PujaSelectionIn] = Field(min_length=1)


@router.post("")
async def add_my_pujas(
    payload: AddPujasIn,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    existing_resp = client.table("pandit_puja").select("puja_id").eq("pandit_id", pandit["id"]).execute()
    already_added = {row["puja_id"] for row in (getattr(existing_resp, "data", None) or [])}

    new_rows = [
        {
            "pandit_id": pandit["id"],
            "puja_id": selection.puja_id,
            "price_override": selection.price_override,
            "active": True,
        }
        for selection in payload.pujas
        if selection.puja_id not in already_added
    ]

    if not new_rows:
        raise HTTPException(status_code=400, detail="All selected pujas are already in your list.")

    resp = client.table("pandit_puja").insert(new_rows).select("*").execute()
    saved = getattr(resp, "data", None) or []
    _attach_puja_info(client, saved)

    write_audit_log(
        action="PANDIT_PUJAS_ADDED",
        actor_id=str(current_user["id"]),
        entity="pandit_puja",
        entity_id=str(pandit["id"]),
        payload={"puja_ids": [row["puja_id"] for row in new_rows]},
    )

    return {"message": "Puja(s) added to your services.", "items": saved}


class UpdatePujaIn(BaseModel):
    price_override: Optional[float] = Field(default=None, gt=0)
    active: Optional[bool] = None


def _get_own_pandit_puja_or_404(client, pandit_id: str, pandit_puja_id: str) -> dict:
    resp = (
        client.table("pandit_puja")
        .select("*")
        .eq("id", pandit_puja_id)
        .eq("pandit_id", pandit_id)
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="This puja is not in your service list.")
    return rows[0]


@router.patch("/{pandit_puja_id}")
async def update_my_puja(
    pandit_puja_id: str,
    payload: UpdatePujaIn,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])
    _get_own_pandit_puja_or_404(client, pandit["id"], pandit_puja_id)

    columns = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not columns:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    resp = client.table("pandit_puja").update(columns).eq("id", pandit_puja_id).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not update this puja.")
    saved = rows[0]
    _attach_puja_info(client, [saved])

    write_audit_log(
        action="PANDIT_PUJA_UPDATED",
        actor_id=str(current_user["id"]),
        entity="pandit_puja",
        entity_id=pandit_puja_id,
        payload=columns,
    )

    return {"message": "Puja updated successfully.", "item": saved}


@router.delete("/{pandit_puja_id}")
async def remove_my_puja(
    pandit_puja_id: str,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])
    _get_own_pandit_puja_or_404(client, pandit["id"], pandit_puja_id)

    client.table("pandit_puja").delete().eq("id", pandit_puja_id).execute()

    write_audit_log(
        action="PANDIT_PUJA_REMOVED",
        actor_id=str(current_user["id"]),
        entity="pandit_puja",
        entity_id=pandit_puja_id,
        payload={},
    )

    return {"message": "Puja removed from your services."}
