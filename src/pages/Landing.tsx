import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';
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
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  // ═══════════════════════════════════════════════════════════════════════════════
  // STICKY NAV HEADER
  // ═══════════════════════════════════════════════════════════════════════════════
  const NavHeader = () => (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontSize: 20, fontWeight: FontWeight.bold, color: Colors.charcoal }}>Canopy</span>
        </div>

        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 8,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}
          >
            <span style={{ display: 'block', width: 24, height: 2, background: Colors.charcoal, borderRadius: 2, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
            <span style={{ display: 'block', width: 24, height: 2, background: Colors.charcoal, borderRadius: 2, transition: 'all 0.3s', opacity: mobileMenuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 24, height: 2, background: Colors.charcoal, borderRadius: 2, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
          </button>
        )}

        {/* Desktop nav */}
        {!isMobile && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <a
              href="#features"
              onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}
              style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.charcoal; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = Colors.medGray; }}
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={(e) => { e.preventDefault(); scrollToSection('pricing'); }}
              style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.charcoal; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = Colors.medGray; }}
            >
              Pricing
            </a>
            <a
              href="/support"
              style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.charcoal; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = Colors.medGray; }}
            >
              Support
            </a>
            <a
              href="/for-agents"
              style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.charcoal; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = Colors.medGray; }}
            >
              For Agents
            </a>
            <a
              href="/for-pros"
              style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = Colors.charcoal; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = Colors.medGray; }}
            >
              For Pros
            </a>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: FontWeight.medium,
                background: 'transparent',
                color: Colors.charcoal,
                border: `1px solid ${Colors.lightGray}`,
                borderRadius: BorderRadius.md,
                cursor: 'pointer',
                fontFamily: fontStack,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = Colors.copper; (e.target as HTMLElement).style.color = Colors.copper; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = Colors.lightGray; (e.target as HTMLElement).style.color = Colors.charcoal; }}
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/signup')}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: FontWeight.semibold,
                background: Colors.copper,
                color: Colors.white,
                border: 'none',
                borderRadius: BorderRadius.md,
                cursor: 'pointer',
                fontFamily: fontStack,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#A66B3A'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = Colors.copper; }}
            >
              Get Started
            </button>
          </nav>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {isMobile && mobileMenuOpen && (
        <nav
          style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            padding: '8px 0 16px', borderTop: '1px solid #eee',
          }}
        >
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}
            style={{ padding: '12px 0', fontSize: 16, color: Colors.charcoal, textDecoration: 'none', fontWeight: FontWeight.medium }}>
            Features
          </a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollToSection('pricing'); }}
            style={{ padding: '12px 0', fontSize: 16, color: Colors.charcoal, textDecoration: 'none', fontWeight: FontWeight.medium }}>
            Pricing
          </a>
          <a href="/support"
            style={{ padding: '12px 0', fontSize: 16, color: Colors.charcoal, textDecoration: 'none', fontWeight: FontWeight.medium }}>
            Support
          </a>
          <a href="/for-agents"
            style={{ padding: '12px 0', fontSize: 16, color: Colors.charcoal, textDecoration: 'none', fontWeight: FontWeight.medium }}>
            For Agents
          </a>
          <a href="/for-pros"
            style={{ padding: '12px 0', fontSize: 16, color: Colors.charcoal, textDecoration: 'none', fontWeight: FontWeight.medium }}>
            For Pros
          </a>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
              style={{ flex: 1, padding: '12px', fontSize: 15, fontWeight: FontWeight.medium, background: 'transparent', color: Colors.charcoal, border: `1px solid ${Colors.lightGray}`, borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack }}>
              Log In
            </button>
            <button onClick={() => { setMobileMenuOpen(false); navigate('/signup'); }}
              style={{ flex: 1, padding: '12px', fontSize: 15, fontWeight: FontWeight.semibold, background: Colors.copper, color: Colors.white, border: 'none', borderRadius: BorderRadius.md, cursor: 'pointer', fontFamily: fontStack }}>
              Get Started
            </button>
          </div>
        </nav>
      )}
    </header>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // HERO SECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  const HeroSection = () => (
    <section
      style={{
        background: Colors.warmWhite,
        padding: isMobile ? '60px 16px' : '120px 24px',
        textAlign: 'center',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: isMobile ? 32 : 56,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            margin: '0 0 24px 0',
            lineHeight: 1.2,
          }}
        >
          Your Home, Simplified.
        </h1>

        <p
          style={{
            fontSize: isMobile ? 17 : 20,
            color: Colors.medGray,
            margin: isMobile ? '0 0 32px 0' : '0 0 48px 0',
            lineHeight: 1.6,
            maxWidth: '700px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          AI-powered home maintenance that keeps your biggest investment in top shape. Track equipment, schedule maintenance, get expert help — all in one place.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '40px',
          }}
        >
          <button
            onClick={() => navigate('/signup')}
            style={{
              padding: '14px 40px',
              fontSize: 16,
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
              (e.target as HTMLElement).style.background = '#A66B3A';
              (e.target as HTMLElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = Colors.copper;
              (e.target as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            Get Started Free
          </button>

          <button
            onClick={() => scrollToSection('features')}
            style={{
              padding: '14px 40px',
              fontSize: 16,
              fontWeight: FontWeight.semibold,
              background: 'transparent',
              color: Colors.copper,
              border: `2px solid ${Colors.copper}`,
              borderRadius: BorderRadius.lg,
              cursor: 'pointer',
              fontFamily: fontStack,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = Colors.copperMuted;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            Learn More
          </button>
        </div>

        <p
          style={{
            fontSize: 14,
            color: Colors.medGray,
            margin: 0,
          }}
        >
          Free forever plan available. No credit card required.
        </p>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROBLEM/SOLUTION SECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  const ProblemsSection = () => (
    <section
      style={{
        background: Colors.white,
        padding: isMobile ? '48px 16px' : '80px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: isMobile ? 28 : 42,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            textAlign: 'center',
            margin: isMobile ? '0 0 36px 0' : '0 0 64px 0',
          }}
        >
          Homeownership shouldn't be overwhelming
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: isMobile ? '32px' : '40px',
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: '20px',
              }}
              role="img"
              aria-label="Clipboard"
            >
              📋
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              Never Miss Maintenance
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              AI creates a personalized maintenance schedule based on your home's equipment, climate zone, and season.
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: '20px',
              }}
            >
              🔍
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              Know Your Home
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Scan equipment with your camera, track warranties, store documents securely, and build a complete digital profile of your home.
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 48,
                marginBottom: '20px',
              }}
              role="img"
              aria-label="Wrench"
            >
              🔧
            </div>
            <h3
              style={{
                fontSize: 20,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              Expert Help On-Demand
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Connect with vetted local pros for bimonthly visits, repairs, and inspections — all managed through the app.
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FEATURES GRID SECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  const FeaturesSection = () => (
    <section
      id="features"
      style={{
        background: '#F5F4F0',
        padding: isMobile ? '48px 16px' : '80px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: isMobile ? 28 : 42,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            textAlign: 'center',
            margin: isMobile ? '0 0 36px 0' : '0 0 64px 0',
          }}
        >
          Everything you need to protect your home
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: isMobile ? '20px' : '32px',
          }}
        >
          {/* Feature 1 */}
          <div
            style={{
              background: Colors.white,
              padding: isMobile ? '24px' : '32px',
              borderRadius: BorderRadius.lg,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              AI Equipment Scanner
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Point your camera at any appliance. AI identifies make, model, and serial number instantly.
            </p>
          </div>

          {/* Feature 2 */}
          <div
            style={{
              background: Colors.white,
              padding: isMobile ? '24px' : '32px',
              borderRadius: BorderRadius.lg,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              Smart Maintenance Calendar
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              40+ task templates customized to your home. Seasonal reminders, equipment-specific schedules.
            </p>
          </div>

          {/* Feature 3 */}
          <div
            style={{
              background: Colors.white,
              padding: isMobile ? '24px' : '32px',
              borderRadius: BorderRadius.lg,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              Document Vault
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Store warranties, inspection reports, and manuals. PIN-protected for sensitive documents.
            </p>
          </div>

          {/* Feature 4 */}
          <div
            style={{
              background: Colors.white,
              padding: isMobile ? '24px' : '32px',
              borderRadius: BorderRadius.lg,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              Weather-Smart Alerts
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Real-time NWS alerts with actionable home prep tasks for your area.
            </p>
          </div>

          {/* Feature 5 */}
          <div
            style={{
              background: Colors.white,
              padding: isMobile ? '24px' : '32px',
              borderRadius: BorderRadius.lg,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              Home Health Score
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              See your home's maintenance status at a glance. Track improvement over time.
            </p>
          </div>

          {/* Feature 6 */}
          <div
            style={{
              background: Colors.white,
              padding: isMobile ? '24px' : '32px',
              borderRadius: BorderRadius.lg,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 12px 0',
              }}
            >
              AI Home Assistant
            </h3>
            <p
              style={{
                fontSize: 15,
                color: Colors.medGray,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Ask questions about your home. Get instant, personalized maintenance advice.
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRICING SECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  const PricingSection = () => (
    <section
      id="pricing"
      style={{
        background: Colors.white,
        padding: isMobile ? '48px 16px' : '80px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: isMobile ? 28 : 42,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            textAlign: 'center',
            margin: isMobile ? '0 0 36px 0' : '0 0 64px 0',
          }}
        >
          Simple, transparent pricing
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: isMobile ? '24px' : '32px',
            marginBottom: '48px',
          }}
        >
          {/* Free Plan */}
          <div
            style={{
              background: Colors.white,
              border: `2px solid ${Colors.lightGray}`,
              padding: '40px 32px',
              borderRadius: BorderRadius.lg,
              textAlign: 'center',
            }}
          >
            <h3
              style={{
                fontSize: 24,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 8px 0',
              }}
            >
              Free
            </h3>
            <div
              style={{
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.copper,
                margin: '0 0 24px 0',
              }}
            >
              $0<span style={{ fontSize: 16, color: Colors.medGray }}>/mo</span>
            </div>

            <p
              style={{
                fontSize: 14,
                color: Colors.medGray,
                margin: '0 0 24px 0',
                fontWeight: FontWeight.semibold,
              }}
            >
              Get started basics
            </p>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px 0',
                textAlign: 'left',
              }}
            >
              {['Equipment tracking (up to 5)', 'Basic maintenance calendar', 'Weather alerts', 'Document storage'].map((item) => (
                <li key={item} style={{ fontSize: 14, color: Colors.medGray, marginBottom: '12px' }}>
                  ✓ {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate('/signup')}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 15,
                fontWeight: FontWeight.semibold,
                background: Colors.lightGray,
                color: Colors.charcoal,
                border: 'none',
                borderRadius: BorderRadius.lg,
                cursor: 'pointer',
                fontFamily: fontStack,
              }}
            >
              Start Free
            </button>
          </div>

          {/* Home Plan - Most Popular */}
          <div
            style={{
              background: Colors.white,
              border: `2px solid ${Colors.copper}`,
              padding: '40px 32px',
              borderRadius: BorderRadius.lg,
              textAlign: 'center',
              position: 'relative',
              transform: isMobile ? 'none' : 'scale(1.05)',
              boxShadow: '0 12px 32px rgba(196, 132, 78, 0.15)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: Colors.copper,
                color: Colors.white,
                padding: '6px 16px',
                borderRadius: BorderRadius.full,
                fontSize: 12,
                fontWeight: FontWeight.semibold,
              }}
            >
              MOST POPULAR
            </div>

            <h3
              style={{
                fontSize: 24,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 8px 0',
              }}
            >
              Home
            </h3>
            <div
              style={{
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.copper,
                margin: '0 0 24px 0',
              }}
            >
              $6.99<span style={{ fontSize: 16, color: Colors.medGray }}>/mo</span>
            </div>

            <p
              style={{
                fontSize: 14,
                color: Colors.medGray,
                margin: '0 0 24px 0',
                fontWeight: FontWeight.semibold,
              }}
            >
              Complete home management
            </p>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px 0',
                textAlign: 'left',
              }}
            >
              {[
                'Everything in Free',
                'Unlimited equipment',
                'AI scanner & assistant',
                'Smart scheduling',
                'Secure notes',
                'Home health score',
                'Sale prep checklist',
              ].map((item) => (
                <li key={item} style={{ fontSize: 14, color: Colors.medGray, marginBottom: '12px' }}>
                  ✓ {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate('/signup')}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 15,
                fontWeight: FontWeight.semibold,
                background: Colors.copper,
                color: Colors.white,
                border: 'none',
                borderRadius: BorderRadius.lg,
                cursor: 'pointer',
                fontFamily: fontStack,
              }}
            >
              Start Free Trial
            </button>
          </div>

          {/* Pro Plan */}
          <div
            style={{
              background: Colors.white,
              border: `2px solid ${Colors.lightGray}`,
              padding: '40px 32px',
              borderRadius: BorderRadius.lg,
              textAlign: 'center',
            }}
          >
            <h3
              style={{
                fontSize: 24,
                fontWeight: FontWeight.semibold,
                color: Colors.charcoal,
                margin: '0 0 8px 0',
              }}
            >
              Pro
            </h3>
            <div
              style={{
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Colors.copper,
                margin: '0 0 24px 0',
              }}
            >
              $149<span style={{ fontSize: 16, color: Colors.medGray }}>/mo</span>
            </div>

            <p
              style={{
                fontSize: 14,
                color: Colors.medGray,
                margin: '0 0 24px 0',
                fontWeight: FontWeight.semibold,
              }}
            >
              Full-service care
            </p>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 32px 0',
                textAlign: 'left',
              }}
            >
              {[
                'Everything in Home',
                'Bimonthly pro maintenance visits',
                'Priority scheduling',
                'Detailed inspection reports',
                'Pro provider network',
              ].map((item) => (
                <li key={item} style={{ fontSize: 14, color: Colors.medGray, marginBottom: '12px' }}>
                  ✓ {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => navigate('/signup')}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 15,
                fontWeight: FontWeight.semibold,
                background: Colors.lightGray,
                color: Colors.charcoal,
                border: 'none',
                borderRadius: BorderRadius.lg,
                cursor: 'pointer',
                fontFamily: fontStack,
              }}
            >
              Get Started
            </button>
          </div>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 14,
            color: Colors.medGray,
            margin: 0,
          }}
        >
          Annual plans save 10%. All plans include a 7-day money-back guarantee.
        </p>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // SLIM CTA — AGENTS & PROS
  // ═══════════════════════════════════════════════════════════════════════════════
  const ProsCta = () => (
    <section
      style={{
        background: '#F5F4F0',
        padding: isMobile ? '32px 16px' : '48px 24px',
        fontFamily: fontStack,
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isMobile ? 16 : 32,
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 16, color: Colors.medGray, margin: 0 }}>
          Are you a home service professional or real estate agent?
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href="/for-pros"
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: FontWeight.semibold,
              background: Colors.copper,
              color: Colors.white,
              borderRadius: BorderRadius.md,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            Canopy for Pros
          </a>
          <a
            href="/for-agents"
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: FontWeight.semibold,
              background: 'transparent',
              color: Colors.copper,
              border: `1px solid ${Colors.copper}`,
              borderRadius: BorderRadius.md,
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            Canopy for Agents
          </a>
        </div>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════════════════
  const Footer = () => (
    <footer
      style={{
        background: Colors.charcoal,
        color: Colors.white,
        padding: '60px 24px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: isMobile ? '24px' : '40px',
            marginBottom: '40px',
            paddingBottom: '40px',
            borderBottom: `1px solid rgba(255, 255, 255, 0.1)`,
          }}
        >
          {/* Brand */}
          <div>
            <h3 style={{ fontSize: 18, fontWeight: FontWeight.bold, margin: '0 0 12px 0' }}>
              Canopy
            </h3>
            <p style={{ fontSize: 14, color: '#CCCCCC', margin: 0 }}>
              Your home, simplified.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: FontWeight.semibold, margin: '0 0 16px 0' }}>
              Product
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { label: 'Features', href: '#features' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'Download App', href: '/signup' },
              ].map((item) => (
                <li key={item.label} style={{ marginBottom: '8px' }}>
                  <a
                    href={item.href}
                    style={{
                      color: '#CCCCCC',
                      textDecoration: 'none',
                      fontSize: 14,
                      transition: 'color 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.color = Colors.copper;
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.color = '#CCCCCC';
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: FontWeight.semibold, margin: '0 0 16px 0' }}>
              Company
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { label: 'About', href: '#features' },
                { label: 'Support', href: '/support' },
                { label: 'Become a Pro', href: '/apply-pro' },
              ].map((item) => (
                <li key={item.label} style={{ marginBottom: '8px' }}>
                  <a
                    href={item.href}
                    style={{
                      color: '#CCCCCC',
                      textDecoration: 'none',
                      fontSize: 14,
                      transition: 'color 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.color = Colors.copper;
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.color = '#CCCCCC';
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: FontWeight.semibold, margin: '0 0 16px 0' }}>
              Legal
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {['Terms', 'Privacy', 'Contractor Terms', 'AI Disclaimer', 'Cancellation Policy'].map((item) => (
                <li key={item} style={{ marginBottom: '8px' }}>
                  <a
                    href={item === 'Terms' ? '/terms' : item === 'Privacy' ? '/privacy' : item === 'Contractor Terms' ? '/contractor-terms' : item === 'AI Disclaimer' ? '/ai-disclaimer' : '/cancellation'}
                    style={{
                      color: '#CCCCCC',
                      textDecoration: 'none',
                      fontSize: 14,
                      transition: 'color 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.color = Colors.copper;
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.color = '#CCCCCC';
                    }}
                  >
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 style={{ fontSize: 14, fontWeight: FontWeight.semibold, margin: '0 0 16px 0' }}>
              Support
            </h4>
            <a
              href="mailto:support@canopyhome.app"
              style={{
                color: '#CCCCCC',
                textDecoration: 'none',
                fontSize: 14,
                transition: 'color 0.3s',
                display: 'block',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = Colors.copper;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = '#CCCCCC';
              }}
            >
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
      <ProblemsSection />
      <FeaturesSection />
      <PricingSection />
      <ProsCta />
      <Footer />
      </div>
    </SectionErrorBoundary>
  );
}
