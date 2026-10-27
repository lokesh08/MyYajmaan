// schema.org JSON-LD builders (structured data for rich search results).
// Pure functions -> plain objects; used by the app at runtime and by the
// build tooling for the static <head>. Only real data is ever emitted:
// no invented ratings, reviews, addresses or prices.

import { SITE, absoluteUrl, toSnippet } from './siteConfig.js';

const CONTEXT = 'https://schema.org';

export function organizationSchema(siteUrl) {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': absoluteUrl(siteUrl, '/#organization'),
    name: SITE.name,
    url: absoluteUrl(siteUrl, '/'),
    logo: absoluteUrl(siteUrl, SITE.logoPath),
    description: SITE.description,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: SITE.supportEmail,
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    ],
  };
}

export function websiteSchema(siteUrl) {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': absoluteUrl(siteUrl, '/#website'),
    url: absoluteUrl(siteUrl, '/'),
    name: SITE.name,
    description: SITE.description,
    inLanguage: SITE.language,
    publisher: { '@id': absoluteUrl(siteUrl, '/#organization') },
  };
}

// items: [{ name, path }] from the home page down to the current page.
export function breadcrumbSchema(siteUrl, items) {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(siteUrl, item.path),
    })),
  };
}

export function pujaServiceSchema(siteUrl, puja, { path, image } = {}) {
  const url = absoluteUrl(siteUrl, path || `/book/${puja.id}`);
  const price = Number(puja.base_price);
  const isPackage = puja.puja_type === 'package';

  const schema = {
    '@context': CONTEXT,
    '@type': 'Service',
    name: puja.title,
    description: toSnippet(puja.description, 300) || undefined,
    serviceType: 'Puja (Hindu ritual)',
    category: puja.category || undefined,
    url,
    image: image ? [absoluteUrl(siteUrl, image)] : undefined,
    provider: { '@id': absoluteUrl(siteUrl, '/#organization') },
    areaServed: { '@type': 'Country', name: 'India' },
  };

  // A package puja is quoted by the team, so no fixed price exists.
  if (!isPackage && Number.isFinite(price) && price > 0) {
    schema.offers = {
      '@type': 'Offer',
      price: price.toFixed(2),
      priceCurrency: 'INR',
      url,
      availability: 'https://schema.org/InStock',
    };
  }

  return schema;
}

export function panditSchema(siteUrl, pandit, { path, image } = {}) {
  const name = pandit.display_name || pandit.name;
  const languages = pandit.languages_spoken || pandit.languages || [];
  const specialities = pandit.specialities || [];

  return {
    '@context': CONTEXT,
    '@type': 'Person',
    name,
    url: absoluteUrl(siteUrl, path || `/pandit/${pandit.id}`),
    image: image ? absoluteUrl(siteUrl, image) : undefined,
    jobTitle: 'Pandit Ji (Hindu priest)',
    description: toSnippet(pandit.about || pandit.bio, 300) || undefined,
    knowsAbout: specialities.length ? specialities : undefined,
    knowsLanguage: languages.length ? languages : undefined,
    // City/state only -- a street address is never published.
    homeLocation:
      pandit.city || pandit.state
        ? {
            '@type': 'Place',
            address: {
              '@type': 'PostalAddress',
              addressLocality: pandit.city || undefined,
              addressRegion: pandit.state || undefined,
              addressCountry: 'IN',
            },
          }
        : undefined,
    worksFor: { '@id': absoluteUrl(siteUrl, '/#organization') },
  };
}

// items: [{ question, answer }]
export function faqSchema(items) {
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

// items: [{ name, path }]
export function itemListSchema(siteUrl, items, name) {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    name,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(siteUrl, item.path),
      name: item.name,
    })),
  };
}

export function contactPageSchema(siteUrl) {
  return {
    '@context': CONTEXT,
    '@type': 'ContactPage',
    name: `Contact ${SITE.name}`,
    url: absoluteUrl(siteUrl, '/contact-us'),
    about: { '@id': absoluteUrl(siteUrl, '/#organization') },
  };
}
