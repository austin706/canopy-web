import { useNavigate } from 'react-router-dom';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

export default function Landing() {
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
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
      </div>
    </header>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // HERO SECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  const HeroSection = () => (
    <section
      style={{
        background: Colors.warmWhite,
        padding: '120px 24px',
        textAlign: 'center',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: 56,
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
            fontSize: 20,
            color: Colors.medGray,
            margin: '0 0 48px 0',
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
        padding: '80px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: 42,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            textAlign: 'center',
            margin: '0 0 64px 0',
          }}
        >
          Homeownership shouldn't be overwhelming
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '40px',
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
        padding: '80px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: 42,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            textAlign: 'center',
            margin: '0 0 64px 0',
          }}
        >
          Everything you need to protect your home
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '32px',
          }}
        >
          {/* Feature 1 */}
          <div
            style={{
              background: Colors.white,
              padding: '32px',
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
              padding: '32px',
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
              padding: '32px',
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
              padding: '32px',
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
              padding: '32px',
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
              padding: '32px',
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
        padding: '80px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2
          style={{
            fontSize: 42,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            textAlign: 'center',
            margin: '0 0 64px 0',
          }}
        >
          Simple, transparent pricing
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px',
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
              transform: 'scale(1.05)',
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
  // FOR REAL ESTATE AGENTS SECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  const AgentsSection = () => (
    <section
      style={{
        background: Colors.warmWhite,
        padding: '80px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 42,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            margin: '0 0 24px 0',
          }}
        >
          The perfect closing gift
        </h2>

        <p
          style={{
            fontSize: 18,
            color: Colors.medGray,
            lineHeight: 1.6,
            margin: '0 0 48px 0',
          }}
        >
          Give your clients a subscription to Canopy as a closing gift. Stay connected, build loyalty, and stand out from other agents.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '32px',
            marginBottom: '48px',
          }}
        >
          {['Purchase gift codes in bulk', 'Track client engagement', 'Branded agent portal', 'Client home management visibility'].map(
            (item) => (
              <div key={item} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: '12px' }}>✓</div>
                <p style={{ fontSize: 15, color: Colors.medGray, margin: 0 }}>
                  {item}
                </p>
              </div>
            )
          )}
        </div>

        <button
          onClick={() => {
            window.location.href = 'mailto:agents@canopyhome.app';
          }}
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
          }}
        >
          Learn More About Agent Partnership
        </button>
      </div>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // FOR PRO PROVIDERS SECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  const ProProvidersSection = () => (
    <section
      style={{
        background: Colors.white,
        padding: '80px 24px',
        fontFamily: fontStack,
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
        <h2
          style={{
            fontSize: 42,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            margin: '0 0 24px 0',
          }}
        >
          Grow your business with Canopy
        </h2>

        <p
          style={{
            fontSize: 18,
            color: Colors.medGray,
            lineHeight: 1.6,
            margin: '0 0 48px 0',
          }}
        >
          Join our network of trusted home maintenance professionals. Get matched with homeowners in your area.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '32px',
            marginBottom: '48px',
          }}
        >
          {['Steady job pipeline', 'Flexible scheduling', 'Simple quoting & invoicing', 'Build your reputation with ratings'].map(
            (item) => (
              <div key={item} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: '12px' }}>✓</div>
                <p style={{ fontSize: 15, color: Colors.medGray, margin: 0 }}>
                  {item}
                </p>
              </div>
            )
          )}
        </div>

        <button
          onClick={() => navigate('/apply-pro')}
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
          }}
        >
          Apply to Join
        </button>
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '40px',
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
    <div style={{ fontFamily: fontStack }}>
      <NavHeader />
      <HeroSection />
      <ProblemsSection />
      <FeaturesSection />
      <PricingSection />
      <AgentsSection />
      <ProProvidersSection />
      <Footer />
    </div>
  );
}
