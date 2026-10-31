// Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REFERRAL_STORAGE_KEY,
  buildReferralLink,
  buildReferralShareText,
  clearStoredReferralCode,
  normalizeReferralCode,
  resolveReferralCode,
} from "./referral.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const blockedStorage = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
};

test("normalizeReferralCode trims, upper-cases and rejects junk", () => {
  assert.equal(normalizeReferralCode("  asmitashar8139 "), "ASMITASHAR8139");
  assert.equal(normalizeReferralCode(""), "");
  assert.equal(normalizeReferralCode(null), "");
  assert.equal(normalizeReferralCode("—"), "");
  assert.equal(normalizeReferralCode("<script>"), "");
  assert.equal(normalizeReferralCode("AB"), "");
});

test("buildReferralLink points at the register page with the code", () => {
  assert.equal(
    buildReferralLink("ASMITASHAR8139", "https://www.myyajmaan.com"),
    "https://www.myyajmaan.com/register?ref=ASMITASHAR8139",
  );
  assert.equal(buildReferralLink("abc123", "http://localhost:3000/"), "http://localhost:3000/register?ref=ABC123");
});

test("buildReferralLink gives nothing to share without a real code", () => {
  assert.equal(buildReferralLink("", "https://www.myyajmaan.com"), "");
  assert.equal(buildReferralLink("—", "https://www.myyajmaan.com"), "");
  assert.equal(buildReferralLink("ABC123", ""), "");
});

test("share text contains the full link and the code", () => {
  const link = "https://www.myyajmaan.com/register?ref=ABC123";
  const text = buildReferralShareText("ABC123", link);
  assert.ok(text.includes(link));
  assert.ok(text.includes("ABC123"));
});

test("resolveReferralCode prefers the URL and remembers it", () => {
  const storage = memoryStorage();
  assert.equal(resolveReferralCode("abc123", storage), "ABC123");
  assert.equal(storage.data[REFERRAL_STORAGE_KEY], "ABC123");
});

test("resolveReferralCode falls back to the remembered code", () => {
  const storage = memoryStorage({ [REFERRAL_STORAGE_KEY]: "ABC123" });
  assert.equal(resolveReferralCode(null, storage), "ABC123");
  assert.equal(resolveReferralCode("", storage), "ABC123");
});

test("a new link replaces an older remembered code", () => {
  const storage = memoryStorage({ [REFERRAL_STORAGE_KEY]: "OLD111" });
  assert.equal(resolveReferralCode("NEW222", storage), "NEW222");
  assert.equal(storage.data[REFERRAL_STORAGE_KEY], "NEW222");
});

test("no code anywhere means no referral", () => {
  assert.equal(resolveReferralCode(null, memoryStorage()), "");
  assert.equal(resolveReferralCode(null, null), "");
});

test("blocked storage never breaks the register page", () => {
  assert.equal(resolveReferralCode("ABC123", blockedStorage), "ABC123");
  assert.equal(resolveReferralCode(null, blockedStorage), "");
  assert.doesNotThrow(() => clearStoredReferralCode(blockedStorage));
});

test("clearStoredReferralCode forgets the code after sign-up", () => {
  const storage = memoryStorage({ [REFERRAL_STORAGE_KEY]: "ABC123" });
  clearStoredReferralCode(storage);
  assert.equal(resolveReferralCode(null, storage), "");
});
