import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from security_middleware import CsrfHeaderMiddleware, SecurityHeadersMiddleware

load_dotenv()

from routers import (
    admin_auth,
    admin_bookings,
    admin_complaints,
    admin_coupons,
    admin_dashboard,
    admin_muhrats,
    admin_package_bookings,
    admin_pandit_feedback,
    admin_pandits,
    admin_pujas,
    admin_reports,
    admin_reviews,
    admin_settings,
    admin_support,
    admin_users,
    admin_wallet,
    audit,
    auth,
    bookings,
    client_addresses,
    client_bookings,
    client_settings,
    client_wallet,
    complaints,
    coupons,
    cities,
    cms,
    contact,
    festivals,
    messaging,
    muhrats,
    notifications,
    offers,
    otp,
    package_bookings,
    pandit_aadhar,
    pandit_bookings,
    pandit_feedback,
    pandit_photos,
    pandit_profile,
    pandit_pujas,
    pandit_wallet,
    pandits,
    payments,
    public_settings,
    pujas,
    referrals,
    reviews,
    seo,
)

app = FastAPI(
    title="MyYajmaan API",
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# Registered before CORSMiddleware so CORS ends up outermost (Starlette
# applies middleware in reverse of registration order) -- see
# security_middleware.py for why that ordering matters.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CsrfHeaderMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin_auth.router)
app.include_router(admin_bookings.router)
app.include_router(admin_package_bookings.router)
app.include_router(admin_complaints.router)
app.include_router(admin_coupons.router)
app.include_router(admin_dashboard.router)
app.include_router(admin_muhrats.router)
app.include_router(admin_pandit_feedback.router)
app.include_router(admin_pandits.router)
app.include_router(admin_pujas.router)
app.include_router(admin_reports.router)
app.include_router(admin_reviews.router)
app.include_router(admin_settings.router)
app.include_router(admin_support.router)
app.include_router(admin_users.router)
app.include_router(admin_wallet.router)
app.include_router(audit.router)
app.include_router(bookings.router)
app.include_router(package_bookings.router)
app.include_router(client_addresses.router)
app.include_router(client_bookings.router)
app.include_router(complaints.router)
app.include_router(client_settings.router)
app.include_router(client_wallet.router)
app.include_router(coupons.router)
app.include_router(cities.router)
app.include_router(cms.public_router)
app.include_router(cms.admin_router)
app.include_router(contact.router)
app.include_router(festivals.router)
app.include_router(muhrats.router)
app.include_router(notifications.router)
app.include_router(messaging.router)
app.include_router(offers.router)
app.include_router(otp.router)
app.include_router(pandit_aadhar.router)
app.include_router(pandit_bookings.router)
app.include_router(pandit_feedback.router)
app.include_router(pandit_photos.router)
app.include_router(pandit_profile.router)
app.include_router(pandit_pujas.router)
app.include_router(pandit_wallet.router)
app.include_router(pandits.router)
app.include_router(payments.router)
app.include_router(public_settings.router)
app.include_router(pujas.router)
app.include_router(referrals.router)
app.include_router(reviews.router)
app.include_router(seo.router)


@app.get("/")
def health():
    return {
        "status": "ok",
    }