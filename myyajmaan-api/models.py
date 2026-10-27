from pydantic import BaseModel
from typing import Optional, List
from datetime import date as date_type, time, datetime


class PanditOut(BaseModel):
    id: str
    name: Optional[str] = None
    display_name: Optional[str] = None
    languages: Optional[List[str]] = None
    languages_spoken: Optional[List[str]] = None
    specialities: Optional[List[str]] = None
    service_areas: Optional[List[str]] = None
    experience_years: Optional[int] = None
    rating: Optional[float] = None
    rating_avg: Optional[float] = None
    total_bookings: Optional[int] = None
    price: Optional[float] = None
    starting_price: Optional[float] = None  # cheapest active pandit_puja price; None if they have none
    about: Optional[str] = None
    bio: Optional[str] = None
    address: Optional[str] = None  # street-level text, no phone/email — for the map card only
    city: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    verification_status: Optional[str] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None  # raw avatar field from DB (if present)
    image: Optional[str] = None  # normalized image property used by frontend
    portrait_url: Optional[str] = None
    created_at: Optional[datetime] = None

class BookingIn(BaseModel):
    pandit_id: str
    catalog_puja_id: Optional[str] = None
    date: date_type
    timeslot: str
    puja_id: Optional[int] = None
    package_id: Optional[int] = None
    amount: Optional[float] = None
    payment_ref: Optional[str] = None
    coupon_id: Optional[str] = None
    coupon_discount: Optional[float] = 0
    notes: Optional[str] = None
    # Checkout snapshot (see 20260906000000_booking_checkout_snapshot.sql)
    # -- stored on the booking itself rather than only via address_id, so
    # it keeps showing what was actually used at booking time even if the
    # saved address is later edited or deleted.
    address_id: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    address_line: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_pincode: Optional[str] = None
    special_instructions: Optional[str] = None
    payment_method: Optional[str] = None
    # Pricing breakdown (see admin_settings.py's /admin/settings/pricing
    # and BookPayment.jsx) -- stored so a booking is a complete record
    # of what was actually charged, not just one opaque `amount`.
    package_tier: Optional[str] = None
    premium_fee: Optional[float] = 0
    gst_amount: Optional[float] = 0
    platform_fee: Optional[float] = 0
    # The Pandit Ji's own price at booking time (pandit_puja.price_override),
    # separate from `amount` (the full payable total incl. GST/platform/
    # premium fees) -- see invoicing.py. Drives both invoices' amounts.
    pandit_fee_amount: Optional[float] = None

class BookingOut(BaseModel):
    id: str
    client_id: Optional[str] = None
    pandit_id: str
    date: Optional[date_type] = None
    booking_date: Optional[date_type] = None
    timeslot: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

class PujaOut(BaseModel):
    id: str
    title: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    category: Optional[str] = None
    listing_type: Optional[str] = None
    puja_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    thumbnail_url: Optional[str] = None   # small image for list/home
    image_url: Optional[str] = None       # big image for detail
    metadata: Optional[dict] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None

class FestivalOut(BaseModel):
    id: str
    title: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date_type] = None
    end_date: Optional[date_type] = None
    image_url: Optional[str] = None
    highlight: Optional[bool] = False