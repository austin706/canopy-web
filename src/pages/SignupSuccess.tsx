import { useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import { trackEvent } from '@/utils/analytics';

/**
 * Post-signup success page with Free vs Home comparison card.
 * Shown after email verification link is sent — drives immediate upgrade consideration.
 */
export default function SignupSuccess() {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    trackEvent('signup_success_upgrade_click');
    navigate('/login?redirect=/subscription');
  };

  const handleContinue = () => {
    trackEvent('signup_success_continue_free');
    navigate('/login');
  };

  const features: { label: string; free: string; home: string; highlight?: boolean }[] = [
    { label: 'Equipment tracking', free: 'Up to 3', home: 'Unlimited', highlight: true },
    { label: 'AI chat messages', free: '5/mo', home: 'Unlimited', highlight: true },
    { label: 'AI text lookups', free: '2/mo', home: 'Unlimited', highlight: true },
    { label: 'AI equipment scans', free: '1 lifetime', home: 'Unlimited', highlight: true },
    { label: 'Maintenance history', free: '90 days', home: 'Full history', highlight: true },
    { label: 'Maintenance calendar', free: 'Basic', home: 'Smart scheduling' },
    { label: 'Weather alerts', free: 'Basic', home: 'Action items included' },
    { label: 'Home health score', free: '—', home: '✓' },
    { label: 'Home Token', free: '—', home: '✓ with completeness score' },
    { label: 'Document vault', free: '—', home: '✓' },
    { label: 'Sale prep checklist', free: '—', home: '✓' },
    { label: 'Secure notes', free: '—', home: '✓' },
  ];

  const card: React.CSSProperties = {
    maxWidth: 720,
    width: '100%',
    background: Colors.white,
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    background: Colors.sage,
    padding: '32px 32px 24px',
    textAlign: 'center',
    color: Colors.white,
  };

  const cell: React.CSSProperties = {
    padding: '10px 16px',
    fontSize: 14,
    borderBottom: `1px solid ${Colors.cream}`,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${Colors.cream} 0%, ${Colors.warmWhite} 50%, ${Colors.cream} 100%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
    }}>
      {/* Success message */}
      <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 520 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `${Colors.success}20`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28,
        }}>
          ✓
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: Colors.charcoal, margin: '0 0 8px' }}>
          Account Created
        </h1>
        <p style={{ fontSize: 16, color: Colors.medGray, lineHeight: 1.5, margin: 0 }}>
          Check your email for a verification link, then sign in to get started.
        </p>
      </div>

      {/* Comparison card */}
      <div style={card}>
        <div style={headerStyle}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
            Get more from Canopy
          </h2>
          <p style={{ fontSize: 14, margin: 0, opacity: 0.9 }}>
            See what you unlock with Home — just $6.99/mo
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', padding: 0 }}>
          <thead>
            <tr style={{
              background: Colors.cream,
              fontWeight: 600,
              fontSize: 13,
              color: Colors.medGray,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              <th scope="col" style={{ ...cell, textAlign: 'left' }}>Feature</th>
              <th scope="col" style={{ ...cell, textAlign: 'center' }}>Free</th>
              <th scope="col" style={{ ...cell, textAlign: 'center', color: Colors.copper }}>Home</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr
                key={f.label}
                style={{
                  background: f.highlight ? `${Colors.copper}08` : 'transparent',
                }}
              >
                <th scope="row" style={{ ...cell, fontWeight: f.highlight ? 600 : 400, color: Colors.charcoal, textAlign: 'left' }}>
                  {f.label}
                </th>
                <td style={{ ...cell, textAlign: 'center', color: Colors.medGray }}>
                  {f.free}
                </td>
                <td style={{
                  ...cell, textAlign: 'center', fontWeight: 600,
                  color: f.home === '—' ? Colors.medGray : Colors.sage,
                }}>
                  {f.home}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* CTA section */}
        <div style={{
          padding: '24px 32px', display: 'flex', gap: 12,
          justifyContent: 'center', flexWrap: 'wrap',
          borderTop: `1px solid ${Colors.cream}`,
        }}>
          <button
            onClick={handleUpgrade}
            style={{
              padding: '12px 32px', borderRadius: 8,
              background: Colors.copper, color: Colors.white,
              border: 'none', fontWeight: 600, fontSize: 15,
              cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = Colors.copperDark)}
            onMouseOut={(e) => (e.currentTarget.style.background = Colors.copper)}
          >
            Upgrade to Home — $6.99/mo
          </button>
          <button
            onClick={handleContinue}
            style={{
              padding: '12px 32px', borderRadius: 8,
              background: 'transparent', color: Colors.medGray,
              border: `1px solid ${Colors.lightGray}`, fontWeight: 500,
              fontSize: 15, cursor: 'pointer',
            }}
          >
            Continue with Free
          </button>
        </div>
      </div>

      {/* Reassurance */}
      <p style={{
        marginTop: 24, fontSize: 13, color: Colors.silver,
        textAlign: 'center', maxWidth: 400,
      }}>
        No credit card required for Free. Upgrade anytime from your dashboard.
        <br />Cancel Home at any time — your data is always yours.
      </p>
    </div>
  );
}
