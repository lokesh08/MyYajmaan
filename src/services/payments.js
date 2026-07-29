import { isConfigured, createPaymentSessionRecord } from './supabaseClient';
import { getServiceMode, requestJson } from './apiClient';

export async function initiatePayment({ amount, currency = 'INR', method = 'upi' }) {
  const serviceMode = getServiceMode();

  if (serviceMode === 'api') {
    try {
      const payload = await requestJson('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ amount, currency, method }),
      });
      return payload;
    } catch (err) {
      console.warn('API payment initiation failed, falling back to mock', err);
    }
  }

  if (serviceMode === 'supabase' && isConfigured) {
    try {
      const paymentSession = {
        session_id: `ps_${Date.now()}`,
        amount,
        currency,
        method,
        status: 'initialized',
      };
      const record = await createPaymentSessionRecord(paymentSession);
      return record;
    } catch (err) {
      console.warn('Supabase payment session save failed, falling back to mock', err);
    }
  }

  return new Promise((resolve) => {
    setTimeout(() => resolve({
      sessionId: `ps_${Date.now()}`,
      amount,
      currency,
      method,
      status: 'initialized',
    }), 300);
  });
}

export function verifyPayment(sessionId) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ sessionId, status: 'success', paidAt: new Date().toISOString() }), 500);
  });
}
