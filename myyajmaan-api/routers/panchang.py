from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from panchang import PanchangError, get_panchang, today_ist

router = APIRouter(prefix="/panchang", tags=["panchang"])


@router.get("")
def read_panchang(
    date_: Optional[date] = Query(default=None, alias="date", description="YYYY-MM-DD, default today (IST)"),
    city: Optional[str] = Query(default=None, max_length=80),
    state: Optional[str] = Query(default=None, max_length=80),
):
    """Public daily Panchang for a city (see panchang.py). Default Jaipur, today."""
    try:
        return get_panchang(date_ or today_ist(), city=city, state=state)
    except PanchangError as error:
        raise HTTPException(status_code=400, detail=str(error))
