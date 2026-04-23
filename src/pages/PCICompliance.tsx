import { LEGAL_DATES, pciAnnualReviewDueDate } from '@/constants/legalDates';

export default function PCICompliance() {
  // P3 #73 (2026-04-23) — derive annual review date from last-updated ISO so the
  // two can't drift. Prior copy hardcoded "January 31, 2027" which would go
  // stale the moment the SAQ-A was re-attested.
  const annualReviewDue = pciAnnualReviewDueDate();
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: 'var(--color-text)', lineHeight: 1.7 }}>
      <a href="/" style={{ color: 'var(--color-sage)', textDecoration: 'none', fontSize: 14 }}>← Back</a>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>PCI DSS Compliance</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 32 }}>
        SAQ-A Self-Assessment Questionnaire — Last updated <time dateTime={LEGAL_DATES.pciCompliance.iso}>{LEGAL_DATES.pciCompliance.display}</time>
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>PCI DSS Compliance Overview</h2>
      <p>
        Canopy is committed to protecting payment card data and maintaining the highest standards of security. As a merchant that fully outsources payment processing to Stripe — a PCI DSS Level 1 certified service provider — Canopy qualifies for SAQ-A, the simplest self-assessment questionnaire under the PCI DSS framework.
      </p>
      <p style={{ marginTop: 12 }}>
        No cardholder data is stored, processed, or transmitted by Canopy systems. All payment processing is handled exclusively through Stripe's secure payment infrastructure.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Our Payment Architecture</h2>
      <p>
        Canopy never touches credit card data. All payment information is collected and processed securely through our payment partners:
      </p>
      <ul style={{ marginTop: 12, marginLeft: 24 }}>
        <li style={{ marginBottom: 8 }}><strong>Web payments:</strong> All card data is collected directly by Stripe via Stripe Checkout (hosted payment pages) or Stripe.js/Elements. Canopy servers never see, store, or transmit credit card numbers, CVVs, or expiration dates.</li>
        <li style={{ marginBottom: 8 }}><strong>Mobile payments:</strong> Payments via Apple App Store and Google Play are handled entirely by Apple and Google. Canopy receives payment confirmations only after the transaction is complete.</li>
        <li><strong>Stripe handling:</strong> Stripe handles all PCI compliance requirements for payment processing as a PCI DSS Level 1 Service Provider.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>SAQ-A Eligibility Confirmation</h2>
      <div style={{ backgroundColor: 'var(--color-success)15', border: '1px solid var(--color-success)30', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <p style={{ marginBottom: 16, fontWeight: 600, color: 'var(--color-success)' }}>Canopy meets all requirements for PCI DSS SAQ-A:</p>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-success)', fontSize: 18, marginRight: 12, fontWeight: 700 }}>✓</span>
            <span>All payment processing fully outsourced to PCI DSS validated third-party (Stripe Level 1 Service Provider)</span>
          </li>
          <li style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-success)', fontSize: 18, marginRight: 12, fontWeight: 700 }}>✓</span>
            <span>No electronic storage of cardholder data on any Canopy system</span>
          </li>
          <li style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-success)', fontSize: 18, marginRight: 12, fontWeight: 700 }}>✓</span>
            <span>No processing of cardholder data on any Canopy system</span>
          </li>
          <li style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-success)', fontSize: 18, marginRight: 12, fontWeight: 700 }}>✓</span>
            <span>No transmission of cardholder data through Canopy systems</span>
          </li>
          <li style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-success)', fontSize: 18, marginRight: 12, fontWeight: 700 }}>✓</span>
            <span>All payment pages served directly by Stripe (Checkout hosted pages)</span>
          </li>
          <li style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-success)', fontSize: 18, marginRight: 12, fontWeight: 700 }}>✓</span>
            <span>Company does not store cardholder data in paper records</span>
          </li>
          <li style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--color-success)', fontSize: 18, marginRight: 12, fontWeight: 700 }}>✓</span>
            <span>Confirmed with Stripe that they are PCI DSS compliant (Level 1 Service Provider)</span>
          </li>
        </ul>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Security Controls</h2>
      <p>
        Although Canopy does not handle cardholder data directly, we maintain robust security controls to protect all user information and system integrity:
      </p>
      <ul style={{ marginTop: 12, marginLeft: 24 }}>
        <li style={{ marginBottom: 8 }}><strong>HTTPS/TLS Encryption:</strong> All web traffic between clients and Canopy servers is encrypted with TLS 1.2 or higher.</li>
        <li style={{ marginBottom: 8 }}><strong>Database Security:</strong> Supabase Row Level Security (RLS) policies enforce access control on all database tables. Users can only access their own data.</li>
        <li style={{ marginBottom: 8 }}><strong>Authentication:</strong> All user authentication is handled by Supabase Auth with ES256 JWT tokens. Sessions are time-limited and securely managed.</li>
        <li style={{ marginBottom: 8 }}><strong>Secrets Management:</strong> API keys and secrets are stored in Supabase Vault and never committed to code repositories.</li>
        <li style={{ marginBottom: 8 }}><strong>Access Control:</strong> Role-based access control (RBAC) with roles: homeowner, agent, provider, and admin. Each role has defined permissions.</li>
        <li><strong>Dependency Updates:</strong> Regular security patches and dependency updates are applied to keep all libraries current.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Stripe Integration Details</h2>
      <p style={{ marginBottom: 16 }}>
        Canopy's payment infrastructure is built entirely on Stripe's PCI-compliant platform:
      </p>
      <ul style={{ marginLeft: 24 }}>
        <li style={{ marginBottom: 8 }}><strong>Web checkout:</strong> Stripe Checkout in redirect mode — users are sent to Stripe's hosted payment page and return to Canopy after transaction completion.</li>
        <li style={{ marginBottom: 8 }}><strong>Mobile checkout:</strong> Opens the system browser to Stripe Checkout page, keeping payment data isolated from the app.</li>
        <li style={{ marginBottom: 8 }}><strong>Webhooks:</strong> Stripe sends secure webhook events to Canopy's webhook endpoint. These events contain subscription metadata and payment status only — never card data.</li>
        <li style={{ marginBottom: 8 }}><strong>Invoices:</strong> Stripe handles all invoice payment collection. Canopy displays invoice status and links to Stripe only.</li>
        <li><strong>Customer Portal:</strong> Users access the Stripe Customer Portal directly for payment method management and billing history.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Annual Review Schedule</h2>
      <ul style={{ marginLeft: 24 }}>
        <li style={{ marginBottom: 8 }}><strong>Assessment period:</strong> January 1 — December 31</li>
        <li style={{ marginBottom: 8 }}><strong>Annual self-assessment due:</strong> January 31 of following year</li>
        <li style={{ marginBottom: 8 }}><strong>Responsible party:</strong> Austin Wojciechowski, Founder</li>
        <li>
          <strong>Next review due:</strong>{' '}
          <time dateTime={annualReviewDue.iso}>{annualReviewDue.display}</time>{' '}
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            (12 months after last attestation)
          </span>
        </li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Incident Response</h2>
      <p>
        If a potential security incident involving payment data is discovered, the following steps will be taken:
      </p>
      <ol style={{ marginTop: 12, marginLeft: 24 }}>
        <li style={{ marginBottom: 8 }}>Immediately notify Stripe Support</li>
        <li style={{ marginBottom: 8 }}>Investigate the scope of potential exposure</li>
        <li style={{ marginBottom: 8 }}>Notify affected users within 72 hours if required by law</li>
        <li style={{ marginBottom: 8 }}>Document the incident and all remediation steps taken</li>
        <li>Review and update security controls as needed to prevent recurrence</li>
      </ol>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contact & Resources</h2>
      <p>
        For questions regarding PCI compliance: <a href="mailto:support@canopyhome.app" style={{ color: 'var(--color-sage)', textDecoration: 'none' }}>support@canopyhome.app</a>
      </p>
      <p style={{ marginTop: 12 }}>
        For Stripe's PCI compliance documentation, visit: <a href="https://stripe.com/docs/security" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-sage)', textDecoration: 'none' }}>stripe.com/docs/security</a>
      </p>

      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 48, paddingTop: 24, color: 'var(--color-text-secondary)', fontSize: 14, textAlign: 'center' as const }}>© {new Date().getFullYear()} Canopy. All rights reserved.</div>
    </div>
  );
}
