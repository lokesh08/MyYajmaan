from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers import pandits, bookings, pujas, festivals

app = FastAPI(title="MyYajmaan API")

origins = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pandits.router)
app.include_router(bookings.router)
app.include_router(pujas.router)
app.include_router(festivals.router)

@app.get("/")
def health():
    return {"status": "ok"}