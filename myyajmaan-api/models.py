from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, datetime


class PanditOut(BaseModel): 
    id: str 
    name: Optional[str] = None 
    display_name: Optional[str] =    None 
    languages: Optional[List[str]] = None 
    experience_years: Optional[int] = None 
    rating: Optional[float] = None 
    price: Optional[float] = None 
    about: Optional[str] = None 
    city: Optional[str] = None 
    avatar_url: Optional[str] = None # raw avatar field from DB (if present) image: Optional[str] = None # normalized image property used by frontend portrait_url: Optional[str] = None created_at: Optional[datetime] = None

class BookingIn(BaseModel):
    pandit_id: str
    booking_date: date
    timeslot: time
    notes: Optional[str] = None

class BookingOut(BaseModel):
    id: str
    user_id: str
    pandit_id: str
    booking_date: date
    timeslot: time
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

class PujaOut(BaseModel):
    id: str
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    thumbnail_url: Optional[str] = None   # small image for list/home
    image_url: Optional[str] = None       # big image for detail
    created_at: Optional[datetime] = None

class FestivalOut(BaseModel):
    id: str
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    image_url: Optional[str] = None
    highlight: Optional[bool] = False