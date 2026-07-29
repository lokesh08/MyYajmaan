import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let isConfigured = false;

if (url && anonKey) {
  try {
    supabase = createClient(url, anonKey);
    isConfigured = true;
  } catch (e) {
    console.warn('Supabase client init failed', e);
  }
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

export async function fetchPandits(pujaId, date, timeslot) {
  if (!isConfigured || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('pandits').select('*').eq('approved', true).limit(50);
  if (error) throw error;
  return data;
}

export async function fetchAvailability(pujaId, date) {
  if (!isConfigured || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.from('availability').select('*').eq('puja_id', pujaId).eq('date', date);
  if (error) throw error;
  return data;
}

export { isConfigured };
