// src/api/axiosClient.js
import axios from "axios";

/**
 * Resolve baseURL for both Vite and CRA environments:
 * - Vite: import.meta.env.VITE_API_BASE_URL
 * - CRA / other: process.env.REACT_APP_API_BASE
 *
 * IMPORTANT: after changing .env, restart your dev server.
 */

let baseURL = "";

// Prefer Vite env (import.meta.env) when available
try {
  // import.meta is statically replaced by Vite; accessing in a try block avoids runtime errors in non-Vite envs
  // eslint-disable-next-line no-undef
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) {
    baseURL = import.meta.env.VITE_API_BASE_URL;
  }
} catch (e) {
  // ignore — not a Vite environment
}

// Fallback to CRA-style env var if baseURL still empty
if (!baseURL && typeof process !== "undefined" && process.env?.REACT_APP_API_BASE) {
  baseURL = process.env.REACT_APP_API_BASE;
}

// final fallback to VITE_API_BASE_URL via process.env (some setups expose VITE_ vars there)
if (!baseURL && typeof process !== "undefined" && process.env?.VITE_API_BASE_URL) {
  baseURL = process.env.VITE_API_BASE_URL;
}

console.log("API baseURL:", baseURL);

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// request & response interceptors (same as your original)
api.interceptors.request.use(
  (config) => {
    try {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {}
    return config;
  },
  (error) => Promise.reject(error)
);

// ... keep your existing response interceptor logic unchanged ...
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}
function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;

    if (error?.code === "ERR_CANCELED" || error?.message === "canceled") {
      return Promise.reject(error);
    }

    if (!error.response) {
      return Promise.reject(error);
    }

    if (error.response.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshToken = typeof window !== "undefined" ? window.localStorage.getItem("refreshToken") : null;
          if (!refreshToken) {
            isRefreshing = false;
            return Promise.reject(error);
          }

          const resp = await axios.post(`${baseURL || ""}/auth/refresh`, { refreshToken });

          const newAccessToken = resp?.data?.accessToken;
          const newRefreshToken = resp?.data?.refreshToken;

          if (newAccessToken) {
            if (typeof window !== "undefined") {
              window.localStorage.setItem("accessToken", newAccessToken);
              if (newRefreshToken) window.localStorage.setItem("refreshToken", newRefreshToken);
            }
            api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
            onRefreshed(newAccessToken);
          } else {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem("accessToken");
              window.localStorage.removeItem("refreshToken");
            }
          }
        } catch (refreshErr) {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem("accessToken");
            window.localStorage.removeItem("refreshToken");
          }
          return Promise.reject(refreshErr);
        } finally {
          isRefreshing = false;
        }
      }

      return new Promise((resolve) => {
        addRefreshSubscriber((token) => {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

export default api;