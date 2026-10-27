import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import seo from './vite-plugins/seo.js';

// The SEO plugin also injects the browser theme colour (from the design
// tokens) and writes robots.txt / sitemap.xml / the web manifest.
export default defineConfig({
  plugins: [react(), seo()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
