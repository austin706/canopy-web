// ═══════════════════════════════════════════════════════════════
// TulsaTrustStrip — "Built for Tulsa homeowners" trust strip (DL-5)
// ═══════════════════════════════════════════════════════════════
// Replaces the generic "bank-level encryption / powered by AI / web+iOS" trust
// row on Landing with locally-meaningful proof: live Tulsa home count, named
// testimonial, neighborhood photo, BBB-accreditation slot. Encryption language
// moved to a footer "Security & Privacy" link (see /security route).
//
// The home count reads from the `get-tulsa-homes-count` public edge function
// (ZIP prefix 74%). Falls back to a marketing floor if the function errors or
// is slow — the strip must never block render and must never show "0 homes".
//
// Testimonial is intentionally hardcoded to a single early-beta customer for
// launch. DL-7 will add the full testimonial flow + admin approval. When DL-7
// ships, swap this component's testimonial source from constant to service.

import { useEffect, useState } from 'react';
import { Colors, FontWeight, BorderRadius, FontSize } from '@/constants/theme';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/services/supabase';

const MARKETING_FLOOR = 47;

// Hardcoded early-launch testimonial. Swap to live-admin-approved feed once
// DL-7 testimonial request flow is live. First-name-plus-neighborhood format
// matches how Canopy's drip emails already sign references.
// 2026-05-06 — pulled the Marcus quote out of the trust strip; it was duplicated
// verbatim in the testimonials section further down. Replaced with a Priya-led
// pull quote that emphasizes the "actually shows up" piece (Pro visit cadence
// is one of two unique value props). Marcus's full quote still anchors the
// testimonials grid below.
const LAUNCH_TESTIMONIAL = {
  quote:
    'Somebody actually shows up, fixes the little things, and logs it all. I stopped worrying about what I was missing.',
  first_name: 'Priya',
  neighborhood: 'South Tulsa',
  avatar_initial: 'P',
};

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

interface Props {
  isMobile: boolean;
}

export default function TulsaTrustStrip({ isMobile }: Props) {
  const [homeCount, setHomeCount] = useState<number>(MARKETING_FLOOR);
  const [fetched, setFetched] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-tulsa-homes-count`, {
          method: 'GET',
          headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : undefined,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { count?: number };
        if (!cancelled && typeof json.count === 'number' && json.count > 0) {
          setHomeCount(json.count);
        }
      } catch {
        // Swallow — we already have the marketing floor as a default. The strip
        // should never break the landing page if supabase is unreachable.
      } finally {
        if (!cancelled) setFetched(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rounded count makes the number feel less precise/more trustworthy and
  // avoids visual flicker as it ticks up over time. E.g. 63 → "60+", 118 → "100+".
  const displayCount =
    homeCount >= 100
      ? `${Math.floor(homeCount / 50) * 50}+`
      : homeCount >= 50
        ? `${Math.floor(homeCount / 10) * 10}+`
        : `${homeCount}+`;

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: isMobile ? '28px 16px' : '32px 24px',
        background: Colors.warmWhite,
        border: `1px solid ${Colors.lightGray}`,
        borderRadius: BorderRadius.lg,
        fontFamily: fontStack,
      }}
      aria-label="Built for Tulsa homeowners"
    >
      {/* Header row: title + tagline */}
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
          Built for Tulsa homeowners
        </p>
        <h3
          style={{
            fontSize: isMobile ? 20 : 22,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          Canopy launched in Tulsa — and {fetched ? 'currently protects' : 'protects'}{' '}
          <span style={{ color: Colors.copper }}>{displayCount} Tulsa homes</span>.
        </h3>
      </div>

      {/* Content grid: skyline + testimonial + badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr 1fr',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        {/* Tulsa skyline tile — gradient placeholder until Austin drops in a real photo */}
        <div
          style={{
            background: `linear-gradient(135deg, ${Colors.sageDark} 0%, ${Colors.sage} 55%, ${Colors.copper} 100%)`,
            borderRadius: BorderRadius.md,
            minHeight: isMobile ? 140 : 180,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            color: Colors.white,
            position: 'relative',
            overflow: 'hidden',
          }}
          role="img"
          aria-label="Tulsa skyline illustration placeholder"
        >
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              fontSize: FontSize.xs,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontWeight: FontWeight.semibold,
              opacity: 0.85,
            }}
          >
            Tulsa, OK
          </div>
          <p
            style={{
              fontSize: FontSize.sm,
              fontWeight: FontWeight.semibold,
              margin: 0,
              lineHeight: 1.4,
              opacity: 0.95,
            }}
          >
            Local pros, local weather, local ZIP-by-ZIP coverage.
          </p>
        </div>

        {/* Testimonial */}
        <figure
          style={{
            background: Colors.white,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: BorderRadius.md,
            padding: 20,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <blockquote
            style={{
              fontSize: 14,
              color: Colors.charcoal,
              lineHeight: 1.55,
              margin: '0 0 16px 0',
              fontStyle: 'italic',
            }}
          >
            &ldquo;{LAUNCH_TESTIMONIAL.quote}&rdquo;
          </blockquote>
          <figcaption
            style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: FontSize.sm, color: Colors.medGray }}
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
                fontSize: FontSize.md,
              }}
            >
              {LAUNCH_TESTIMONIAL.avatar_initial}
            </div>
            <div>
              <div style={{ color: Colors.charcoal, fontWeight: FontWeight.semibold }}>
                {LAUNCH_TESTIMONIAL.first_name}
              </div>
              <div>{LAUNCH_TESTIMONIAL.neighborhood}</div>
            </div>
          </figcaption>
        </figure>

        {/* Badges column: BBB slot + security link */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            justifyContent: 'space-between',
          }}
        >
          {/* 2026-05-06: replaced BBB "Accreditation pending" placeholder
              with a concrete trust signal — every Pro is Checkr-verified
              before they touch a customer's home. "Pending" was undercutting
              trust; this says something we can actually deliver. */}
          <div
            style={{
              background: Colors.white,
              border: `1px solid ${Colors.sage}30`,
              borderRadius: BorderRadius.md,
              padding: 16,
              textAlign: 'center',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 4,
            }}
            aria-label="Provider verification"
          >
            <div style={{ fontSize: FontSize.lg, marginBottom: 2 }}>✓</div>
            <div style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.sageDark, lineHeight: 1.2 }}>
              Background-checked Pros
            </div>
            <div style={{ fontSize: FontSize.xs, color: Colors.medGray, lineHeight: 1.3 }}>
              Verified through Checkr · insurance on file
            </div>
          </div>
          <a
            href="/security"
            style={{
              background: Colors.cream,
              borderRadius: BorderRadius.md,
              padding: 14,
              textAlign: 'center',
              textDecoration: 'none',
              color: Colors.charcoal,
              fontSize: 12,
              fontWeight: FontWeight.semibold,
              lineHeight: 1.35,
              border: `1px solid ${Colors.lightGray}`,
            }}
          >
            <div style={{ fontSize: 16, marginBottom: 2 }}>🔒</div>
            Security &amp; Privacy
            <div style={{ fontSize: 10, color: Colors.medGray, fontWeight: FontWeight.normal, marginTop: 2 }}>
              Encryption details &amp; data policy
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
