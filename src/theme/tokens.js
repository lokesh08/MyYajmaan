// =====================================================================
//  MyYajmaan design tokens -- the ONE place colours are defined.
//
//  Change a value here and the whole app follows:
//    - Tailwind classes (bg-maroon, text-amber-700, shadow-card, ...)
//      are generated from this file (see tailwind.config.js),
//    - plain CSS reads the same values as CSS variables
//      (var(--color-maroon), var(--shadow-card), ...),
//    - scripts/charts that need a raw value import it from here.
//
//  Nothing else in the app may contain a colour literal (#hex, rgb(),
//  hsl(), named colours). `npm run check:colors` enforces that.
//
//  Naming: a token's path is its Tailwind name and CSS variable, e.g.
//    colors.maroon.dark    -> bg-maroon-dark  /  var(--color-maroon-dark)
//    colors.maroon.DEFAULT -> bg-maroon       /  var(--color-maroon)
// =====================================================================

// Returns `hex` as an rgba() string -- for shadows/overlays that need
// transparency, so alpha variants stay derived from a token.
export function alpha(hex, opacity) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const colors = {
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
  white: '#ffffff',
  black: '#000000',

  // ---- Brand ------------------------------------------------------
  // Primary brand maroon, lightest -> darkest.
  maroon: {
    DEFAULT: '#7a1f2d', // buttons, headings, links
    light: '#8a2233', // hover / gradient highlight
    dark: '#631425', // primary buttons on light pages, gradient start
    deep: '#5a0d1a', // hero / banner gradients
    deeper: '#4a0f1c', // footer, modal headers
    night: '#3a0b16', // darkest gradient stop
    ink: '#2d1117', // default page text
    ember: '#50110f', // text on gold badges
    mist: '#fdf2f4', // info-toast background
    blush: '#f3c6ce', // info-toast border
  },
  saffron: '#d97706', // primary accent (CTAs, highlights)
  gold: '#fbbf24', // bright accent / glows
  marigold: {
    DEFAULT: '#dc9418', // eyebrow labels, small accents
    deep: '#d88d23', // gradient end for warm banners
  },
  sand: {
    DEFAULT: '#f4c66a', // soft gold on dark backgrounds
    pale: '#f4d49c',
  },

  // ---- Surfaces (warm light backgrounds) --------------------------
  cream: {
    DEFAULT: '#f2e1da', // page background
    light: '#f8ece3',
  },
  // Ivory/parchment tints, lightest -> darkest.
  parchment: {
    50: '#fffaf2', // card / section background
    100: '#fff8e9',
    150: '#fff6ee',
    200: '#fff3dc',
    250: '#fdeee0',
    300: '#f9e3bd',
    350: '#f7d7b2',
    400: '#f3d9c4',
    450: '#f0e6da',
    500: '#e5d2b8',
  },
  brown: {
    DEFAULT: '#6f5847', // muted text on cream
    dark: '#3f1e13', // gradient stop
    rust: '#b84a00', // reward highlight text
    ink: '#333322', // modal titles
  },
  // Testimonial avatar gradients.
  clay: { DEFAULT: '#d99a62', sand: '#b89362' },
  sage: { light: '#c9d9d5', DEFAULT: '#719994' },
  rosewood: { light: '#f4c8c9', DEFAULT: '#c9868c' },

  // ---- Neutral greys used by the older plain-CSS screens ----------
  neutral: {
    50: '#f5f5f5',
    100: '#f0f0f0',
    150: '#eeeeee',
    200: '#e6e6e6',
    300: '#dddddd',
    400: '#888888',
    450: '#777777',
    500: '#666666',
    600: '#444444',
    700: '#333333',
    800: '#222222',
  },

  // ---- Map / share-button accents ---------------------------------
  azure: {
    DEFAULT: '#1976d2',
    dark: '#115293',
    light: '#2185d0',
    50: '#f0f7ff',
    mist: '#f6f7fb', // map page background
  },
  social: {
    whatsapp: '#075e54',
    facebook: '#1877f2',
    email: '#0b79d0',
  },
  forest: '#1b8e3b', // positive numbers in the earnings panel

  // ---- Status / utility palettes (Tailwind's scales, kept here so
  //      they can be tuned from this file too) ----------------------
  //  amber/orange = warm + pending, emerald = success, rose/red =
  //  danger, sky/indigo/violet/fuchsia/teal = info & chart accents,
  //  slate/gray = text & borders.
  slate: {50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a', 950: '#020617'},
  gray: {50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827', 950: '#030712'},
  red: {50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d', 950: '#450a0a'},
  orange: {50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407'},
  amber: {50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f', 950: '#451a03'},
  emerald: {50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b', 950: '#022c22'},
  teal: {50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e'},
  sky: {50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e', 950: '#082f49'},
  indigo: {50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b'},
  violet: {50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065'},
  fuchsia: {50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75', 950: '#4a044e'},
  rose: {50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519'},
};

// ---- Shadows (built from colour tokens) -----------------------------
const s = (hex, a) => alpha(hex, a);
export const shadows = {
  divine: `0 24px 60px ${s(colors.maroon.deep, 0.18)}`,
  'card-sm': `0 12px 30px ${s(colors.maroon.DEFAULT, 0.06)}`,
  card: `0 18px 40px ${s(colors.maroon.DEFAULT, 0.06)}`,
  'card-lg': `0 20px 40px ${s(colors.maroon.DEFAULT, 0.14)}`,
  lift: `0 14px 35px ${s(colors.maroon.DEFAULT, 0.18)}`,
  button: `0 10px 25px ${s(colors.maroon.DEFAULT, 0.3)}`,
  'divine-lg': `0 20px 50px ${s(colors.maroon.deep, 0.18)}`,
  float: `0 20px 50px -20px ${s(colors.maroon.DEFAULT, 0.25)}`,
  'hover-lift': `0 12px 22px ${s(colors.maroon.deep, 0.16)}`,
  'ring-marigold': `0 0 0 5px ${s(colors.marigold.DEFAULT, 0.14)}`,
  'glow-gold': `0 0 18px ${s(colors.gold, 0.55)}`,
  'glow-gold-md': `0 6px 20px ${s(colors.gold, 0.5)}`,
  'glow-gold-sm': `0 4px 14px ${s(colors.gold, 0.35)}`,
  'panel-dark': `inset 0 1px 0 ${s(colors.white, 0.08)}, 0 14px 36px -14px ${s(colors.black, 0.6)}`,
  'sheet-up': `0 -30px 70px -30px ${s('#140408', 0.55)}`,
  toast: `0 14px 32px -12px ${s(colors.maroon.DEFAULT, 0.22)}`,
  modal: `0 16px 36px ${s('#0c1722', 0.2)}`,
  'hover-soft': `0 8px 20px ${s(colors.black, 0.06)}`,
  chip: `0 4px 10px ${s(colors.black, 0.12)}`,
  thumb: `0 2px 8px ${s(colors.maroon.DEFAULT, 0.4)}`,
};

// ---- Gradient overlays used as utility classes (bg-vignette, ...) ---
export const gradients = {
  vignette: `radial-gradient(ellipse at center, transparent 40%, ${s(colors.black, 0.24)} 100%)`,
  'glow-gold': `radial-gradient(circle at 50% 0%, ${s(colors.gold, 0.16)}, transparent 60%)`,
};

// Browser UI colour (address bar on mobile); injected into index.html.
export const themeColor = colors.maroon.DEFAULT;

// ---------------------------------------------------------------------
// Helpers for the build tooling (Tailwind config, CSS variables, checks).
// ---------------------------------------------------------------------

// { maroon: { DEFAULT, dark } } -> { 'maroon': '#..', 'maroon-dark': '#..' }
export function flattenColors(tree = colors, prefix = '') {
  const flat = {};
  for (const [key, value] of Object.entries(tree)) {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    if (value && typeof value === 'object') {
      Object.assign(flat, flattenColors(value, name));
    } else {
      flat[name] = value;
    }
  }
  return flat;
}

// :root { --color-maroon: #7a1f2d; --shadow-card: ...; }
export function cssVariables() {
  const vars = {};
  for (const [name, value] of Object.entries(flattenColors())) {
    vars[`--color-${name}`] = value;
  }
  for (const [name, value] of Object.entries(shadows)) {
    vars[`--shadow-${name}`] = value;
  }
  return vars;
}
