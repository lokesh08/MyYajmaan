import { optimizedImage } from '../utils/image';

// Stable local SVG illustration for the one spot a puja still needs a
// placeholder before the booking flow has a real puja object yet (see
// HomePage.jsx's handleSelectPandit). Every other puja/festival/pandit
// image in the app comes from the API (thumbnail_url/image_url/
// avatar_url/image_url), not a static local set.
export const pujaImages = {
  ganesh: '/images/puja-ganesh.svg',
};

export const bannerImages = {
  banner1: optimizedImage('/images/banners/banner1.png'),
  banner2: optimizedImage('/images/banners/banner2.png'),
  banner3: optimizedImage('/images/banners/banner3.png'),
  banner4: optimizedImage('/images/banners/banner4.png'),
};

export const authBackgrounds = {
  login: '/images/auth-login.svg',
  register: '/images/auth-register.svg',
};

export const bookingFallbackImage = '/images/booking-fallback.svg';

// Shown for any real (API-backed) pandit who hasn't uploaded a
// display picture (their passport photo, once approved) yet.
export const panditPlaceholderImage = optimizedImage('/images/panditPlaceholder.png');
