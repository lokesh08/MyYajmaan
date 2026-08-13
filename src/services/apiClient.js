// adjust the import path to where your axios instance lives in your project
import api from '../api/axiosClient'; 
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

  // options supported:
  // { method, headers, body, params, signal, timeout }
  const {
    method = 'GET',
    headers = {},
    body,
    params,
    signal,
    timeout,
    // any other axios config can be passed through via options.extraConfig
    extraConfig = {},
  } = options;

  // Build axios request config. Use the axios instance's baseURL (configured in axiosClient).
  const axiosConfig = {
    url: path,               // relative path; axios instance baseURL will be applied
    method: method.toLowerCase(),
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    params: params || undefined,
    timeout: timeout || undefined,
    signal: signal || undefined, // AbortController.signal
    ...extraConfig,
  };

  // Attach body for non-GET methods. Axios will JSON.stringify automatically for objects.
  if (body !== undefined && method.toUpperCase() !== 'GET') {
    axiosConfig.data = body;
  }

  try {
    const resp = await api.request(axiosConfig);
    return resp.data;
  } catch (err) {
    // normalize axios error:
    // - canceled requests have code 'ERR_CANCELED' (axios v1+)
    if (err?.code === 'ERR_CANCELED') {
      const canceled = new Error('Request canceled');
      canceled.name = 'CanceledError';
      canceled.isCanceled = true;
      throw canceled;
    }

    // HTTP error response
    const status = err?.response?.status;
    const data = err?.response?.data;
    const message = data?.message || err.message || `Request failed${status ? `: ${status}` : ''}`;

    const error = new Error(message);
    error.status = status;
    error.data = data;
    throw error;
  }
}
