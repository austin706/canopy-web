import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

export default function ProLanding() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  return (
    <div style={{ fontFamily: fontStack }}>
      {/* Nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #eee',
          padding: '0 24px',
          fontFamily: fontStack,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            {/* 2026-05-06: PNG-only — same fix as Landing/AgentLanding. */}
            <img
              src="/canopy-watercolor-logo.png"
              alt="Canopy"
              width={44}
              height={32}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              style={{ objectFit: 'contain' }}
            />
            <span style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.charcoal }}>Canopy</span>
            <span style={{ fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.copper, marginLeft: 4 }}>for Pros</span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24 }}>
            <a
              href="/"
              style={{ fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none' }}
            >
              ← Home
            </a>
            <button
              onClick={() => navigate('/apply-pro')}
              style={{
                padding: isMobile ? '8px 16px' : '8px 20px',
                fontSize: FontSize.sm,
                fontWeight: FontWeight.semibold,
                background: Colors.copper,
                color: Colors.white,
                border: 'none',
                borderRadius: BorderRadius.md,
                cursor: 'pointer',
                fontFamily: fontStack,
              }}
            >
              Apply Now
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          background: `linear-gradient(180deg, ${Colors.warmWhite} 0%, ${Colors.cream} 100%)`,
          padding: isMobile ? '60px 16px' : '104px 24px',
          textAlign: 'center',
          fontFamily: fontStack,
        }}
      >
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <p style={{
            fontSize: FontSize.sm, fontWeight: FontWeight.bold,
            letterSpacing: 1.4, textTransform: 'uppercase',
            color: Colors.copper, margin: '0 0 16px',
          }}>
            For service providers
          </p>
          <h1
            style={{
              fontSize: isMobile ? 32 : 50,
              fontWeight: FontWeight.bold,
              color: Colors.charcoal,
              margin: '0 0 20px 0',
              lineHeight: 1.15,
            }}
          >
            Skip the lead-bidding. Show up to a job that&apos;s already on the calendar.
          </h1>
          <p
            style={{
              fontSize: isMobile ? 17 : 20,
              color: Colors.medGray,
              margin: '0 auto 40px',
              lineHeight: 1.55,
              maxWidth: 660,
            }}
          >
            Canopy homeowners pay for scheduled maintenance. We route the work to vetted Pros, deliver the home&apos;s full equipment + history before you arrive, and get you paid through Stripe. <strong style={{ color: Colors.charcoal }}>15% platform fee, no monthly, no lead bidding.</strong>
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              onClick={() => navigate('/apply-pro')}
              style={{
                padding: '15px 32px',
                fontSize: FontSize.md,
                fontWeight: FontWeight.semibold,
                background: Colors.copper,
                color: Colors.white,
                border: 'none',
                borderRadius: BorderRadius.lg,
                cursor: 'pointer',
                fontFamily: fontStack,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = Colors.copperDark;
                (e.target as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = Colors.copper;
                (e.target as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              Apply to join the network
            </button>
            <a
              href="#sample-job"
              style={{
                padding: '15px 28px',
                fontSize: FontSize.md,
                fontWeight: FontWeight.semibold,
                background: 'transparent',
                color: Colors.copper,
                border: `2px solid ${Colors.copper}`,
                borderRadius: BorderRadius.lg,
                cursor: 'pointer',
                fontFamily: fontStack,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              See a sample job
            </a>
          </div>
          <p style={{ fontSize: FontSize.sm, color: Colors.medGray, margin: 0 }}>
            Background-checked through Checkr · payouts via Stripe Connect · pay only when you get paid
          </p>
        </div>
      </section>

      {/* Sample-job spotlight — what a Pro actually sees in the app */}
      <section
        id="sample-job"
        style={{
          background: Colors.white,
          padding: isMobile ? '64px 16px' : '104px 24px',
          fontFamily: fontStack,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div aria-hidden="true" style={{
          position: 'absolute', top: -60, left: -100, width: 360, height: 360,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${Colors.sage}14 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          maxWidth: 1180, margin: '0 auto', position: 'relative',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1.05fr',
          gap: isMobile ? 40 : 80,
          alignItems: 'center',
        }}>
          {/* Mock — what a Pro sees in their job queue */}
          <div aria-hidden="true" style={{
            position: 'relative',
            background: Colors.white,
            borderRadius: 18,
            padding: isMobile ? 20 : 28,
            boxShadow: '0 24px 64px -16px rgba(38, 32, 28, 0.18), 0 4px 12px rgba(38, 32, 28, 0.06)',
            border: `1px solid ${Colors.sage}25`,
            maxWidth: isMobile ? '100%' : 460,
            marginRight: isMobile ? 0 : 'auto',
            transform: isMobile ? 'none' : 'rotate(1.2deg)',
            order: isMobile ? 2 : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.7, textTransform: 'uppercase', color: '#5C7A4F', margin: 0 }}>
                  Confirmed visit · Tuesday 10 AM
                </p>
                <h3 style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: '2px 0 0' }}>
                  HVAC quarterly tune-up
                </h3>
              </div>
              <span style={{
                fontSize: FontSize.xs, fontWeight: FontWeight.bold,
                color: '#5C7A4F', background: '#5C7A4F18',
                padding: '4px 10px', borderRadius: 999,
              }}>$185 payout</span>
            </div>

            <div style={{
              padding: '10px 12px', borderRadius: 10, marginBottom: 12,
              background: Colors.cream, border: `1px solid ${Colors.lightGray}`,
            }}>
              <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                <strong style={{ color: Colors.charcoal }}>1247 Cedar Ridge Dr · Tulsa</strong>
              </p>
              <p style={{ fontSize: FontSize.xs, color: Colors.medGray, margin: '2px 0 0' }}>
                Built 1998 · 2,400 sqft · Sarah K.
              </p>
            </div>

            <p style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, textTransform: 'uppercase', color: Colors.medGray, margin: '0 0 8px' }}>
              On-site, before you arrive
            </p>
            <div style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
              {[
                { icon: '🔧', label: 'Carrier 25HCC4 (2018, condenser)' },
                { icon: '🌬️', label: 'Trane TUH1B080 (2018, gas furnace)' },
                { icon: '📄', label: '12 visits logged · last filter Apr 28' },
                { icon: '📸', label: '4 system photos from prior visit' },
              ].map((row) => (
                <div key={row.label} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', background: Colors.warmWhite,
                  borderRadius: 8, fontSize: 12, color: Colors.charcoal,
                }}>
                  <span aria-hidden="true">{row.icon}</span>
                  <span>{row.label}</span>
                </div>
              ))}
            </div>

            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: `${Colors.copper}10`, border: `1px solid ${Colors.copper}30`,
              fontSize: 12, color: Colors.charcoal, lineHeight: 1.4,
            }}>
              <strong>Homeowner note:</strong> "Squeak in the upstairs vent when the AC kicks on. Filter is on the shelf next to the unit."
            </div>
          </div>

          {/* Copy column */}
          <div>
            <p style={{
              fontSize: FontSize.sm, fontWeight: FontWeight.bold,
              letterSpacing: 1.4, textTransform: 'uppercase',
              color: '#5C7A4F', margin: '0 0 16px',
            }}>
              Show up prepared
            </p>
            <h2 style={{
              fontSize: isMobile ? 30 : 42, fontWeight: FontWeight.bold,
              color: Colors.charcoal, margin: '0 0 20px', lineHeight: 1.15,
            }}>
              Make/model/serial of every system. Photos. The note the homeowner forgot to text.
            </h2>
            <p style={{
              fontSize: isMobile ? 16 : 18, color: Colors.medGray,
              lineHeight: 1.6, margin: '0 0 28px',
            }}>
              Every visit lands on your queue with the home&apos;s complete equipment inventory, maintenance history, photos from prior Pros, and the homeowner&apos;s actual note about what&apos;s wrong. No more "oh, I didn&apos;t bring that part."
            </p>
            <ul style={{
              listStyle: 'none', padding: 0, margin: '0 0 32px',
              display: 'grid', gap: 14,
            }}>
              {[
                { icon: '📋', text: <><strong>Quote &amp; invoice</strong> in-app — line items, photos, signatures. Homeowner approves, you get paid.</> },
                { icon: '💸', text: <><strong>Stripe Connect payouts</strong> — money lands in your bank, usually next business day. No invoicing software, no chasing checks.</> },
                { icon: '📅', text: <><strong>You set availability</strong> — block off Saturdays, vacations, busy seasons. Visits propose around your calendar.</> },
                { icon: '⭐', text: <><strong>Reputation that compounds</strong> — every visit logs to the homeowner&apos;s Home Token. When they sell, your name is on the record buyers see.</> },
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span aria-hidden="true" style={{ fontSize: FontSize.xl, lineHeight: '28px', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: FontSize.md, color: Colors.charcoal, lineHeight: 1.55 }}>{item.text}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/apply-pro')}
              style={{
                padding: '14px 28px', fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                background: Colors.copper, color: Colors.white, border: 'none',
                borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = Colors.copperDark; (e.target as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = Colors.copper; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              Start the application →
            </button>
          </div>
        </div>
      </section>

      {/* Why this is different */}
      <section
        style={{
          background: Colors.cream,
          padding: isMobile ? '56px 16px' : '88px 24px',
          fontFamily: fontStack,
        }}
      >
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p style={{
            textAlign: 'center', fontSize: FontSize.sm, fontWeight: FontWeight.bold,
            letterSpacing: 1.4, textTransform: 'uppercase', color: Colors.copper,
            margin: '0 0 12px',
          }}>
            Not like the lead-gen sites
          </p>
          <h2
            style={{
              fontSize: isMobile ? 26 : 36,
              fontWeight: FontWeight.bold,
              color: Colors.charcoal,
              textAlign: 'center',
              margin: '0 0 16px 0',
              lineHeight: 1.2,
            }}
          >
            The economics actually work.
          </h2>
          <p style={{
            fontSize: isMobile ? 15 : 17, color: Colors.medGray,
            textAlign: 'center', maxWidth: 620,
            margin: '0 auto 48px', lineHeight: 1.6,
          }}>
            We don&apos;t sell your contact info to four other Pros and call it a "lead." Homeowners have already paid for the visit. Your job is to do the work and log it.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: isMobile ? 16 : 24,
            }}
          >
            {[
              {
                icon: '🚫',
                title: 'No lead bidding',
                desc: 'You\'re not paying $40 to compete with 3 other Pros for one estimate. You get the job, you do the job, you get paid.',
              },
              {
                icon: '💰',
                title: '15% on completed work, that\'s it',
                desc: 'No monthly subscription. No per-lead fee. No phantom "premium placement" charge. We make money when you make money.',
              },
              {
                icon: '🗓️',
                title: 'Scheduled work, not emergencies',
                desc: 'Quarterly Pro visits. Annual Maintenance Inspections. Add-on rotations. The boring, predictable work that fills your slow weeks.',
              },
              {
                icon: '🔒',
                title: 'Background-checked + insured',
                desc: 'Every Pro on the network is Checkr-verified, insurance on file. You\'re not competing with the cousin who "knows a guy" anymore.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: Colors.white,
                  padding: isMobile ? '24px' : '28px',
                  borderRadius: 14,
                  border: `1px solid ${Colors.lightGray}`,
                  boxShadow: '0 1px 2px rgba(38, 32, 28, 0.04)',
                }}
              >
                <div style={{ fontSize: FontSize.xxl, marginBottom: 10 }} role="img" aria-label={item.title}>
                  {item.icon}
                </div>
                <h3
                  style={{
                    fontSize: FontSize.lg,
                    fontWeight: FontWeight.semibold,
                    color: Colors.charcoal,
                    margin: '0 0 8px 0',
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ fontSize: FontSize.md, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        style={{
          background: '#F5F4F0',
          padding: isMobile ? '48px 16px' : '80px 24px',
          fontFamily: fontStack,
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontSize: isMobile ? 28 : 36,
              fontWeight: FontWeight.bold,
              color: Colors.charcoal,
              margin: isMobile ? '0 0 36px 0' : '0 0 56px 0',
            }}
          >
            How it works
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: isMobile ? '32px' : '40px',
            }}
          >
            {[
              { step: '1', title: 'Apply', desc: 'Submit your application with your trade, service area, and credentials.' },
              { step: '2', title: 'Get Verified', desc: 'We review your background and certifications. Approved pros join the network.' },
              { step: '3', title: 'Start Working', desc: 'Accept jobs from homeowners in your area. Set your schedule and grow your business.' },
            ].map((item) => (
              <div key={item.step}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: Colors.copper,
                    color: Colors.white,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: FontSize.lg,
                    fontWeight: FontWeight.bold,
                    margin: '0 auto 16px',
                  }}
                >
                  {item.step}
                </div>
                <h3 style={{ fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: FontSize.md, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Fee disclosure — required for transparency on contractor terms */}
          <div
            style={{
              marginTop: isMobile ? 40 : 56,
              padding: '20px 24px',
              background: Colors.cream,
              border: `1px solid ${Colors.lightGray}`,
              borderRadius: 12,
              textAlign: 'left',
            }}
          >
            <h3 style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>
              Straightforward pricing
            </h3>
            <p style={{ fontSize: FontSize.sm, color: Colors.medGray, lineHeight: 1.6, margin: '0 0 6px 0' }}>
              Canopy charges a <strong>15% platform fee</strong> on completed jobs. No monthly fees, no lead-bidding, no subscription — you only pay when you get paid. Payouts are handled through Stripe Connect (standard processing fees apply).
            </p>
            <p style={{ fontSize: FontSize.sm, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>
              Full terms in the <a href="/contractor-terms" style={{ color: Colors.copper, textDecoration: 'underline' }}>Contractor Agreement</a>.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: `linear-gradient(135deg, ${Colors.charcoal} 0%, #1a1a1a 100%)`,
          padding: isMobile ? '56px 16px' : '88px 24px',
          textAlign: 'center',
          fontFamily: fontStack,
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: isMobile ? 28 : 38,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              margin: '0 0 16px 0',
              lineHeight: 1.2,
            }}
          >
            Stop bidding for leads. Start showing up to work.
          </h2>
          <p style={{ fontSize: isMobile ? 16 : 18, color: 'var(--color-silver)', margin: '0 0 32px 0', lineHeight: 1.6 }}>
            Tell us your trade, your service area, and your insurance. We&apos;ll get you set up on the network and the first homeowner visit can land within the week.
          </p>
          <button
            onClick={() => navigate('/apply-pro')}
            style={{
              padding: '15px 32px',
              fontSize: FontSize.md,
              fontWeight: FontWeight.semibold,
              background: Colors.copper,
              color: Colors.white,
              border: 'none',
              borderRadius: BorderRadius.lg,
              cursor: 'pointer',
              fontFamily: fontStack,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            Start the application →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          background: Colors.charcoal,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '24px',
          textAlign: 'center',
          fontFamily: fontStack,
        }}
      >
        <p style={{ fontSize: FontSize.sm, color: 'var(--color-med-gray)', margin: 0 }}>
          © 2026 Canopy. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
