from dotenv import load_dotenv 
import os 
from supabase import create_client

load_dotenv() 
url = os.getenv("SUPABASE_URL") 
key = os.getenv("SUPABASE_ANON_KEY")

print("SUPABASE_URL:", url) 
print("SUPABASE_ANON_KEY set:", bool(key))

if not url or not key: print("Missing URL or anon key; check .env") 
else: client = create_client(url, key) 
resp = client.table("pandits").select("*").limit(1).execute() 
print("resp.error:", resp.error) 
print("resp.data (first row):", resp.data) 