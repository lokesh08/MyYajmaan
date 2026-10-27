import { useEffect, useState } from "react";

import { getCmsContent } from "../services/cms";

export function useCmsContent(key, fallback) {
  const [cms, setCms] = useState({ content: fallback, updatedAt: null, version: null });

  useEffect(() => {
    let active = true;
    getCmsContent(key)
      .then((data) => {
        if (active && data?.content) {
          setCms({ content: data.content, updatedAt: data.updated_at || null, version: data.version || null });
        }
      })
      .catch(() => {
        // Static copy remains available when CMS content is not configured.
      });
    return () => {
      active = false;
    };
  }, [key]);

  return cms;
}

export function formatCmsUpdatedAt(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}