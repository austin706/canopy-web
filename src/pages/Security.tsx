// ═══════════════════════════════════════════════════════════════
// Security — "Security & Privacy" surface (DL-5)
// ═══════════════════════════════════════════════════════════════
// Dedicated security page linked from the TulsaTrustStrip on Landing and
// from the footer Legal column. Consolidates the encryption / data-handling
// language that previously lived in the generic trust-badge row on Landing.
// Links to Privacy Policy for the full legal text — this page is the
// marketing-clear explainer.

import { Colors, FontWeight, BorderRadius } from '@/constants/theme';
import { Link } from 'react-router-dom';

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

interface Pillar {
  icon: string;
  title: string;
  body: string;
}

const PILLARS: Pillar[] = [
  {
    icon: '🔐',
    title: 'Encryption in transit and at rest',
    body:
      'All traffic between the Canopy apps and our servers runs over TLS 1.2+. Your documents, photos, and database records are encrypted at rest in Supabase-managed hardened cloud infrastructure.',
  },
  {
    icon: '🛡️',
    title: 'PIN-protected secure notes',
    body:
      'Alarm codes, safe combinations, gate codes, and similar sensitive notes sit behind an additional PIN layer. Even if someone gains access to your account, those entries stay locked without the PIN.',
  },
  {
    icon: '🏠',
    title: 'Row-level data isolation',
    body:
      'Every row in the Canopy database is tagged to its owner and protected by row-level security policies. Pro Providers and Agents only see the fields required for the specific job they were invited to — nothing more.',
  },
  {
    icon: '🧾',
    title: 'Export and delete, any time',
    body:
      'You can export your full Canopy history — profile, homes, equipment, maintenance logs, documents, invoices — as a portable JSON file, and delete your account with a single action from the Profile screen.',
  },
  {
    icon: '🚫',
    title: 'We do not sell your data',
    body:
      'Canopy has never sold, rented, or monetized customer data to third parties, and we never will. Our revenue comes from subscriptions and Certified Pro service fees — not from your information.',
  },
  {
    icon: '📋',
    title: 'Audit trail on every admin action',
    body:
      'Administrative changes to homes, subscriptions, and refunds are written to an append-only audit log. You can request your audit trail for your own account at any time.',
  },
];

export default function Security() {
  return (
    <div
      style={{
        fontFamily: fontStack,
        background: Colors.warmWhite,
        minHeight: '100vh',
        color: Colors.charcoal,
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: `1px solid ${Colors.lightGray}`,
          padding: '20px 24px',
          background: Colors.white,
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Link
            to="/"
            style={{
              color: Colors.sageDark,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: FontWeight.semibold,
            }}
          >
            ← Canopy Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: '56px 24px 24px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: 2,
              color: Colors.sageDark,
              fontWeight: FontWeight.semibold,
              margin: '0 0 10px 0',
            }}
          >
            Security &amp; Privacy
          </p>
          <h1
            style={{
              fontSize: 38,
              fontWeight: FontWeight.bold,
              margin: '0 0 16px 0',
              lineHeight: 1.2,
            }}
          >
            Your home data, treated like we&apos;d want ours treated.
          </h1>
          <p style={{ fontSize: 17, color: Colors.medGray, lineHeight: 1.6, margin: 0 }}>
            Canopy stores the service history of your most expensive asset — so
            we built it to the same encryption and isolation standards used by
            payments and healthcare apps. The full legal text lives in our{' '}
            <Link to="/privacy" style={{ color: Colors.copper, textDecoration: 'underline' }}>
              Privacy Policy
            </Link>
            ; this page is the plain-English version.
          </p>
        </div>
      </section>

      {/* Pillars */}
      <section style={{ padding: '32px 24px 56px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 20,
            }}
          >
            {PILLARS.map((p) => (
              <div
                key={p.title}
                style={{
                  background: Colors.white,
                  border: `1px solid ${Colors.lightGray}`,
                  borderRadius: BorderRadius.lg,
                  padding: 24,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 10 }}>{p.icon}</div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: FontWeight.semibold,
                    margin: '0 0 8px 0',
                    color: Colors.charcoal,
                  }}
                >
                  {p.title}
                </h3>
                <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.55, margin: 0 }}>
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reporting + compliance footer */}
      <section style={{ background: Colors.cream, padding: '48px 24px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 22,
              fontWeight: FontWeight.bold,
              margin: '0 0 12px 0',
              color: Colors.charcoal,
            }}
          >
            Report a security issue
          </h2>
          <p style={{ fontSize: 15, color: Colors.medGray, lineHeight: 1.6, margin: '0 0 18px 0' }}>
            If you believe you&apos;ve found a vulnerability or suspicious activity,
            email{' '}
            <a
              href="mailto:security@canopyhome.app"
              style={{ color: Colors.copper, textDecoration: 'underline' }}
            >
              security@canopyhome.app
            </a>
            . We acknowledge reports within one business day and coordinate
            responsible disclosure when appropriate. For support or account
            issues, use{' '}
            <a
              href="mailto:support@canopyhome.app"
              style={{ color: Colors.copper, textDecoration: 'underline' }}
            >
              support@canopyhome.app
            </a>
            .
          </p>
          <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>
            See the <Link to="/privacy" style={{ color: Colors.copper }}>Privacy Policy</Link>,{' '}
            <Link to="/terms" style={{ color: Colors.copper }}>Terms of Service</Link>, and{' '}
            <Link to="/cancellation" style={{ color: Colors.copper }}>Cancellation Policy</Link>{' '}
            for the complete legal terms.
          </p>
        </div>
      </section>
    </div>
  );
}
