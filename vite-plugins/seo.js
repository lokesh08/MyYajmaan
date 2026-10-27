// Build-time SEO output for the single-page app.
//
// What it does:
//   1. index.html  - fills the SEO markers with title, description,
//      canonical, Open Graph / Twitter tags and site-wide JSON-LD.
//   2. per-route HTML - writes dist/<route>/index.html for every public
//      page with that page's own head + a <noscript> summary, so crawlers
//      and link-preview bots that don't run JavaScript still get correct
//      tags. (Static hosts serve /contact-us -> contact-us/index.html.)
//   3. robots.txt, sitemap.xml, site.webmanifest - generated from the same
//      route table and design tokens; also served by the dev server.
//
// The public address is VITE_SITE_URL (e.g. https://www.example.com).
// When it isn't set, URLs fall back to relative paths and a warning is
// printed, because canonical URLs and sitemaps must be absolute.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';

import { colors, themeColor } from '../src/theme/tokens.js';
import { SITE, absoluteUrl } from '../src/seo/siteConfig.js';
import { PUBLIC_ROUTES } from '../src/seo/routes.js';
import { breadcrumbSchema, organizationSchema, websiteSchema } from '../src/seo/structuredData.js';

const HEAD_START = '<!--seo:head-->';
const HEAD_END = '<!--/seo:head-->';
const BODY_START = '<!--seo:noscript-->';
const BODY_END = '<!--/seo:noscript-->';

// Private areas kept out of crawling. The admin portal is deliberately
// NOT listed: robots.txt is public, and its path is meant to stay hard
// to guess (see constants/adminRoutes.js). It is protected by a noindex
// meta tag instead.
const DISALLOWED_PATHS = [
  '/dashboard',
  '/pandit/dashboard',
  '/pandit/bookings',
  '/pandit/feedback',
  '/pandit/messages',
  '/pandit/photos',
  '/pandit/profile',
  '/pandit/pujas',
  '/pandit/wallet',
  '/book/datetime',
  '/book/select-pandit',
  '/book/address',
  '/book/payment',
  '/book/confirmation',
  '/book/package/',
  '/browse-pandits',
  '/verify-otp',
  '/reset-password',
];

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const escapeText = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// JSON inside <script>: '<' is escaped so "</script>" can never appear.
const jsonScript = (data, attrs = '') =>
  `<script type="application/ld+json"${attrs}>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

function headBlock(route, siteUrl) {
  const canonical = absoluteUrl(siteUrl, route.path);
  const image = absoluteUrl(siteUrl, SITE.ogImagePath);
  const title = escapeAttr(route.title);
  const description = escapeAttr(route.description);

  const lines = [
    HEAD_START,
    `<title>${escapeText(route.title)}</title>`,
    `<meta name="description" content="${description}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
    `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeAttr(SITE.name)}" />`,
    `<meta property="og:locale" content="${SITE.locale}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
    `<meta property="og:image" content="${escapeAttr(image)}" />`,
    `<meta property="og:image:alt" content="${escapeAttr(SITE.ogImageAlt)}" />`,
    `<meta property="og:image:width" content="${SITE.ogImageWidth}" />`,
    `<meta property="og:image:height" content="${SITE.ogImageHeight}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
    `<meta name="twitter:image:alt" content="${escapeAttr(SITE.ogImageAlt)}" />`,
    // Site-wide identity data: stays on every page (no data-seo-jsonld).
    jsonScript(organizationSchema(siteUrl)),
    jsonScript(websiteSchema(siteUrl)),
  ];

  if (route.preloadImage) {
    // index.html is also the fallback for every other URL, so only preload
    // when the visitor actually landed on this route.
    lines.push(
      `<script>if(location.pathname===${JSON.stringify(route.path)}){var l=document.createElement("link");l.rel="preload";l.as="image";l.href=${JSON.stringify(route.preloadImage)};l.setAttribute("fetchpriority","high");document.head.appendChild(l)}</script>`,
    );
  }

  if (route.path !== '/') {
    // Page-level data is tagged so the running app can replace it.
    lines.push(
      jsonScript(
        breadcrumbSchema(siteUrl, [
          { name: 'Home', path: '/' },
          { name: route.heading, path: route.path },
        ]),
        ' data-seo-jsonld',
      ),
    );
  }

  lines.push(HEAD_END);
  return lines.join('\n    ');
}

function noscriptBlock(route) {
  const links = PUBLIC_ROUTES.filter((r) => r.path !== route.path)
    .map((r) => `<li><a href="${escapeAttr(r.path)}">${escapeText(r.heading)}</a></li>`)
    .join('');
  return [
    BODY_START,
    '<noscript>',
    `<h1>${escapeText(route.heading)}</h1>`,
    `<p>${escapeText(route.description)}</p>`,
    '<p>MyYajmaan needs JavaScript to book a puja. Please enable it in your browser.</p>',
    `<nav aria-label="Site"><ul>${links}</ul></nav>`,
    '</noscript>',
    BODY_END,
  ].join('\n    ');
}

function replaceBetween(html, start, end, replacement) {
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  if (from === -1 || to === -1) return html;
  return html.slice(0, from) + replacement + html.slice(to + end.length);
}

function robotsTxt(siteUrl, apiBase) {
  const lines = ['User-agent: *', 'Allow: /', ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`), ''];
  if (siteUrl) lines.push(`Sitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}`);
  // Pujas and Pandit Ji profiles live in the database; the API serves
  // that half of the sitemap. Cross-host sitemaps are allowed when they
  // are declared in robots.txt like this.
  if (/^https?:\/\//i.test(apiBase || '')) lines.push(`Sitemap: ${apiBase.replace(/\/+$/, '')}/sitemap-dynamic.xml`);
  return `${lines.join('\n')}\n`;
}

function sitemapXml(siteUrl) {
  const urls = PUBLIC_ROUTES.map(
    (route) =>
      `  <url>\n    <loc>${escapeText(absoluteUrl(siteUrl, route.path))}</loc>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority.toFixed(1)}</priority>\n  </url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function webManifest() {
  return `${JSON.stringify(
    {
      name: `${SITE.name} - ${SITE.tagline}`,
      short_name: SITE.name,
      description: SITE.description,
      lang: SITE.language,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: themeColor,
      background_color: colors.cream.DEFAULT,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  )}\n`;
}

export default function seoPlugin() {
  let siteUrl = '';
  let apiBase = '';
  let outDir = 'dist';
  let root = process.cwd();
  let isBuild = false;

  return {
    name: 'myyajmaan-seo',

    configResolved(config) {
      const env = loadEnv(config.mode, config.root, 'VITE_');
      siteUrl = (env.VITE_SITE_URL || '').replace(/\/+$/, '');
      apiBase = env.VITE_API_BASE_URL || '';
      outDir = config.build.outDir;
      root = config.root;
      isBuild = config.command === 'build';

      if (isBuild && !siteUrl) {
        console.warn(
          '\n[seo] VITE_SITE_URL is not set - canonical URLs, Open Graph URLs and sitemap.xml need the public address (e.g. https://www.example.com). Set it in the build environment.\n',
        );
      }
    },

    // index.html: theme colour + the home page's SEO block.
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const home = PUBLIC_ROUTES.find((r) => r.path === '/');
        return html
          .replaceAll('%THEME_COLOR%', themeColor)
          .replace(/<!--seo:head-->[\s\S]*?<!--\/seo:head-->/, headBlock(home, siteUrl))
          .replace(/<!--seo:noscript-->[\s\S]*?<!--\/seo:noscript-->/, noscriptBlock(home));
      },
    },

    // Same files in `vite dev`, so they can be checked locally.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        const files = {
          '/robots.txt': ['text/plain', () => robotsTxt(siteUrl, apiBase)],
          '/sitemap.xml': ['application/xml', () => sitemapXml(siteUrl)],
          '/site.webmanifest': ['application/manifest+json', webManifest],
        };
        const file = files[url];
        if (!file) return next();
        res.setHeader('Content-Type', `${file[0]}; charset=utf-8`);
        res.end(file[1]());
      });
    },

    closeBundle() {
      if (!isBuild) return;
      const out = join(root, outDir);
      const indexPath = join(out, 'index.html');
      if (!existsSync(indexPath)) return;

      writeFileSync(join(out, 'robots.txt'), robotsTxt(siteUrl, apiBase));
      writeFileSync(join(out, 'sitemap.xml'), sitemapXml(siteUrl));
      writeFileSync(join(out, 'site.webmanifest'), webManifest());

      const template = readFileSync(indexPath, 'utf8');
      for (const route of PUBLIC_ROUTES) {
        if (route.path === '/') continue;
        let html = replaceBetween(template, HEAD_START, HEAD_END, headBlock(route, siteUrl));
        html = replaceBetween(html, BODY_START, BODY_END, noscriptBlock(route));
        const dir = join(out, route.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), html);
      }
    },
  };
}
