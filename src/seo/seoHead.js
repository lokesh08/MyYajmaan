// Runtime <head> manager for the single-page app.
//
// Several components can ask for SEO tags at once (the route-level
// defaults in <RouteSeo>, and a page's own <Seo> once its data loads).
// Each registers an entry with a priority. The entries are merged from
// lowest to highest priority, so a higher one overrides only the fields
// it actually sets (a page that just adds structured data keeps the
// route's title and description). When an entry unmounts the rest still
// apply. The result is independent of React's child-before-parent
// effect order.

import { SITE, absoluteUrl, normalizePath } from './siteConfig.js';

const JSON_LD_ATTR = 'data-seo-jsonld';

const entries = new Map(); // id -> { config, priority, order }
let counter = 0;

export function getSiteUrl() {
  const configured = import.meta.env.VITE_SITE_URL;
  return (configured || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
}

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (content === undefined || content === null || content === '') {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]:not([sizes]):not([hreflang])`);
  if (!href) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(blocks) {
  document.head.querySelectorAll(`script[${JSON_LD_ATTR}]`).forEach((node) => node.remove());
  blocks.filter(Boolean).forEach((block) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute(JSON_LD_ATTR, '');
    script.textContent = JSON.stringify(block);
    document.head.appendChild(script);
  });
}

function titleFor(config) {
  const title = (config.title || '').trim();
  if (!title) return SITE.defaultTitle;
  return title.includes(SITE.name) ? title : `${title}${SITE.titleSuffix}`;
}

function render() {
  if (typeof document === 'undefined') return;

  const config = {};
  [...entries.values()]
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .forEach((entry) => {
      Object.entries(entry.config).forEach(([key, value]) => {
        if (value !== undefined) config[key] = value;
      });
    });

  const siteUrl = getSiteUrl();
  const title = titleFor(config);
  const description = config.description || SITE.description;
  const noindex = Boolean(config.noindex);
  const canonicalPath = normalizePath(config.path ?? window.location.pathname);
  const canonical = absoluteUrl(siteUrl, canonicalPath);
  const image = absoluteUrl(siteUrl, config.image || SITE.ogImagePath);
  const usingDefaultImage = !config.image;

  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta(
    'name',
    'robots',
    noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  );
  // A noindex page has no canonical to declare.
  upsertLink('canonical', noindex ? '' : canonical);

  upsertMeta('property', 'og:type', config.type || 'website');
  upsertMeta('property', 'og:site_name', SITE.name);
  upsertMeta('property', 'og:locale', SITE.locale);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:image', image);
  upsertMeta('property', 'og:image:alt', config.imageAlt || SITE.ogImageAlt);
  upsertMeta('property', 'og:image:width', usingDefaultImage ? String(SITE.ogImageWidth) : '');
  upsertMeta('property', 'og:image:height', usingDefaultImage ? String(SITE.ogImageHeight) : '');

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', image);
  upsertMeta('name', 'twitter:image:alt', config.imageAlt || SITE.ogImageAlt);

  setJsonLd([].concat(config.jsonLd || []));
}

export function setSeoEntry(id, config, priority = 1) {
  const existing = entries.get(id);
  entries.set(id, { config, priority, order: existing ? existing.order : ++counter });
  render();
}

export function removeSeoEntry(id) {
  if (entries.delete(id)) render();
}
