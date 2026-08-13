// src/utils/analytics.js
export function sendAnalytics(eventName, payload = {}) {
  // Example: push to dataLayer if GA/Tag Manager is present
  if (window.dataLayer && typeof window.dataLayer.push === 'function') {
    window.dataLayer.push({ event: eventName, ...payload });
  } else {
    // Debug log fallback
    console.debug('Analytics event', eventName, payload);
  }
}

// In production you may replace this with your actual analytics integration