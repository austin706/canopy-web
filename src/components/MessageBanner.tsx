// ═══════════════════════════════════════════════════════════════
// MessageBanner — replaces inline string-matching error styles
// Usage: <MessageBanner message={message} />
// ═══════════════════════════════════════════════════════════════
import { getMessageVariant, messageColors } from '@/utils/messageType';

interface Props {
  message: string;
  style?: React.CSSProperties;
}

export default function MessageBanner({ message, style }: Props) {
  const variant = getMessageVariant(message);
  const { bg, fg } = messageColors(variant);
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: '10px 16px',
        borderRadius: 8,
        background: bg,
        color: fg,
        fontSize: 14,
        marginBottom: 16,
        ...style,
      }}
    >
      {message}
    </div>
  );
}
