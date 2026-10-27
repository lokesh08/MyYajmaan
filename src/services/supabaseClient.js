import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let isConfigured = false;

// A password-recovery email link can redirect back to any page (the
// Supabase project's configured Site URL, not necessarily
// /reset-password -- see App.jsx), and supabase-js consumes and
// strips the token hash from the URL as soon as this client is
// created, which can happen before any component has mounted to
// notice. Registering this listener right here, at module load, is
// the earliest possible point -- so it can't miss the event no
// matter which page happens to be rendering when the link is opened.
let recoveryDetected = false;
let recoveryListeners = [];

function notifyRecoverySession() {
  recoveryDetected = true;
  const listeners = recoveryListeners;
  recoveryListeners = [];
  listeners.forEach((callback) => callback());
}

if (url && anonKey) {
  try {
    supabase = createClient(url, anonKey);
    isConfigured = true;
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        notifyRecoverySession();
      }
    });
  } catch (e) {
    console.warn('Supabase client init failed', e);
  }
}

export function isRecoverySession() {
  return recoveryDetected;
}

// PASSWORD_RECOVERY fires asynchronously (supabase-js has to process
// the URL token before it knows), so a one-time mount check can race
// it and miss the event entirely. This calls back immediately if the
// event already happened, or later, whichever comes first -- callers
// don't have to guess which case they're in.
export function onRecoverySession(callback) {
  if (recoveryDetected) {
    callback();
    return () => {};
  }
  recoveryListeners.push(callback);
  return () => {
    recoveryListeners = recoveryListeners.filter((cb) => cb !== callback);
  };
}

export async function createBookingRecord(booking) {
  if (!isConfigured || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('bookings').insert([booking]).select().single();
  if (error) throw error;
  return data;
}

export async function createPaymentSessionRecord(paymentSession) {
  if (!isConfigured || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('payment_sessions').insert([paymentSession]).select().single();
  if (error) throw error;
  return data;
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// '07:00 AM' -> '07:00' -- same 12h format BookDateTime.jsx renders;
// ported alongside the equivalent Python helper in routers/pandits.py
// since this path talks to Supabase directly and never goes through
// that backend.
function parseSlotTo24h(timeslot) {
  if (!timeslot) return null;
  const match = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(timeslot);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function panditMatchesCity(pandit, city) {
  const cityLower = city.trim().toLowerCase();
  const serviceAreas = pandit.service_areas || [];
  if (serviceAreas.length > 0) {
    return serviceAreas.some((area) => (area || '').trim().toLowerCase() === cityLower);
  }
  // No service areas declared yet -- fall back to the pandit's own
  // registered city rather than excluding them (mirrors the "empty
  // list = unrestricted" rule already used for coupons).
  return (pandit.city || '').trim().toLowerCase() === cityLower;
}

function panditMatchesAvailability(pandit, weekdayKey, slot24h) {
  const pattern = pandit.availability_pattern || {};
  const { days, start_time: startTime, end_time: endTime } = pattern;
  if (!days || !days.length || !startTime || !endTime) return true; // no pattern set yet -- treat as available
  if (weekdayKey && !days.includes(weekdayKey)) return false;
  if (slot24h && !(startTime <= slot24h && slot24h < endTime)) return false;
  return true;
}

// {pandit_id: {puja_id: price}} for every active pandit_puja row among
// the given pandits (or just pujaId, if given) -- price is
// price_override when set, else the puja's own base_price. Mirrors
// _resolve_pandit_prices in routers/pandits.py, since this talks to
// Supabase directly and never goes through that backend. Pandit Ji
// never set a general price themselves -- this is the only real
// source of what they actually charge.
async function resolvePanditPrices(panditIds, pujaId) {
  if (!panditIds.length) return {};
  let query = supabase.from('pandit_puja').select('pandit_id, puja_id, price_override').in('pandit_id', panditIds).eq('active', true);
  if (pujaId) query = query.eq('puja_id', pujaId);
  const { data: relations, error } = await query;
  if (error || !relations?.length) return {};

  const pujaIds = [...new Set(relations.map((row) => row.puja_id))];
  const { data: pujas } = await supabase.from('pujas').select('id, base_price').in('id', pujaIds);
  const basePriceByPuja = Object.fromEntries((pujas || []).map((p) => [p.id, p.base_price]));

  const pricesByPandit = {};
  for (const row of relations) {
    const price = row.price_override ?? basePriceByPuja[row.puja_id];
    if (price == null) continue;
    (pricesByPandit[row.pandit_id] ||= {})[row.puja_id] = Number(price);
  }
  return pricesByPandit;
}

export async function fetchPandits(pujaId, date, timeslot, city) {
  if (!isConfigured || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('pandits')
    .select('*')
    // Matches the real API's GET /pandits filter (routers/pandits.py) --
    // `approved` is a stale/legacy boolean column that's false for every
    // pandit in this app today; verification_status is the field the
    // admin approval flow actually sets.
    .eq('is_active', true)
    .eq('verification_status', 'approved')
    .limit(50);
  if (error) throw error;

  let rows = data || [];
  if (city) {
    rows = rows.filter((pandit) => panditMatchesCity(pandit, city));
  }
  if (date || timeslot) {
    let weekdayKey = null;
    if (date) {
      const parsed = new Date(`${date}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        weekdayKey = WEEKDAY_KEYS[(parsed.getDay() + 6) % 7]; // getDay(): 0=Sun -> shift so 0=Mon
      }
    }
    const slot24h = parseSlotTo24h(timeslot);
    rows = rows.filter((pandit) => panditMatchesAvailability(pandit, weekdayKey, slot24h));
  }

  const pricesByPandit = await resolvePanditPrices(rows.map((r) => r.id), pujaId);
  if (pujaId) {
    // Booking-flow context: only pandits who actually offer this puja
    // are selectable, priced at exactly what they charge for it.
    rows = rows.filter((pandit) => pricesByPandit[pandit.id]?.[pujaId] != null);
    rows.forEach((pandit) => { pandit.price = pricesByPandit[pandit.id][pujaId]; });
  } else {
    // Browse/homepage context: "starting from" the cheapest puja they
    // offer, or nothing shown if they haven't added any yet.
    rows.forEach((pandit) => {
      const pujaPrices = pricesByPandit[pandit.id];
      pandit.starting_price = pujaPrices ? Math.min(...Object.values(pujaPrices)) : null;
    });
  }

  return rows;
}

export async function fetchAvailability(pujaId, date) {
  if (!isConfigured || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('availability').select('*').eq('puja_id', pujaId).eq('date', date);
  if (error) throw error;
  return data;
}

export { isConfigured, supabase };
