import plugin from 'tailwindcss/plugin';

import { colors, shadows, gradients, cssVariables } from './src/theme/tokens.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    // Replaces (not extends) Tailwind's default palette: every colour
    // class in the app resolves to a token in src/theme/tokens.js, so
    // that file is the single source of truth.
    colors,
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
        serif: ['Noto Serif', 'serif'],
      },
      boxShadow: shadows,
      backgroundImage: gradients,
    },
  },
  plugins: [
    // Exposes every token to plain CSS as var(--color-*) / var(--shadow-*).
    plugin(({ addBase }) => {
      addBase({ ':root': cssVariables() });
    }),
  ],
};
