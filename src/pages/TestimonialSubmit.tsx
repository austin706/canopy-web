// ═══════════════════════════════════════════════════════════════
// TestimonialSubmit — /testimonial/submit (DL-7)
// ═══════════════════════════════════════════════════════════════
// Landing page for the solicitation email link. Collects a rating,
// quote, optional category chips, and first-name + neighborhood.
// Requires auth (RLS policy `testimonials_owner_insert` checks
// auth.uid() = user_id). Unauthenticated visitors are redirected to
// /login?returnTo=/testimonial/submit.
//
// Submissions land with status='pending'. Admins review and approve
// from /admin/testimonials — only then do they surface on Landing.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, FontWeight, BorderRadius, Spacing } from '@/constants/theme';
import { track } from '@/utils/analytics';
import { getErrorMessage } from '@/utils/errors';

const CATEGORY_OPTIONS = [
  'HVAC',
  'Plumbing',
  'Electrical',
  'Yard',
  'Sale Prep',
  'Pro Visit',
  'Recall',
  'Documents',
  'Home Token',
] as const;

type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

const MIN_QUOTE = 10;
const MAX_QUOTE = 500;

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export default function TestimonialSubmit() {
  const navigate = useNavigate();
  const { user, home, isAuthenticated } = useStore();

  const [rating, setRating] = useState<number>(5);
  const [quote, setQuote] = useState('');
  const [firstName, setFirstName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [chips, setChips] = useState<Set<CategoryOption>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [viewReported, setViewReported] = useState(false);

  // Redirect unauthenticated visitors to login, preserving returnTo.
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?returnTo=${encodeURIComponent('/testimonial/submit')}`, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Prefill first name from profile, pulled from full_name.
  useEffect(() => {
    if (user?.full_name) {
      const first = String(user.full_name).trim().split(/\s+/)[0] ?? '';
      setFirstName(first);
    }
  }, [user?.full_name]);

  // Prefill neighborhood from home.city if populated.
  useEffect(() => {
    if (home?.city && !neighborhood) {
      setNeighborhood(home.city);
    }
  }, [home?.city, neighborhood]);

  // Fire view event once source is resolvable (from query string).
  useEffect(() => {
    if (viewReported || !isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    const source: 'email' | 'direct' | 'profile' =
      src === 'email' ? 'email' : src === 'profile' ? 'profile' : 'direct';
    track('testimonial_submit_view', { source });
    setViewReported(true);
  }, [viewReported, isAuthenticated]);

  // Check if this user has already submitted a testimonial — avoid duplicates.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('testimonials')
        .select('id, status')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1);
      if ((data ?? []).length > 0) {
        setAlreadySubmitted(true);
      }
    })();
  }, [user?.id]);

  const quoteCharCount = quote.trim().length;
  const canSubmit = useMemo(() => {
    return (
      !submitting &&
      !alreadySubmitted &&
      firstName.trim().length >= 1 &&
      quoteCharCount >= MIN_QUOTE &&
      quoteCharCount <= MAX_QUOTE &&
      rating >= 1 &&
      rating <= 5
    );
  }, [submitting, alreadySubmitted, firstName, quoteCharCount, rating]);

  function toggleChip(c: CategoryOption) {
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !user?.id) return;
    setSubmitting(true);
    setError(null);
    try {
      // P2 #69 (2026-04-23) — derive city/state from the user's home record
      // instead of hardcoding Tulsa/OK. Falls back to null when the user
      // hasn't completed setup, so we never mislabel testimonials.
      const homeCity = typeof home?.city === 'string' && home.city.trim() ? home.city.trim() : null;
      const homeState = typeof home?.state === 'string' && home.state.trim() ? home.state.trim() : null;
      const { error: insertError } = await supabase.from('testimonials').insert({
        user_id: user.id,
        home_id: home?.id ?? null,
        first_name: firstName.trim(),
        neighborhood: neighborhood.trim() || null,
        city: homeCity,
        state: homeState,
        quote: quote.trim(),
        rating,
        category_chips: Array.from(chips),
        source: 'in_app',
        status: 'pending',
      });
      if (insertError) throw insertError;

      // Mark testimonial_requests as submitted if one exists (soft update — no-op if absent).
      await supabase
        .from('testimonial_requests')
        .update({ status: 'submitted', last_event_at: new Date().toISOString() })
        .eq('user_id', user.id);

      track('testimonial_submit_success', {
        rating,
        chip_count: chips.size,
      });
      setDone(true);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      track('testimonial_submit_error', { reason: msg.slice(0, 80) });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    // Redirect runs in useEffect — brief flash guard.
    return null;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: Colors.warmWhite,
        fontFamily: fontStack,
        padding: '40px 16px',
      }}
    >
      <div
        style={{
          maxWidth: 620,
          margin: '0 auto',
          background: Colors.white,
          border: `1px solid ${Colors.lightGray}`,
          borderRadius: BorderRadius.lg,
          padding: '32px 28px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 2,
              color: Colors.sageDark,
              fontWeight: FontWeight.semibold,
              margin: '0 0 8px 0',
            }}
          >
            Share your experience
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Colors.charcoal,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Help your {typeof home?.city === 'string' && home.city.trim() ? home.city.trim() : 'local'} neighbors
          </h1>
          <p
            style={{
              fontSize: 15,
              color: Colors.medGray,
              margin: '10px auto 0',
              maxWidth: 460,
              lineHeight: 1.55,
            }}
          >
            A couple sentences about Canopy goes a long way. We publish first name and
            neighborhood only — never last name or address.
          </p>
        </div>

        {done && (
          <div
            role="status"
            style={{
              background: Colors.cream,
              border: `1px solid ${Colors.sage}`,
              color: Colors.sageDark,
              padding: 16,
              borderRadius: BorderRadius.md,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>🌿</div>
            <div style={{ fontWeight: FontWeight.semibold, marginBottom: 4 }}>
              Thanks — we got it.
            </div>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              We'll review and it'll show up on our Landing page once approved. You can close
              this tab.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                marginTop: 14,
                background: Colors.copper,
                color: Colors.white,
                border: 'none',
                padding: '10px 18px',
                borderRadius: BorderRadius.md,
                fontSize: 14,
                fontWeight: FontWeight.semibold,
                cursor: 'pointer',
              }}
            >
              Back to dashboard
            </button>
          </div>
        )}

        {alreadySubmitted && !done && (
          <div
            role="status"
            style={{
              background: Colors.cream,
              border: `1px solid ${Colors.lightGray}`,
              color: Colors.charcoal,
              padding: 16,
              borderRadius: BorderRadius.md,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            <div style={{ fontWeight: FontWeight.semibold, marginBottom: 4 }}>
              You've already shared a testimonial — thank you!
            </div>
            <p style={{ fontSize: 13, margin: 0, color: Colors.medGray }}>
              Want to update it? Email support@canopyhome.app and we'll swap it out.
            </p>
          </div>
        )}

        {!done && !alreadySubmitted && (
          <form onSubmit={handleSubmit}>
            {/* Rating */}
            <label
              htmlFor="rating"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                marginBottom: 8,
              }}
            >
              How would you rate Canopy so far?
            </label>
            <div id="rating" role="radiogroup" aria-label="Star rating" style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  onClick={() => setRating(n)}
                  style={{
                    fontSize: 32,
                    background: 'transparent',
                    border: 'none',
                    color: n <= rating ? Colors.copper : Colors.lightGray,
                    cursor: 'pointer',
                    padding: 2,
                    lineHeight: 1,
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Quote */}
            <label
              htmlFor="quote"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                marginBottom: 8,
              }}
            >
              What's working best for you?
            </label>
            <textarea
              id="quote"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="E.g. Canopy caught a water-heater recall I had no idea about…"
              rows={4}
              maxLength={MAX_QUOTE + 20}
              style={{
                width: '100%',
                padding: 12,
                fontSize: 15,
                lineHeight: 1.55,
                borderRadius: BorderRadius.md,
                border: `1px solid ${Colors.lightGray}`,
                fontFamily: 'inherit',
                resize: 'vertical',
                color: Colors.charcoal,
                background: Colors.white,
              }}
              required
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: quoteCharCount < MIN_QUOTE ? Colors.medGray : quoteCharCount > MAX_QUOTE ? Colors.error : Colors.medGray,
                marginTop: 6,
                marginBottom: 20,
              }}
            >
              <span>Min {MIN_QUOTE} characters.</span>
              <span>
                {quoteCharCount} / {MAX_QUOTE}
              </span>
            </div>

            {/* Categories */}
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                marginBottom: 8,
              }}
            >
              Which parts helped most? (Optional)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
              {CATEGORY_OPTIONS.map((c) => {
                const active = chips.has(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleChip(c)}
                    style={{
                      fontSize: 12,
                      fontWeight: FontWeight.semibold,
                      padding: '6px 12px',
                      borderRadius: BorderRadius.full,
                      border: `1px solid ${active ? Colors.sageDark : Colors.lightGray}`,
                      background: active ? Colors.sage : Colors.white,
                      color: active ? Colors.white : Colors.charcoal,
                      cursor: 'pointer',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            {/* First name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Spacing.md, marginBottom: 20 }}>
              <div>
                <label
                  htmlFor="first_name"
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: FontWeight.semibold,
                    color: Colors.charcoal,
                    marginBottom: 6,
                  }}
                >
                  First name *
                </label>
                <input
                  id="first_name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={50}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 15,
                    borderRadius: BorderRadius.md,
                    border: `1px solid ${Colors.lightGray}`,
                    color: Colors.charcoal,
                    background: Colors.white,
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="neighborhood"
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: FontWeight.semibold,
                    color: Colors.charcoal,
                    marginBottom: 6,
                  }}
                >
                  Neighborhood (optional)
                </label>
                <input
                  id="neighborhood"
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Midtown Tulsa"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 15,
                    borderRadius: BorderRadius.md,
                    border: `1px solid ${Colors.lightGray}`,
                    color: Colors.charcoal,
                    background: Colors.white,
                  }}
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  background: '#FDECEA',
                  border: `1px solid ${Colors.error}`,
                  color: Colors.error,
                  borderRadius: BorderRadius.md,
                  padding: 12,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                background: canSubmit ? Colors.copper : Colors.lightGray,
                color: Colors.white,
                border: 'none',
                padding: '14px 20px',
                borderRadius: BorderRadius.md,
                fontSize: 15,
                fontWeight: FontWeight.semibold,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Submitting…' : 'Share testimonial'}
            </button>
            <p
              style={{
                fontSize: 11,
                color: Colors.medGray,
                textAlign: 'center',
                marginTop: 14,
                marginBottom: 0,
                lineHeight: 1.5,
              }}
            >
              By submitting, you give Canopy permission to display this on our website with
              your first name and neighborhood.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
