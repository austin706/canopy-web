/**
 * Production Logger Utility
 *
 * Provides a consistent logging interface that can be silenced in production.
 * In production (import.meta.env.PROD), only error and warn are output.
 * In development, all levels (debug, info, warn, error) are output.
 *
 * Usage:
 *   import logger from '@/utils/logger';
 *   logger.error('Error message', error);
 *   logger.warn('Warning message');
 *   logger.info('Info message');
 *   logger.debug('Debug message');
 */

const isProduction = import.meta.env.PROD;

const logger = {
  /**
   * Log an error message. Always outputs in both development and production.
   */
  error(...args: any[]): void {
    console.error(...args);
  },

  /**
   * Log a warning message. Always outputs in both development and production.
   */
  warn(...args: any[]): void {
    console.warn(...args);
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
export { logger };
