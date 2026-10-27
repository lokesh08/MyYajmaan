import { useEffect, useId } from "react";

import { removeSeoEntry, setSeoEntry } from "../seo/seoHead";

/**
 * Sets this page's search/social tags. Renders nothing.
 *
 *   <Seo title="Rudrabhishek Puja" description="..." image="/x.png"
 *        jsonLd={[serviceSchema, breadcrumbs]} />
 *
 * `title` gets " | MyYajmaan" appended unless it already names the brand.
 * `noindex` keeps the page out of search results. Route-level defaults
 * come from <RouteSeo>; a <Seo> in a page overrides only the fields it
 * sets (priority 2).
 */
export default function Seo({
  title,
  description,
  path,
  image,
  imageAlt,
  type,
  noindex,
  jsonLd,
  priority = 2,
}) {
  const id = useId();
  // Structured data is an object, so serialise it for a stable dependency.
  const jsonLdKey = JSON.stringify(jsonLd || null);

  useEffect(() => {
    setSeoEntry(id, { title, description, path, image, imageAlt, type, noindex, jsonLd }, priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, title, description, path, image, imageAlt, type, noindex, jsonLdKey, priority]);

  useEffect(() => () => removeSeoEntry(id), [id]);

  return null;
}
