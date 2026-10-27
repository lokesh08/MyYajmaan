// Site-wide SEO constants. Plain data with no browser or Vite APIs, so
// the same file is used by the app at runtime AND by the build tooling
// (vite-plugins/seo.js) that writes index.html, robots.txt, sitemap.xml
// and the per-page static heads.
//
// The public web address comes from the VITE_SITE_URL environment
// variable (e.g. https://www.example.com), never from this file.

export const SITE = {
  name: 'MyYajmaan',
  tagline: 'Divine puja booking',
  defaultTitle: 'MyYajmaan | Book Verified Pandit Ji & Puja Online',
  titleSuffix: ' | MyYajmaan',
  description:
    'Book verified Pandit Ji for Satyanarayan, Griha Pravesh, Rudrabhishek and more. Pick an auspicious muhurat, see clear pricing and get doorstep puja services.',
  locale: 'en_IN',
  language: 'en-IN',
  logoPath: '/images/logo-mark.png',
  ogImagePath: '/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'MyYajmaan - book verified Pandit Ji and puja services online',
  supportEmail: 'support@myyajmaan.com',
};

// "/book/" + "/" -> "/book"; keeps the root as "/".
export function normalizePath(path = '/') {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  const clean = withSlash.split('?')[0].split('#')[0];
  return clean.length > 1 ? clean.replace(/\/+$/, '') : '/';
}

export function absoluteUrl(siteUrl, path = '/') {
  const base = (siteUrl || '').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

// Trims to a search-snippet length at a word boundary.
export function toSnippet(text, max = 155) {
  const plain = String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 60 ? cut.lastIndexOf(' ') : cut.length).replace(/[,;:.\-\s]+$/, '')}…`;
}
