import { LEGAL_DATES } from '@/constants/legalDates';

// P3 #75 (2026-04-23) — contractor-terms effective date read from the shared
// legalDates constant so revisions propagate everywhere at once.
const CONTRACTOR_TERMS_DATE = LEGAL_DATES.contractorTerms;

export default function ContractorTerms() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: 'var(--color-text)', lineHeight: 1.7 }}>
      <a href="/" style={{ color: 'var(--color-sage)', textDecoration: 'none', fontSize: 14 }}>← Back</a>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Pro Provider Terms of Service</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 32 }}>
        Effective <time dateTime={CONTRACTOR_TERMS_DATE.iso}>{CONTRACTOR_TERMS_DATE.display}</time>
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>1. Purpose & Scope</h2>
      <p>
        These terms and conditions govern the relationship between Canopy ("Platform") and independent Pro Providers ("Provider") who use the Canopy platform to connect with homeowners for home maintenance and repair services. By registering as a Pro Provider, you accept these terms in their entirety.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>2. Independent Contractor Status</h2>
      <p>
        Provider is an independent contractor, not an employee of Canopy. Provider is solely responsible for:
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Determining methods and means of performing services</li>
        <li style={{ marginBottom: 8 }}>Managing own work schedule and availability</li>
        <li style={{ marginBottom: 8 }}>Paying all self-employment taxes and filing required tax documents (1099)</li>
        <li style={{ marginBottom: 8 }}>Obtaining own liability and workers' compensation insurance</li>
      </ul>
      <p>
        Canopy does not provide employment benefits, health insurance, workers' compensation, or unemployment insurance. Provider maintains sole discretion over job acceptance and service delivery methods.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>3. Eligibility & Qualifications</h2>
      <p>Provider must maintain the following at all times:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Be at least 18 years of age</li>
        <li style={{ marginBottom: 8 }}>Maintain all required state, local, and municipal licenses and certifications for services offered</li>
        <li style={{ marginBottom: 8 }}>Carry general liability insurance with minimum coverage of $1,000,000 per occurrence</li>
        <li style={{ marginBottom: 8 }}>Carry auto insurance if using vehicle for service calls or homeowner transportation</li>
        <li style={{ marginBottom: 8 }}>Pass background check if required by applicable law or Canopy policy</li>
        <li style={{ marginBottom: 8 }}>Maintain clean driving record if services involve vehicle operation</li>
      </ul>
      <p>
        Canopy reserves the right to verify credentials at any time and suspend access if requirements are not maintained.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>4. Service Standards</h2>
      <p>All work performed through Canopy must meet these professional standards:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Respond to job requests within 24 hours of posting</li>
        <li style={{ marginBottom: 8 }}>Arrive within the scheduled service window</li>
        <li style={{ marginBottom: 8 }}>Perform all work in a professional and workmanlike manner consistent with industry standards</li>
        <li style={{ marginBottom: 8 }}>Clean up work area and remove debris before departure</li>
        <li style={{ marginBottom: 8 }}>Provide written quote before beginning any additional work not pre-approved by homeowner</li>
        <li style={{ marginBottom: 8 }}>Notify both homeowner and Canopy immediately of any unforeseen issues, code violations, or cost changes</li>
        <li style={{ marginBottom: 8 }}>Maintain professional communication and behavior throughout service engagement</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>5. Scheduling & Cancellation</h2>
      <p>
        Provider must accept or decline job requests within 24 hours of posting. Once accepted:
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>For standard service calls: cancellation allowed up to 48 hours before scheduled time</li>
        <li style={{ marginBottom: 8 }}>For bimonthly maintenance visits: 48-hour cancellation window applies</li>
        <li style={{ marginBottom: 8 }}>Excessive cancellations (more than 3 in any 30-day period) may result in account suspension</li>
        <li style={{ marginBottom: 8 }}>No-shows without prior cancellation trigger automatic account review and may result in suspension</li>
      </ul>
      <p>
        Provider is responsible for managing calendar and confirming availability before accepting jobs.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>6. Payment Terms</h2>
      <p>
        Canopy facilitates all payments between homeowner and Provider through Stripe, our secure payment processor.
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Canopy retains a 15% platform fee on all service transactions</li>
        <li style={{ marginBottom: 8 }}>Payments are processed within 5-7 business days after job completion and homeowner confirmation</li>
        <li style={{ marginBottom: 8 }}>Payment processing requires both provider acceptance and homeowner sign-off</li>
        <li style={{ marginBottom: 8 }}>Disputed charges are handled through Canopy's resolution process in good faith</li>
        <li style={{ marginBottom: 8 }}>Provider receives itemized payment statements through the platform dashboard</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>7. Bimonthly Visit Program</h2>
      <p>
        Pro and Pro+ subscribers receive periodic maintenance visits. Bimonthly visits are allocated automatically based on service area and provider availability.
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Provider must complete the standardized inspection checklist provided by Canopy</li>
        <li style={{ marginBottom: 8 }}>Provider must submit photos and detailed findings through the platform</li>
        <li style={{ marginBottom: 8 }}>AI-generated summaries are created from provider input data</li>
        <li style={{ marginBottom: 8 }}>Provider is responsible for accuracy and completeness of all raw data submitted</li>
        <li style={{ marginBottom: 8 }}>Homeowner receives AI-enhanced report with provider's baseline data within 48 hours of visit</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>8. Quotes & Invoicing</h2>
      <p>
        All quotes and invoicing must be managed through the Canopy platform:
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>All quotes must be submitted through the Canopy platform</li>
        <li style={{ marginBottom: 8 }}>Work cannot begin until homeowner has approved the quote in writing</li>
        <li style={{ marginBottom: 8 }}>Invoices are generated through platform and paid via Stripe</li>
        <li style={{ marginBottom: 8 }}>Provider may not solicit direct payment outside the platform for work initiated through Canopy</li>
        <li style={{ marginBottom: 8 }}>All disputes regarding charges must be resolved through Canopy's formal process</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>9. Insurance & Liability</h2>
      <p>
        Provider assumes full liability for all work performed and maintains responsibility for insurance coverage:
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Provider's insurance is the primary coverage for any incidents arising from work performed</li>
        <li style={{ marginBottom: 8 }}>Provider shall indemnify and hold harmless Canopy from all claims, damages, or costs arising from provider's work</li>
        <li style={{ marginBottom: 8 }}>Canopy is not liable for injuries, property damage, or disputes arising from services provided by Provider</li>
        <li style={{ marginBottom: 8 }}>Provider agrees to maintain continuous coverage throughout the term of service</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>10. Confidentiality</h2>
      <p>
        Provider must protect homeowner privacy and comply with all data protection requirements:
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Keep homeowner personal information, addresses, and contact details confidential</li>
        <li style={{ marginBottom: 8 }}>May not use homeowner data for personal marketing, solicitation, or commercial purposes outside the platform</li>
        <li style={{ marginBottom: 8 }}>Must comply with applicable state and federal data protection laws</li>
        <li style={{ marginBottom: 8 }}>Violation of confidentiality may result in immediate account termination</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>11. Platform Conduct</h2>
      <p>
        Provider agrees to maintain professional and ethical behavior on the platform:
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Maintain professional communication in all interactions with homeowners and Canopy staff</li>
        <li style={{ marginBottom: 8 }}>No harassment, discrimination, or abusive behavior toward homeowners or other providers</li>
        <li style={{ marginBottom: 8 }}>No soliciting homeowners to conduct work outside the platform or abandon Canopy services</li>
        <li style={{ marginBottom: 8 }}>No misrepresenting qualifications, experience, certifications, or work history</li>
        <li style={{ marginBottom: 8 }}>No posting false or misleading reviews or testimonials</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>12. Termination</h2>
      <p>
        Canopy or Provider may terminate this agreement:
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Either party may terminate with 7 days written notice via email</li>
        <li style={{ marginBottom: 8 }}>Canopy may immediately suspend or terminate for safety violations, fraud, or repeated complaints</li>
        <li style={{ marginBottom: 8 }}>Outstanding payments for completed work will be processed according to standard payment terms</li>
        <li style={{ marginBottom: 8 }}>Provider must complete any in-progress jobs or arrange acceptable handoff to another provider</li>
        <li style={{ marginBottom: 8 }}>Upon termination, Provider's access to the platform is immediately revoked</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>13. Dispute Resolution</h2>
      <p>
        Any disputes between Provider and Canopy are resolved through the following process:
      </p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Good faith negotiation and communication attempt first (30 days)</li>
        <li style={{ marginBottom: 8 }}>Non-binding mediation as second step if negotiation fails</li>
        <li style={{ marginBottom: 8 }}>Binding arbitration at Canopy's then-current corporate seat (currently Tulsa, Oklahoma; Providers in other service-area states may request a virtual/remote arbitration hearing in lieu of in-person appearance) if mediation fails to resolve the dispute</li>
        <li style={{ marginBottom: 8 }}>Small claims court in Provider's state of residence remains available for claims under $10,000</li>
      </ul>
      <p style={{ marginTop: 8, fontStyle: 'italic' as const, fontSize: 14, color: 'var(--color-text-secondary)' }}>
        Note: Nothing in this section overrides mandatory state or local licensing, safety, insurance, or consumer-protection requirements that apply to Provider in their service area. Where state law voids a choice-of-venue clause, the nearest competent venue in Provider's service area applies.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>14. Modifications to Terms</h2>
      <p>
        Canopy may modify these terms at any time. Material changes require 30 days written notice via email or in-app notification. Continued use of the platform after the notice period constitutes acceptance of modified terms. Provider may decline modifications by terminating the agreement.
      </p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>15. Contact & Support</h2>
      <p>
        For questions regarding these terms or to report violations, contact:
      </p>
      <p style={{ marginTop: 16 }}>
        <strong>support@canopyhome.app</strong>
      </p>

      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 48, paddingTop: 24, color: 'var(--color-text-secondary)', fontSize: 14, textAlign: 'center' as const }}>
        © {new Date().getFullYear()} Canopy. All rights reserved.
        {/* P3 #75 (2026-04-23) — single source of truth in constants/legalDates.ts */}
        <p style={{ marginTop: 8 }}>
          Last updated: <time dateTime={CONTRACTOR_TERMS_DATE.iso}>{CONTRACTOR_TERMS_DATE.display}</time>. Governing law: State of Oklahoma (Canopy's state of incorporation), except where mandatory state or local law in Provider's service area requires otherwise.
        </p>
      </div>
    </div>
  );
}
