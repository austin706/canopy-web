// ═══════════════════════════════════════════════════════════════
// format.ts — shared formatters for dates, numbers, currency
// ═══════════════════════════════════════════════════════════════
// P3 #86 (2026-04-23) — Prior to this, the codebase had three date-format
// patterns scattered across pages: raw `new Date().toLocaleDateString()`,
// per-call `Intl.DateTimeFormat(...).format(...)`, and hand-rolled strings
// like `${m}/${d}/${y}`. Same user could see "4/23/2026", "April 23, 2026",
// and "Apr 23, 2026" on three different screens in the same session.
//
// These helpers centralize the four display modes the app actually uses.
// All respect the user's locale (defaulting to en-US) and produce stable
// output (no locale drift between SSR and hydration — we're Vite-CSR, but
// still worth keeping deterministic).
//
// Convention:
//   formatDateShort(d)     → "Apr 23, 2026"       (most task/card lists)
//   formatDateLong(d)      → "April 23, 2026"     (document + legal headers)
//   formatDateWeekday(d)   → "Wednesday, Apr 23"  (calendar + visit cards)
//   formatDateRelative(d)  → "3 days ago"         (notification timestamps)
//   formatCurrency(n)      → "$149.00"            (pricing, invoices)
//   formatCurrency(n, 'compact') → "$1.6k"        (dashboard totals)
//
// Pass a Date, string, or number; null/undefined returns '—'.

type DateLike = Date | string | number | null | undefined;

function coerce(d: DateLike): Date | null {
  if (d === null || d === undefined || d === '') return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

const SHORT_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const LONG_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDateShort(d: DateLike): string {
  const date = coerce(d);
  return date ? SHORT_FMT.format(date) : '—';
}

export function formatDateLong(d: DateLike): string {
  const date = coerce(d);
  return date ? LONG_FMT.format(date) : '—';
}

export function formatDateWeekday(d: DateLike): string {
  const date = coerce(d);
  return date ? WEEKDAY_FMT.format(date) : '—';
}

export function formatTime(d: DateLike): string {
  const date = coerce(d);
  return date ? TIME_FMT.format(date) : '—';
}

export function formatDateTime(d: DateLike): string {
  const date = coerce(d);
  if (!date) return '—';
  return `${SHORT_FMT.format(date)} · ${TIME_FMT.format(date)}`;
}

/**
 * "3 days ago", "in 2 hours", "just now". Falls back to formatDateShort
 * for anything older than ~30 days.
 */
export function formatDateRelative(d: DateLike): string {
  const date = coerce(d);
  if (!date) return '—';

  const now = Date.now();
  const diffMs = date.getTime() - now;
  const absMs = Math.abs(diffMs);
  const sec = Math.round(absMs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  const sign = diffMs < 0 ? -1 : 1;

  if (sec < 45) return 'just now';
  if (min < 45) return rtf.format(sign * min, 'minute');
  if (hr < 24) return rtf.format(sign * hr, 'hour');
  if (day < 30) return rtf.format(sign * day, 'day');
  return formatDateShort(date);
}

export function formatCurrency(n: number | null | undefined, mode: 'default' | 'compact' = 'default'): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (mode === 'compact' && Math.abs(n) >= 1000) {
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n);
}

// ═══════════════════════════════════════════════════════════════
// cn — className concatenation
// ═══════════════════════════════════════════════════════════════
// P3 #84 (2026-04-23) — pages had patterns like
//   className={`btn ${active ? 'btn-sage' : 'btn-ghost'} ${disabled ? 'opacity-50' : ''}`}
// sprinkled throughout. Small utility keeps the falsy-branch handling
// consistent without pulling in clsx/classnames as a new dependency.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
