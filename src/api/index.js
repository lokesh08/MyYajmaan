import api from "./axiosClient";

function normalizeAxiosError(error) {
  if (
    error?.code === "ERR_CANCELED" ||
    error?.name === "CanceledError"
  ) {
    const canceled = new Error("Request canceled");
    canceled.name = "CanceledError";
    canceled.isCanceled = true;
    return canceled;
  }

  const status = error?.response?.status;
  const responseData = error?.response?.data;
  const detail = responseData?.detail;

  let code = "REQUEST_FAILED";
  let message = "Something went wrong. Please try again.";

  if (typeof detail === "object" && detail) {
    code = detail.code || code;
    message = detail.message || message;
  } else if (typeof detail === "string") {
    message = detail;
  } else if (responseData?.message) {
    message = responseData.message;
  } else if (error?.message) {
    message = error.message;
  }

  const normalizedError = new Error(message);
  normalizedError.status = status;
  normalizedError.code = code;
  normalizedError.data = responseData;

  return normalizedError;
}

export async function get(url, config = {}) {
  try {
    const response = await api.get(url, config);
    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error);
  }
}

export async function post(url, payload = {}, config = {}) {
  try {
    const response = await api.post(url, payload, config);
    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error);
  }
}

export async function put(url, payload = {}, config = {}) {
  try {
    const response = await api.put(url, payload, config);
    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error);
  }
}

export async function patch(url, payload = {}, config = {}) {
  try {
    const response = await api.patch(url, payload, config);
    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error);
  }
}

export async function del(url, config = {}) {
  try {
    const response = await api.delete(url, config);
    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error);
  }
}

export async function postForm(url, formData, config = {}) {
  try {
    // Content-Type: undefined overrides axiosClient's default
    // "application/json" so the browser sets multipart/form-data with
    // the correct boundary itself -- hardcoding that header here (with
    // no boundary) would break the server's multipart parsing.
    const response = await api.post(url, formData, {
      ...config,
      headers: { ...(config.headers || {}), "Content-Type": undefined },
    });
    return response.data;
  } catch (error) {
    throw normalizeAxiosError(error);
  }
}

export function withAbortGet(url, config = {}) {
  const controller = new AbortController();

  return {
    controller,
    promise: get(url, {
      ...config,
      signal: controller.signal,
    }),
  };
}

export function withAbortPost(
  url,
  payload = {},
  config = {},
) {
  const controller = new AbortController();

  return {
    controller,
    promise: post(url, payload, {
      ...config,
      signal: controller.signal,
    }),
  };
}

export function withAbortPut(
  url,
  payload = {},
  config = {},
) {
  const controller = new AbortController();

  return {
    controller,
    promise: put(url, payload, {
      ...config,
      signal: controller.signal,
    }),
  };
}

export function withAbortDelete(url, config = {}) {
  const controller = new AbortController();

  return {
    controller,
    promise: del(url, {
      ...config,
      signal: controller.signal,
    }),
  };
}

export default {
  get,
  post,
  put,
  patch,
  del,
  postForm,
  withAbortGet,
  withAbortPost,
  withAbortPut,
  withAbortDelete,
};