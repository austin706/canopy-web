import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontWeight, BorderRadius, FontSize } from '@/constants/theme';
import { PRICING, ANNUAL_DISCOUNT_PERCENT } from '@/constants/pricing';
import type { BillingInterval } from '@/constants/pricing';
import { trackEvent } from '@/utils/analytics';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';
import ZipPreCheck from '@/components/ZipPreCheck';
import TulsaTrustStrip from '@/components/TulsaTrustStrip';
import TestimonialsSection from '@/components/TestimonialsSection';

// FAQ content. Defined at module scope so the JSON-LD schema effect and the
// rendered accordion both read from a single source of truth.
const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'Is Canopy really free? Do I need a credit card to sign up?',
    a: 'Yes — the Free plan is free forever, no credit card required. It includes up to 3 equipment items, a basic maintenance calendar, weather-smart alerts, 5 AI chat messages per month, 2 text lookups per month, 1 lifetime AI equipment scan, and 90 days of maintenance history.',
  },
  {
    q: 'What does the AI equipment scanner actually do?',
    a: 'You point your phone at the label on your HVAC, water heater, dishwasher, or any other appliance. Canopy reads the make, model, and serial number, looks up the expected lifespan and recall history, and automatically builds a personalized maintenance plan for that specific piece of equipment — filter sizes, service intervals, the whole thing.',
  },
  {
    q: "How is Canopy different from a spreadsheet or Google Drive folder?",
    a: "A spreadsheet holds information — Canopy acts on it. Canopy tells you what needs attention next, when to schedule it, what it should cost, and who in your area is qualified to do it. It generates a verified, timestamped home history (the Home Token) that transfers to the next owner when you sell, which a folder of receipts simply can't do.",
  },
  {
    q: "Do I have to hire Canopy's pros, or can I use my own contractors?",
    a: 'Canopy is designed to work both ways. On the Free and Home plans you handle maintenance yourself (or with your own contractors) and log it in Canopy. On the Pro plan, Canopy-vetted technicians visit every other month to handle it for you. You can always log outside work regardless of plan — Canopy will track it the same way.',
  },
  {
    q: 'What is a Home Token and why does it matter when I sell?',
    a: "A Home Token is the complete, timestamped, verified record of your home's maintenance history — every pro visit, inspection, task completed, document uploaded, and equipment serviced. When you sell, you transfer the Home Token to the buyer at closing. Buyers who see a documented maintenance history are more likely to offer close to asking and less likely to back out during inspection contingencies.",
  },
  {
    q: 'Where is Canopy available right now?',
    a: 'Canopy is launching in Tulsa, Oklahoma first, where we can guarantee pro visit coverage. The software side (AI, calendar, document vault, Home Token, weather alerts) works anywhere in the US — you can use the Free and Home plans today no matter where you live. Pro visits roll out to Oklahoma City, Dallas / Fort Worth, and additional metros through 2026.',
  },
  {
    q: 'Does Canopy work on iOS and Android, or just the web?',
    a: 'All three. Canopy runs on iOS, Android, and the web at canopyhome.app. Your account and data sync across all three automatically — start a task on your phone, finish it on your laptop.',
  },
  {
    q: 'Can I cancel anytime? What about refunds?',
    a: 'Yes, you can cancel anytime directly from your account settings. Every paid plan includes a 7-day money-back guarantee — if Canopy is not for you, email support@canopyhome.app within 7 days of your first charge and we will refund you, no questions asked.',
  },
  {
    q: 'How is my home data protected?',
    a: "Canopy uses bank-level encryption for data in transit and at rest. Your documents, photos, and secure notes are stored in hardened cloud infrastructure. Secure notes are PIN-protected with an additional layer so even if someone gets into your account they can't read alarm codes, safe combinations, or gate codes without your PIN.",
  },
  {
    q: 'What happens to my data if I delete my account?',
    a: "You can delete your account and all of your data from the Profile screen in under a minute. Before you delete, you can export a complete copy of your data as a portable JSON file — profile, homes, equipment, maintenance logs, documents, invoices, and history — so you keep everything. Deletion is permanent and covers every table we store about you (required by California and EU law).",
  },
];

// ─── DL-6 · Hero A/B experiment ─────────────────────────────────────────────
// Two hero variants split 50/50 and persisted in localStorage so a given
// visitor sees the same variant across sessions (essential for honest
// landing→signup conversion measurement).
//
// Variant A — `outcome_promise`: new per-audit copy. One-sentence outcome
//             promise + three-line differentiator + primary CTA
//             "Start free — takes 2 minutes". This is the challenger.
// Variant B — `certainty_loop`:  current production copy ("Stop guessing.
//             Start knowing."). Kept as the control so we can measure lift
//             cleanly. Primary CTA: "Get Started Free".
//
// All hero CTA clicks fire `landing_hero_cta_click` with the variant tag so
// we can attribute downstream conversion in GA4. Assignment fires
// `landing_hero_variant_assigned` exactly once per visitor.
type HeroVariant = 'outcome_promise' | 'certainty_loop';
const HERO_VARIANT_STORAGE_KEY = 'canopy.exp.hero_variant';

interface HeroCopy {
  variant: HeroVariant;
  h1: string;
  subhead: string;
  primaryCta: string;
  secondaryCta: string;
}

const HERO_COPY: Record<HeroVariant, HeroCopy> = {
  outcome_promise: {
    variant: 'outcome_promise',
    h1: 'Never forget a maintenance task, lose a manual, or overpay a contractor again.',
    subhead:
      "Snap a photo of any appliance. Canopy figures out what it is, when it needs attention, and lines up a vetted Tulsa pro before things break — and keeps a record buyers will trust the day you list.",
    primaryCta: 'Start free — takes 2 minutes',
    secondaryCta: 'See how it works',
  },
  certainty_loop: {
    variant: 'certainty_loop',
    h1: 'Stop guessing. Start knowing.',
    subhead:
      "Canopy reads every appliance label in your home, tells you exactly what needs attention and when, and builds a tamper-evident record of every visit, repair, and replacement — so the value you put in shows the day you list.",
    primaryCta: 'Get started free',
    secondaryCta: 'See it in action',
  },
};

/** Pick or recall the hero variant for this visitor. SSR-safe: returns the
 *  challenger by default if localStorage is unavailable. */
function readHeroVariant(): HeroVariant {
  if (typeof window === 'undefined') return 'outcome_promise';
  try {
    const stored = window.localStorage.getItem(HERO_VARIANT_STORAGE_KEY);
    if (stored === 'outcome_promise' || stored === 'certainty_loop') return stored;
    const assigned: HeroVariant = Math.random() < 0.5 ? 'outcome_promise' : 'certainty_loop';
    window.localStorage.setItem(HERO_VARIANT_STORAGE_KEY, assigned);
    // Fire assignment once. We can't call trackEvent here because this runs
    // inside the render path; callers fire it from a useEffect (see below).
    return assigned;
  } catch {
    return 'outcome_promise';
  }
}

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [comparisonOpen, setComparisonOpen] = useState(false);

  // DL-6 — one-time variant assignment, stable per-visitor. The first render
  // seeds the ref so CTAs + analytics both use the same value.
  const [heroVariant] = useState<HeroVariant>(() => readHeroVariant());
  const heroCopy = HERO_COPY[heroVariant];

  // Fire assignment + view events exactly once. Assignment fires only when
  // the localStorage key was freshly created by readHeroVariant (we can tell
  // by comparing what's there now to what's there "before" — but since the
  // write happened inside readHeroVariant, we instead rely on a second key
  // that tracks whether we've already reported the assignment).
  useEffect(() => {
    try {
      const reportedKey = 'canopy.exp.hero_variant_reported';
      if (typeof window === 'undefined') return;
      if (window.localStorage.getItem(reportedKey) !== heroVariant) {
        trackEvent('landing_hero_variant_assigned', { variant: heroVariant });
        window.localStorage.setItem(reportedKey, heroVariant);
      }
      trackEvent('landing_hero_view', { variant: heroVariant });
    } catch {
      // No-op: analytics must never break render.
    }
  }, [heroVariant]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ─── FAQPage JSON-LD schema for SEO rich results ────────────────────────────
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'canopy-faq-schema';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    document.head.appendChild(script);
    return () => {
      const existing = document.getElementById('canopy-faq-schema');
      if (existing) existing.remove();
    };
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Fire a GA4 CTA click event then navigate. Centralizes instrumentation so
   * we can rename or extend the event shape in one place. The hero CTA
   * additionally fires `landing_hero_cta_click` with the active variant so
   * the DL-6 A/B experiment can measure lift without joining on session.
   */
  const ctaToSignup = (location: string) => {
    trackEvent('cta_click', { location, destination: '/signup', page: 'landing' });
    if (location === 'hero' || location === 'mobile_menu') {
      trackEvent('landing_hero_cta_click', {
        cta_label: heroCopy.primaryCta,
        variant: heroVariant,
      });
    }
    navigate('/signup');
  };

  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  // Shared card hover
  const cardHover = (e: React.MouseEvent, enter: boolean) => {
    if (isMobile) return;
    const el = e.currentTarget as HTMLElement;
    el.style.transform = enter ? 'translateY(-4px)' : 'translateY(0)';
    el.style.boxShadow = enter ? '0 8px 24px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.06)';
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // NAV
  // ═══════════════════════════════════════════════════════════════════════════════
  const NavHeader = () => (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #eee', padding: '0 24px', fontFamily: fontStack,
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          {/* 2026-05-06: avif/webp variants in /public are 8110-byte placeholders
              (real PNG is 1.19MB). Browser preferred AVIF, decoded garbage,
              naturalWidth=0, alt text rendered next to wordmark. Going PNG-only
              until proper avif/webp encodes are generated. */}
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
          <span style={{ fontSize: 20, fontWeight: FontWeight.bold, color: Colors.charcoal }}>Canopy</span>
        </div>

        {isMobile && (
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'block', width: 24, height: 2, background: Colors.charcoal, borderRadius: 2, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
            <span style={{ display: 'block', width: 24, height: 2, background: Colors.charcoal, borderRadius: 2, transition: 'all 0.3s', opacity: mobileMenuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 24, height: 2, background: Colors.charcoal, borderRadius: 2, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
          </button>
        )}

        {!isMobile && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {['Features', 'How It Works', 'Pricing'].map((label) => (
              <a key={label} href={`#${label.toLowerCase().replace(/ /g, '-')}`}
                onClick={(e) => { e.preventDefault(); scrollToSection(label.toLowerCase().replace(/ /g, '-')); }}
                style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.charcoal; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = Colors.medGray; }}>
                {label}
              </a>
            ))}
            <a href="/support"
              style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.charcoal; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = Colors.medGray; }}>
              Support
            </a>
            <button onClick={() => navigate('/login')}
              style={{ padding: '8px 20px', fontSize: 14, fontWeight: FontWeight.medium, background: 'transparent', color: Colors.charcoal, border: `1px solid ${Colors.lightGray}`, borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack, transition: 'all 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = Colors.copper; (e.target as HTMLElement).style.color = Colors.copper; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = Colors.lightGray; (e.target as HTMLElement).style.color = Colors.charcoal; }}>
              Log In
            </button>
            <button onClick={() => ctaToSignup('nav_header')}
              style={{ padding: '8px 20px', fontSize: 14, fontWeight: FontWeight.semibold, background: Colors.copper, color: Colors.white, border: 'none', borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack, transition: 'all 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = Colors.copperDark; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = Colors.copper; }}>
              Get Started
            </button>
          </nav>
        )}
      </div>

      {isMobile && mobileMenuOpen && (
        <nav style={{ display: 'flex', flexDirection: 'column', padding: '8px 0 16px', borderTop: '1px solid #eee' }}>
          {['Features', 'How It Works', 'Pricing'].map((label) => (
            <a key={label} href="#" onClick={(e) => { e.preventDefault(); scrollToSection(label.toLowerCase().replace(/ /g, '-')); }}
              style={{ padding: '12px 0', fontSize: 16, color: Colors.charcoal, textDecoration: 'none', fontWeight: FontWeight.medium }}>
              {label}
            </a>
          ))}
          <a href="/support" style={{ padding: '12px 0', fontSize: 16, color: Colors.charcoal, textDecoration: 'none', fontWeight: FontWeight.medium }}>Support</a>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
              style={{ flex: 1, padding: 12, fontSize: FontSize.md, fontWeight: FontWeight.medium, background: 'transparent', color: Colors.charcoal, border: `1px solid ${Colors.lightGray}`, borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack }}>
              Log In
            </button>
            <button onClick={() => { setMobileMenuOpen(false); ctaToSignup('mobile_menu'); }}
              style={{ flex: 1, padding: 12, fontSize: FontSize.md, fontWeight: FontWeight.semibold, background: Colors.copper, color: Colors.white, border: 'none', borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack }}>
              Get Started
            </button>
          </div>
        </nav>
      )}
    </header>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // HERO
  // ═══════════════════════════════════════════════════════════════════════════════
  const HeroSection = () => (
    <section style={{
      background: `linear-gradient(180deg, ${Colors.warmWhite} 0%, ${Colors.cream} 100%)`,
      padding: isMobile ? '56px 16px 64px' : '96px 24px 112px',
      textAlign: 'center', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* DL-2: ZIP pre-check pill — inline coverage lookup against
            service_areas with three outcome states (covered / coming soon
            / free-only). Persists to localStorage for onboarding reuse. */}
        <ZipPreCheck isMobile={isMobile} fontStack={fontStack} onCtaSignup={ctaToSignup} />

        {/* DL-6 — variant-driven headline. `outcome_promise` is the longer
            audit-recommended copy; `certainty_loop` is the current production
            headline kept as control. Both share the same markup so only
            textual content differs between variants. */}
        <h1
          data-hero-variant={heroVariant}
          style={{
            // Outcome-promise copy is longer; drop one step at each breakpoint
            // so the single-line CTA promise still fits two lines max on desktop.
            fontSize:
              heroVariant === 'outcome_promise'
                ? (isMobile ? 28 : 44)
                : (isMobile ? 34 : 54),
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            margin: '0 0 24px 0',
            lineHeight: 1.15,
          }}
        >
          {heroCopy.h1}
        </h1>

        <p style={{
          fontSize: isMobile ? 17 : 20, color: Colors.medGray,
          margin: '0 auto 40px', lineHeight: 1.6, maxWidth: 660,
        }}>
          {heroCopy.subhead}
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          <button onClick={() => ctaToSignup('hero')}
            style={{
              padding: '16px 40px', fontSize: 17, fontWeight: FontWeight.semibold,
              background: Colors.copper, color: Colors.white, border: 'none',
              borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack, transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = Colors.copperDark; (e.target as HTMLElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = Colors.copper; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}>
            {heroCopy.primaryCta}
          </button>
          <button onClick={() => {
              trackEvent('landing_hero_cta_click', {
                cta_label: heroCopy.secondaryCta,
                variant: heroVariant,
              });
              scrollToSection('how-it-works');
            }}
            style={{
              padding: '16px 40px', fontSize: 17, fontWeight: FontWeight.semibold,
              background: 'transparent', color: Colors.copper, border: `2px solid ${Colors.copper}`,
              borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack, transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = Colors.copperMuted; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}>
            {heroCopy.secondaryCta}
          </button>
        </div>

        <p style={{ fontSize: 14, color: Colors.medGray, margin: '0 0 32px 0' }}>
          Free forever — no credit card required
        </p>

        {/* DL-5 — Localized trust strip. Replaces the generic "bank-level
            encryption / powered by AI / web+iOS / 2 minutes" badge row with a
            Tulsa-specific proof strip: live count of Tulsa homes, named
            testimonial, neighborhood visual, BBB slot. Encryption language
            has moved to the /security page (linked from within the strip). */}
        <TulsaTrustStrip isMobile={isMobile} />
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // HOW IT WORKS
  // ═══════════════════════════════════════════════════════════════════════════════
  const HowItWorks = () => (
    <section id="how-it-works" style={{
      background: Colors.cream, padding: isMobile ? '48px 16px' : '80px 24px', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <p style={{
          textAlign: 'center', fontSize: FontSize.sm, fontWeight: FontWeight.bold,
          letterSpacing: 1.4, textTransform: 'uppercase', color: Colors.copper,
          margin: '0 0 12px 0',
        }}>
          How Canopy works
        </p>
        <h2 style={{
          fontSize: isMobile ? 26 : 38, fontWeight: FontWeight.bold,
          color: Colors.charcoal, textAlign: 'center', margin: '0 0 16px 0',
          lineHeight: 1.2,
        }}>
          Two minutes to start. Ten to feel set up.
        </h2>
        <p style={{
          fontSize: isMobile ? 15 : 17, color: Colors.medGray,
          textAlign: 'center', margin: '0 auto 56px', maxWidth: 620, lineHeight: 1.6,
        }}>
          Add equipment and documents whenever you have a minute — your plan starts working from day one either way.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 32 : 48,
        }}>
          {[
            { step: '1', title: 'Scan your equipment', desc: "Walk through your home and snap photos of appliance labels. Canopy reads make, model, serial, and age — then builds your inventory and the maintenance plan around it." },
            { step: '2', title: 'Follow your plan', desc: 'A calendar tailored to your specific equipment, climate, and season. Clear instructions, weather-aware alerts, and reminders so nothing slips.' },
            { step: '3', title: 'Layer in Pro when you’re ready', desc: 'Want it hands-off? Upgrade to Pro and a Canopy-certified technician shows up every other month to inspect, tune, and catch small things before they become expensive.' },
          ].map((item) => (
            <div key={item.step} style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: Colors.sage, color: Colors.white,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: FontSize.xl, fontWeight: FontWeight.bold, margin: '0 auto 20px',
              }}>
                {item.step}
              </div>
              <h3 style={{ fontSize: 19, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 10px 0' }}>{item.title}</h3>
              <p style={{ fontSize: FontSize.md, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // HOME TOKEN + MAINTENANCE INSPECTION — the moat
  // ═══════════════════════════════════════════════════════════════════════════════
  // 2026-05-06: most homeowner-care apps are calendars. The transferable,
  // tamper-evident maintenance record is what makes Canopy not a glorified
  // Notion template — it's the credibility wedge agents and buyers care
  // about. This section pulls Home Token + the Annual Maintenance Inspection
  // out of the FAQ + add-ons grid and gives them the visual real estate the
  // moat deserves.
  const HomeTokenSection = () => (
    <section style={{
      background: `linear-gradient(180deg, ${Colors.warmWhite} 0%, ${Colors.cream} 100%)`,
      padding: isMobile ? '64px 16px' : '112px 24px',
      fontFamily: fontStack,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle copper accent ribbon, top-right */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: -40, right: -80, width: 320, height: 320,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${Colors.copper}10 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        maxWidth: 1200, margin: '0 auto', position: 'relative',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.05fr 1fr',
        gap: isMobile ? 40 : 80,
        alignItems: 'center',
      }}>
        {/* Copy column */}
        <div>
          <p style={{
            fontSize: FontSize.sm, fontWeight: FontWeight.bold,
            letterSpacing: 1.4, textTransform: 'uppercase',
            color: Colors.copper, margin: '0 0 16px',
          }}>
            The Canopy Home Token
          </p>
          <h2 style={{
            fontSize: isMobile ? 30 : 44, fontWeight: FontWeight.bold,
            color: Colors.charcoal, margin: '0 0 20px', lineHeight: 1.15,
          }}>
            The maintenance record buyers actually trust.
          </h2>
          <p style={{
            fontSize: isMobile ? 16 : 18, color: Colors.medGray,
            lineHeight: 1.6, margin: '0 0 28px',
          }}>
            Every visit, repair, replacement, and warranty is timestamped, photo-backed where applicable, and tied to the home itself — not your account. When you list, you hand the buyer a verifiable Home Token. The HomeLight data says it&apos;s worth roughly <strong style={{ color: Colors.charcoal }}>$14,000</strong> in inspection objections you don&apos;t have to negotiate away.
          </p>
          <ul style={{
            listStyle: 'none', padding: 0, margin: '0 0 32px',
            display: 'grid', gap: 14,
          }}>
            {[
              { icon: '🛡️', text: <>Optional <strong>Annual Maintenance Inspection</strong> by a Canopy-vetted Pro stamps a tamper-evident record onto the Token — from $149/yr.</> },
              { icon: '📸', text: <>Photo-backed visit logs, manuals, warranties, and receipts in one place — automatically organized.</> },
              { icon: '🤝', text: <>Transfer the Token to the next owner with one click. Their care continues yours.</> },
            ].map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span aria-hidden="true" style={{ fontSize: FontSize.xl, lineHeight: '28px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: FontSize.md, color: Colors.charcoal, lineHeight: 1.55 }}>{item.text}</span>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <button onClick={() => ctaToSignup('home_token')}
              style={{
                padding: '14px 28px', fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                background: Colors.copper, color: Colors.white, border: 'none',
                borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = Colors.copperDark; (e.target as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = Colors.copper; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}>
              Start your Home Token →
            </button>
            <button onClick={() => scrollToSection('pricing')}
              style={{
                padding: '14px 28px', fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                background: 'transparent', color: Colors.copper, border: 'none',
                cursor: 'pointer', fontFamily: fontStack,
              }}>
              See pricing
            </button>
          </div>
        </div>

        {/* Mock Home Token preview — styled to mimic the public share view */}
        <div aria-hidden="true" style={{
          position: 'relative',
          background: Colors.white,
          borderRadius: 18,
          padding: isMobile ? 20 : 28,
          boxShadow: '0 24px 64px -16px rgba(38, 32, 28, 0.18), 0 4px 12px rgba(38, 32, 28, 0.06)',
          border: `1px solid ${Colors.copper}20`,
          maxWidth: isMobile ? '100%' : 480,
          marginLeft: isMobile ? 0 : 'auto',
          transform: isMobile ? 'none' : 'rotate(-1.5deg)',
        }}>
          {/* Token header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: FontSize.lg }}>🏡</span>
            <span style={{
              fontSize: FontSize.xs, fontWeight: FontWeight.bold,
              letterSpacing: 0.7, textTransform: 'uppercase', color: Colors.copper,
            }}>Canopy Home Token</span>
          </div>
          <h3 style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: '0 0 4px', lineHeight: 1.2 }}>
            1247 Cedar Ridge Dr
          </h3>
          <p style={{ fontSize: 14, color: Colors.medGray, margin: '0 0 16px' }}>
            Tulsa, OK · 2,400 sqft · Built 1998
          </p>

          {/* Completeness bar */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>Record completeness</span>
              <span style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.sageDark }}>92%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: Colors.lightGray, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: '92%', borderRadius: 4,
                background: `linear-gradient(90deg, ${Colors.sage}, ${Colors.sageDark})`,
              }} />
            </div>
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {[
              { label: 'Maintenance Inspection ✓', tone: Colors.copper },
              { label: '12 visits logged', tone: Colors.sage },
              { label: 'Warranties on file', tone: Colors.sage },
            ].map((b) => (
              <span key={b.label} style={{
                fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
                padding: '4px 10px', borderRadius: 999,
                background: `${b.tone}18`, color: b.tone,
              }}>
                {b.label}
              </span>
            ))}
          </div>

          {/* Maintenance Inspection callout — the wedge */}
          <div style={{
            display: 'flex', gap: 12,
            padding: 14, borderRadius: 12,
            background: `linear-gradient(135deg, ${Colors.cream} 0%, ${Colors.copper}10 100%)`,
            border: `1px solid ${Colors.copper}30`,
            marginBottom: 14,
          }}>
            <span style={{ fontSize: FontSize.xl, lineHeight: 1, flexShrink: 0 }}>🛡️</span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, textTransform: 'uppercase', color: Colors.copper, margin: 0 }}>
                Maintenance Inspection on file
              </p>
              <p style={{ fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '2px 0 0' }}>
                Last inspected April 12, 2026
              </p>
            </div>
          </div>

          {/* Recent activity rows */}
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              { icon: '🔧', label: 'HVAC quarterly tune-up', date: 'Apr 28' },
              { icon: '💧', label: 'Water heater anode replaced', date: 'Mar 14' },
              { icon: '🍂', label: 'Gutters cleared & inspected', date: 'Nov 02' },
            ].map((row) => (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0', borderTop: `1px solid ${Colors.lightGray}`,
              }}>
                <span aria-hidden="true" style={{ fontSize: 14 }}>{row.icon}</span>
                <span style={{ flex: 1, fontSize: 12, color: Colors.charcoal }}>{row.label}</span>
                <span style={{ fontSize: FontSize.xs, color: Colors.medGray }}>{row.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // ADD-ONS (DL-3) — recurring services between "How it works" and features
  // ═══════════════════════════════════════════════════════════════════════════════
  const AddOnsSection = () => {
    const cards: Array<{
      slug: 'pest' | 'lawn' | 'pool' | 'septic' | 'cleaning';
      category: 'pest' | 'lawn' | 'pool' | 'septic' | 'cleaning';
      icon: string;
      title: string;
      desc: string;
      startsAt: number; // monthly floor in USD
    }> = [
      { slug: 'pest',     category: 'pest',     icon: '🪳', title: 'Pest Shield',    desc: 'Quarterly treatments + free re-services. Tulsa Certified Pros handle the rotation so you never think about it.', startsAt: 39 },
      { slug: 'lawn',     category: 'lawn',     icon: '🌿', title: 'Lawn Care',      desc: 'Mow, edge, and fertilize on a bi-weekly schedule built around your yard size and grass type.', startsAt: 59 },
      { slug: 'pool',     category: 'pool',     icon: '🏊', title: 'Pool Service',   desc: 'Weekly chemistry, cleaning, and equipment checks. Log book stays in Canopy.', startsAt: 149 },
      { slug: 'septic',   category: 'septic',   icon: '💧', title: 'Septic Care',    desc: 'Scheduled inspections, pumping reminders, and on-call response when something goes wrong.', startsAt: 19 },
      { slug: 'cleaning', category: 'cleaning', icon: '🧹', title: 'House Cleaning', desc: 'Bi-weekly deep clean, scoped to your home size and priorities. Same crew, same day, every visit.', startsAt: 129 },
    ];

    const handleCardClick = (card: typeof cards[number]) => {
      trackEvent('landing_addon_card_click', { category: card.category });
      navigate(`/add-ons?focus=${card.slug}`);
    };

    return (
      <section
        id="add-ons"
        style={{
          background: Colors.warmWhite,
          padding: isMobile ? '48px 0' : '80px 24px',
          fontFamily: fontStack,
        }}
        aria-labelledby="add-ons-heading"
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px' : 0 }}>
          <h2
            id="add-ons-heading"
            style={{
              fontSize: isMobile ? 26 : 38,
              fontWeight: FontWeight.bold,
              color: Colors.charcoal,
              textAlign: 'center',
              margin: '0 0 12px 0',
              lineHeight: 1.25,
            }}
          >
            Hand off the home-care tasks you don&apos;t want to think about.
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
            Layer Canopy-vetted recurring services onto your plan. One login, one
            invoice, one record of what was done and when.
          </p>
        </div>

        {/* Horizontal-scroll row on mobile, 5-column grid on desktop */}
        <div
          role="list"
          aria-label="Recurring add-on services"
          style={
            isMobile
              ? {
                  display: 'flex',
                  gap: 14,
                  overflowX: 'auto',
                  padding: '4px 16px 16px 16px',
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                }
              : {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 20,
                  maxWidth: 1200,
                  margin: '0 auto',
                }
          }
        >
          {cards.map((c) => (
            <button
              key={c.slug}
              role="listitem"
              onClick={() => handleCardClick(c)}
              onMouseEnter={(e) => cardHover(e, true)}
              onMouseLeave={(e) => cardHover(e, false)}
              aria-label={`${c.title}: ${c.desc} Starts at $${c.startsAt} per month. Learn more.`}
              style={{
                flex: isMobile ? '0 0 78%' : undefined,
                scrollSnapAlign: isMobile ? 'start' : undefined,
                minWidth: isMobile ? 260 : undefined,
                background: Colors.white,
                border: `1px solid ${Colors.lightGray}`,
                borderRadius: BorderRadius.lg,
                padding: isMobile ? 20 : 22,
                textAlign: 'left',
                fontFamily: fontStack,
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }} aria-hidden="true">
                {c.icon}
              </div>
              <h3
                style={{
                  fontSize: FontSize.lg,
                  fontWeight: FontWeight.semibold,
                  color: Colors.charcoal,
                  margin: '0 0 8px 0',
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: Colors.medGray,
                  lineHeight: 1.55,
                  margin: '0 0 14px 0',
                  flex: 1,
                }}
              >
                {c.desc}
              </p>
              <div
                style={{
                  fontSize: FontSize.sm,
                  fontWeight: FontWeight.semibold,
                  color: Colors.charcoal,
                  marginBottom: 4,
                }}
              >
                Starts at ${c.startsAt}/mo
              </div>
              <div style={{ fontSize: 12, color: Colors.medGray, marginBottom: 14 }}>
                Your exact price after property assessment.
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 14,
                  fontWeight: FontWeight.semibold,
                  color: Colors.copper,
                }}
                aria-hidden="true"
              >
                Learn more →
              </span>
            </button>
          ))}
        </div>

        <p
          style={{
            fontSize: FontSize.sm,
            color: Colors.medGray,
            textAlign: 'center',
            maxWidth: 640,
            margin: '32px auto 0',
            padding: '0 16px',
          }}
        >
          Add-on services are available to Home and Pro subscribers in active
          Canopy service areas. Not in a service area yet?{' '}
          <button
            onClick={() => ctaToSignup('addons_waitlist')}
            style={{
              background: 'none',
              border: 'none',
              color: Colors.copper,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: FontSize.sm,
              fontFamily: fontStack,
              padding: 0,
            }}
          >
            Join the waitlist
          </button>{' '}
          and we&apos;ll notify you when we launch.
        </p>
      </section>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // WHO IS IT FOR — persona cards targeting the main entry-points into Canopy
  // ═══════════════════════════════════════════════════════════════════════════════
  const WhoIsItFor = () => {
    const personas: Array<{
      key: 'new_owner' | 'established' | 'selling_soon' | 'investor';
      icon: string;
      title: string;
      desc: string;
      cta: string;
      destination: string;
    }> = [
      {
        key: 'new_owner',
        icon: '🔑',
        title: 'Just bought a home?',
        desc: 'Scan your equipment in minutes. Your maintenance plan, warranties, and Home Token start working from day one.',
        cta: 'Set up day one',
        destination: '/signup',
      },
      {
        key: 'established',
        icon: '🏡',
        title: 'Been in it a few years?',
        desc: 'Replace the junk drawer of receipts. Document what you\'ve done, catch what you missed, and build the proof of care that protects resale value.',
        cta: 'See your home health',
        destination: '/signup',
      },
      {
        key: 'selling_soon',
        icon: '📋',
        title: 'Selling soon?',
        desc: 'Walk into listing day with a verifiable maintenance record and a Sale Prep checklist Tulsa agents helped us build. Worth ~$14k against inspection objections per HomeLight.',
        cta: 'Preview Sale Prep',
        destination: '/sale-prep-preview',
      },
    ];

    return (
      <section
        id="who-is-it-for"
        style={{
          background: Colors.warmWhite,
          padding: isMobile ? '56px 16px' : '80px 24px',
          fontFamily: fontStack,
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: isMobile ? 26 : 36,
              fontWeight: FontWeight.bold,
              color: Colors.charcoal,
              textAlign: 'center',
              margin: '0 0 12px 0',
            }}
          >
            Where are you in the homeownership journey?
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
            Canopy meets you where you are — from day-one setup to listing day.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: isMobile ? 16 : 24,
            }}
          >
            {personas.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  trackEvent('landing_persona_card_click', {
                    persona: p.key,
                    destination: p.destination,
                  });
                  navigate(p.destination);
                }}
                style={{
                  background: Colors.white,
                  border: `1px solid ${Colors.lightGray}`,
                  borderRadius: BorderRadius.lg,
                  padding: isMobile ? 24 : 28,
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                  fontFamily: fontStack,
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = 'translateY(-3px)';
                  el.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
                  el.style.borderColor = Colors.copper;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = 'none';
                  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                  el.style.borderColor = Colors.lightGray;
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 14 }}>{p.icon}</div>
                <h3
                  style={{
                    fontSize: FontSize.lg,
                    fontWeight: FontWeight.semibold,
                    color: Colors.charcoal,
                    margin: '0 0 8px 0',
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: Colors.medGray,
                    lineHeight: 1.6,
                    margin: '0 0 16px 0',
                    flex: 1,
                  }}
                >
                  {p.desc}
                </p>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: FontWeight.semibold,
                    color: Colors.copper,
                  }}
                >
                  {p.cta} &rarr;
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // FEATURES GRID
  // ═══════════════════════════════════════════════════════════════════════════════
  const FeaturesSection = () => (
    <section id="features" style={{
      background: '#F5F4F0', padding: isMobile ? '48px 16px' : '80px 24px', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{
          fontSize: isMobile ? 26 : 38, fontWeight: FontWeight.bold,
          color: Colors.charcoal, textAlign: 'center', margin: '0 0 12px 0',
        }}>
          Everything your home needs in one place
        </h2>
        <p style={{
          fontSize: isMobile ? 15 : 17, color: Colors.medGray, textAlign: 'center',
          maxWidth: 560, margin: '0 auto 48px', lineHeight: 1.5,
        }}>
          From day-one setup to selling your home — Canopy covers the full homeownership lifecycle.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 16 : 24,
        }}>
          {[
            { icon: '📸', title: 'AI Equipment Scanner', desc: 'Point your camera at any appliance label. Canopy reads the make, model, serial number, and expected lifespan — then generates a personalized maintenance schedule in seconds.' },
            { icon: '📅', title: 'Smart Maintenance Calendar', desc: '40+ task templates customized to your equipment, climate zone, and season. Weather-smart alerts pair severe weather with actionable prep tasks specific to your home.' },
            { icon: '💬', title: 'AI Home Assistant', desc: 'Ask anything about your home. Get instant, personalized answers grounded in your actual equipment, maintenance history, and local conditions.' },
            { icon: '🔧', title: 'Bimonthly Pro Visits', desc: 'Canopy-certified technicians visit every other month to inspect systems, change filters, and generate detailed reports. Available on Pro plans in Tulsa.' },
            { icon: '🗂️', title: 'Document Vault & Home Token', desc: 'Store warranties, manuals, inspection reports, and receipts. Everything builds toward your Home Token — the verified, timestamped record of your home\'s complete history that transfers when you sell.' },
            { icon: '📊', title: 'Home Health Score', desc: 'A living score that reflects how well-maintained your home is. Track it over time, see exactly where to focus next, and use it as proof of care when you list.' },
          ].map((f) => (
            <div key={f.title}
              style={{
                background: Colors.white, padding: isMobile ? 24 : 28, borderRadius: BorderRadius.lg,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => cardHover(e, true)}
              onMouseLeave={(e) => cardHover(e, false)}>
              <div style={{ fontSize: FontSize.xxl, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATS — the "why you should care" proof points (sourced)
  // ═══════════════════════════════════════════════════════════════════════════════
  const StatsSection = () => (
    <section style={{
      background: Colors.warmWhite, padding: isMobile ? '56px 16px' : '88px 24px', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{
          fontSize: isMobile ? 24 : 34, fontWeight: FontWeight.bold,
          color: Colors.charcoal, textAlign: 'center', margin: '0 0 12px 0',
        }}>
          The cost of not maintaining your home
        </h2>
        <p style={{
          fontSize: isMobile ? 15 : 17, color: Colors.medGray, textAlign: 'center',
          maxWidth: 640, margin: '0 auto 48px', lineHeight: 1.6,
        }}>
          Deferred maintenance is the single largest hidden cost of homeownership. Canopy exists to make routine care effortless — and keep these numbers from becoming yours.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 20 : 28,
        }}>
          {[
            {
              stat: '$14,000',
              label: 'Average inspection-driven price reduction at sale',
              support: 'A clean, documented maintenance history is the single strongest defense against deal-killing inspection objections.',
              source: 'HomeLight Top Agent Insights',
            },
            {
              stat: '10%',
              label: 'Of total home value lost to deferred maintenance',
              support: 'For a $400,000 home, that\'s $40,000 in value quietly bleeding away. Routine care protects your biggest asset.',
              source: 'National Association of Home Builders',
            },
            {
              stat: '6×',
              label: 'What a delayed repair typically costs vs. preventive maintenance',
              support: 'Every $1 spent on prevention saves up to $100 in emergency repairs. Canopy schedules the $1.',
              source: 'ASHI / Today\'s Homeowner',
            },
          ].map((s) => (
            <div key={s.stat} style={{
              background: Colors.white, padding: isMobile ? 24 : 32, borderRadius: BorderRadius.lg,
              border: `1px solid ${Colors.lightGray}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                fontSize: isMobile ? 40 : 52, fontWeight: FontWeight.bold,
                color: Colors.copper, lineHeight: 1, marginBottom: 12,
              }}>
                {s.stat}
              </div>
              <div style={{
                fontSize: isMobile ? 15 : 16, fontWeight: FontWeight.semibold,
                color: Colors.charcoal, lineHeight: 1.4, marginBottom: 12,
              }}>
                {s.label}
              </div>
              <p style={{
                fontSize: 14, color: Colors.medGray, lineHeight: 1.6, margin: '0 0 16px 0', flex: 1,
              }}>
                {s.support}
              </p>
              <div style={{
                fontSize: 12, color: Colors.medGray, fontStyle: 'italic',
                paddingTop: 12, borderTop: `1px solid ${Colors.lightGray}`,
              }}>
                Source: {s.source}
              </div>
            </div>
          ))}
        </div>

        <p style={{
          fontSize: FontSize.sm, color: Colors.medGray, textAlign: 'center',
          margin: '36px auto 0', maxWidth: 700, lineHeight: 1.6,
        }}>
          Additional figures drawn from the NAR REALTORS® Confidence Index, Bankrate 2025 Home Affordability Report, Angi State of Home Spending, Freddie Mac, and Department of Energy / Energy Star published guidance on HVAC lifespan.
        </p>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRICING
  // ═══════════════════════════════════════════════════════════════════════════════
  const PricingSection = () => {
    const fmt = (n: number) => (n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`);
    const homeDisplay = billingInterval === 'yearly'
      ? { price: fmt(PRICING.home.stripe.yearly / 12), period: '/mo, billed annually' }
      : { price: fmt(PRICING.home.stripe.monthly), period: '/mo' };
    const proDisplay = billingInterval === 'yearly'
      ? { price: fmt(PRICING.pro.stripe.yearly / 12), period: '/mo, billed annually' }
      : { price: fmt(PRICING.pro.stripe.monthly), period: '/mo' };

    const baseCard: React.CSSProperties = {
      background: Colors.white, border: `2px solid ${Colors.lightGray}`,
      padding: '40px 24px', borderRadius: BorderRadius.lg, textAlign: 'center',
      display: 'flex', flexDirection: 'column',
    };
    const featuredCard: React.CSSProperties = {
      ...baseCard,
      border: `2px solid ${Colors.copper}`,
      position: 'relative',
      transform: isMobile ? 'none' : 'scale(1.04)',
      boxShadow: '0 12px 32px rgba(196, 132, 78, 0.15)',
    };
    const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0, margin: '0 0 28px 0', textAlign: 'left', flex: 1 };
    const itemStyle: React.CSSProperties = { fontSize: 14, color: Colors.medGray, marginBottom: 10, display: 'flex', gap: 8 };
    const checkStyle: React.CSSProperties = { color: Colors.sage, flexShrink: 0 };

    // Comparison table data — Pro+ column dropped 2026-05-06 (tier killed
    // 2026-04-29 pre-launch).
    const rows: Array<[string, string, string, string]> = [
      ['Equipment items', 'Up to 3', 'Unlimited', 'Unlimited'],
      ['Maintenance calendar (40+ tasks)', 'Basic', '✓', '✓'],
      ['AI equipment scans (photo)', '1 lifetime', 'Unlimited', 'Unlimited'],
      ['AI chat messages', '5/mo', 'Unlimited', 'Unlimited'],
      ['Text model lookup', '2/mo', 'Unlimited', 'Unlimited'],
      ['Maintenance history', '90 days', 'Full', 'Full'],
      ['Weather-smart alerts', '✓', '✓', '✓'],
      ['Document vault', '✓', '✓', '✓'],
      ['Secure notes (PIN-protected)', '—', '✓', '✓'],
      ['Home health score', '—', '✓', '✓'],
      ['Home Token + completeness score', '—', '✓', '✓'],
      ['Sale prep checklist', '—', '✓', '✓'],
      ['Bimonthly pro visits', '—', '—', '6/yr'],
      ['Detailed inspection reports', '—', '—', '✓'],
      ['Priority scheduling', '—', '—', '✓'],
      ['Canopy Certified Pro network', '—', '—', '✓'],
    ];
    const headers = ['Free', 'Home', 'Pro'];

    const cell: React.CSSProperties = {
      padding: isMobile ? '10px 8px' : '14px 16px',
      borderBottom: `1px solid ${Colors.lightGray}`,
      fontSize: isMobile ? 12 : 14,
      color: Colors.charcoal,
      textAlign: 'center',
    };
    const featureCell: React.CSSProperties = {
      ...cell,
      textAlign: 'left',
      color: Colors.charcoal,
      fontWeight: FontWeight.medium,
      position: 'sticky',
      left: 0,
      background: Colors.white,
      minWidth: isMobile ? 140 : 260,
    };
    const headerCell: React.CSSProperties = {
      ...cell,
      fontWeight: FontWeight.bold,
      background: Colors.warmWhite,
      borderBottom: `2px solid ${Colors.copper}`,
      color: Colors.charcoal,
      fontSize: isMobile ? 13 : 15,
      position: 'sticky',
      top: 0,
    };
    const renderValue = (v: string) => {
      if (v === '✓') return <span style={{ color: Colors.sage, fontWeight: FontWeight.bold, fontSize: FontSize.lg }} aria-label="included">✓</span>;
      if (v === '—') return <span style={{ color: Colors.medGray }} aria-label="not included">—</span>;
      return v;
    };

    return (
      <section id="pricing" style={{
        background: Colors.white, padding: isMobile ? '48px 16px' : '80px 24px', fontFamily: fontStack,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <h2 style={{
            fontSize: isMobile ? 26 : 38, fontWeight: FontWeight.bold,
            color: Colors.charcoal, textAlign: 'center', margin: '0 0 12px 0',
          }}>
            Simple, transparent pricing
          </h2>
          <p style={{
            fontSize: 16, color: Colors.medGray, textAlign: 'center',
            maxWidth: 560, margin: '0 auto 32px',
          }}>
            Start free, upgrade when you're ready. Every plan builds your home's verified record.
          </p>

          {/* Monthly / Annual toggle */}
          <div
            role="tablist"
            aria-label="Billing interval"
            style={{
              display: 'inline-flex',
              background: Colors.warmWhite,
              border: `1px solid ${Colors.lightGray}`,
              borderRadius: BorderRadius.full,
              padding: 4,
              margin: '0 auto 40px',
              position: 'relative',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {(['monthly', 'yearly'] as BillingInterval[]).map((interval) => {
              const active = billingInterval === interval;
              return (
                <button
                  key={interval}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setBillingInterval(interval)}
                  style={{
                    padding: '10px 22px',
                    fontSize: 14,
                    fontWeight: FontWeight.semibold,
                    background: active ? Colors.copper : 'transparent',
                    color: active ? Colors.white : Colors.medGray,
                    border: 'none',
                    borderRadius: BorderRadius.full,
                    cursor: 'pointer',
                    fontFamily: fontStack,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {interval === 'monthly' ? 'Monthly' : 'Annual'}
                  {interval === 'yearly' && (
                    <span style={{
                      fontSize: FontSize.xs,
                      fontWeight: FontWeight.bold,
                      background: active ? 'rgba(255,255,255,0.25)' : Colors.sageMuted,
                      color: active ? Colors.white : Colors.sageDark,
                      padding: '2px 8px',
                      borderRadius: BorderRadius.full,
                    }}>
                      Save {ANNUAL_DISCOUNT_PERCENT}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
            gap: isMobile ? 20 : 20,
            marginBottom: 32,
            alignItems: 'stretch',
          }}>
            {/* Free */}
            <div style={baseCard}>
              <h3 style={{ fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Free</h3>
              <div style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
                $0<span style={{ fontSize: 14, color: Colors.medGray }}>/mo</span>
              </div>
              <p style={{ fontSize: FontSize.sm, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium, minHeight: 38 }}>Get to know your home</p>
              <ul style={listStyle}>
                {['Up to 3 equipment items', 'Basic maintenance calendar', 'Weather alerts', '5 AI chat messages/mo', '2 text lookups/mo', '1 AI equipment scan', '90-day history'].map((i) => (
                  <li key={i} style={itemStyle}><span style={checkStyle}>✓</span> {i}</li>
                ))}
              </ul>
              <button onClick={() => ctaToSignup('pricing_free')} style={{
                width: '100%', padding: 12, fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                background: Colors.lightGray, color: Colors.charcoal, border: 'none',
                borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
              }}>
                Start Free
              </button>
            </div>

            {/* Home — Most Popular */}
            <div style={featuredCard} aria-label="Most popular plan">
              <div style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                background: Colors.copper, color: Colors.white,
                padding: '6px 16px', borderRadius: BorderRadius.full,
                fontSize: FontSize.xs, fontWeight: FontWeight.semibold, whiteSpace: 'nowrap',
              }}>MOST POPULAR</div>
              <h3 style={{ fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Home</h3>
              <div style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
                {homeDisplay.price}<span style={{ fontSize: FontSize.sm, color: Colors.medGray }}>{homeDisplay.period}</span>
              </div>
              <p style={{ fontSize: FontSize.sm, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium, minHeight: 38 }}>
                Complete home management
              </p>
              <ul style={listStyle}>
                {['Everything in Free', 'Unlimited equipment', 'Unlimited AI scans & chat', 'Full maintenance history', 'Smart scheduling & reminders', 'Home health score', 'Home Token with completeness score', 'Sale prep checklist', 'Secure notes'].map((i) => (
                  <li key={i} style={itemStyle}><span style={checkStyle}>✓</span> {i}</li>
                ))}
              </ul>
              <button onClick={() => ctaToSignup('pricing_home')} style={{
                width: '100%', padding: 12, fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                background: Colors.copper, color: Colors.white, border: 'none',
                borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
              }}>
                Get Home Plan
              </button>
            </div>

            {/* Pro */}
            <div style={baseCard}>
              <h3 style={{ fontSize: FontSize.xl, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Pro</h3>
              <div style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
                {proDisplay.price}<span style={{ fontSize: FontSize.sm, color: Colors.medGray }}>{proDisplay.period}</span>
              </div>
              <p style={{ fontSize: FontSize.sm, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium, minHeight: 38 }}>
                Full-service bimonthly care
              </p>
              <ul style={listStyle}>
                {['Everything in Home', '6 bimonthly pro visits/year', 'Detailed inspection reports', 'Priority scheduling', 'Verified maintenance records', 'Canopy Certified Pro network'].map((i) => (
                  <li key={i} style={itemStyle}><span style={checkStyle}>✓</span> {i}</li>
                ))}
              </ul>
              <button onClick={() => ctaToSignup('pricing_pro')} style={{
                width: '100%', padding: 12, fontSize: FontSize.md, fontWeight: FontWeight.semibold,
                background: Colors.lightGray, color: Colors.charcoal, border: 'none',
                borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
              }}>
                Get Started
              </button>
            </div>

            {/* Pro+ tier removed 2026-04-29 (pre-launch, 0 subscribers).
                The "Pro+ services" name is now the umbrella brand for the
                curated add-on bundle, sold per-add-on through the Add-Ons
                section above. The card was still rendering on the landing
                page at launch-readiness audit on 2026-05-06 — removed. */}
          </div>

          <p style={{ textAlign: 'center', fontSize: 14, color: Colors.medGray, margin: '0 0 32px 0' }}>
            All plans include a 7-day money-back guarantee.
          </p>

          {/* Inline comparison details */}
          <details style={{
            background: Colors.warmWhite,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: BorderRadius.lg,
            padding: '20px 24px',
            cursor: 'pointer',
            marginTop: 24,
          }}
          open={comparisonOpen}
          onToggle={(e) => setComparisonOpen((e.target as HTMLDetailsElement).open)}>
            <summary style={{
              fontSize: 16,
              fontWeight: FontWeight.semibold,
              color: Colors.charcoal,
              listStyle: 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>See full feature comparison</span>
              <span style={{ fontSize: 20, color: Colors.copper, transform: comparisonOpen ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>+</span>
            </summary>

            <div style={{ marginTop: 24, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: isMobile ? 560 : 'auto',
              }}>
                <thead>
                  <tr>
                    <th style={{ ...headerCell, textAlign: 'left', left: 0, zIndex: 2 }} scope="col">Feature</th>
                    {headers.map((h) => (
                      <th key={h} style={headerCell} scope="col">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([feature, free, home, pro], idx) => (
                    <tr key={feature} style={{ background: idx % 2 === 0 ? Colors.white : Colors.warmWhite }}>
                      <th scope="row" style={{ ...featureCell, background: idx % 2 === 0 ? Colors.white : Colors.warmWhite }}>{feature}</th>
                      <td style={cell}>{renderValue(free)}</td>
                      <td style={cell}>{renderValue(home)}</td>
                      <td style={cell}>{renderValue(pro)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isMobile && (
              <p style={{ fontSize: 12, color: Colors.medGray, textAlign: 'center', margin: '12px 0 0' }}>
                ← Scroll horizontally to see all plans →
              </p>
            )}
          </details>
        </div>
      </section>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // FAQ
  // ═══════════════════════════════════════════════════════════════════════════════
  const FaqSection = () => (
    <section id="faq" style={{
      background: Colors.white, padding: isMobile ? '56px 16px' : '88px 24px', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h2 style={{
          fontSize: isMobile ? 26 : 36, fontWeight: FontWeight.bold,
          color: Colors.charcoal, textAlign: 'center', margin: '0 0 12px 0',
        }}>
          Frequently asked questions
        </h2>
        <p style={{
          fontSize: isMobile ? 15 : 17, color: Colors.medGray, textAlign: 'center',
          maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.6,
        }}>
          Don't see your question? Email us at{' '}
          <a
            href="mailto:support@canopyhome.app"
            style={{ color: Colors.copper, textDecoration: 'none', fontWeight: FontWeight.semibold }}
          >
            support@canopyhome.app
          </a>.
        </p>

        <div>
          {FAQ_ITEMS.map((f) => (
            <details
              key={f.q}
              style={{
                background: Colors.warmWhite,
                border: `1px solid ${Colors.lightGray}`,
                borderRadius: BorderRadius.lg,
                padding: '4px 4px',
                marginBottom: 12,
              }}
            >
              <summary
                style={{
                  listStyle: 'none',
                  cursor: 'pointer',
                  padding: '18px 20px',
                  fontSize: isMobile ? 15 : 16,
                  fontWeight: FontWeight.semibold,
                  color: Colors.charcoal,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <span>{f.q}</span>
                <span
                  aria-hidden="true"
                  style={{
                    color: Colors.copper,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    flexShrink: 0,
                  }}
                >
                  +
                </span>
              </summary>
              <div style={{
                padding: '0 20px 18px 20px',
                fontSize: isMobile ? 14 : 15,
                color: Colors.medGray,
                lineHeight: 1.6,
              }}>
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // AGENT REFERRAL STRIP — for Tulsa real estate agents (lead-source channel)
  // ═══════════════════════════════════════════════════════════════════════════════
  // 2026-05-06: Agents are explicitly a strategic lead source per the
  // business model (no commission — closing-gift codes + co-branded share
  // pages). The /agent landing exists but was buried in the footer.
  // This thin strip surfaces it to anyone scrolling past the FAQ.
  const AgentReferralStrip = () => (
    <section style={{
      background: `linear-gradient(135deg, ${Colors.sage}10 0%, ${Colors.copper}10 100%)`,
      padding: isMobile ? '40px 16px' : '56px 24px',
      fontFamily: fontStack,
      borderTop: `1px solid ${Colors.lightGray}`,
      borderBottom: `1px solid ${Colors.lightGray}`,
    }}>
      <div style={{
        maxWidth: 980, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 32,
        flexDirection: isMobile ? 'column' : 'row',
        textAlign: isMobile ? 'center' : 'left',
      }}>
        <div aria-hidden="true" style={{
          fontSize: 40, lineHeight: 1, flexShrink: 0,
        }}>🔑</div>
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: FontSize.sm, fontWeight: FontWeight.bold,
            letterSpacing: 1.2, textTransform: 'uppercase',
            color: Colors.copper, margin: '0 0 6px',
          }}>
            For Tulsa real estate agents
          </p>
          <h3 style={{
            fontSize: isMobile ? 20 : 24, fontWeight: FontWeight.bold,
            color: Colors.charcoal, margin: '0 0 6px', lineHeight: 1.25,
          }}>
            Your closing-gift program lives here.
          </h3>
          <p style={{
            fontSize: FontSize.md, color: Colors.medGray,
            lineHeight: 1.5, margin: 0, maxWidth: 560,
          }}>
            Co-branded gift codes, a buyer-facing Home Token for every closed deal, and analytics you can actually use. No commission, no kickback — just a tool your clients keep using a year after the sale.
          </p>
        </div>
        <button
          onClick={() => navigate('/agent')}
          style={{
            padding: '14px 24px', fontSize: FontSize.md, fontWeight: FontWeight.semibold,
            background: Colors.charcoal, color: Colors.white, border: 'none',
            borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
            transition: 'all 0.3s ease', flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'translateY(-2px)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
        >
          Agent Portal →
        </button>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FINAL CTA
  // ═══════════════════════════════════════════════════════════════════════════════
  const FinalCta = () => (
    <section style={{
      background: `linear-gradient(135deg, ${Colors.charcoal} 0%, #1a1a1a 100%)`,
      padding: isMobile ? '48px 16px' : '80px 24px', fontFamily: fontStack, textAlign: 'center',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{
          fontSize: isMobile ? 28 : 40, fontWeight: FontWeight.bold,
          color: Colors.white, margin: '0 0 16px 0', lineHeight: 1.2,
        }}>
          Your home deserves better than a junk drawer
        </h2>
        <p style={{
          fontSize: isMobile ? 16 : 18, color: 'var(--color-silver)', lineHeight: 1.6, margin: '0 0 36px 0',
        }}>
          Start in 2 minutes. Free forever. Upgrade when you're ready.
        </p>
        <button onClick={() => ctaToSignup('final_cta')}
          style={{
            padding: '16px 48px', fontSize: 17, fontWeight: FontWeight.semibold,
            background: Colors.copper, color: Colors.white, border: 'none',
            borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack, transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = Colors.copperLight; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = Colors.copper; }}>
          Get Started Free
        </button>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════════════════
  const Footer = () => (
    <footer style={{
      background: Colors.charcoal, color: Colors.white, padding: '60px 24px 24px', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: isMobile ? 24 : 40,
          marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div>
            <h3 style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, margin: '0 0 12px 0' }}>Canopy</h3>
            <p style={{ fontSize: 14, color: 'var(--color-silver)', margin: 0, lineHeight: 1.5 }}>
              The maintenance record your home should already have. Built in Tulsa.
            </p>
          </div>
          {[
            {
              title: 'Product',
              links: [
                { label: 'Features', href: '#features' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'FAQ', href: '#faq' },
                { label: 'Get Started', href: '/signup' },
              ],
            },
            {
              title: 'Company',
              links: [
                { label: 'Add-On Services', href: '/add-ons' },
                { label: 'For Agents', href: '/for-agents' },
                { label: 'For Pros', href: '/for-pros' },
                { label: 'Support', href: '/support' },
              ],
            },
            {
              title: 'Legal',
              links: [
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Security & Privacy', href: '/security' },
                { label: 'Contractor Terms', href: '/contractor-terms' },
                { label: 'AI Disclaimer', href: '/ai-disclaimer' },
                { label: 'Cancellation', href: '/cancellation' },
              ],
            },
          ].map((section) => (
            <div key={section.title}>
              <h4 style={{ fontSize: 14, fontWeight: FontWeight.semibold, margin: '0 0 16px 0' }}>{section.title}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {section.links.map((link) => (
                  <li key={link.label} style={{ marginBottom: 8 }}>
                    <a href={link.href}
                      style={{ color: 'var(--color-silver)', textDecoration: 'none', fontSize: 14, transition: 'color 0.3s' }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.copper; }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#CCCCCC'; }}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: FontWeight.semibold, margin: '0 0 16px 0' }}>Contact</h4>
            <a href="mailto:support@canopyhome.app"
              style={{ color: 'var(--color-silver)', textDecoration: 'none', fontSize: 14, transition: 'color 0.3s', display: 'block' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.copper; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#CCCCCC'; }}>
              support@canopyhome.app
            </a>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: FontSize.sm, color: 'var(--color-med-gray)' }}>
          <p style={{ margin: 0 }}>© 2026 Canopy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );

  return (
    <SectionErrorBoundary sectionName="Landing">
      <div style={{ fontFamily: fontStack }}>
        <NavHeader />
        {/* HeroSection invoked as function (not `<HeroSection />`) so
            stateful children like ZipPreCheck don't unmount when Landing
            re-renders from mobileMenuOpen / resize / billingInterval. */}
        {HeroSection()}
        <HowItWorks />
        {/* 2026-05-06: Home Token + Maintenance Inspection — the moat. Slotted
            between How-It-Works and Add-Ons so the value prop lands before
            the homeowner sees the per-service pricing grid. */}
        <HomeTokenSection />
        <AddOnsSection />
        <WhoIsItFor />
        <FeaturesSection />
        <StatsSection />
        {PricingSection()}
        <TestimonialsSection isMobile={isMobile} />
        <FaqSection />
        <AgentReferralStrip />
        <FinalCta />
        <Footer />
      </div>
    </SectionErrorBoundary>
  );
}
