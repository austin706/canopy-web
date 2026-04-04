// ═══════════════════════════════════════════════════════════════
// Message type classifier — replaces brittle string matching
// for determining success/error styling of user-facing messages.
// ═══════════════════════════════════════════════════════════════

export type MessageVariant = 'success' | 'error' | 'info';

const ERROR_KEYWORDS = [
  'fail', 'error', 'invalid', 'denied', 'unauthorized',
  'expired', 'not found', 'unavailable', 'reject', 'unable',
];

const SUCCESS_KEYWORDS = [
  'success', 'saved', 'updated', 'added', 'verified',
  'sent', 'approved', 'completed', 'created', 'linked',
];

/**
 * Classify a user-facing message as success, error, or info.
 * Falls back to 'info' when the message doesn't match any pattern.
 */
export function getMessageVariant(message: string): MessageVariant {
  const lower = message.toLowerCase();
  if (ERROR_KEYWORDS.some((kw) => lower.includes(kw))) return 'error';
  if (SUCCESS_KEYWORDS.some((kw) => lower.includes(kw))) return 'success';
  return 'info';
}

/**
 * Return CSS color variables for a message variant (web).
 */
export function messageColors(variant: MessageVariant) {
  switch (variant) {
    case 'error':
      return { bg: 'var(--color-error-muted, #E5393520)', fg: 'var(--color-error)' };
    case 'success':
      return { bg: 'var(--color-success-muted, #4CAF5020)', fg: 'var(--color-success)' };
    default:
      return { bg: 'var(--color-info-muted, #2196F320)', fg: 'var(--color-info, #2196F3)' };
  }
}
