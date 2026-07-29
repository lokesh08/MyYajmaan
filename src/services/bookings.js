import { isConfigured, createBookingRecord } from './supabaseClient';
import { getServiceMode, requestJson } from './apiClient';

export async function createBooking({ userId = 1, pujaId = 1, packageId = null, panditId, date, timeslot, amount, paymentRef }) {
  const serviceMode = getServiceMode();
  const booking = {
    user_id: userId,
    puja_id: pujaId,
    package_id: packageId,
    pandit_id: panditId,
    date,
    timeslot,
    amount,
    payment_ref: paymentRef,
    status: 'confirmed',
  };

  if (serviceMode === 'api') {
    try {
      return await requestJson('/bookings', {
        method: 'POST',
        body: JSON.stringify(booking),
      });
    } catch (err) {
      console.warn('API createBooking failed, falling back to mock', err);
    }
  }

  if (serviceMode === 'supabase' && isConfigured) {
    try {
      const record = await createBookingRecord(booking);
      return record;
    } catch (err) {
      console.warn('Supabase createBooking failed, falling back to mock', err);
    }
  }

  const fallback = {
    id: `BKG${Date.now()}`,
    userId,
    pujaId,
    packageId,
    panditId,
    date,
    timeslot,
    amount,
    paymentRef,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  return new Promise((resolve) => setTimeout(() => resolve(fallback), 300));
}
