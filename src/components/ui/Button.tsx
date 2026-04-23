// ═══════════════════════════════════════════════════════════════
// Canopy Web — Button primitive
// ═══════════════════════════════════════════════════════════════
// Shared button component that wraps the existing `.btn*` global CSS
// classes in a typed variant API, plus adds consistent disabled/loading
// state handling.
//
// P2 #63 (2026-04-23): Shipped as the migration target for the ~800
// raw `<button>` elements scattered across the web codebase. We're NOT
// force-migrating every call site in this sweep — `index.css` already
// defines a global `:focus-visible` rule that gives every raw button
// a keyboard focus ring, so a11y is not blocked on migration. New code
// should prefer this component; existing call sites can migrate
// opportunistically (each PR that touches a raw button should convert
// it to <Button> as part of the change).
//
// The variants map 1:1 to the existing CSS classes so behaviour is
// identical — the value-add here is typed props, loading spinner, and
// a single place to change button UX globally.

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'   // copper background, white text (main CTA)
  | 'secondary' // cream background, copper text (secondary CTA)
  | 'sage'      // sage background, white text (success/confirm)
  | 'danger'    // red background, white text (destructive)
  | 'ghost';    // transparent background (tertiary / text-like)

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render full-width (adds `.btn-full`). */
  fullWidth?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Optional icon placed before children. */
  leadingIcon?: ReactNode;
  /** Optional icon placed after children. */
  trailingIcon?: ReactNode;
}

/**
 * Button — shared primitive that wraps `.btn` global CSS.
 *
 * Usage:
 *   <Button variant="primary" onClick={save}>Save</Button>
 *   <Button variant="sage" size="lg" fullWidth loading={submitting}>Continue</Button>
 *   <Button variant="danger" onClick={remove}>Delete</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leadingIcon,
      trailingIcon,
      disabled,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    const classes = [
      'btn',
      `btn-${variant}`,
      size === 'sm' ? 'btn-sm' : null,
      size === 'lg' ? 'btn-lg' : null,
      fullWidth ? 'btn-full' : null,
      className || null,
    ]
      .filter(Boolean)
      .join(' ');

    const isDisabled = disabled || loading;

    return (
      <button
        {...rest}
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={classes}
      >
        {loading ? (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        ) : (
          leadingIcon
        )}
        {children}
        {!loading && trailingIcon}
      </button>
    );
  },
);

export default Button;
