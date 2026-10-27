// Fails if a colour literal exists anywhere in the app outside the
// design-token file. Run with `npm run check:colors`.
//
// Colours belong in src/theme/tokens.js only; everything else uses
// Tailwind token classes (bg-maroon, text-amber-700, ...), CSS
// variables (var(--color-maroon)), or imports from the tokens module.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const TOKENS_FILE = 'src/theme/tokens.js';
const SCANNED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html'];

const NAMED_COLORS =
  'white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|brown|maroon|gold|silver|teal|navy|cyan|magenta|lime|olive|aqua|fuchsia|indigo|violet|crimson|tomato|salmon|coral|khaki|beige|ivory|lavender|transparent';

const RULES = [
  { name: 'hex colour', pattern: /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g },
  { name: 'rgb/hsl/oklch function', pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g },
  // fill="white", stroke='red', style={{ color: "blue" }}, backgroundColor: 'gold' ...
  {
    name: 'named colour',
    pattern: new RegExp(
      `\\b(?:fill|stroke|stopColor|floodColor|color|backgroundColor|borderColor|background|border)\\s*(?:=|:)\\s*\\{?\\s*["'](?:${NAMED_COLORS})["']`,
      'g',
    ),
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      walk(path, out);
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      out.push(path);
    }
  }
  return out;
}

const files = [...walk(join(root, 'src')), join(root, 'index.html')];
const findings = [];

for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  if (rel === TOKENS_FILE) continue;

  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      for (const { name, pattern } of RULES) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) findings.push(`${rel}:${index + 1}  ${name}: ${line.trim().slice(0, 110)}`);
      }
    });
}

if (findings.length) {
  console.error(`Found ${findings.length} colour literal(s) outside ${TOKENS_FILE}:\n`);
  console.error(findings.join('\n'));
  console.error(`\nMove the colour into ${TOKENS_FILE} and reference it instead.`);
  process.exit(1);
}

console.log(`OK - no colour literals outside ${TOKENS_FILE} (${files.length} files checked).`);
