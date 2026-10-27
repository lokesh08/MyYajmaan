// src/utils/validation.js

// Remove HTML tags and trim whitespace.
// Keeps basic punctuation but strips any tags like <script> etc.
export function sanitizeInput(value) {
  if (value == null) return value;
  // Convert to string and remove tags
  const s = String(value);
  // Remove any HTML tags
  const withoutTags = s.replace(/<[^>]*>?/gm, '');
  // Replace uncommon control chars
  const cleaned = withoutTags.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  return cleaned;
}

// Basic email validation (simple and pragmatic)
export function isValidEmail(email) {
  if (!email) return false;
  const e = String(email).trim();
  // simple RFC-ish regex (covers normal emails)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(e);
}

// Phone validation: allow leading +, digits, spaces, hyphens, but enforce 7-15 digits total
export function isValidPhone(phone) {
  if (!phone) return false;
  const s = String(phone).trim();
  // remove non-digit characters except leading +
  const digits = s.replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

// Name validation: allow unicode letters, spaces, hyphen and apostrophe.
// No digits or other punctuation.
export function isValidName(name) {
  if (!name) return false;
  const s = String(name).trim();
  // Unicode letter classes \p{L}, allow spaces, hyphen, apostrophe
  // Use 'u' flag for Unicode property escapes
  const re = /^[\p{L}\s'\-]+$/u;
  return re.test(s) && s.length >= 2 && s.length <= 80;
}

// Generic validate function
// fields: { fieldName: value, ... }
// rules: { fieldName: { required: bool, type: 'email'|'phone'|'name'|'string', min, max, custom: fn } }
// returns: { valid: bool, errors: { fieldName: 'error message' } }
export function validate(fields = {}, rules = {}) {
  const errors = {};
  for (const [k, rule] of Object.entries(rules)) {
    const raw = fields[k];
    const value = raw == null ? '' : String(raw).trim();

    if (rule.required && !value) {
      errors[k] = rule.message || 'This field is required';
      continue;
    }
    if (!value) continue; // skip further checks when empty and not required

    if (rule.type === 'email' && !isValidEmail(value)) {
      errors[k] = rule.message || 'Enter a valid email';
      continue;
    }
    if (rule.type === 'phone' && !isValidPhone(value)) {
      errors[k] = rule.message || 'Enter a valid phone number';
      continue;
    }
    if (rule.type === 'name' && !isValidName(value)) {
      errors[k] = rule.message || 'Name can only contain letters, spaces, hyphen or apostrophe';
      continue;
    }
    if (rule.min && value.length < rule.min) {
      errors[k] = rule.message || `Minimum ${rule.min} characters required`;
      continue;
    }
    if (rule.max && value.length > rule.max) {
      errors[k] = rule.message || `Maximum ${rule.max} characters allowed`;
      continue;
    }
    if (typeof rule.custom === 'function') {
      const customResult = rule.custom(value, fields);
      if (customResult !== true) {
        errors[k] = typeof customResult === 'string' ? customResult : rule.message || 'Invalid value';
      }
    }
  } // end for
  return { valid: Object.keys(errors).length === 0, errors };
}