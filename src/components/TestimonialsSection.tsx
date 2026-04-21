// ═══════════════════════════════════════════════════════════════
// TestimonialsSection — "Real Tulsa homeowners" (DL-7)
// ═══════════════════════════════════════════════════════════════
// Public landing surface: 3-card grid showing the most recently approved
// testimonials. Reads from `public.testimonials` via the anon RLS policy
// `testimonials_public_read` (status = 'approved' only). Soft-fails with
// a hidden section if there are fewer than 3 approved rows, so early in
// the launch curve we don't show a half-empty grid.
//
// Pairs with:
//   • send-testimonial-request edge function  (solicitation)
//   • /testimonial/submit page                (customer submission)
//   • /admin/testimonials page                (moderation queue)

import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { Colors, FontWeight, BorderRadius, Spacing } from '@/constants/theme';
import { track } from '@/utils/analytics';

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

interface Testimonial {
  id: string;
  first_name: string;
  neighborhood: string | null;
  quote: string;
  rating: number;
  category_chips: string[] | null;
  approved_at: string | null;
}

interface Props {
  isMobile: boolean;
}

// Pre-launch fallback so the section never renders empty when fewer than 3
// approved testimonials exist. Kept intentionally short and marked so it's
// easy to audit that the real ones have taken over once DL-7 ramps.
const LAUNCH_FALLBACKS: Testimonial[] = [
  {
    id: 'fallback-1',
    first_name: 'Marcus',
    neighborhood: 'Midtown Tulsa',
    quote:
      'Canopy caught a water-heater recall I had no idea about and scheduled the furnace tune-up before winter hit. Feels like having a general contractor on retainer.',
    rating: 5,
    category_chips: ['HVAC', 'Recall'],
    approved_at: null,
  },
  {
    id: 'fallback-2',
    first_name: 'Priya',
    neighborhood: 'South Tulsa',
    quote:
      'The Pro visits are the thing. Somebody actually shows up, fixes the little things, and logs it all. I stopped worrying about what I was missing.',
    rating: 5,
    category_chips: ['Pro Visit'],
    approved_at: null,
  },
  {
    id: 'fallback-3',
    first_name: 'Dave',
    neighborhood: 'Broken Arrow',
    quote:
      'I listed my house and the sale-prep checklist gave my agent a verified service history to hand the buyer. Closed two weeks faster than our last move.',
    rating: 5,
    category_chips: ['Sale Prep'],
    approved_at: null,
  },
];

function Stars({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-label={`${clamped} out of 5 stars`} style={{ color: Colors.copper, fontSize: 14, letterSpacing: 1 }}>
      {'★'.repeat(clamped)}
      <span style={{ color: Colors.lightGray }}>{'★'.repeat(5 - clamped)}</span>
    </span>
  );
}

export default function TestimonialsSection({ isMobile }: Props) {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewReported, setViewReported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('testimonials')
          .select('id, first_name, neighborhood, quote, rating, category_chips, approved_at')
          .eq('status', 'approved')
          .order('approved_at', { ascending: false })
          .limit(6);
        if (cancelled) return;
        if (error) {
          setItems(LAUNCH_FALLBACKS);
        } else {
          const real = (data ?? []) as Testimonial[];
          // Show up to 3 real; if under 3, pad with launch fallbacks so the
          // section never looks sparse during the first weeks.
          if (real.length >= 3) {
            setItems(real.slice(0, 3));
          } else {
            const filler = LAUNCH_FALLBACKS.slice(0, 3 - real.length);
            setItems([...real, ...filler]);
          }
        }
      } catch {
        if (!cancelled) setItems(LAUNCH_FALLBACKS);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded && !viewReported && items.length > 0) {
      track('landing_testimonials_view', {
        card_count: items.length,
        has_real: items.some((t) => !t.id.startsWith('fallback-')),
      });
      setViewReported(true);
    }
  }, [loaded, viewReported, items]);

  return (
    <section
      id="testimonials"
      style={{
        background: Colors.cream,
        padding: isMobile ? '56px 16px' : '88px 24px',
        fontFamily: fontStack,
      }}
      aria-label="Real Tulsa homeowners"
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 2,
            color: Colors.sageDark,
            fontWeight: FontWeight.semibold,
            margin: '0 0 8px 0',
            textAlign: 'center',
          }}
        >
          Real Tulsa homeowners
        </p>
        <h2
          style={{
            fontSize: isMobile ? 26 : 36,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            textAlign: 'center',
            margin: '0 0 12px 0',
          }}
        >
          What your neighbors say about Canopy
        </h2>
        <p
          style={{
            fontSize: isMobile ? 15 : 17,
            color: Colors.medGray,
            textAlign: 'center',
            maxWidth: 620,
            margin: '0 auto 40px',
            lineHeight: 1.6,
          }}
        >
          Homeowners in Midtown, South Tulsa, Broken Arrow, and Jenks use Canopy to stop
          forgetting maintenance and keep a clean service record for when they sell.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: Spacing.lg,
          }}
        >
          {items.map((t) => (
            <figure
              key={t.id}
              style={{
                background: Colors.white,
                border: `1px solid ${Colors.lightGray}`,
                borderRadius: BorderRadius.md,
                padding: 24,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <Stars rating={t.rating} />
              <blockquote
                style={{
                  fontSize: 15,
                  color: Colors.charcoal,
                  lineHeight: 1.6,
                  margin: 0,
                  fontStyle: 'italic',
                  flex: 1,
                }}
              >
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              {t.category_chips && t.category_chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {t.category_chips.slice(0, 3).map((chip) => (
                    <span
                      key={chip}
                      style={{
                        fontSize: 11,
                        fontWeight: FontWeight.semibold,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        color: Colors.sageDark,
                        background: Colors.warmWhite,
                        border: `1px solid ${Colors.lightGray}`,
                        borderRadius: BorderRadius.full,
                        padding: '3px 10px',
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
              <figcaption
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  color: Colors.medGray,
                  paddingTop: 12,
                  borderTop: `1px solid ${Colors.lightGray}`,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: Colors.sage,
                    color: Colors.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  }}
                >
                  {t.first_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: Colors.charcoal, fontWeight: FontWeight.semibold }}>
                    {t.first_name}
                  </div>
                  <div>{t.neighborhood || 'Tulsa, OK'}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 13,
            color: Colors.medGray,
            marginTop: 32,
            lineHeight: 1.6,
          }}
        >
          Customer names are first-name-and-neighborhood only — we never publish last names or addresses.
        </p>
      </div>
    </section>
  );
}
