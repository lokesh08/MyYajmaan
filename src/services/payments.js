import { isConfigured, createPaymentSessionRecord } from './supabaseClient';
import { getServiceMode, requestJson } from './apiClient';

export async function initiatePayment(
  { amount, currency = 'INR', method = 'upi' },
  { signal } = {} // optional { signal: AbortSignal }
) {
  const serviceMode = getServiceMode();

  // Try API mode first
  if (serviceMode === 'api') {
    try {
      const payload = await requestJson('/payments/initiate', {
        method: 'POST',
        body: { amount, currency, method },
        signal,
      });
      return payload;
    } catch (err) {
      // Rethrow canceled requests so callers can handle aborts
      if (err?.name === 'CanceledError' || err?.isCanceled) {
        throw err;
      }
      console.warn('API payment initiation failed, falling back to mock/supabase', err);
    }
  }

  // Supabase fallback (if configured)
  if (serviceMode === 'supabase' && isConfigured) {
    try {
      const paymentSession = {
        session_id: `ps_${Date.now()}`,
        amount,
        currency,
        method,
        status: 'initialized',
        created_at: new Date().toISOString(),
      };
      const record = await createPaymentSessionRecord(paymentSession);
      return record;
    } catch (err) {
      console.warn('Supabase payment session save failed, falling back to mock', err);
    }
  }

  // Mock fallback
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          sessionId: `ps_${Date.now()}`,
          amount,
          currency,
          method,
          status: 'initialized',
        }),
      300
    );
  });
}

export async function verifyPayment(sessionId, { signal } = {}) {
  const serviceMode = getServiceMode();

  // Try API mode
  if (serviceMode === 'api') {
    try {
      // expecting server endpoint to verify session by id
      const payload = await requestJson('/payments/verify', {
        method: 'GET',
        params: { sessionId },
        signal,
      });
      return payload;
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.isCanceled) {
        throw err;
      }
      console.warn('API payment verification failed, falling back to mock', err);
    }
  }

  // Supabase mode: if you have a verification stored in Supabase, add logic here.
  // For now, fall back to mock behavior (simulated verification).
  return new Promise((resolve) => {
    setTimeout(() => resolve({ sessionId, status: 'success', paidAt: new Date().toISOString() }), 500);
  });
}