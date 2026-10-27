import { isConfigured, fetchPandits as fetchPanditsFromSupabase } from './supabaseClient';
import { getServiceMode, requestJson } from './apiClient';

// pincode isn't used as a filter -- a pandit's registered pincode is a
// single point, not a service radius, so exact matching would almost
// always return nobody. City is the reliable signal; pincode is only
// ever shown to the customer as information (see SelectPandit.jsx).
export async function fetchAvailablePandits(pujaId, date, timeslot, { city, signal } = {}) {
  const serviceMode = getServiceMode();

  // If API mode, call requestJson with params and optional signal
  if (serviceMode === 'api') {
    try {
      const payload = await requestJson('/pandits', {
        method: 'GET',
        // Backend query param is puja_id (snake_case), not pujaId --
        // this mismatch previously meant the real API path silently
        // ignored which puja was selected.
        params: { puja_id: pujaId, date, timeslot, city: city || undefined },
        signal,
      });

      // Normalize response shape as before
      const pandits = Array.isArray(payload?.pandits)
        ? payload.pandits
        : Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload)
        ? payload
        : [];

      return { date, timeslot, pandits };
    } catch (err) {
      // Rethrow canceled requests so callers can ignore during cleanup
      if (err?.name === 'CanceledError' || err?.isCanceled) {
        throw err;
      }
      console.warn('API pandits failed, falling back to mock', err);
      return fetchAvailablePanditsMock(pujaId, date, timeslot);
    }
  }

  // Supabase mode fallback
  if (serviceMode === 'supabase' && isConfigured) {
    try {
      const rows = await fetchPanditsFromSupabase(pujaId, date, timeslot, city);
      return { date, timeslot, pandits: Array.isArray(rows) ? rows : [] };
    } catch (err) {
      console.warn('Supabase pandits failed, falling back to mock', err);
      return fetchAvailablePanditsMock(pujaId, date, timeslot);
    }
  }

  // Default: mock
  return fetchAvailablePanditsMock(pujaId, date, timeslot);
}

function fetchAvailablePanditsMock(pujaId, date, timeslot) {
  const pandits = [
    { id: 1, name: 'Pandit Rajesh Sharma', languages: ['Hindi', 'English'], experience: 12, rating: 4.9, price: 2100, distanceKm: 2.1 },
    { id: 2, name: 'Pandit Vivek Mishra', languages: ['Hindi'], experience: 9, rating: 4.8, price: 1800, distanceKm: 4.3 },
    { id: 3, name: 'Pandit Dinesh Pathak', languages: ['Hindi', 'Sanskrit'], experience: 15, rating: 4.7, price: 2500, distanceKm: 6.8 },
    { id: 4, name: 'Pandit Gaurav Joshi', languages: ['Hindi', 'English'], experience: 7, rating: 4.6, price: 1600, distanceKm: 1.2 },
  ];

  return new Promise((resolve) => {
    setTimeout(() => resolve({ date, timeslot, pandits }), 300);
  });
}