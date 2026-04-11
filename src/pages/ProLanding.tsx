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
            <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            <span style={{ fontSize: 20, fontWeight: FontWeight.bold, color: Colors.charcoal }}>Canopy</span>
            <span style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.copper, marginLeft: 4 }}>for Pros</span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24 }}>
            <a
              href="/"
              style={{ fontSize: 14, fontWeight: FontWeight.medium, color: Colors.medGray, textDecoration: 'none' }}
            >
              ← Home
            </a>
            <button
              onClick={() => navigate('/apply-pro')}
              style={{
                padding: isMobile ? '8px 16px' : '8px 20px',
                fontSize: 14,
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
          background: Colors.warmWhite,
          padding: isMobile ? '60px 16px' : '100px 24px',
          textAlign: 'center',
          fontFamily: fontStack,
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1
            style={{
              fontSize: isMobile ? 32 : 48,
              fontWeight: FontWeight.bold,
              color: Colors.charcoal,
              margin: '0 0 24px 0',
              lineHeight: 1.2,
            }}
          >
            Grow your business with Canopy
          </h1>
          <p
            style={{
              fontSize: isMobile ? 17 : 20,
              color: Colors.medGray,
              margin: '0 0 40px 0',
              lineHeight: 1.6,
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Join our network of trusted home maintenance professionals. Get matched with homeowners in your area who need your expertise.
          </p>
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
            Apply to Join
          </button>
        </div>
      </section>

      {/* Benefits */}
      <section
        style={{
          background: Colors.white,
          padding: isMobile ? '48px 16px' : '80px 24px',
          fontFamily: fontStack,
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: isMobile ? 28 : 36,
              fontWeight: FontWeight.bold,
              color: Colors.charcoal,
              textAlign: 'center',
              margin: isMobile ? '0 0 36px 0' : '0 0 56px 0',
            }}
          >
            Why pros choose Canopy
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: isMobile ? '24px' : '40px',
            }}
          >
            {[
              {
                icon: '📅',
                title: 'Steady Job Pipeline',
                desc: 'No more slow seasons. Canopy connects you with homeowners who have scheduled maintenance waiting.',
              },
              {
                icon: '🕐',
                title: 'Flexible Scheduling',
                desc: 'Set your own availability. Accept jobs that fit your calendar — no pressure, no quotas.',
              },
              {
                icon: '💰',
                title: 'Simple Quoting & Invoicing',
                desc: 'Send quotes and invoices right through the app. Get paid faster with less paperwork.',
              },
              {
                icon: '⭐',
                title: 'Build Your Reputation',
                desc: 'Earn ratings and reviews from homeowners. A strong profile means more job requests.',
              },
              {
                icon: '🏠',
                title: 'Full Home Context',
                desc: 'See the homeowner\'s equipment, maintenance history, and photos before you arrive. No surprises.',
              },
              {
                icon: '📈',
                title: 'Grow at Your Pace',
                desc: 'Start with a few jobs and scale up. Canopy grows with your business.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: '#F5F4F0',
                  padding: isMobile ? '24px' : '32px',
                  borderRadius: BorderRadius.lg,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }} role="img" aria-label={item.title}>
                  {item.icon}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: FontWeight.semibold,
                    color: Colors.charcoal,
                    margin: '0 0 8px 0',
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ fontSize: 15, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>
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
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    margin: '0 auto 16px',
                  }}
                >
                  {item.step}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: FontWeight.semibold, color: Colors.charcoal, margin: '0 0 8px 0' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 15, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          background: Colors.charcoal,
          padding: isMobile ? '48px 16px' : '80px 24px',
          textAlign: 'center',
          fontFamily: fontStack,
        }}
      >
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: isMobile ? 28 : 36,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              margin: '0 0 16px 0',
            }}
          >
            Ready to join the network?
          </h2>
          <p style={{ fontSize: 17, color: 'var(--color-silver)', margin: '0 0 32px 0', lineHeight: 1.6 }}>
            Apply today and start getting matched with homeowners in your area.
          </p>
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
            Apply Now
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
        <p style={{ fontSize: 13, color: 'var(--color-med-gray)', margin: 0 }}>
          © 2026 Canopy. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
