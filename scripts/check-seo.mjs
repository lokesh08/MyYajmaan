// SEO guard. `npm run check:seo`
//
//   1. Route data  (always): every public page has a unique title of at
//      most 60 characters and a unique 70-160 character description.
//   2. Build output (after `npm run build`): each public page's static
//      HTML has the right title, canonical and robots tag; JSON-LD parses;
//      robots.txt / sitemap.xml / manifest exist; the share image is 1200x630;
//      private routes are not in the sitemap.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { PUBLIC_ROUTES, resolveRouteSeo } from '../src/seo/routes.js';
import { SITE } from '../src/seo/siteConfig.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const problems = [];
const fail = (message) => problems.push(message);

// ---- 1. route data ----------------------------------------------------
const seenTitles = new Map();
const seenDescriptions = new Map();

for (const route of PUBLIC_ROUTES) {
  if (route.title.length > 60) fail(`${route.path}: title is ${route.title.length} chars (max 60)`);
  if (route.description.length < 70 || route.description.length > 160) {
    fail(`${route.path}: description is ${route.description.length} chars (want 70-160)`);
  }
  if (!route.heading) fail(`${route.path}: missing heading`);
  if (seenTitles.has(route.title)) fail(`${route.path}: title duplicates ${seenTitles.get(route.title)}`);
  if (seenDescriptions.has(route.description)) fail(`${route.path}: description duplicates ${seenDescriptions.get(route.description)}`);
  seenTitles.set(route.title, route.path);
  seenDescriptions.set(route.description, route.path);
  if (resolveRouteSeo(route.path).noindex) fail(`${route.path}: public route resolves as noindex`);
}

for (const path of ['/login', '/dashboard', '/dashboard/wallet', '/pandit/dashboard', '/book/payment', '/admin/users', '/no-such-page']) {
  if (!resolveRouteSeo(path).noindex) fail(`${path}: should be noindex`);
}

// ---- 2. build output --------------------------------------------------
if (!existsSync(dist)) {
  console.log('(dist/ not found - run `npm run build` to also check the built output)');
} else {
  const read = (file) => readFileSync(join(dist, file), 'utf8');
  const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

  for (const route of PUBLIC_ROUTES) {
    const file = route.path === '/' ? 'index.html' : join(route.path.slice(1), 'index.html');
    if (!existsSync(join(dist, file))) {
      fail(`${route.path}: no static page at dist/${file}`);
      continue;
    }
    const html = read(file);
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
    if (unescape(title || '') !== route.title) fail(`${route.path}: built <title> is "${title}"`);
    if (!/<link rel="canonical" href="[^"]+"/.test(html)) fail(`${route.path}: no canonical link`);
    if (/name="robots" content="[^"]*noindex/.test(html)) fail(`${route.path}: built page is noindex`);
    if (!/<meta property="og:image" content="[^"]+"/.test(html)) fail(`${route.path}: no og:image`);

    for (const block of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try {
        JSON.parse(block[1]);
      } catch {
        fail(`${route.path}: invalid JSON-LD`);
      }
    }
  }

  for (const file of ['robots.txt', 'sitemap.xml', 'site.webmanifest', 'og-image.png']) {
    if (!existsSync(join(dist, file))) fail(`dist/${file} is missing`);
  }

  if (existsSync(join(dist, 'sitemap.xml'))) {
    const sitemap = read('sitemap.xml');
    for (const route of PUBLIC_ROUTES) {
      if (!sitemap.includes(`${route.path === '/' ? '/' : route.path}</loc>`)) fail(`sitemap.xml is missing ${route.path}`);
    }
    if (/\/(dashboard|login|book\/payment|verify-otp)</.test(sitemap)) fail('sitemap.xml lists a private route');
  }

  if (existsSync(join(dist, 'robots.txt'))) {
    const robots = read('robots.txt');
    if (!/^Sitemap:/m.test(robots)) fail('robots.txt has no Sitemap line (set VITE_SITE_URL for the build)');
    if (/\/admin/i.test(robots)) fail('robots.txt exposes the admin path');
  }

  if (existsSync(join(dist, 'og-image.png'))) {
    const { width, height } = await sharp(join(dist, 'og-image.png')).metadata();
    if (width !== SITE.ogImageWidth || height !== SITE.ogImageHeight) fail(`og-image.png is ${width}x${height}, expected ${SITE.ogImageWidth}x${SITE.ogImageHeight}`);
  }
}

if (problems.length) {
  console.error(`SEO check found ${problems.length} problem(s):\n`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log(`OK - SEO checks passed (${PUBLIC_ROUTES.length} public pages${existsSync(dist) ? ', build output verified' : ''}).`);
