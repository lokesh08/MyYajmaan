export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key',
};

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function getSupabaseClient() {
  return {
    url: supabaseConfig.url,
    anonKey: supabaseConfig.anonKey,
  };
}
