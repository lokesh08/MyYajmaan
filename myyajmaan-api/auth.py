from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import httpx
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

security = HTTPBearer(auto_error=False)

async def get_bearer_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Returns the raw bearer token string if present, otherwise None.
    Use this in endpoints that need the token to create a per-request client.
    """
    if not credentials or credentials.scheme.lower() != "bearer":
        return None
    return credentials.credentials

async def get_current_user(token: str = Depends(get_bearer_token)):
    """
    Verifies the Bearer token with Supabase Auth and returns user info.
    Raises 401 if token is missing or invalid.
    """
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    url = f"{SUPABASE_URL}/auth/v1/user"
    headers = {"Authorization": f"Bearer {token}"}
    if SUPABASE_ANON_KEY:
        headers["apikey"] = SUPABASE_ANON_KEY

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    return resp.json()