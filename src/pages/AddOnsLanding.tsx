// Public add-ons landing page at /add-ons
// Marketing page explaining recurring service add-ons available to Home &
// Pro subscribers. Pricing is "starting at" because the real number is
// quoted per-property on the first site visit.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
import { useStore } from '@/store/useStore';

interface AddOnCard {
  name: string;
  tagline: string;
  priceRange: string;
  cadence: string;
  icon: string;
  bullets: string[];
}

// 2026-05-06 round-7: prices aligned to the canonical figures rendered on
// Landing (/) so a homeowner doesn't see $39/mo on the homepage and $60/mo
// here. Icons, taglines, and cadence also normalized to match the AddOns
// section on Landing for consistency. Real prices are still per-property
// quoted after assessment — these are the marketing floors.
const RECURRING: AddOnCard[] = [
  {
    name: 'Pest Shield',
    tagline: 'Quarterly treatments, no surprises.',
    priceRange: 'From $39/mo',
    cadence: 'Quarterly exterior · free re-services',
    icon: '🪳',
    bullets: [
      'Licensed applicators, EPA-registered products',
      'Termite & rodent monitoring included',
      'Visit logs and product records stored in your Canopy',
    ],
  },
  {
    name: 'Lawn Care',
    tagline: 'A yard that looks taken care of — because it is.',
    priceRange: 'From $59/mo',
    cadence: 'Bi-weekly mow · seasonal fertilization · irrigation checks',
    icon: '🌿',
    bullets: [
      'Mow, edge, fertilize on a fixed schedule',
      'Irrigation zone testing and seasonal shutdown',
      'Optional: aeration, overseeding, mulch refresh',
    ],
  },
  {
    name: 'Pool Service',
    tagline: 'Swimmable every weekend.',
    priceRange: 'From $149/mo',
    cadence: 'Weekly chemistry, cleaning, and equipment checks',
    icon: '🏊',
    bullets: [
      'Chemical balance checks and adjustments',
      'Skimmer and basket cleaning, brushing',
      'Equipment inspection and leak detection',
    ],
  },
  {
    name: 'Septic Care',
    tagline: 'Aerobic systems, handled.',
    priceRange: 'From $19/mo',
    cadence: 'Scheduled inspections + on-call response',
    icon: '💧',
    bullets: [
      'Chlorine refill, spray-head testing, alarm checks',
      'State-compliance reports for aerobic permits',
      'Schedule pump-outs through Canopy when due',
    ],
  },
  {
    name: 'House Cleaning',
    tagline: 'Bi-weekly, by the same crew.',
    priceRange: 'From $129/mo',
    cadence: 'Bi-weekly standard · weekly available',
    icon: '🧹',
    bullets: [
      'Consistent crew, background-checked',
      'Detailed checklist scoped to your home',
      'One-time deep cleans available at quote',
    ],
  },
];

const SEASONAL = [
  'HVAC tune-ups (spring + fall)',
  'Exterior wash & seal',
  'Carpet cleaning',
  'Chimney sweep',
  'Generator service',
  'Duct cleaning',
  'Septic pumping',
  'Gutter cleanout',
];

export default function AddOnsLanding() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [isMobile, setIsMobile] = useState(false);

  // Authenticated users land on the in-app Add-Ons tab instead of the
  // marketing page — they already know what add-ons are; they want to
  // request one. Unauthenticated visitors see the marketing page.
  useEffect(() => {
    if (user?.id) {
      navigate('/pro-services?tab=add-ons', { replace: true });
    }
  }, [user?.id, navigate]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  return (
    <div style={{ fontFamily: fontStack, background: Colors.white }}>
      {/* Nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${Colors.lightGray}`,
          padding: '0 24px',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer', fontSize: 22, fontWeight: FontWeight.bold, color: Colors.copper }}
        >
          Canopy
        </div>
        <button
          onClick={() => navigate('/signup')}
          style={{
            background: Colors.copper,
            color: Colors.white,
            border: 'none',
            padding: '10px 20px',
            borderRadius: BorderRadius.md,
            fontSize: FontSize.sm,
            fontWeight: FontWeight.semibold,
            cursor: 'pointer',
          }}
        >
          Get Started
        </button>
      </header>

      {/* Hero */}
      <section style={{ padding: isMobile ? '56px 20px' : '96px 24px 72px', textAlign: 'center', background: Colors.cream }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <p style={{ fontSize: 14, fontWeight: FontWeight.semibold, color: Colors.copper, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 16px' }}>
            Canopy Add-Ons
          </p>
          <h1 style={{ fontSize: isMobile ? 36 : 52, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: '0 0 20px', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Recurring home services, from one app
          </h1>
          <p style={{ fontSize: isMobile ? 17 : 20, color: Colors.medGray, margin: '0 0 32px', lineHeight: 1.5 }}>
            Pest control, lawn care, pool service, septic, cleaning — managed alongside the maintenance you already track in Canopy. Vetted local providers. Transparent quoting. Cancel anytime.
          </p>
          <button
            onClick={() => navigate('/signup')}
            style={{
              background: Colors.copper,
              color: Colors.white,
              border: 'none',
              padding: isMobile ? '14px 28px' : '16px 36px',
              borderRadius: BorderRadius.md,
              fontSize: isMobile ? 16 : 18,
              fontWeight: FontWeight.semibold,
              cursor: 'pointer',
            }}
          >
            Start your Canopy
          </button>
          <p style={{ fontSize: 13, color: Colors.medGray, margin: '16px 0 0' }}>
            Available on the Home plan ($6.99/mo) and Pro plans.
          </p>
        </div>
      </section>

      {/* Recurring services */}
      <section style={{ padding: isMobile ? '48px 20px' : '80px 24px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? 28 : 36, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: '0 0 12px', textAlign: 'center' }}>
            Recurring services
          </h2>
          <p style={{ fontSize: 16, color: Colors.medGray, margin: '0 0 40px', textAlign: 'center', maxWidth: 620, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Per-property pricing. You'll see a baseline estimate right away; the final quote is locked in after the provider confirms on the first visit.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 20,
            }}
          >
            {RECURRING.map((a) => (
              <div
                key={a.name}
                style={{
                  background: Colors.white,
                  border: `1px solid ${Colors.lightGray}`,
                  borderRadius: BorderRadius.lg,
                  padding: 24,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{a.icon}</div>
                <h3 style={{ fontSize: 20, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 4px' }}>
                  {a.name}
                </h3>
                <p style={{ fontSize: 15, color: Colors.copper, fontWeight: FontWeight.semibold, margin: '0 0 12px' }}>
                  {a.priceRange}
                </p>
                <p style={{ fontSize: 14, color: Colors.medGray, margin: '0 0 16px', lineHeight: 1.5 }}>
                  {a.tagline}
                </p>
                <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 16px', fontStyle: 'italic' }}>
                  {a.cadence}
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, color: Colors.medGray, fontSize: 14, lineHeight: 1.6 }}>
                  {a.bullets.map((b) => (
                    <li key={b} style={{ marginBottom: 6 }}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seasonal */}
      <section style={{ padding: isMobile ? '48px 20px' : '64px 24px', background: Colors.cream }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: isMobile ? 24 : 30, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: '0 0 12px' }}>
            Seasonal & annual services
          </h2>
          <p style={{ fontSize: 16, color: Colors.medGray, margin: '0 0 28px', lineHeight: 1.6 }}>
            One-time bookings — Canopy reminds you when they're due and routes the request to a local provider.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
            }}
          >
            {SEASONAL.map((s) => (
              <span
                key={s}
                style={{
                  background: Colors.white,
                  border: `1px solid ${Colors.lightGray}`,
                  borderRadius: 999,
                  padding: '8px 16px',
                  fontSize: 14,
                  color: Colors.charcoal,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: isMobile ? '48px 20px' : '80px 24px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? 28 : 36, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: '0 0 40px', textAlign: 'center' }}>
            How add-ons work
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 24 }}>
            {[
              { step: '1', t: 'Pick a service', d: 'Choose from the add-on catalog inside your Canopy account.' },
              { step: '2', t: 'Get an estimate', d: 'We generate a starting price based on your home\'s profile.' },
              { step: '3', t: 'Provider confirms', d: 'A vetted local provider visits and locks in the final quote.' },
              { step: '4', t: 'Pay monthly', d: 'Billed together with your Canopy subscription. Pause or cancel anytime.' },
            ].map((s) => (
              <div key={s.step}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: Colors.copper, color: Colors.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: FontWeight.bold, marginBottom: 12 }}>
                  {s.step}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 6px' }}>{s.t}</h3>
                <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: Colors.charcoal, padding: isMobile ? '48px 20px' : '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? 28 : 36, fontWeight: FontWeight.bold, color: Colors.white, margin: '0 0 16px' }}>
            One app for your whole home.
          </h2>
          <p style={{ fontSize: 17, color: Colors.silver, margin: '0 0 32px', lineHeight: 1.6 }}>
            Maintenance tracking, service add-ons, and a full history of every visit — in one place.
          </p>
          <button
            onClick={() => navigate('/signup')}
            style={{
              background: Colors.copper,
              color: Colors.white,
              border: 'none',
              padding: '14px 32px',
              borderRadius: BorderRadius.md,
              fontSize: 16,
              fontWeight: FontWeight.semibold,
              cursor: 'pointer',
            }}
          >
            Start your Canopy
          </button>
          <p style={{ fontSize: 13, color: Colors.silver, margin: '16px 0 0' }}>
            Currently available in the Tulsa metro · expanding regionally in 2026.
          </p>
        </div>
      </section>
    </div>
  );
}
