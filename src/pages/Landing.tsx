import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontWeight, BorderRadius } from '@/constants/theme';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
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
          <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
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
            {[{ label: 'Support', href: '/support' }, { label: 'For Agents', href: '/for-agents' }, { label: 'For Pros', href: '/for-pros' }].map((item) => (
              <a key={item.label} href={item.href}
                style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.charcoal; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = Colors.medGray; }}>
                {item.label}
              </a>
            ))}
            <button onClick={() => navigate('/login')}
              style={{ padding: '8px 20px', fontSize: 14, fontWeight: FontWeight.medium, background: 'transparent', color: Colors.charcoal, border: `1px solid ${Colors.lightGray}`, borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack, transition: 'all 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = Colors.copper; (e.target as HTMLElement).style.color = Colors.copper; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = Colors.lightGray; (e.target as HTMLElement).style.color = Colors.charcoal; }}>
              Log In
            </button>
            <button onClick={() => navigate('/signup')}
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
          {[{ l: 'Support', h: '/support' }, { l: 'For Agents', h: '/for-agents' }, { l: 'For Pros', h: '/for-pros' }].map((i) => (
            <a key={i.l} href={i.h} style={{ padding: '12px 0', fontSize: 16, color: Colors.charcoal, textDecoration: 'none', fontWeight: FontWeight.medium }}>{i.l}</a>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
              style={{ flex: 1, padding: 12, fontSize: 15, fontWeight: FontWeight.medium, background: 'transparent', color: Colors.charcoal, border: `1px solid ${Colors.lightGray}`, borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack }}>
              Log In
            </button>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/signup'); }}
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
            Now available in Tulsa, OK
          </span>
        </div>

        <h1 style={{
          fontSize: isMobile ? 34 : 54, fontWeight: FontWeight.bold,
          color: Colors.charcoal, margin: '0 0 24px 0', lineHeight: 1.15,
        }}>
          Your Home, Taken Care Of
        </h1>

        <p style={{
          fontSize: isMobile ? 17 : 20, color: Colors.medGray,
          margin: '0 auto 40px', lineHeight: 1.6, maxWidth: 660,
        }}>
          Canopy is the AI-powered platform that helps you understand, maintain, and protect your home — from the day you move in to the day you sell.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          <button onClick={() => navigate('/signup')}
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

        <p style={{ fontSize: 14, color: Colors.medGray, margin: 0 }}>
          Free forever plan available — no credit card required
        </p>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // TRUST BAR
  // ═══════════════════════════════════════════════════════════════════════════════
  const TrustBar = () => (
    <section style={{
      background: Colors.white, padding: isMobile ? '20px 16px' : '18px 24px',
      borderBottom: `1px solid ${Colors.lightGray}`, fontFamily: fontStack,
    }}>
      <div style={{
        maxWidth: 900, margin: '0 auto',
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
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // VALUE PROPS — the "why"
  // ═══════════════════════════════════════════════════════════════════════════════
  const ValueProps = () => (
    <section style={{
      background: Colors.white, padding: isMobile ? '48px 16px' : '80px 24px', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{
          fontSize: isMobile ? 26 : 38, fontWeight: FontWeight.bold,
          color: Colors.charcoal, textAlign: 'center', margin: '0 0 16px 0',
        }}>
          Your home is your biggest investment.{isMobile ? ' ' : <br />}Canopy helps you protect it.
        </h2>
        <p style={{
          fontSize: isMobile ? 16 : 18, color: Colors.medGray, textAlign: 'center',
          maxWidth: 680, margin: '0 auto 48px', lineHeight: 1.6,
        }}>
          Most homeowners are guessing — forgotten filter changes, lost warranty info, no idea what was last serviced or when. Canopy replaces the guesswork with a system.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 28 : 40,
        }}>
          {[
            { icon: '🧠', title: 'AI That Knows Your Home', desc: 'Scan equipment labels with your camera. Canopy identifies make, model, and age — then builds a personalized maintenance plan for everything you own.' },
            { icon: '🔧', title: 'Pro Maintenance On Autopilot', desc: 'Canopy-vetted technicians visit your home every other month to inspect, maintain, and catch small problems before they become expensive ones.' },
            { icon: '📄', title: 'A Verified Record That Builds Over Time', desc: 'Every task, pro visit, and inspection is logged with timestamps and verification — creating a complete home history you can share or transfer when you sell.' },
          ].map((c) => (
            <div key={c.title} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }} role="img" aria-label={c.title}>{c.icon}</div>
              <h3 style={{ fontSize: 19, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 10px 0' }}>{c.title}</h3>
              <p style={{ fontSize: 15, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>{c.desc}</p>
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
          Up and running in minutes
        </h2>

        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 32 : 48,
        }}>
          {[
            { step: '1', title: 'Scan Your Home', desc: 'Walk through and snap photos of your appliance labels. Canopy\'s AI identifies everything — HVAC, water heater, appliances — and builds your equipment inventory.' },
            { step: '2', title: 'Follow Your Plan', desc: 'Get a maintenance calendar tailored to your equipment, your climate, and the season. Clear instructions for each task, with reminders so nothing slips.' },
            { step: '3', title: 'Want Hands-Off? Add Pro Visits', desc: 'You can handle it all yourself with Canopy\'s guidance — or upgrade to Pro and get a certified technician at your door every other month for inspections, filter changes, and peace of mind.' },
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
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: isMobile ? 16 : 24,
        }}>
          {[
            { icon: '📸', title: 'AI Equipment Scanner', desc: 'Point your camera at any appliance label. Canopy identifies the make, model, serial number, and expected lifespan in seconds.' },
            { icon: '📅', title: 'Smart Maintenance Calendar', desc: '40+ task templates customized to your equipment and climate zone. Seasonal reminders and step-by-step instructions for each task.' },
            { icon: '💬', title: 'AI Home Assistant', desc: 'Ask anything about your home and get instant, personalized answers based on your actual equipment and maintenance history.' },
            { icon: '🔧', title: 'Bimonthly Pro Visits', desc: 'Canopy-vetted technicians visit every other month to inspect systems, change filters, and generate detailed inspection reports.' },
            { icon: '⛅', title: 'Weather-Smart Alerts', desc: 'Real-time NWS severe weather alerts paired with actionable prep tasks specific to your home, your equipment, and the incoming conditions.' },
            { icon: '📊', title: 'Home Health Score', desc: 'A living score that reflects how well-maintained your home is. Track it over time and know exactly where to focus next.' },
            { icon: '🗂️', title: 'Document Vault', desc: 'Store warranties, inspection reports, manuals, and receipts. PIN-protected secure notes for alarm codes and sensitive info.' },
            { icon: '🏠', title: 'Home Token', desc: 'A verified, timestamped record of your home\'s complete maintenance history — pro visits, inspections, tasks, and documents — that transfers to the next owner when you sell.' },
            { icon: '🏷️', title: 'Sale Prep & Home Transfer', desc: 'When you\'re ready to sell, Canopy generates a prioritized prep checklist. At closing, transfer your full home history to the buyer in one click.' },
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
  // LIFECYCLE SECTION — sell the long-term story
  // ═══════════════════════════════════════════════════════════════════════════════
  const LifecycleSection = () => (
    <section style={{
      background: Colors.white, padding: isMobile ? '48px 16px' : '80px 24px', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{
          fontSize: isMobile ? 26 : 36, fontWeight: FontWeight.bold,
          color: Colors.charcoal, textAlign: 'center', margin: '0 0 16px 0',
        }}>
          Canopy grows with you
        </h2>
        <p style={{
          fontSize: isMobile ? 15 : 17, color: Colors.medGray, textAlign: 'center',
          maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.5,
        }}>
          Whether you just moved in or you've lived there for 20 years, Canopy meets you where you are.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? 20 : 28,
        }}>
          {[
            {
              stage: 'Move In',
              icon: '🏡',
              desc: 'Scan your equipment, upload your inspection report, and get a maintenance plan built for your home in minutes. If your seller used Canopy, their full Home Token transfers to you automatically.',
            },
            {
              stage: 'Live In',
              icon: '🛠️',
              desc: 'Follow your personalized calendar, get weather-smart alerts, and ask the AI assistant anything. Every completed task builds your home\'s verified maintenance record.',
            },
            {
              stage: 'Maintain',
              icon: '📋',
              desc: 'Upgrade to Pro and let certified technicians handle the hard stuff. Bimonthly visits, detailed inspection reports, and a growing record of professional care for your home.',
            },
            {
              stage: 'Sell',
              icon: '🤝',
              desc: 'Use Sale Prep to prioritize improvements. Your Home Token — the complete, verified history of how you cared for your home — transfers to the buyer at closing, adding confidence and value to your sale.',
            },
          ].map((item) => (
            <div key={item.stage} style={{
              display: 'flex', gap: 20, padding: 24,
              background: Colors.warmWhite, borderRadius: BorderRadius.lg,
              border: `1px solid ${Colors.lightGray}`,
            }}>
              <div style={{ fontSize: 32, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 6px 0' }}>{item.stage}</h3>
                <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // AGENTS + PROS CTA
  // ═══════════════════════════════════════════════════════════════════════════════
  const PartnersSection = () => (
    <section style={{
      background: Colors.cream, padding: isMobile ? '48px 16px' : '64px 24px', fontFamily: fontStack,
    }}>
      <div style={{
        maxWidth: 1000, margin: '0 auto',
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 24 : 32,
      }}>
        {/* Agents */}
        <div style={{
          background: Colors.white, borderRadius: BorderRadius.lg, padding: isMobile ? 24 : 32,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🏘️</div>
          <h3 style={{ fontSize: 20, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>For Real Estate Agents</h3>
          <p style={{ fontSize: 15, color: Colors.medGray, lineHeight: 1.6, margin: '0 0 20px 0' }}>
            Gift Canopy subscriptions to clients at closing. They get a well-maintained home. You get a differentiated closing gift, a portal to track client homes, and the ability to attest to Home Tokens before listings.
          </p>
          <a href="/for-agents" style={{
            display: 'inline-block', padding: '10px 24px', fontSize: 14, fontWeight: FontWeight.semibold,
            background: Colors.copper, color: Colors.white, borderRadius: BorderRadius.md, textDecoration: 'none',
          }}>
            Learn More
          </a>
        </div>

        {/* Pros */}
        <div style={{
          background: Colors.white, borderRadius: BorderRadius.lg, padding: isMobile ? 24 : 32,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔧</div>
          <h3 style={{ fontSize: 20, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>For Home Service Pros</h3>
          <p style={{ fontSize: 15, color: Colors.medGray, lineHeight: 1.6, margin: '0 0 20px 0' }}>
            Join the Canopy Certified network and get matched with homeowners in your area who need bimonthly visits, inspections, and project work. We handle scheduling, payments, and customer management.
          </p>
          <a href="/for-pros" style={{
            display: 'inline-block', padding: '10px 24px', fontSize: 14, fontWeight: FontWeight.semibold,
            background: 'transparent', color: Colors.copper, border: `1px solid ${Colors.copper}`,
            borderRadius: BorderRadius.md, textDecoration: 'none',
          }}>
            Become a Pro
          </a>
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRICING
  // ═══════════════════════════════════════════════════════════════════════════════
  const PricingSection = () => (
    <section id="pricing" style={{
      background: Colors.white, padding: isMobile ? '48px 16px' : '80px 24px', fontFamily: fontStack,
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{
          fontSize: isMobile ? 26 : 38, fontWeight: FontWeight.bold,
          color: Colors.charcoal, textAlign: 'center', margin: '0 0 12px 0',
        }}>
          Simple, transparent pricing
        </h2>
        <p style={{
          fontSize: 16, color: Colors.medGray, textAlign: 'center',
          maxWidth: 480, margin: '0 auto 48px',
        }}>
          Start free, upgrade when you're ready. Every plan builds your home's record.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 24 : 32, marginBottom: 48,
        }}>
          {/* Free */}
          <div style={{
            background: Colors.white, border: `2px solid ${Colors.lightGray}`,
            padding: '40px 28px', borderRadius: BorderRadius.lg, textAlign: 'center',
          }}>
            <h3 style={{ fontSize: 24, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Free</h3>
            <div style={{ fontSize: 28, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
              $0<span style={{ fontSize: 16, color: Colors.medGray }}>/mo</span>
            </div>
            <p style={{ fontSize: 14, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium }}>Get to know your home</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', textAlign: 'left' }}>
              {['Up to 5 equipment items', 'Basic maintenance calendar', 'Weather alerts for your area', 'Document storage', '15 AI chat messages/mo', '1 AI equipment scan'].map((item) => (
                <li key={item} style={{ fontSize: 14, color: Colors.medGray, marginBottom: 10, display: 'flex', gap: 8 }}>
                  <span style={{ color: Colors.sage, flexShrink: 0 }}>✓</span> {item}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/signup')} style={{
              width: '100%', padding: 12, fontSize: 15, fontWeight: FontWeight.semibold,
              background: Colors.lightGray, color: Colors.charcoal, border: 'none',
              borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
            }}>
              Start Free
            </button>
          </div>

          {/* Home */}
          <div style={{
            background: Colors.white, border: `2px solid ${Colors.copper}`,
            padding: '40px 28px', borderRadius: BorderRadius.lg, textAlign: 'center',
            position: 'relative', transform: isMobile ? 'none' : 'scale(1.05)',
            boxShadow: '0 12px 32px rgba(196, 132, 78, 0.15)',
          }}>
            <div style={{
              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
              background: Colors.copper, color: Colors.white,
              padding: '6px 16px', borderRadius: BorderRadius.full,
              fontSize: 12, fontWeight: FontWeight.semibold,
            }}>MOST POPULAR</div>
            <h3 style={{ fontSize: 24, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Home</h3>
            <div style={{ fontSize: 28, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
              $6.99<span style={{ fontSize: 16, color: Colors.medGray }}>/mo</span>
            </div>
            <p style={{ fontSize: 14, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium }}>Complete home management</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', textAlign: 'left' }}>
              {['Everything in Free', 'Unlimited equipment', 'Unlimited AI scans & chat', 'Smart scheduling & reminders', 'Home health score', 'Home Token with completeness score', 'Sale prep checklist', 'Secure notes'].map((item) => (
                <li key={item} style={{ fontSize: 14, color: Colors.medGray, marginBottom: 10, display: 'flex', gap: 8 }}>
                  <span style={{ color: Colors.sage, flexShrink: 0 }}>✓</span> {item}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/signup')} style={{
              width: '100%', padding: 12, fontSize: 15, fontWeight: FontWeight.semibold,
              background: Colors.copper, color: Colors.white, border: 'none',
              borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
            }}>
              Start Free Trial
            </button>
          </div>

          {/* Pro */}
          <div style={{
            background: Colors.white, border: `2px solid ${Colors.lightGray}`,
            padding: '40px 28px', borderRadius: BorderRadius.lg, textAlign: 'center',
          }}>
            <h3 style={{ fontSize: 24, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>Pro</h3>
            <div style={{ fontSize: 28, fontWeight: FontWeight.bold, color: Colors.copper, margin: '0 0 8px 0' }}>
              $149<span style={{ fontSize: 16, color: Colors.medGray }}>/mo</span>
            </div>
            <p style={{ fontSize: 14, color: Colors.medGray, margin: '0 0 24px 0', fontWeight: FontWeight.medium }}>Full-service home care</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', textAlign: 'left' }}>
              {['Everything in Home', '6 bimonthly pro visits/year', 'Detailed inspection reports', 'Priority scheduling', 'Verified maintenance records', 'Canopy Certified Pro network'].map((item) => (
                <li key={item} style={{ fontSize: 14, color: Colors.medGray, marginBottom: 10, display: 'flex', gap: 8 }}>
                  <span style={{ color: Colors.sage, flexShrink: 0 }}>✓</span> {item}
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/signup')} style={{
              width: '100%', padding: 12, fontSize: 15, fontWeight: FontWeight.semibold,
              background: Colors.lightGray, color: Colors.charcoal, border: 'none',
              borderRadius: BorderRadius.lg, cursor: 'pointer', fontFamily: fontStack,
            }}>
              Get Started
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 14, color: Colors.medGray, margin: 0 }}>
          Annual plans save 10%. All plans include a 7-day money-back guarantee.
        </p>
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
          fontSize: isMobile ? 16 : 18, color: '#CCCCCC', lineHeight: 1.6, margin: '0 0 36px 0',
        }}>
          Set up in 5 minutes. Free forever. Upgrade when you're ready.
        </p>
        <button onClick={() => navigate('/signup')}
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
            <p style={{ fontSize: 14, color: '#CCCCCC', margin: 0, lineHeight: 1.5 }}>
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
                { label: 'Download App', href: '/signup' },
              ],
            },
            {
              title: 'Company',
              links: [
                { label: 'For Agents', href: '/for-agents' },
                { label: 'For Pros', href: '/for-pros' },
                { label: 'Become a Pro', href: '/apply-pro' },
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
                      style={{ color: '#CCCCCC', textDecoration: 'none', fontSize: 14, transition: 'color 0.3s' }}
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
              style={{ color: '#CCCCCC', textDecoration: 'none', fontSize: 14, transition: 'color 0.3s', display: 'block' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.copper; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#CCCCCC'; }}>
              support@canopyhome.app
            </a>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#999999' }}>
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
        <TrustBar />
        <ValueProps />
        <HowItWorks />
        <FeaturesSection />
        <LifecycleSection />
        <PartnersSection />
        <PricingSection />
        <FinalCta />
        <Footer />
      </div>
    </SectionErrorBoundary>
  );
}
