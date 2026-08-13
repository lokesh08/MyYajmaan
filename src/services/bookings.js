import { isConfigured, createBookingRecord } from './supabaseClient';
import { getServiceMode, requestJson } from './apiClient';

export async function createBooking(
  {
    userId = 1,
    pujaId = 1,
    packageId = null,
    panditId,
    date,
    timeslot,
    amount,
    paymentRef,
  },
  { signal } = {} // optional { signal: AbortSignal }
) {
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

  // Try API mode
  if (serviceMode === 'api') {
    try {
      // requestJson (axios wrapper) accepts body as object and optional signal
      return await requestJson('/bookings', {
        method: 'POST',
        body: booking,
        signal,
      });
    } catch (err) {
      // If caller aborted the request, rethrow so caller can handle it
      if (err?.name === 'CanceledError' || err?.isCanceled) {
        throw err;
      }
      console.warn('API createBooking failed, falling back to other modes', err);
    }
  }

  // Try Supabase mode (if configured)
  if (serviceMode === 'supabase' && isConfigured) {
    try {
      const record = await createBookingRecord(booking);
      return record;
    } catch (err) {
      console.warn('Supabase createBooking failed, falling back to mock', err);
    }
  }

  // Fallback mock booking (simulate slight delay)
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