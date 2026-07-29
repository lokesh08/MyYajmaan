const STORAGE_KEY = 'myyajmaan.serviceMode';
export const SERVICE_MODES = ['mock', 'api', 'supabase'];

function resolveConfiguredMode() {
  const isSupabaseEnabled = import.meta.env.VITE_USE_SUPABASE === 'true';
  const hasApiBaseUrl = Boolean(import.meta.env.VITE_API_BASE_URL || '');

  if (isSupabaseEnabled) return 'supabase';
  if (hasApiBaseUrl) return 'api';
  return 'mock';
}

export function getConfiguredServiceMode() {
  return resolveConfiguredMode();
}

export function getServiceMode() {
  if (typeof window === 'undefined') {
    return getConfiguredServiceMode();
  }

  const storedMode = window.localStorage.getItem(STORAGE_KEY);
  if (storedMode && SERVICE_MODES.includes(storedMode)) {
    return storedMode;
  }

  return getConfiguredServiceMode();
}

export function setServiceMode(mode) {
  if (!SERVICE_MODES.includes(mode)) {
    return false;
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }

  return true;
}

export function resetServiceMode() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function getServiceModeLabel(mode = getServiceMode()) {
  const labels = {
    mock: 'Mock',
    api: 'API',
    supabase: 'Supabase',
  };

  return labels[mode] || 'Mock';
}

export async function requestJson(path, options = {}) {
  const mode = getServiceMode();
  if (mode !== 'api') {
    throw new Error(`API requests are unavailable while service mode is ${mode}`);
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}
