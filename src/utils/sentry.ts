/**
 * Sentry error tracking for Canopy Web.
 *
 * SETUP:
 *   1. npm install @sentry/react
 *   2. Set VITE_SENTRY_DSN in your .env
 *   3. initSentry() is called in main.tsx — that's it.
 *
 * When VITE_SENTRY_DSN is missing, everything is a no-op.
 */

import logger from '@/utils/logger';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

let sentryModule: typeof import('@sentry/react') | null = null;

export async function initSentry() {
  if (!SENTRY_DSN) return;

  try {
    sentryModule = await import('@sentry/react');
    sentryModule.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE, // 'development' | 'production'
      // Only send 20% of transactions in production to stay within quota
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
      // Ignore common noisy errors
      ignoreErrors: [
        'ResizeObserver loop',
        'Network request failed',
        'Load failed',
        'AbortError',
        'UnavailableError',           // PayPal Honey / browser extensions
        'Importing a module script',  // Stale chunks after deploy (handled by lazyRetry)
      ],
      // Ignore errors originating from browser extensions
      denyUrls: [
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
        /^safari-extension:\/\//i,
        /^moz-extension:\/\//i,
        /Honey\.safariextension/i,
        /PayPal/i,
      ],
      beforeSend(event) {
        // Strip PII from URLs (query params can contain tokens)
        if (event.request?.url) {
          try {
            const u = new URL(event.request.url);
            u.search = '';
            u.hash = '';
            event.request.url = u.toString();
          } catch { /* keep original */ }
        }
        return event;
      },
    });
  } catch {
    // @sentry/react not installed — graceful degradation
    logger.warn('[Sentry] @sentry/react not installed. Error tracking disabled.');
  }
}

/** Manually capture an exception (e.g., from catch blocks). */
export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (sentryModule) {
    sentryModule.captureException(error, context ? { extra: context } : undefined);
  }
}

/** Manually capture a message. */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (sentryModule) {
    sentryModule.captureMessage(message, level);
  }
}

/** Set user context (call after login). */
export function setUser(user: { id: string; email?: string; role?: string } | null) {
  if (sentryModule) {
    sentryModule.setUser(user);
  }
}
