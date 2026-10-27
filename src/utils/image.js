import { OPTIMIZED_IMAGES } from "../constants/optimizedImages";

/**
 * Returns the lighter WebP version of a local image when one exists
 * (see scripts/optimize-images.mjs), otherwise the URL unchanged.
 *
 * Works for paths that come from the database too: a puja saved with
 * "/images/SatyanarayanPuja.png" is served as a ~250 KB WebP instead of a
 * 2.7 MB PNG, with no data change. Remote/storage URLs pass through.
 * Keep using the ORIGINAL url for social-share (og:image) tags.
 */
export function optimizedImage(url) {
  if (typeof url === "string" && OPTIMIZED_IMAGES.has(url)) {
    return url.replace(/\.(png|jpe?g)$/i, ".webp");
  }
  return url;
}
