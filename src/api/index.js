// src/api/index.js
import api from './axiosClient';

/**
 * Thin wrapper around axios instance to always return response.data
 * and to accept AbortSignal for cancellation.
 *
 * Each method accepts an optional config object that can contain:
 * - signal: AbortSignal (from AbortController)
 * - any other axios request config (params, headers, etc)
 *
 * Also exports withAbort* helpers that automatically create an AbortController
 * and return { promise, controller } so components can easily abort.
 */

function normalizeAxiosError(error) {
  // axios v1 uses CanceledError (error.code === 'ERR_CANCELED')
  if (error?.code === 'ERR_CANCELED') {
    const canceled = new Error('Request canceled');
    canceled.name = 'CanceledError';
    canceled.isCanceled = true;
    return canceled;
  }

  if (error.response) {
    const { status, data } = error.response;
    const message = data?.message || error.message || 'Request failed';
    const err = new Error(message);
    err.status = status;
    err.data = data;
    return err;
  }
  const err = new Error(error.message || 'Network error');
  err.status = null;
  err.data = null;
  return err;
}

export async function get(url, config = {}) {
  try {
    const resp = await api.get(url, config);
    return resp.data;
  } catch (e) {
    throw normalizeAxiosError(e);
  }
}

export async function post(url, payload = {}, config = {}) {
  try {
    const resp = await api.post(url, payload, config);
    return resp.data;
  } catch (e) {
    throw normalizeAxiosError(e);
  }
}

export async function put(url, payload = {}, config = {}) {
  try {
    const resp = await api.put(url, payload, config);
    return resp.data;
  } catch (e) {
    throw normalizeAxiosError(e);
  }
}

export async function del(url, config = {}) {
  try {
    const resp = await api.delete(url, config);
    return resp.data;
  } catch (e) {
    throw normalizeAxiosError(e);
  }
}

export async function postForm(url, formData, config = {}) {
  const cfg = {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config,
  };
  try {
    const resp = await api.post(url, formData, cfg);
    return resp.data;
  } catch (e) {
    throw normalizeAxiosError(e);
  }
}

/**
 * Convenience helper: create an AbortController and return { promise, controller }.
 * Use like:
 *   const { promise, controller } = withAbortGet('/referral');
 *   promise.then(...).catch(...);
 *   // on cleanup: controller.abort();
 */
export function withAbortGet(url, config = {}) {
  const controller = new AbortController();
  const promise = get(url, { ...config, signal: controller.signal });
  return { promise, controller };
}
export function withAbortPost(url, payload = {}, config = {}) {
  const controller = new AbortController();
  const promise = post(url, payload, { ...config, signal: controller.signal });
  return { promise, controller };
}
export function withAbortPut(url, payload = {}, config = {}) {
  const controller = new AbortController();
  const promise = put(url, payload, { ...config, signal: controller.signal });
  return { promise, controller };
}
export function withAbortDelete(url, config = {}) {
  const controller = new AbortController();
  const promise = del(url, { ...config, signal: controller.signal });
  return { promise, controller };
}
export function withAbortPostForm(url, formData, config = {}) {
  const controller = new AbortController();
  const promise = postForm(url, formData, { ...config, signal: controller.signal });
  return { promise, controller };
}

export default {
  get,
  post,
  put,
  del,
  postForm,
  withAbortGet,
  withAbortPost,
  withAbortPut,
  withAbortDelete,
  withAbortPostForm,
};