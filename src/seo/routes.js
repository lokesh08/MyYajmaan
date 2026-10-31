// Per-route SEO data. Plain data + a tiny matcher (no React / Vite
// imports) so the app and the build tooling share one source of truth.
//
// Rules of thumb used for every entry below:
//   - title: <= 60 characters, unique, brand at the end
//   - description: 110-160 characters, unique, written for a person
//   - anything behind a login, or a step in a flow, is noindex

import { normalizePath } from './siteConfig.js';

// Pages search engines should index. Also drives sitemap.xml and the
// per-page static HTML written at build time.
export const PUBLIC_ROUTES = [
  {
    path: '/',
    title: 'MyYajmaan | Book Verified Pandit Ji & Puja Online',
    description:
      'Book verified Pandit Ji for Satyanarayan, Griha Pravesh, Rudrabhishek and more. Pick an auspicious muhurat, see clear pricing and get doorstep puja services.',
    heading: 'Book verified Pandit Ji and puja services online',
    // First banner slide = the largest paint on the home page; start fetching it immediately.
    preloadImage: '/images/banners/banner1.webp',
    changefreq: 'daily',
    priority: 1.0,
  },
  {
    path: '/book',
    title: 'Book Puja Online – Browse All Pujas | MyYajmaan',
    description:
      'Explore Vedic pujas you can book online - Satyanarayan, Navgraha, Lakshmi, Rudrabhishek and more - performed by verified Pandit Ji at your home.',
    heading: 'Book a puja online',
    changefreq: 'daily',
    priority: 0.9,
  },
  {
    path: '/pandit/register',
    title: 'Join as Pandit Ji – Get Puja Bookings | MyYajmaan',
    description:
      'Are you a Pandit Ji? Register with MyYajmaan, get verified and receive puja booking requests from families near you. Grow your practice with trusted bookings.',
    heading: 'Join MyYajmaan as a Pandit Ji',
    changefreq: 'monthly',
    priority: 0.7,
  },
  {
    path: '/register',
    title: 'Create Account – Book Pujas Online | MyYajmaan',
    description:
      'Create a free MyYajmaan account to book verified Pandit Ji, track your pujas, earn referral rewards and manage everything in one place.',
    heading: 'Create your MyYajmaan account',
    changefreq: 'monthly',
    priority: 0.6,
  },
  {
    path: '/help-center',
    title: 'Help Center – Booking, Payments & Refunds | MyYajmaan',
    description:
      'Answers to common questions about booking a puja, cancellations, refunds, payments, wallet and referral rewards on MyYajmaan.',
    heading: 'MyYajmaan Help Center',
    changefreq: 'monthly',
    priority: 0.6,
  },
  {
    path: '/contact-us',
    title: 'Contact Us – MyYajmaan Support',
    description:
      'Have a question about a puja booking, payment or Pandit Ji? Contact the MyYajmaan team through the form or by email and we will help you quickly.',
    heading: 'Contact MyYajmaan',
    changefreq: 'yearly',
    priority: 0.5,
  },
  {
    path: '/cancellation-refund',
    title: 'Cancellation & Refund Policy | MyYajmaan',
    description:
      'Understand how cancellations and refunds work for puja bookings on MyYajmaan, including eligibility, timelines and how to request a refund.',
    heading: 'Cancellation and refund policy',
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | MyYajmaan',
    description:
      'Read how MyYajmaan collects, uses and protects your personal information when you book pujas and use our services.',
    heading: 'Privacy policy',
    changefreq: 'yearly',
    priority: 0.3,
  },
  {
    path: '/terms-and-conditions',
    title: 'Terms and Conditions | MyYajmaan',
    description:
      'The terms for using MyYajmaan to book pujas and Pandit Ji services, including bookings, payments and the responsibilities of each party.',
    heading: 'Terms and conditions',
    changefreq: 'yearly',
    priority: 0.3,
  },
];

// Everything else. Matched in order (first hit wins); `:param` matches
// one segment and a trailing `/*` matches any depth.
const OTHER_ROUTES = [
  // Auth + utility screens: reachable, useful, but not search landing pages.
  { pattern: '/login', title: 'Log In | MyYajmaan', noindex: true },
  { pattern: '/pandit/login', title: 'Pandit Ji Log In | MyYajmaan', noindex: true },
  { pattern: '/forgot-password', title: 'Forgot Password | MyYajmaan', noindex: true },
  { pattern: '/reset-password', title: 'Reset Password | MyYajmaan', noindex: true },
  { pattern: '/verify-otp', title: 'Verify Your Account | MyYajmaan', noindex: true },
  { pattern: '/unauthorized', title: 'Access Denied | MyYajmaan', noindex: true },

  // Booking flow steps: personal, session-based, no value in search.
  { pattern: '/book/datetime', title: 'Choose Date & Time | MyYajmaan', noindex: true },
  { pattern: '/book/select-pandit', title: 'Select Pandit Ji | MyYajmaan', noindex: true },
  { pattern: '/book/address', title: 'Puja Address | MyYajmaan', noindex: true },
  { pattern: '/book/payment', title: 'Payment | MyYajmaan', noindex: true },
  { pattern: '/book/confirmation', title: 'Booking Confirmed | MyYajmaan', noindex: true },
  { pattern: '/book/package/*', title: 'Package Puja Booking | MyYajmaan', noindex: true },

  // Logged-in areas.
  { pattern: '/dashboard', title: 'My Dashboard | MyYajmaan', noindex: true },
  { pattern: '/dashboard/*', title: 'My Account | MyYajmaan', noindex: true },
  { pattern: '/pandit/dashboard', title: 'Pandit Ji Dashboard | MyYajmaan', noindex: true },
  { pattern: '/pandit/bookings', title: 'Pandit Ji Bookings | MyYajmaan', noindex: true },
  { pattern: '/pandit/feedback', title: 'Pandit Ji Feedback | MyYajmaan', noindex: true },
  { pattern: '/pandit/messages', title: 'Pandit Ji Messages | MyYajmaan', noindex: true },
  { pattern: '/pandit/photos', title: 'Pandit Ji Photos | MyYajmaan', noindex: true },
  { pattern: '/pandit/profile', title: 'Pandit Ji Profile | MyYajmaan', noindex: true },
  { pattern: '/pandit/pujas', title: 'My Pujas | MyYajmaan', noindex: true },
  { pattern: '/pandit/wallet', title: 'Pandit Ji Wallet | MyYajmaan', noindex: true },
  { pattern: '/pandit', title: 'Pandit Ji Portal | MyYajmaan', noindex: true },
  { pattern: '/admin', title: 'Admin | MyYajmaan', noindex: true },
  { pattern: '/admin/*', title: 'Admin | MyYajmaan', noindex: true },

  // Public detail pages (fallbacks; real values come from the data).
  {
    pattern: '/book/:id',
    title: 'Puja Details – Book Online | MyYajmaan',
    description:
      'See what this puja includes, its benefits and price, then book a verified Pandit Ji for your preferred date and time.',
  },
  {
    pattern: '/pandit/:id',
    title: 'Pandit Ji Profile | MyYajmaan',
    description:
      'View this verified Pandit Ji’s experience, languages, specialities and service area, then book a puja online.',
  },
];

export function matchPattern(pattern, pathname) {
  const path = normalizePath(pathname);
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2);
    return path === base || path.startsWith(`${base}/`);
  }
  const p = pattern.split('/');
  const s = path.split('/');
  if (p.length !== s.length) return false;
  return p.every((part, i) => part.startsWith(':') || part === s[i]);
}

// SEO fields for a URL path. Unknown paths are treated as a soft 404 and
// kept out of the index.
export function resolveRouteSeo(pathname) {
  const path = normalizePath(pathname);

  const pub = PUBLIC_ROUTES.find((route) => route.path === path);
  if (pub) return { ...pub, noindex: false };

  for (const rule of OTHER_ROUTES) {
    if (!matchPattern(rule.pattern, path)) continue;
    return { description: undefined, noindex: false, ...rule };
  }

  return {
    title: 'Page Not Found | MyYajmaan',
    description: 'This page could not be found.',
    noindex: true,
    notFound: true,
  };
}
