/**
 * Production Logger Utility
 *
 * Provides a consistent logging interface that can be silenced in production.
 * In production (import.meta.env.PROD), only error and warn are output.
 * In development, all levels (debug, info, warn, error) are output.
 *
 * The `error` and `warn` methods sanitize their arguments to strip credentials,
 * bearer tokens, API keys, JWTs, and PII-ish fields before they hit the console
 * (and, via any attached transport like Sentry, before they leave the device).
 *
 * Usage:
 *   import logger from '@/utils/logger';
 *   logger.error('Error message', error);
 *   logger.warn('Warning message');
 *   logger.info('Info message');
 *   logger.debug('Debug message');
 */

const isProduction = import.meta.env.PROD;

// Keys whose values should be redacted wholesale in logged objects.
const SENSITIVE_KEY_PATTERN = /(authorization|auth|apikey|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|secret|password|session|cookie|set-cookie|jwt|bearer)/i;

// Patterns in strings that should be redacted inline.
const INLINE_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9\-_.~+/=]+/gi, 'Bearer [REDACTED]'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[JWT_REDACTED]'],
  [/sk_(live|test)_[A-Za-z0-9]+/g, '[STRIPE_KEY_REDACTED]'],
  [/rk_(live|test)_[A-Za-z0-9]+/g, '[STRIPE_KEY_REDACTED]'],
  [/whsec_[A-Za-z0-9]+/g, '[STRIPE_WEBHOOK_SECRET_REDACTED]'],
];

function sanitizeString(s: string): string {
  let out = s;
  for (const [re, repl] of INLINE_PATTERNS) out = out.replace(re, repl);
  return out;
}

function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value !== 'object') return value;

  // Error objects — preserve name + message but sanitize the message/stack.
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message || ''),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }

  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((v) => sanitize(v, seen));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitize(v, seen);
    }
  }
  return out;
}

function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map((a) => sanitize(a));
}

const logger = {
  /**
   * Log an error message. Always outputs in both development and production.
   * Arguments are sanitized to strip tokens, credentials, and JWTs.
   */
  error(...args: any[]): void {
    console.error(...sanitizeArgs(args));
  },

  /**
   * Log a warning message. Always outputs in both development and production.
   * Arguments are sanitized to strip tokens, credentials, and JWTs.
   */
  warn(...args: any[]): void {
    console.warn(...sanitizeArgs(args));
  },

  /**
   * Log an info message. Only outputs in development; suppressed in production.
   */
  info(...args: any[]): void {
    if (!isProduction) {
      console.info(...args);
    }
  },

  /**
   * Log a debug message. Only outputs in development; suppressed in production.
   */
  debug(...args: any[]): void {
    if (!isProduction) {
      console.debug(...args);
    }
  },
};

export default logger;
export { logger, sanitize as sanitizeForLog };
