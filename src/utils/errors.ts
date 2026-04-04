// ═══════════════════════════════════════════════════════════════
// Error helpers — replaces `catch (error: any)` with safe typing
// ═══════════════════════════════════════════════════════════════

/**
 * Safely extract a message string from an unknown caught value.
 * Replaces the pattern: `catch (error: any) { ... error.message ... }`
 * With:                  `catch (err) { const msg = getErrorMessage(err); ... }`
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}
