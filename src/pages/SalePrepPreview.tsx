// ═══════════════════════════════════════════════════════════════
// SalePrepPreview — logged-out teaser for the Sale Prep kit (DL-4)
// ═══════════════════════════════════════════════════════════════
// A public landing surface that shows what's inside the authenticated
// /sale-prep experience without requiring signup. Driven by DL-4:
// clicking the "Selling soon?" persona card on the main landing page
// routes here first, and the primary CTA converts to signup → the
// actual /sale-prep kit. This is the bottom of the pre-launch funnel
// for sell-intent traffic.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontWeight, BorderRadius } from '@/constants/theme';
import { SALE_PREP_CATEGORIES, SALE_PREP_ITEMS } from '@/constants/salePrep';
import { trackEvent } from '@/utils/analytics';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export default function SalePrepPreview() {
  const navigate = useNavigate();

  useEffect(() => {
    trackEvent('sale_prep_preview_view', {});
  }, []);

  const CATEGORY_BLURBS: Record<string, string> = {
    exterior: 'Curb appeal moves offers. Canopy prioritizes the cheap wins that change how a home photographs.',
    interior: 'Walk-through polish: declutter, deep clean, freshen paint, fix the small stuff buyers will flag.',
    systems: 'Prove the mechanicals work (HVAC, plumbing, electrical, water heater) with documentation.',
    documentation: 'Warranties, permits, and maintenance history that defuse inspection-driven price cuts.',
    staging: 'Presentation details that make rooms feel bigger, brighter, and ready to list.',
  };

  const itemsByCategory = SALE_PREP_CATEGORIES.map((cat) => ({
    key: cat.id,
    label: cat.label,
    icon: cat.icon,
    description: CATEGORY_BLURBS[cat.id] ?? '',
    items: SALE_PREP_ITEMS.filter((i) => i.category === cat.id).slice(0, 3),
    total: SALE_PREP_ITEMS.filter((i) => i.category === cat.id).length,
  }));

  const totalItems = SALE_PREP_ITEMS.length;

  return (
    <SectionErrorBoundary sectionName="SalePrepPreview">
      <div style={{ fontFamily: fontStack, background: Colors.warmWhite, minHeight: '100vh' }}>
        {/* Simple header with Back to Canopy link */}
        <header
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${Colors.lightGray}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: Colors.sageDark,
              fontSize: 14,
              fontWeight: FontWeight.semibold,
              cursor: 'pointer',
              fontFamily: fontStack,
            }}
          >
            &larr; Canopy Home
          </button>
          <button
            onClick={() => {
              trackEvent('cta_click', {
                location: 'sale_prep_preview_header',
                destination: '/signup',
                page: 'sale_prep_preview',
              });
              navigate('/signup');
            }}
            style={{
              background: Colors.copper,
              color: Colors.white,
              border: 'none',
              padding: '10px 20px',
              borderRadius: BorderRadius.md,
              fontSize: 14,
              fontWeight: FontWeight.semibold,
              cursor: 'pointer',
              fontFamily: fontStack,
            }}
          >
            Get Started Free
          </button>
        </header>

        {/* Hero */}
        <section style={{ padding: '64px 24px 48px', textAlign: 'center' }}>
          <div style={{ maxWidth: 780, margin: '0 auto' }}>
            <p
              style={{
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: 2,
                color: Colors.sageDark,
                fontWeight: FontWeight.semibold,
                marginBottom: 16,
              }}
            >
              For homeowners thinking about selling
            </p>
            <h1
              style={{
                fontSize: 42,
                fontWeight: FontWeight.bold,
                color: Colors.charcoal,
                margin: '0 0 20px 0',
                lineHeight: 1.2,
              }}
            >
              Get your home ready to list, without the scramble.
            </h1>
            <p
              style={{
                fontSize: 18,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: '0 0 32px 0',
              }}
            >
              Canopy&apos;s Sale Prep kit walks you through the same punch list our
              Tulsa pros use to get homes show-ready. Pair it with a verified
              Home Token and documented maintenance history, and you walk into
              listing day with proof of care that moves offers closer to asking.
            </p>
            <button
              onClick={() => {
                trackEvent('cta_click', {
                  location: 'sale_prep_preview_hero',
                  destination: '/signup',
                  page: 'sale_prep_preview',
                });
                navigate('/signup');
              }}
              style={{
                background: Colors.copper,
                color: Colors.white,
                border: 'none',
                padding: '16px 36px',
                borderRadius: BorderRadius.md,
                fontSize: 16,
                fontWeight: FontWeight.semibold,
                cursor: 'pointer',
                fontFamily: fontStack,
              }}
            >
              Start free, includes Sale Prep
            </button>
            <p style={{ fontSize: 13, color: Colors.medGray, marginTop: 16 }}>
              Free plan works anywhere. Sale Prep kit unlocks the moment you sign up.
            </p>
          </div>
        </section>

        {/* What's inside */}
        <section style={{ padding: '48px 24px 72px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <h2
              style={{
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.charcoal,
                textAlign: 'center',
                margin: '0 0 12px 0',
              }}
            >
              What&apos;s inside the Sale Prep kit
            </h2>
            <p
              style={{
                fontSize: 16,
                color: Colors.medGray,
                textAlign: 'center',
                maxWidth: 620,
                margin: '0 auto 40px',
                lineHeight: 1.6,
              }}
            >
              {totalItems} curated prep items across {SALE_PREP_CATEGORIES.length} categories.
              Sample items below. The full checklist and pro-booking flow are
              inside the app.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 20,
              }}
            >
              {itemsByCategory.map((cat) => (
                <div
                  key={cat.key}
                  style={{
                    background: Colors.white,
                    border: `1px solid ${Colors.lightGray}`,
                    borderRadius: BorderRadius.lg,
                    padding: 24,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{cat.icon}</div>
                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: FontWeight.semibold,
                      color: Colors.charcoal,
                      margin: '0 0 6px 0',
                    }}
                  >
                    {cat.label}
                  </h3>
                  <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
                    {cat.description}
                  </p>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {cat.items.map((item) => (
                      <li
                        key={item.id}
                        style={{
                          fontSize: 14,
                          color: Colors.charcoal,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <span style={{ color: Colors.sage, fontWeight: FontWeight.bold }}>✓</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                  {cat.total > cat.items.length && (
                    <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12 }}>
                      + {cat.total - cat.items.length} more inside the app
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          style={{
            background: Colors.cream,
            padding: '64px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <h2
              style={{
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.charcoal,
                margin: '0 0 16px 0',
              }}
            >
              Start prepping today, list whenever you&apos;re ready.
            </h2>
            <p
              style={{
                fontSize: 16,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: '0 0 28px 0',
              }}
            >
              Sign up free, toggle on &ldquo;thinking about selling&rdquo; in your home
              profile, and Canopy pins the Sale Prep kit to your dashboard. No
              credit card required.
            </p>
            <button
              onClick={() => {
                trackEvent('cta_click', {
                  location: 'sale_prep_preview_footer',
                  destination: '/signup',
                  page: 'sale_prep_preview',
                });
                navigate('/signup');
              }}
              style={{
                background: Colors.copper,
                color: Colors.white,
                border: 'none',
                padding: '16px 36px',
                borderRadius: BorderRadius.md,
                fontSize: 16,
                fontWeight: FontWeight.semibold,
                cursor: 'pointer',
                fontFamily: fontStack,
              }}
            >
              Create your free account
            </button>
          </div>
        </section>
      </div>
    </SectionErrorBoundary>
  );
}
