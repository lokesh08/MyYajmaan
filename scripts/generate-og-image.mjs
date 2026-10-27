// Builds public/og-image.png (1200x630): the image shown when a MyYajmaan
// link is shared on WhatsApp, Facebook, X, LinkedIn, etc.
//
// Made from the hero banner plus a brand strip; colours come from the
// design tokens. Run: npm run generate:og   (only needed if the banner or
// brand text changes).

import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

import { colors } from '../src/theme/tokens.js';
import { SITE } from '../src/seo/siteConfig.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const WIDTH = SITE.ogImageWidth;
const HEIGHT = SITE.ogImageHeight;

// A fixed strip height (rather than deriving it from the banner's own
// scaled height) keeps this working no matter what aspect ratio the
// banner happens to be -- the banner is cover-cropped to exactly fill
// the remaining area above it instead of assuming a specific shape.
const STRIP_HEIGHT = 170;
const bannerHeight = HEIGHT - STRIP_HEIGHT;
const banner = await sharp(join(root, 'public/images/banners/banner1.png'))
  .resize({ width: WIDTH, height: bannerHeight, fit: 'cover', position: 'centre' })
  .png()
  .toBuffer();
const stripHeight = STRIP_HEIGHT;

const strip = `
<svg width="${WIDTH}" height="${stripHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.maroon.deeper}"/>
      <stop offset="0.55" stop-color="${colors.maroon.DEFAULT}"/>
      <stop offset="1" stop-color="${colors.maroon.deep}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="60" y="${stripHeight / 2 - 8}" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="700" fill="${colors.white}">${SITE.name}</text>
  <text x="60" y="${stripHeight / 2 + 42}" font-family="Arial, Helvetica, sans-serif" font-size="27" fill="${colors.sand.DEFAULT}">Book verified Pandit Ji &amp; puja services online</text>
  <rect x="${WIDTH - 250}" y="${stripHeight / 2 - 34}" width="190" height="68" rx="34" fill="${colors.saffron}"/>
  <text x="${WIDTH - 155}" y="${stripHeight / 2 + 12}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="700" fill="${colors.white}">Book now</text>
</svg>`;

const output = join(root, 'public/og-image.png');
await sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: colors.maroon.DEFAULT } })
  .composite([
    { input: banner, top: 0, left: 0 },
    { input: Buffer.from(strip), top: bannerHeight, left: 0 },
  ])
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(output);

const { size } = (await import('node:fs')).statSync(output);
console.log(`og-image.png ${WIDTH}x${HEIGHT}, ${(size / 1024).toFixed(0)} KB`);
