import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

export default function AgentLanding() {
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
            {/* 2026-05-06: PNG-only — avif/webp variants in /public are
                placeholders; the <picture> fallback was hitting them and
                rendering naturalWidth=0 + duplicated alt text on every
                page. Same fix as Landing. */}
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
            <span style={{ fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.copper, marginLeft: 4 }}>for Agents</span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24 }}>
            <a
              href="/"
              style={{ fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none' }}
            >
              ← Home
            </a>
            <button
              onClick={() => window.location.href = '/agent-application'}
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
            For real estate agents
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
            A closing gift your clients keep using a year after the sale.
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
            Hand a Canopy code at closing. Your client gets a co-branded home-care app under your name. You get a buyer-facing Home Token for every listing, analytics on who&apos;s about to sell, and a tool that earns its keep on referrals, not commissions.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <button
              onClick={() => window.location.href = '/agent-application'}
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
              Apply, takes 2 minutes
            </button>
            <a
              href="#sample"
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
              See a sample
            </a>
          </div>
          <p style={{ fontSize: FontSize.sm, color: Colors.medGray, margin: 0 }}>
            Free to apply · no commission, no kickback · gift a Home plan year for $60
          </p>
        </div>
      </section>

      {/* Co-branded Home Token spotlight — the moat from the agent's POV */}
      <section
        id="sample"
        style={{
          background: Colors.white,
          padding: isMobile ? '64px 16px' : '104px 24px',
          fontFamily: fontStack,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div aria-hidden="true" style={{
          position: 'absolute', top: -60, right: -100, width: 360, height: 360,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${Colors.copper}10 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{
          maxWidth: 1180, margin: '0 auto', position: 'relative',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1.05fr',
          gap: isMobile ? 40 : 80,
          alignItems: 'center',
        }}>
          {/* Mock — a co-branded buyer-facing share page snippet */}
          <div aria-hidden="true" style={{
            position: 'relative',
            background: Colors.white,
            borderRadius: 18,
            padding: isMobile ? 20 : 28,
            boxShadow: '0 24px 64px -16px rgba(38, 32, 28, 0.18), 0 4px 12px rgba(38, 32, 28, 0.06)',
            border: `1px solid ${Colors.copper}25`,
            maxWidth: isMobile ? '100%' : 460,
            marginRight: isMobile ? 0 : 'auto',
            transform: isMobile ? 'none' : 'rotate(-1.4deg)',
            order: isMobile ? 2 : 0,
          }}>
            {/* Agent attribution bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', marginBottom: 14,
              background: Colors.cream,
              border: `1px solid ${Colors.copper}30`,
              borderRadius: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: Colors.copper, color: Colors.white,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: FontWeight.bold, fontSize: FontSize.sm, flexShrink: 0,
              }}>YN</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, textTransform: 'uppercase', color: Colors.copper, margin: 0 }}>
                  Maintained with care · gift of
                </p>
                <p style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '1px 0 0' }}>
                  Your Name · Brokerage
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: FontSize.md }}>🏡</span>
              <span style={{
                fontSize: FontSize.xs, fontWeight: FontWeight.bold,
                letterSpacing: 0.7, textTransform: 'uppercase', color: Colors.copper,
              }}>Canopy Home Token</span>
            </div>
            <h3 style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: '0 0 4px', lineHeight: 1.2 }}>
              1247 Cedar Ridge Dr
            </h3>
            <p style={{ fontSize: FontSize.sm, color: Colors.medGray, margin: '0 0 14px' }}>
              Built 1998 · 2,400 sqft · 3 bed · 2 bath
            </p>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>Record completeness</span>
                <span style={{ fontSize: 12, fontWeight: FontWeight.bold, color: '#5C7A4F' }}>94%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: Colors.lightGray, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '94%', background: 'linear-gradient(90deg, #8FAA7E, #5C7A4F)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
              {[
                { label: 'Inspection ✓', tone: Colors.copper },
                { label: '14 visits logged', tone: '#5C7A4F' },
                { label: 'Warranties on file', tone: '#5C7A4F' },
              ].map((b) => (
                <span key={b.label} style={{
                  fontSize: 10, fontWeight: FontWeight.semibold,
                  padding: '3px 9px', borderRadius: 999,
                  background: `${b.tone}18`, color: b.tone,
                }}>
                  {b.label}
                </span>
              ))}
            </div>

            <p style={{
              fontSize: FontSize.xs, color: Colors.medGray, margin: 0,
              textAlign: 'center', fontStyle: 'italic',
              borderTop: `1px solid ${Colors.lightGray}`, paddingTop: 10,
            }}>
              Buyers and inspectors see your name on every share.
            </p>
          </div>

          {/* Copy column */}
          <div>
            <p style={{
              fontSize: FontSize.sm, fontWeight: FontWeight.bold,
              letterSpacing: 1.4, textTransform: 'uppercase',
              color: Colors.copper, margin: '0 0 16px',
            }}>
              Your name · Their record
            </p>
            <h2 style={{
              fontSize: isMobile ? 30 : 42, fontWeight: FontWeight.bold,
              color: Colors.charcoal, margin: '0 0 20px', lineHeight: 1.15,
            }}>
              Every closed deal gets a Home Token with your name on it.
            </h2>
            <p style={{
              fontSize: isMobile ? 16 : 18, color: Colors.medGray,
              lineHeight: 1.6, margin: '0 0 28px',
            }}>
              When your client is ready to sell, whether to a buyer agent, an inspector, or a contractor, the Home Token they share is co-branded with your name. The whole town becomes a referral surface, automatically.
            </p>
            <ul style={{
              listStyle: 'none', padding: 0, margin: '0 0 32px',
              display: 'grid', gap: 14,
            }}>
              {[
                { icon: '🎁', text: <><strong>Gift codes</strong> at closing in batches of 1, 5, 10, 25, or custom. We mint them; you hand them off.</> },
                { icon: '🏷️', text: <><strong>Co-branded share pages</strong> with your photo + brokerage. Every time the home is shown or transferred, your name leads.</> },
                { icon: '📊', text: <><strong>Activity analytics</strong> show which clients are active, who&apos;s logging maintenance, and who flipped on Sale Prep, your earliest "ready-to-sell" signal.</> },
                { icon: '🤝', text: <><strong>Reactivation campaign</strong> automatically nudges clients who lapse, so the relationship doesn&apos;t go quiet between deals.</> },
              ].map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span aria-hidden="true" style={{ fontSize: FontSize.xl, lineHeight: '28px', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: FontSize.md, color: Colors.charcoal, lineHeight: 1.55 }}>{item.text}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => window.location.href = '/agent-application'}
              style={{
                padding: '14px 28px', fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                background: Colors.copper, color: Colors.white, border: 'none',
                borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = Colors.copperDark; (e.target as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = Colors.copper; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              Get my agent portal →
            </button>
          </div>
        </div>
      </section>

      {/* Why this beats other closing gifts */}
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
            Beats the gift basket
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
            A closing gift that compounds.
          </h2>
          <p style={{
            fontSize: isMobile ? 15 : 17, color: Colors.medGray,
            textAlign: 'center', maxWidth: 620,
            margin: '0 auto 48px', lineHeight: 1.6,
          }}>
            Wine gets drunk in a weekend. A charcuterie board doesn&apos;t make it to Thursday. Canopy keeps showing up in your client&apos;s pocket every time something needs a filter, a tune-up, or a Pro.
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
                icon: '📅',
                title: 'Used most weeks of the year',
                desc: 'Weather alerts, AI task reminders, equipment lookups, document storage, the AI Home Assistant. Your name is the wrapper on every single touch.',
              },
              {
                icon: '🏷️',
                title: '$60 a year, wholesale',
                desc: 'Buy Home-plan gift codes in batches of 1, 5, 10, 25, or custom. Agents pay $60 for a full year, about 28% below the retail price your client would otherwise see. No commission, no kickback.',
              },
              {
                icon: '🛬',
                title: 'Sale-ready by listing day',
                desc: 'Sale Prep checklist + verified Home Token = listing day with documented care. HomeLight pegs it at ~$14k against inspection objections.',
              },
              {
                icon: '🔁',
                title: 'Built for the second deal',
                desc: "Your activity analytics show which clients flipped on Sale Prep. That's the earliest signal someone's getting ready to list.",
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
                <p style={{ fontSize: 14.5, color: Colors.medGray, lineHeight: 1.55, margin: 0 }}>
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
              { step: '1', title: 'Apply in 2 minutes', desc: 'Tell us your name, brokerage, and primary market. We approve same-day.' },
              { step: '2', title: 'Mint codes on demand', desc: 'Buy codes in batches at our cost. Your portal auto-generates a co-branded share link for each one.' },
              { step: '3', title: 'Hand it off at closing', desc: 'Drop the code in the closing folder (or text it). Your client activates, you stay top-of-mind for life.' },
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

          {/* Compensation disclosure — agents are a lead/retention channel, not paid contractors */}
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
              About the agent program
            </h3>
            <p style={{ fontSize: FontSize.sm, color: Colors.medGray, lineHeight: 1.6, margin: '0 0 6px 0' }}>
              Canopy's agent program is a <strong>referral and client-retention tool</strong>. Agents don't receive commissions or referral fees from Canopy. The value is relationship-building: your clients get a branded home-maintenance app under your name, and you stay top-of-mind for their next move.
            </p>
            <p style={{ fontSize: FontSize.sm, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>
              Gift codes and custom agent pages are offered at no cost. Canopy-certified service providers (separate program) pay a 15% platform fee when they complete jobs through the app.
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
            Stop hoping for the second listing. Build it in.
          </h2>
          <p style={{ fontSize: isMobile ? 16 : 18, color: 'var(--color-silver)', margin: '0 0 32px 0', lineHeight: 1.6 }}>
            Two-minute application. Same-day approval. Your portal lights up with co-branded share pages and bulk gift codes the moment you&apos;re in.
          </p>
          <button
            onClick={() => window.location.href = '/agent-application'}
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
            Apply for the agent program →
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
