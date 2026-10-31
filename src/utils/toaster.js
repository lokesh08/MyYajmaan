// src/utils/toaster.js
import { toast } from 'react-toastify';
import { translateServerText } from '../i18n';

// small config wrapper so we can change styling/behavior centrally
const DEFAULT_OPTIONS = {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

// Messages from the server are English; in Hindi mode the common ones
// are shown in Hindi (see i18n/hiServer.js). Already-translated or
// unknown text passes through unchanged.
export function showSuccess(message, opts = {}) {
  toast.success(translateServerText(message), { ...DEFAULT_OPTIONS, ...opts });
}

export function showError(message, opts = {}) {
  toast.error(translateServerText(message), { ...DEFAULT_OPTIONS, ...opts });
}

export function showWarning(message, opts = {}) {
  toast.warning(translateServerText(message), { ...DEFAULT_OPTIONS, ...opts });
}

export function showInfo(message, opts = {}) {
  toast.info(translateServerText(message), { ...DEFAULT_OPTIONS, ...opts });
}