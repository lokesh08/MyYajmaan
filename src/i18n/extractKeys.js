// Finds every text passed to t(...) / tt(...) in a source file, so tests can
// check each one has a Hindi translation. Only literal strings count:
// t("Book a Puja"), and both branches of t(cond ? "A" : "B").
// No dependencies (used by `node --test`).

const CALL = /\b(?:t|tt)\(/g;

function readString(src, i) {
  const quote = src[i];
  let out = "";
  for (let j = i + 1; j < src.length; j++) {
    const ch = src[j];
    if (ch === "\\") {
      const next = src[j + 1];
      out += next === "n" ? "\n" : next === "u" ? String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16)) : next;
      j += next === "u" ? 5 : 1;
      continue;
    }
    if (ch === quote) return { value: out, end: j };
    out += ch;
  }
  return { value: out, end: src.length };
}

// Strings in the first argument of each t( call (stops at the first
// top-level comma or the closing parenthesis).
export function extractKeys(src) {
  const keys = new Set();
  let match;
  CALL.lastIndex = 0;
  while ((match = CALL.exec(src))) {
    // skip identifiers like `split(`, `getAt(` that merely end in t
    const before = src[match.index - 1];
    if (before && /[\w$.]/.test(before)) continue;
    let depth = 0;
    for (let i = match.index + match[0].length; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"' || ch === "'") {
        const { value, end } = readString(src, i);
        if (depth === 0) keys.add(value);
        i = end;
        continue;
      }
      if (ch === "`") break; // template literals are not translation keys
      if (ch === "(" || ch === "[" || ch === "{") depth += 1;
      else if (ch === ")" || ch === "]" || ch === "}") {
        if (depth === 0) break;
        depth -= 1;
      } else if (ch === "," && depth === 0) break;
    }
  }
  return keys;
}
