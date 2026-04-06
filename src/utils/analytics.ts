/**
 * Google Analytics 4 integration for Canopy Web.
 *
 * Set VITE_GA_MEASUREMENT_ID in your .env to enable.
 * When the env var is missing, all calls are no-ops — safe for local dev.
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let initialized = false;

/** Load the GA4 gtag.js script and configure the measurement ID. */
export function initGA() {
  if (initialized || !GA_ID) return;
  initialized = true;

  // Global dataLayer
  const w = window as unknown as Record<string, unknown>;
  w.dataLayer = (w.dataLayer as unknown[]) || [];

  // gtag helper
  function gtag(...args: unknown[]) {
    (w.dataLayer as unknown[]).push(args);
  }
  w.gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: false }); // we send page views manually on route change

  // Inject the script tag
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

/** Send a page_view event (call on every route change). */
export function trackPageView(path: string) {
  const w = window as unknown as Record<string, unknown>;
  if (!GA_ID || typeof w.gtag !== 'function') return;
  const gtagFn = w.gtag as (...args: unknown[]) => void;
  gtagFn('event', 'page_view', {
    page_path: path,
    page_title: document.title,
  });
}

/** Send a custom event. */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  const w = window as unknown as Record<string, unknown>;
  if (!GA_ID || typeof w.gtag !== 'function') return;
  const gtagFn = w.gtag as (...args: unknown[]) => void;
  gtagFn('event', eventName, params);
}
