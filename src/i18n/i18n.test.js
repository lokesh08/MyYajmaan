// Run with: npm run test:unit
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";

import { extractKeys } from "./extractKeys.js";
import HI from "./hi.js";
import { HI_SERVER_EXACT, HI_SERVER_PATTERNS } from "./hiServer.js";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getLanguage,
  isEnglishOnlyPath,
  readStoredLanguage,
  setCurrentLanguage,
  storeLanguage,
  t,
  translateServerText,
} from "./index.js";

afterEach(() => setCurrentLanguage("en"));

const SRC = fileURLToPath(new URL("..", import.meta.url));

function sourceFiles(dir = SRC) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(jsx?)$/.test(name) && !/\.test\.js$/.test(name)) out.push(path);
  }
  return out;
}
const rel = (path) => relative(SRC, path).replace(/\\/g, "/");
// Admin portal is English-only; ConfirmDialog is shared with customer/Pandit Ji pages.
const isAdminFile = (path) => /^(pages|components)\/admin\//.test(rel(path)) && !rel(path).endsWith("components/admin/ConfirmDialog.jsx");
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

// ---------------------------------------------------------------------
// t()
// ---------------------------------------------------------------------

test("English is the default and returns the text unchanged", () => {
  assert.equal(getLanguage(), DEFAULT_LANGUAGE);
  assert.equal(t("Book a Puja"), "Book a Puja");
});

test("Hindi mode returns the Hindi text", () => {
  setCurrentLanguage("hi");
  assert.equal(t("Book a Puja"), HI["Book a Puja"]);
  assert.notEqual(t("Book a Puja"), "Book a Puja");
});

test("text without a translation stays English (never breaks)", () => {
  setCurrentLanguage("hi");
  assert.equal(t("Some puja name typed by admin"), "Some puja name typed by admin");
  assert.equal(t(""), "");
  assert.equal(t(undefined), undefined);
  assert.equal(t(42), 42);
});

test("placeholders are filled in both languages", () => {
  assert.equal(t("Step {current} of {total}", { current: 2, total: 6 }), "Step 2 of 6");
  setCurrentLanguage("hi");
  assert.equal(t("Step {current} of {total}", { current: 2, total: 6 }), "चरण 2 / 6");
  // missing value keeps the placeholder visible rather than printing "undefined"
  assert.equal(t("Step {current} of {total}", { current: 2 }), "चरण 2 / {total}");
});

test("unknown language falls back to English", () => {
  setCurrentLanguage("fr");
  assert.equal(getLanguage(), "en");
  assert.equal(t("Book a Puja"), "Book a Puja");
});

// ---------------------------------------------------------------------
// Server messages
// ---------------------------------------------------------------------

test("server messages are left alone in English mode", () => {
  assert.equal(translateServerText("Booking not found."), "Booking not found.");
});

test("known server messages are shown in Hindi", () => {
  setCurrentLanguage("hi");
  assert.equal(translateServerText("Booking not found."), HI_SERVER_EXACT["Booking not found."]);
  assert.equal(translateServerText("  Booking not found.  "), HI_SERVER_EXACT["Booking not found."]);
});

test("server messages with amounts use the patterns", () => {
  setCurrentLanguage("hi");
  assert.equal(
    translateServerText("Rescheduling costs Rs. 500. Please add money to your wallet and try again."),
    "समय बदलने का शुल्क रु. 500 है। कृपया वॉलेट में पैसे जोड़कर फिर से कोशिश करें।",
  );
  assert.equal(
    translateServerText("Withdrawal amount exceeds your available balance of Rs. 1500.00."),
    "निकासी राशि आपके उपलब्ध बैलेंस रु. 1500.00 से ज़्यादा है।",
  );
  assert.equal(translateServerText("Lokesh Sharma has confirmed your booking."), "Lokesh Sharma ने आपकी बुकिंग पक्की कर दी है।");
});

test("unknown or non-text server messages pass through", () => {
  setCurrentLanguage("hi");
  assert.equal(translateServerText("Some brand new error"), "Some brand new error");
  assert.equal(translateServerText(""), "");
  assert.equal(translateServerText(null), null);
  const err = { code: "X" };
  assert.equal(translateServerText(err), err);
});

test("every server pattern is a valid, anchored regex with Hindi output", () => {
  for (const [pattern, replacement] of HI_SERVER_PATTERNS) {
    assert.ok(pattern instanceof RegExp);
    assert.ok(pattern.source.startsWith("^") && pattern.source.endsWith("$"), pattern.source);
    assert.match(replacement, /[ऀ-ॿ]/);
  }
});

// ---------------------------------------------------------------------
// Saved choice and admin
// ---------------------------------------------------------------------

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}
const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };

test("language choice is remembered", () => {
  const storage = memoryStorage();
  assert.equal(readStoredLanguage(storage), "en");
  storeLanguage(storage, "hi");
  assert.equal(storage.data[LANGUAGE_STORAGE_KEY], "hi");
  assert.equal(readStoredLanguage(storage), "hi");
});

test("bad saved value or blocked storage falls back to English", () => {
  assert.equal(readStoredLanguage(memoryStorage({ [LANGUAGE_STORAGE_KEY]: "xx" })), "en");
  assert.equal(readStoredLanguage(blocked), "en");
  assert.equal(readStoredLanguage(null), "en");
  assert.doesNotThrow(() => storeLanguage(blocked, "hi"));
});

test("admin portal is English-only, everything else can switch", () => {
  for (const path of ["/admin", "/admin/", "/admin/dashboard", "/admin/wallet?tab=earnings"]) assert.equal(isEnglishOnlyPath(path), true, path);
  for (const path of ["/", "/book", "/dashboard", "/pandit/wallet", "/administrator", "/book/admin"]) assert.equal(isEnglishOnlyPath(path), false, path);
});

test("admin pages do not use translations", () => {
  const offenders = sourceFiles().filter(isAdminFile).filter((f) => /from ["'][./]*i18n["']/.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders.map(rel), []);
});

// ---------------------------------------------------------------------
// Dictionary coverage
// ---------------------------------------------------------------------

test("every text the app translates has a Hindi entry", () => {
  const missing = [];
  for (const file of sourceFiles()) {
    if (isAdminFile(file) || rel(file).startsWith("i18n/")) continue;
    for (const key of extractKeys(readFileSync(file, "utf8"))) {
      if (!/[A-Za-z]{2}/.test(key)) continue; // symbols / numbers only
      if (!Object.prototype.hasOwnProperty.call(HI, key)) missing.push(`${rel(file)}: ${key}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("Hindi entries keep the same {placeholders} as the English", () => {
  const wrong = Object.entries(HI).filter(([en, hi]) => placeholders(en).join() !== placeholders(hi).join());
  assert.deepEqual(wrong, []);
});

test("Hindi entries are Hindi (or intentionally the same brand/format text)", () => {
  const SAME_ALLOWED = /^(MyYajmaan|Razorpay|WhatsApp|Facebook|Instagram|LinkedIn|YouTube|Threads|X \(Twitter\)|UPI ID|XXXX XXXX XXXX|yourname@upi|name@example\.com|support@myyajmaan\.com)$/;
  const notHindi = Object.entries(HI).filter(([en, hi]) => hi !== "" && !/[ऀ-ॿ]/.test(hi) && !SAME_ALLOWED.test(en));
  assert.deepEqual(notHindi, []);
});

test("server message dictionary is Hindi", () => {
  const notHindi = Object.entries(HI_SERVER_EXACT).filter(([, hi]) => !/[ऀ-ॿ]/.test(hi));
  assert.deepEqual(notHindi, []);
});

// ---------------------------------------------------------------------
// Key extraction (used by the coverage test above)
// ---------------------------------------------------------------------

test("extractKeys finds literal keys, both ?: branches, and skips look-alikes", () => {
  const src = `
    t("One")
    tt('Two', { a: 1 })
    t(count === 1 ? "View {count} coupon" : "View {count} coupons", { count })
    t(item.label)
    split("x"); format("y"); obj.t("z")
    t("Say \\"hi\\"")
  `;
  assert.deepEqual([...extractKeys(src)].sort(), ["One", 'Say "hi"', "Two", "View {count} coupon", "View {count} coupons"].sort());
});
