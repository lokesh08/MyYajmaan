# MyYajmaan

MyYajmaan is a puja-booking platform: customers browse and book verified Pandit Ji
for pujas, pay online, and manage bookings from a dashboard; Pandit Ji manage their
profile, availability, and earnings; admins run the whole platform from a back office.

This repo is the **React + Vite frontend**. It talks to the FastAPI backend in
[`myyajmaan-api/`](myyajmaan-api/README.md), which in turn talks to Supabase/Postgres.
See that backend's README to run the API and database locally.

## Stack

React 19, Vite, Tailwind CSS, React Router, Axios, React Quill (CMS rich text),
Leaflet (pandit map), Supabase JS client (storage uploads only - the app itself
talks to the FastAPI backend, not Supabase directly).

## Getting started

1. Make sure the backend is running first - see
   [`myyajmaan-api/README.md`](myyajmaan-api/README.md).
2. Install dependencies: `npm install`
3. Copy the environment example: `copy .env.example .env` (Windows) or
   `cp .env.example .env`
4. Start the dev server: `npm run dev`

## Environment variables

All front-end env vars are `VITE_*` and are **public** - they ship to the browser,
so never put secrets here. See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the FastAPI backend, e.g. `http://127.0.0.1:8000` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Used only for direct Supabase Storage uploads (e.g. profile photos); leave blank if not needed locally |
| `VITE_SITE_URL` | Public site address, no trailing slash - used for canonical URLs, Open Graph tags, and `sitemap.xml`. **Required for a production build.** |
| `VITE_IDLE_LOGOUT_MINUTES` | Optional, minutes of inactivity before auto sign-out (default 30) |

## App areas

- **Public site** - home, puja catalogue, pandit browsing/map, booking flow
  (puja → date/time → pandit → address → payment), contact, help center,
  privacy policy, terms, cancellation & refund.
- **Client dashboard** (`src/pages/client/`) - bookings, wallet, addresses,
  referrals, settings.
- **Pandit Ji dashboard** (`src/pages/pandit/`) - bookings, profile, photos,
  wallet, feedback.
- **Admin panel** (`src/pages/admin/`) - users, pandits, pujas, bookings,
  coupons, wallet, complaints, reports, CMS (policy pages, journeys, benefits),
  muhurats, testimonials, audit log, and settings (pricing, booking lead time,
  invoice/GST details, Pandit Ji registration rules, social media links).
- **Messaging center** (`src/pages/messaging/`) - in-app chat between
  customers, Pandit Ji, and support.

## Payments, OTP, and other backend-driven features

Razorpay checkout, email/SMS OTP verification, SMTP/MSG91 credentials, and the
CMS content store are all configured and run on the **backend** - see
[`myyajmaan-api/README.md`](myyajmaan-api/README.md) for where to set those up.
The frontend only calls the backend's REST endpoints for all of this; there is
nothing to configure here.

## Colours and design tokens

Every colour, shadow and gradient in the app is defined once, in
[`src/theme/tokens.js`](src/theme/tokens.js). Change a value there and the whole
app follows.

- **Tailwind classes** (`bg-maroon`, `text-amber-700`, `shadow-card`) are generated
  from the tokens - `tailwind.config.js` replaces Tailwind's default palette with them.
- **Plain CSS** reads the same values as variables: `var(--color-maroon)`,
  `var(--shadow-card)`; use `color-mix(in srgb, var(--color-maroon) 10%, transparent)`
  for transparency.
- **JS that needs a raw value** (charts, SVG) imports it: `import { colors } from "../theme/tokens"`.
- Do not write `#hex`, `rgb()`/`hsl()` or named colours anywhere else.
  `npm run check:colors` fails if any exist outside the tokens file.

## SEO

Search and social tags are generated from one place - [`src/seo/`](src/seo/).

| Task | Where |
| --- | --- |
| Change a page's title / description, or add a public page | `src/seo/routes.js` (`PUBLIC_ROUTES`) |
| Site name, default description, share image | `src/seo/siteConfig.js` |
| Structured data (JSON-LD) builders | `src/seo/structuredData.js` |
| Set tags from a page that loads data | `<Seo title=... description=... jsonLd=... />` (see `PujaDetailPage.jsx`) |

How it works:

- **Runtime:** `<RouteSeo />` (mounted in `App.jsx`) sets the title, description, canonical and
  robots tag for every route. A page can add a `<Seo>` to override fields once its data loads.
  Login, dashboards, booking steps and unknown URLs are `noindex`.
- **Build:** `vite-plugins/seo.js` writes the tags into `index.html`, a static `<route>/index.html`
  for each public page (for crawlers and link previews that don't run JavaScript),
  `robots.txt`, `sitemap.xml` and `site.webmanifest`. The API serves the database half of the
  sitemap at `/sitemap-dynamic.xml` (pujas and approved Pandit Ji profiles).
- **Set these for production:** `VITE_SITE_URL` (front-end build) and `PUBLIC_SITE_URL` (API) to
  the real public address, e.g. `https://www.example.com`.
- **Images:** large images have lighter `.webp` copies (`npm run optimize:images`); the app serves
  them through `optimizedImage()` in `src/utils/image.js`. Re-run the script after adding images.
  The share image is `public/og-image.png` (`npm run generate:og`).
- **Guard:** `npm run check:seo` (run after `npm run build`) checks title/description length and
  uniqueness, the built pages, sitemap, robots and structured data.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint |
| `npm run check:colors` | Fail if any colour literal exists outside `src/theme/tokens.js` |
| `npm run check:seo` | Validate SEO output after a build |
| `npm run optimize:images` | Generate `.webp` copies of local images |
| `npm run generate:og` | Rebuild `public/og-image.png` from the current banner + brand tokens |
