import { isConfigured, fetchAvailability as fetchAvailabilityFromSupabase } from './supabaseClient';
import { getServiceMode, requestJson } from './apiClient';

export function getAvailability(pujaId, date) {
  const serviceMode = getServiceMode();

  if (serviceMode === 'api') {
    return requestJson(`/availability?pujaId=${pujaId}&date=${date}`)
      .then((payload) => {
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
      })
      .catch((err) => {
        console.warn('API availability failed, falling back to mock', err);
        return getAvailabilityMock(pujaId, date);
      });
  }

  if (serviceMode === 'supabase' && isConfigured) {
    return fetchAvailabilityFromSupabase(pujaId, date).then((rows) => {
      const slots = { morning: [], afternoon: [], evening: [] };
      rows.forEach((r) => {
        const group = r.group || 'morning';
        slots[group] = slots[group] || [];
        slots[group].push({ id: r.id || r.timeslot, time: r.time || r.timeslot, available: r.available ?? true, shubh: r.shubh ?? false });
      });
      return { date, pujaId, slots };
    });
  }

  return getAvailabilityMock(pujaId, date);
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
