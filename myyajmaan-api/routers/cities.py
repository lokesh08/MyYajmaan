from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from db import create_supabase_client_for_key, SUPABASE_ANON_KEY

router = APIRouter(prefix="/cities", tags=["cities"])


class CityOut(BaseModel):
    id: str
    name: str
    state: str


@router.get("", response_model=List[CityOut])
def list_cities():
    if not SUPABASE_ANON_KEY:
        return []

    client = create_supabase_client_for_key(SUPABASE_ANON_KEY)
    response = client.table("cities").select("id, name, state").order("name").execute()
    return response.data or []
