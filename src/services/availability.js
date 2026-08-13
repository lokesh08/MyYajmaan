import { isConfigured, fetchAvailability as fetchAvailabilityFromSupabase } from './supabaseClient';
import { getServiceMode, requestJson } from './apiClient';

export async function getAvailability(pujaId, date, { signal } = {}) {
  const serviceMode = getServiceMode();

  // If not in 'api' mode, use mock immediately
  if (serviceMode !== 'api') {
    return getAvailabilityMock(pujaId, date);
  }

  try {
    // Call requestJson via axios wrapper; pass params and optional signal for cancellation
    const payload = await requestJson('/availability', {
      method: 'GET',
      params: { pujaId, date },
      signal, // AbortController.signal (optional)
    });

    // Normalize payload to rows array (original behavior)
    const rows = Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload) ? payload : [];
    const slots = { morning: [], afternoon: [], evening: [] };

    rows.forEach((r) => {
      const group = r.group || r.category || 'morning';
      slots[group] = slots[group] || [];
      slots[group].push({
        id: r.id || r.timeslot || `${group}-${r.time}`,
        time: r.time || r.timeslot,
        available: r.available ?? true,
        shubh: r.shubh ?? false,
      });
    });

    return { date, pujaId, slots };
  } catch (err) {
    // If request was cancelled, rethrow so caller can handle cleanup
    if (err?.name === 'CanceledError' || err?.isCanceled) {
      throw err;
    }

    // Otherwise log and fall back to mock (preserve previous behaviour)
    console.warn('API availability failed, falling back to mock', err);
    return getAvailabilityMock(pujaId, date);
  }
}

function getAvailabilityMock(pujaId, date) {
  const slots = {
    morning: [
      { id: 'm1', time: '06:00 AM', available: true, shubh: false },
      { id: 'm2', time: '07:00 AM', available: true, shubh: true },
      { id: 'm3', time: '08:00 AM', available: false, shubh: false },
    ],
    afternoon: [
      { id: 'a1', time: '12:00 PM', available: true, shubh: false },
      { id: 'a2', time: '01:00 PM', available: true, shubh: false },
    ],
    evening: [
      { id: 'e1', time: '06:00 PM', available: true, shubh: false },
      { id: 'e2', time: '07:00 PM', available: true, shubh: true },
      { id: 'e3', time: '08:00 PM', available: true, shubh: false },
    ],
  };

  return new Promise((resolve) => {
    setTimeout(() => resolve({ date, pujaId, slots }), 300);
  });
}
