// English / Hindi for the public site, the customer (Yajmaan) panel and
// the Pandit Ji panel. The admin portal is English-only (LanguageProvider
// forces English under /admin).
//
// The English text itself is the key: t("Book a Puja") returns the Hindi
// from ./hi.js when Hindi is on, and the English unchanged otherwise -- so
// anything not yet translated simply stays English instead of breaking.
// Placeholders use {name}: t("Step {current} of {total}", { current, total }).
//
// Plain functions (not a hook) so utils like the toaster can use them too;
// LanguageProvider re-renders the app when the language changes.
// Free of React/DOM imports so it can be unit tested with `node --test`.

import HI from "./hi.js";
import { HI_SERVER_EXACT, HI_SERVER_PATTERNS } from "./hiServer.js";

export const LANGUAGES = ["en", "hi"];
export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_STORAGE_KEY = "myyajmaan-lang";

let current = DEFAULT_LANGUAGE;

export function getLanguage() {
  return current;
}

// Only LanguageProvider should call this (it also re-renders the app).
export function setCurrentLanguage(lang) {
  current = LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

function fill(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars && vars[name] != null ? String(vars[name]) : match));
}

export function t(text, vars) {
  if (typeof text !== "string") return text;
  const translated = current === "hi" && Object.prototype.hasOwnProperty.call(HI, text) ? HI[text] : text;
  return fill(translated, vars);
}

// Messages written by the server (errors, notifications) are English.
// In Hindi mode the common ones are shown in Hindi: an exact match first,
// then patterns with a number/amount in them. Unknown ones stay English.
export function translateServerText(message) {
  if (current !== "hi" || typeof message !== "string" || !message) return message;
  const trimmed = message.trim();
  if (Object.prototype.hasOwnProperty.call(HI_SERVER_EXACT, trimmed)) return HI_SERVER_EXACT[trimmed];
  if (Object.prototype.hasOwnProperty.call(HI, trimmed)) return HI[trimmed];
  for (const [pattern, replacement] of HI_SERVER_PATTERNS) {
    if (pattern.test(trimmed)) return trimmed.replace(pattern, replacement);
  }
  return message;
}

// Saved choice, falling back to English. Storage can be blocked.
export function readStoredLanguage(storage) {
  try {
    const saved = storage?.getItem(LANGUAGE_STORAGE_KEY);
    return LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function storeLanguage(storage, lang) {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    /* storage blocked -- choice lasts for this visit only */
  }
}

// Admin portal never switches language.
export function isEnglishOnlyPath(pathname) {
  return /^\/admin(\/|$)/.test(pathname || "");
}
