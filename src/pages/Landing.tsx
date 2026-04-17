import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontWeight, BorderRadius } from '@/constants/theme';
import { PRICING, ANNUAL_DISCOUNT_PERCENT } from '@/constants/pricing';
import type { BillingInterval } from '@/constants/pricing';
import { trackEvent } from '@/utils/analytics';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

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

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
  const [comparisonOpen, setComparisonOpen] = useState(false);

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
   * we can rename or extend the event shape in one place.
   */
  const ctaToSignup = (location: string) => {
    trackEvent('cta_click', { location, destination: '/signup', page: 'landing' });
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
          <picture>
            <source srcSet="/canopy-watercolor-logo.avif" type="image/avif" />
            <source srcSet="/canopy-watercolor-logo.webp" type="image/webp" />
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
          </picture>
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
              style={{ flex: 1, padding: 12, fontSize: 15, fontWeight: FontWeight.medium, background: 'transparent', color: Colors.charcoal, border: `1px solid ${Colors.lightGray}`, borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack }}>
              Log In
            </button>
            <button onClick={() => { setMobileMenuOpen(false); ctaToSignup('mobile_menu'); }}
              style={{ flex: 1, padding: 12, fontSize: 15, fontWeight: FontWeight.semibold, background: Colors.copper, color: Colors.white, border: 'none', borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack }}>
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
        <div style={{
          display: 'inline-block', background: Colors.sageMuted, border: `1px solid ${Colors.sageLight}`,
          borderRadius: BorderRadius.full, padding: '6px 16px', marginBottom: 24,
        }}>
          <span style={{ fontSize: 13, fontWeight: FontWeight.semibold, color: Colors.sageDark }}>
            Pro services now available in Tulsa, OK
          </span>
        </div>

        <h1 style={{
          fontSize: isMobile ? 34 : 54, fontWeight: FontWeight.bold,
          color: Colors.charcoal, margin: '0 0 24px 0', lineHeight: 1.15,
        }}>
          Stop guessing. Start knowing.
        </h1>

        <p style={{
          fontSize: isMobile ? 17 : 20, color: Colors.medGray,
          margin: '0 auto 40px', lineHeight: 1.6, maxWidth: 660,
        }}>
          Canopy is the AI-powered platform that tracks every piece of equipment in your home, tells you exactly what needs attention and when, and builds a verified maintenance record that protects your home's value.
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
            Get Started Free
          </button>
          <button onClick={() => scrollToSection('how-it-works')}
            style={{
              padding: '16px 40px', fontSize: 17, fontWeight: FontWeight.semibold,
              background: 'transparent', color: Colors.copper, border: `2px solid ${Colors.copper}`,
              borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack, transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.background = Colors.copperMuted; }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}>
            See How It Works
          </button>
        </div>

        <p style={{ fontSize: 14, color: Colors.medGray, margin: '0 0 32px 0' }}>
          Free forever — no credit card required
        </p>

        {/* Trust badges inline */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: isMobile ? 20 : 48, flexWrap: 'wrap',
        }}>
          {[
            { icon: '🔒', text: 'Bank-level encryption' },
            { icon: '🤖', text: 'Powered by AI' },
            { icon: '📱', text: 'Web + iOS + Android' },
            { icon: '⚡', text: 'Set up in 5 minutes' },
          ].map((item) => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 13, fontWeight: FontWeight.medium, color: Colors.medGray }}>{item.text}</span>
            </div>
          ))}
        </div>
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
        <h2 style={{
          fontSize: isMobile ? 26 : 38, fontWeight: FontWeight.bold,
          color: Colors.charcoal, textAlign: 'center', margin: '0 0 56px 0',
        }}>
          Up and running in 5 minutes
        </h2>

        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 32 : 48,
        }}>
          {[
            { step: '1', title: 'Scan Your Equipment', desc: "Walk through your home and snap photos of appliance labels. Canopy's AI identifies make, model, serial number, and age — then builds your equipment inventory and a personalized maintenance plan." },
            { step: '2', title: 'Follow Your Plan', desc: 'Get a maintenance calendar tailored to your specific equipment, climate zone, and season. Clear instructions for each task, with reminders so nothing slips through the cracks.' },
            { step: '3', title: 'Go Hands-Off with Pro', desc: 'Upgrade to Pro and get a Canopy-certified technician at your door every other month. They inspect, maintain, and catch small problems before they become expensive ones.' },
          ].map((item) => (
            <div key={item.step} style={{ textAlign: 'center' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: Colors.sage, color: Colors.white,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: FontWeight.bold, margin: '0 auto 20px',
              }}>
                {item.step}
              </div>
              <h3 style={{ fontSize: 19, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 10px 0' }}>{item.title}</h3>
              <p style={{ fontSize: 15, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

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
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
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
          fontSize: 13, color: Colors.medGray, textAlign: 'center',
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

    // Comparison table data
    const rows: Array<[string, string, string, string, string]> = [
      ['Equipment items', 'Up to 3', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Maintenance calendar (40+ tasks)', 'Basic', '✓', '✓', '✓'],
      ['AI equipment scans (photo)', '1 lifetime', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['AI chat messages', '5/mo', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Text model lookup', '2/mo', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Maintenance history', '90 days', 'Full', 'Full', 'Full'],
      ['Weather-smart alerts', '✓', '✓', '✓', '✓'],
      ['Document vault', '✓', '✓', '✓', '✓'],
      ['Secure notes (PIN-protected)', '—', '✓', '✓', '✓'],
      ['Home health score', '—', '✓', '✓', '✓'],
      ['Home Token + completeness score', '—', '✓', '✓', '✓'],
      ['Sale prep checklist', '—', '✓', '✓', '✓'],
      ['Bimonthly pro visits', '—', '—', '6/yr', 'Custom cadence'],
      ['Detailed inspection reports', '—', '—', '✓', '✓'],
      ['Priority scheduling', '—', '—', '✓', '✓'],
      ['Dedicated pro provider', '—', '—', '—', '✓'],
      ['Canopy Certified Pro network', '—', '—', '✓', '✓'],
    ];
    const headers = ['Free', 'Home', 'Pro', 'Pro+'];

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
      if (v === '✓') return <span style={{ color: Colors.sage, fontWeight: FontWeight.bold, fontSize: 18 }} aria-label="included">✓</span>;
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
                      fontSize: 11,
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
              <h3 style={{ fontSize: 22, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Free</h3>
              <div style={{ fontSize: 28, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
                $0<span style={{ fontSize: 14, color: Colors.medGray }}>/mo</span>
              </div>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium, minHeight: 38 }}>Get to know your home</p>
              <ul style={listStyle}>
                {['Up to 3 equipment items', 'Basic maintenance calendar', 'Weather alerts', '5 AI chat messages/mo', '2 text lookups/mo', '1 AI equipment scan', '90-day history'].map((i) => (
                  <li key={i} style={itemStyle}><span style={checkStyle}>✓</span> {i}</li>
                ))}
              </ul>
              <button onClick={() => ctaToSignup('pricing_free')} style={{
                width: '100%', padding: 12, fontSize: 15, fontWeight: FontWeight.semibold,
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
                fontSize: 11, fontWeight: FontWeight.semibold, whiteSpace: 'nowrap',
              }}>MOST POPULAR</div>
              <h3 style={{ fontSize: 22, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Home</h3>
              <div style={{ fontSize: 28, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
                {homeDisplay.price}<span style={{ fontSize: 13, color: Colors.medGray }}>{homeDisplay.period}</span>
              </div>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium, minHeight: 38 }}>
                Complete home management
              </p>
              <ul style={listStyle}>
                {['Everything in Free', 'Unlimited equipment', 'Unlimited AI scans & chat', 'Full maintenance history', 'Smart scheduling & reminders', 'Home health score', 'Home Token with completeness score', 'Sale prep checklist', 'Secure notes'].map((i) => (
                  <li key={i} style={itemStyle}><span style={checkStyle}>✓</span> {i}</li>
                ))}
              </ul>
              <button onClick={() => ctaToSignup('pricing_home')} style={{
                width: '100%', padding: 12, fontSize: 15, fontWeight: FontWeight.semibold,
                background: Colors.copper, color: Colors.white, border: 'none',
                borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
              }}>
                Get Home Plan
              </button>
            </div>

            {/* Pro */}
            <div style={baseCard}>
              <h3 style={{ fontSize: 22, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Pro</h3>
              <div style={{ fontSize: 28, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
                {proDisplay.price}<span style={{ fontSize: 13, color: Colors.medGray }}>{proDisplay.period}</span>
              </div>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium, minHeight: 38 }}>
                Full-service bimonthly care
              </p>
              <ul style={listStyle}>
                {['Everything in Home', '6 bimonthly pro visits/year', 'Detailed inspection reports', 'Priority scheduling', 'Verified maintenance records', 'Canopy Certified Pro network'].map((i) => (
                  <li key={i} style={itemStyle}><span style={checkStyle}>✓</span> {i}</li>
                ))}
              </ul>
              <button onClick={() => ctaToSignup('pricing_pro')} style={{
                width: '100%', padding: 12, fontSize: 15, fontWeight: FontWeight.semibold,
                background: Colors.lightGray, color: Colors.charcoal, border: 'none',
                borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
              }}>
                Get Started
              </button>
            </div>

            {/* Pro+ — Concierge */}
            <div style={baseCard}>
              <h3 style={{ fontSize: 22, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Pro+</h3>
              <div style={{ fontSize: 28, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
                Custom<span style={{ fontSize: 13, color: Colors.medGray, display: 'block', fontWeight: FontWeight.medium }}>Contact sales</span>
              </div>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium, minHeight: 38 }}>
                Full home concierge service
              </p>
              <ul style={listStyle}>
                {['Everything in Pro', 'Dedicated pro provider', 'Routine maintenance of all systems', 'Bigger jobs quoted separately', 'Priority scheduling & support', 'Custom cadence + scope'].map((i) => (
                  <li key={i} style={itemStyle}><span style={checkStyle}>✓</span> {i}</li>
                ))}
              </ul>
              <a
                href="mailto:support@canopyhome.app?subject=Canopy%20Pro%2B%20Inquiry"
                style={{
                  display: 'block', width: '100%', padding: 12, fontSize: 15, fontWeight: FontWeight.semibold,
                  background: 'transparent', color: Colors.copper, border: `2px solid ${Colors.copper}`,
                  borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
                  textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box',
                }}
              >
                Contact Sales
              </a>
            </div>
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
                  {rows.map(([feature, free, home, pro, proPlus], idx) => (
                    <tr key={feature} style={{ background: idx % 2 === 0 ? Colors.white : Colors.warmWhite }}>
                      <th scope="row" style={{ ...featureCell, background: idx % 2 === 0 ? Colors.white : Colors.warmWhite }}>{feature}</th>
                      <td style={cell}>{renderValue(free)}</td>
                      <td style={cell}>{renderValue(home)}</td>
                      <td style={cell}>{renderValue(pro)}</td>
                      <td style={cell}>{renderValue(proPlus)}</td>
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
          Set up in 5 minutes. Free forever. Upgrade when you're ready.
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
            <h3 style={{ fontSize: 18, fontWeight: FontWeight.bold, margin: '0 0 12px 0' }}>Canopy</h3>
            <p style={{ fontSize: 14, color: 'var(--color-silver)', margin: 0, lineHeight: 1.5 }}>
              AI-powered home maintenance. Understand, maintain, and protect your biggest investment.
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
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-med-gray)' }}>
          <p style={{ margin: 0 }}>© 2026 Canopy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );

  return (
    <SectionErrorBoundary sectionName="Landing">
      <div style={{ fontFamily: fontStack }}>
        <NavHeader />
        <HeroSection />
        <HowItWorks />
        <FeaturesSection />
        <StatsSection />
        {PricingSection()}
        <FaqSection />
        <FinalCta />
        <Footer />
      </div>
    </SectionErrorBoundary>
  );
}
