"""Converts every puja's stored image to light WebP versions.

Puja images were stored as the uploaded 3-4 MB PNGs, and the same file
was used as the card thumbnail -- the Book Puja page downloaded ~44 MB
on a phone. For each puja whose image lives in Storage this downloads
its main image and uploads:

    pujas/<id>/big.webp    (<= 1200px wide, detail page)
    pujas/<id>/thumb.webp  (<= 480px wide, cards and lists)

then points image_url / thumbnail_url at them. The original PNGs are
left in Storage untouched, so this is safe to re-run and easy to undo.

Usage (from myyajmaan-api/ with the venv activated):
    python scripts/optimize_puja_images.py --dry-run
    python scripts/optimize_puja_images.py             # local (.env)

Against Supabase Cloud, set the live values for this one command:
    $env:SUPABASE_URL = "https://<project>.supabase.co"
    $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
    python scripts/optimize_puja_images.py
"""
import argparse
import os
import sys

from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from db import (  # noqa: E402
    LARGE_IMAGE_MAX_WIDTH,
    SUPABASE_PUBLIC_BUCKET,
    THUMBNAIL_MAX_WIDTH,
    service_supabase,
    webp_variant,
)


def storage_path(key: str, bucket: str):
    """'images/pujas/<id>/big.png' -> 'pujas/<id>/big.png'; None if not ours."""
    if not key or key.startswith(("http://", "https://", "/")):
        return None
    prefix = f"{bucket}/"
    return key[len(prefix):] if key.startswith(prefix) else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if service_supabase is None:
        print("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
        return 1

    bucket = SUPABASE_PUBLIC_BUCKET or "images"
    store = service_supabase.storage.from_(bucket)
    print(f"Target: {os.getenv('SUPABASE_URL')}  bucket: {bucket}  dry-run: {args.dry_run}")

    rows = service_supabase.table("pujas").select("id, title, image_url, thumbnail_url").order("title").execute().data
    done = skipped = failed = 0
    for row in rows:
        source = storage_path(row.get("image_url") or row.get("thumbnail_url"), bucket)
        if not source:
            skipped += 1
            continue
        if source.endswith(".webp") and (row.get("thumbnail_url") or "").endswith(".webp"):
            skipped += 1  # already converted
            continue
        if args.dry_run:
            print(f"  would convert  {row['title']}  ({source})")
            done += 1
            continue

        try:
            original = store.download(source)
            big = webp_variant(original, LARGE_IMAGE_MAX_WIDTH)
            thumb = webp_variant(original, THUMBNAIL_MAX_WIDTH, quality=75)
            if not big or not thumb:
                raise ValueError("could not decode image")
            for kind, data in (("big", big), ("thumb", thumb)):
                store.upload(f"pujas/{row['id']}/{kind}.webp", data, {"content-type": "image/webp", "upsert": "true"})
            service_supabase.table("pujas").update({
                "image_url": f"{bucket}/pujas/{row['id']}/big.webp",
                "thumbnail_url": f"{bucket}/pujas/{row['id']}/thumb.webp",
            }).eq("id", row["id"]).execute()
            print(f"  converted      {row['title']}  {len(original) // 1024} KB -> {len(big) // 1024} KB / {len(thumb) // 1024} KB")
            done += 1
        except Exception as exc:  # keep going; report at the end
            print(f"  FAILED         {row['title']}: {exc}")
            failed += 1

    print(f"Done. {done} converted, {skipped} skipped (no stored image / already WebP), {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
