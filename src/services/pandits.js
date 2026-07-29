import { isConfigured, fetchPandits as fetchPanditsFromSupabase } from './supabaseClient';
import { getServiceMode, requestJson } from './apiClient';

export function fetchAvailablePandits(pujaId, date, timeslot) {
  const serviceMode = getServiceMode();

  if (serviceMode === 'api') {
    return requestJson(`/pandits?pujaId=${pujaId}&date=${date}&timeslot=${encodeURIComponent(timeslot)}`)
      .then((payload) => {
        const pandits = Array.isArray(payload?.pandits) ? payload.pandits : Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload) ? payload : [];
        return { date, timeslot, pandits };
      })
      .catch((err) => {
        console.warn('API pandits failed, falling back to mock', err);
        return fetchAvailablePanditsMock(pujaId, date, timeslot);
      });
  }

  if (serviceMode === 'supabase' && isConfigured) {
    return fetchPanditsFromSupabase(pujaId, date, timeslot).then((rows) => ({ date, timeslot, pandits: rows }));
  }

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
