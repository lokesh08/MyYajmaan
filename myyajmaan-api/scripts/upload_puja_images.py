"""Uploads puja images from public/images/Puja/normal to Supabase Storage
and points each puja's image_url/thumbnail_url at them.

Same layout as every existing puja image: the file is stored as both
pujas/<puja_id>/big.png and pujas/<puja_id>/thumb.png in the public
bucket, and the row stores "images/pujas/<puja_id>/big.png" etc.

Puja IDs are the same on local and Supabase Cloud. Before writing, each
row's title is checked against the expected one, so an ID that points
at a different puja is skipped rather than given the wrong picture.

Usage (from myyajmaan-api/ with the venv activated):
    python scripts/upload_puja_images.py --dry-run   # show what would change
    python scripts/upload_puja_images.py             # local (.env)

Against Supabase Cloud, set the live values for this one command
(environment variables win over .env):
    SUPABASE_URL=https://<project>.supabase.co \
    SUPABASE_SERVICE_ROLE_KEY=<service role key> \
    python scripts/upload_puja_images.py
"""
import argparse
import os
import sys

from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from db import SUPABASE_PUBLIC_BUCKET, service_supabase  # noqa: E402

IMAGES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "public", "images", "Puja", "normal",
)

# file name -> (puja id, expected title)
PUJA_IMAGES = {
    "AkandRamayanPathPuja.png": ("7fde1374-5d71-457f-9726-b3d16e070c61", "Akhand Ramayan Path"),
    "BhagwatGeetaPaathPuja.png": ("652872ab-27c3-4cf3-98e2-1cf597b2df2c", "Bhagavad Gita Path"),
    "ChandiHomamPuja.png": ("c91e0182-fa70-4e61-8aa3-722939562bc1", "Chandi Homam"),
    "ChhathPuja.png": ("59517564-bca5-4498-aac5-ee2576e4f916", "Chhath Puja"),
    "DeviBhagwatKathaPuja.png": ("9b200153-7e44-4866-95fb-7e646e7dfa9f", "Devi Bhagwat Katha"),
    "DhanteresPuja.png": ("279c8141-8ab3-42be-83cf-e591fa1d85c6", "Dhanteras Puja"),
    "DurgaNavratriPuja.png": ("82cd8b1b-27d5-4c8f-bbbc-8f15fd003ad3", "Durga Puja (Navratri)"),
    "DurgaSaptaShatiPathPuja.png": ("f420fdd3-dba3-4a63-a253-6654189f5114", "Durga Saptashati Path"),
    "FactoryInaugurationPuja.png": ("b8670303-079e-48d4-92bd-881bd3883d78", "Factory Inauguration Puja"),
    "GrihaShantiPuja.png": ("8f5a602f-952e-4589-b5d5-4731fd460fe6", "Griha Shanti Puja"),
    "HanumanChalisaPathPuja.png": ("269013e2-b735-466e-ad75-02d86c5c5785", "Hanuman Chalisa Path"),
    "HolikaDahanPuja.png": ("63ab111a-59e9-419a-925e-f8a7e6edd92b", "Holika Dahan Puja"),
    "KalashSthapanaPuja.png": ("2f25e78a-fede-4952-b922-f39ab3d2bc3e", "Kalash Sthapana Puja"),
    "KaliPuja.png": ("ef2cd112-5a2e-4613-b85f-2b55c52fa07f", "Kali Puja"),
    "KanyaDaanPuja.png": ("f6b04ff9-4d08-4e3c-b1eb-cb79cbd37e2f", "Kanyadan Puja"),
    "KarwaChauthPuja.png": ("17e9bd4d-40d9-4f09-b3da-9928b40b7a3e", "Karva Chauth Puja"),
    "KrishnaJanmashtamiPuja.png": ("c9887b68-3745-4b03-87e4-d75568e40ff2", "Krishna Janmashtami Puja"),
    "LakshmiDiwaliPuja.png": ("a53db0cd-0f75-458c-b9c5-7b90345ef514", "Lakshmi Puja (Diwali)"),
    "MahaRudraAbhishekPuja.png": ("1809ead1-35e3-40e6-a2ea-83f6e60bf507", "Maha Rudrabhishek"),
    "MakarSankrantiPuja.png": ("0a450abc-3e27-455a-b60b-1a4ff88cb86c", "Makar Sankranti Puja"),
    "RakshaBandhanPuja.png": ("8387413f-c379-4f77-a689-d5208943415b", "Raksha Bandhan Puja"),
    "RamCharitmanasPuja.png": ("10e9cfc5-36db-4131-937b-ae80b38142ac", "Ramcharitmanas Path"),
    "RamNavamiPuja.png": ("18df3dac-31e9-4318-8cc3-30335361f8ed", "Ram Navami Puja"),
    "SaraswatiPuja.png": ("c0ffa0a5-98b5-4873-8bc5-f21c2105d80d", "Saraswati Puja (Vasant Panchami)"),
    "ShaniPuja.png": ("b7dea362-aab1-430e-a8f9-2083ee394905", "Shani Puja"),
    "SrimadBhagwatKathaPuja.png": ("7bfae68a-d926-4488-83cb-187aa269e72b", "Shrimad Bhagwat Katha"),
    "VishnuPuja.png": ("568f786d-b903-478d-ba92-0696b114cea3", "Vishnu Puja"),
    "VishnuPuranPathPuja.png": ("de58808b-d6d4-47c0-9060-a5378e4f375f", "Vishnu Puran Path"),
    # ShriPuja.png (a Lakshmi image) has no matching puja yet -- add it
    # here once the puja it belongs to exists.
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if service_supabase is None:
        print("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
        return 1

    bucket = SUPABASE_PUBLIC_BUCKET or "images"
    print(f"Target: {os.getenv('SUPABASE_URL')}  bucket: {bucket}  dry-run: {args.dry_run}")

    failures = 0
    for file_name, (puja_id, expected_title) in PUJA_IMAGES.items():
        path = os.path.join(IMAGES_DIR, file_name)
        if not os.path.exists(path):
            print(f"  MISSING FILE  {file_name}")
            failures += 1
            continue

        rows = service_supabase.table("pujas").select("id, title").eq("id", puja_id).limit(1).execute().data
        if not rows:
            print(f"  NO PUJA       {file_name} -> {puja_id} ({expected_title})")
            failures += 1
            continue
        if rows[0]["title"] != expected_title:
            print(f"  TITLE CHANGED {file_name} -> {puja_id}: expected {expected_title!r}, found {rows[0]['title']!r}")
            failures += 1
            continue

        if args.dry_run:
            print(f"  would set     {expected_title} <- {file_name}")
            continue

        with open(path, "rb") as fh:
            data = fh.read()
        keys = {}
        for kind in ("big", "thumb"):
            object_path = f"pujas/{puja_id}/{kind}.png"
            service_supabase.storage.from_(bucket).upload(
                object_path, data, {"content-type": "image/png", "upsert": "true"},
            )
            keys[kind] = f"{bucket}/{object_path}"

        service_supabase.table("pujas").update({
            "image_url": keys["big"],
            "thumbnail_url": keys["thumb"],
        }).eq("id", puja_id).execute()
        print(f"  updated       {expected_title} <- {file_name}")

    print(f"Done. {len(PUJA_IMAGES) - failures} ok, {failures} skipped.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
