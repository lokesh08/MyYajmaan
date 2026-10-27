// src/utils/toaster.js
import { toast } from 'react-toastify';

// small config wrapper so we can change styling/behavior centrally
const DEFAULT_OPTIONS = {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

export function showSuccess(message, opts = {}) {
  toast.success(message, { ...DEFAULT_OPTIONS, ...opts });
}

export function showError(message, opts = {}) {
  toast.error(message, { ...DEFAULT_OPTIONS, ...opts });
}

export function showWarning(message, opts = {}) {
  toast.warning(message, { ...DEFAULT_OPTIONS, ...opts });
}

export function showInfo(message, opts = {}) {
  toast.info(message, { ...DEFAULT_OPTIONS, ...opts });
}