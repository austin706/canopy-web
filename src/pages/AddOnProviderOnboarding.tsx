import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import { getErrorMessage } from '@/utils/errors';
import logger from '@/utils/logger';

// AddOnProviderOnboarding — web wrapper for the add-on provider onboarding flow.
// The full step-by-step UI (documents, signatures, training, etc.) lives in
// the mobile portal (`Canopy-App/app/add-on-provider/onboarding/*`) because
// providers are field workers; the web version is a parity scaffold that lets
// providers update their profile and kick off Stripe Connect from a browser.
//
// Steps surfaced here for Phase 1:
//   1) Verify add_on_providers row exists for the caller (created by
//      apply_as_add_on_provider). If none, bounce to /apply-add-on-provider.
//   2) Profile — quick edit of company/contact/service ZIPs.
//   3) Documents/signature — placeholder; deferred to mobile in Phase 1.
//   4) Stripe Connect — invoke add-on-connect-onboard (action='create') and
//      send the user to the hosted onboarding URL.
//
// Approval is admin-driven (approve_add_on_provider) — providers stay in
// status='applied' or 'onboarding' until an admin flips them to 'active'.

interface AddOnProviderRow {
  id: string;
  provider_id: string;
  category_id: string;
  status: string;
  company_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  license_number: string | null;
  service_zip_codes: string[] | null;
  service_radius_miles: number | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean | null;
}

type Step = 'profile' | 'documents' | 'stripe' | 'done';

export default function AddOnProviderOnboarding() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AddOnProviderRow | null>(null);
  const [step, setStep] = useState<Step>('profile');

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [serviceZipCodes, setServiceZipCodes] = useState('');
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [stripeStarting, setStripeStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id) {
        setError('You must be signed in to continue onboarding.');
        setLoading(false);
        return;
      }
      try {
        // Pick the most recently applied row (a provider can re-apply across
        // categories — the dashboard handles the multi-row case in Phase 5).
        const { data, error: pErr } = await supabase
          .from('add_on_providers')
          .select(
            'id, provider_id, category_id, status, company_name, contact_name, contact_phone, contact_email, license_number, service_zip_codes, service_radius_miles, stripe_connect_account_id, stripe_connect_onboarding_complete',
          )
          .eq('provider_id', user.id)
          .order('applied_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pErr) throw pErr;
        if (!data) {
          if (!cancelled) {
            // No applied row yet — push them to the apply page first
            navigate('/apply-add-on-provider');
          }
          return;
        }
        if (!cancelled) {
          setProvider(data);
          setCompanyName(data.company_name || '');
          setContactName(data.contact_name || '');
          setContactPhone(data.contact_phone || '');
          setContactEmail(data.contact_email || '');
          setLicenseNumber(data.license_number || '');
          setServiceZipCodes((data.service_zip_codes || []).join(', '));
          setServiceRadiusMiles(
            data.service_radius_miles != null ? String(data.service_radius_miles) : '',
          );
          if (data.stripe_connect_onboarding_complete) setStep('done');
          else if (data.stripe_connect_account_id) setStep('stripe');
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(getErrorMessage(e) || 'Failed to load provider profile.');
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

  const handleSaveProfile = async () => {
    if (!provider) return;
    if (!companyName.trim()) {
      setError('Company name is required.');
      return;
    }
    setSavingProfile(true);
    setError(null);
    try {
      const zips = serviceZipCodes
        .split(',')
        .map((z) => z.trim())
        .filter((z) => /^\d{5}$/.test(z));

      // RLS policy "Provider updates own provider row" lets the provider
      // edit their own row by provider_id = auth.uid(); no SECURITY DEFINER
      // needed for this path.
      const { error: upErr } = await supabase
        .from('add_on_providers')
        .update({
          company_name: companyName.trim(),
          contact_name: contactName.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
          license_number: licenseNumber.trim() || null,
          service_zip_codes: zips,
          service_radius_miles: serviceRadiusMiles ? parseInt(serviceRadiusMiles, 10) : null,
          onboarding_step: 'profile_saved',
          status: provider.status === 'applied' ? 'onboarding' : provider.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', provider.id);
      if (upErr) throw upErr;
      setStep('documents');
    } catch (e) {
      setError(getErrorMessage(e) || 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleStartStripe = async () => {
    if (!provider) return;
    setStripeStarting(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        'add-on-connect-onboard',
        {
          body: { action: 'create', providerId: provider.id },
        },
      );
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      const url = (data as { onboardingUrl?: string })?.onboardingUrl;
      if (!url) throw new Error('No onboarding URL returned from edge function.');
      logger.info('add-on-connect-onboard returned onboarding URL — redirecting.');
      window.location.href = url;
    } catch (e) {
      setError(getErrorMessage(e) || 'Failed to start Stripe onboarding.');
      setStripeStarting(false);
    }
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: Colors.medGray }}>Loading your provider profile…</p>
        </div>
      </div>
    );
  }

  if (error && !provider) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: 18 /* allow-lint */, fontWeight: 700, marginBottom: 8 }}>Onboarding error</h2>
          <p style={{ color: Colors.medGray }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/apply-add-on-provider')}>
            Start an application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 24 /* allow-lint */, fontWeight: 700, marginBottom: 4 }}>Add-On Provider Onboarding</h1>
        <p style={{ color: Colors.medGray, fontSize: 14 /* allow-lint */, marginBottom: 24 }}>
          Status: <strong>{provider?.status}</strong>
          {provider?.category_id ? <> · Category: <strong>{provider.category_id}</strong></> : null}
        </p>

        <StepNav step={step} setStep={setStep} />

        {error && (
          <div
            style={{
              background: 'var(--color-error)',
              opacity: 0.15,
              color: 'var(--color-error)',
              padding: 12,
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13 /* allow-lint */,
            }}
          >
            {error}
          </div>
        )}

        {step === 'profile' && (
          <>
            <h3 style={sectionTitleStyle}>Business Profile</h3>
            <LabelInput label="Company Name *" value={companyName} onChange={setCompanyName} />
            <LabelInput label="Contact Name" value={contactName} onChange={setContactName} />
            <LabelInput label="Contact Phone" value={contactPhone} onChange={setContactPhone} />
            <LabelInput
              label="Contact Email"
              value={contactEmail}
              onChange={setContactEmail}
              type="email"
            />
            <LabelInput label="License Number" value={licenseNumber} onChange={setLicenseNumber} />
            <LabelInput
              label="Service ZIP Codes (comma-separated)"
              value={serviceZipCodes}
              onChange={setServiceZipCodes}
            />
            <LabelInput
              label="Service Radius (miles)"
              value={serviceRadiusMiles}
              onChange={setServiceRadiusMiles}
              type="number"
            />
            <button aria-label="action"
              className="btn btn-primary"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              style={{ width: '100%', marginTop: 16 }}
            >
              {savingProfile ? 'Saving…' : 'Save & Continue'}
            </button>
          </>
        )}

        {step === 'documents' && (
          <>
            <h3 style={sectionTitleStyle}>Documents & Signature</h3>
            <p style={{ color: Colors.medGray, fontSize: 14 /* allow-lint */, marginBottom: 16 }}>
              For now, document and signature capture happens in the Canopy mobile
              app. Install the app and sign in with the same account, or skip
              ahead to Stripe Connect — your application stays in onboarding
              status either way.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                className="btn btn-primary"
                href="/get-the-app"
                style={{ textDecoration: 'none' }}
              >
                Get the mobile app
              </a>
              <button className="btn btn-ghost" onClick={() => setStep('stripe')}>
                Skip to Stripe Connect →
              </button>
            </div>
          </>
        )}

        {step === 'stripe' && (
          <>
            <h3 style={sectionTitleStyle}>Stripe Connect</h3>
            <p style={{ color: Colors.medGray, fontSize: 14 /* allow-lint */, marginBottom: 16 }}>
              Connect a bank account through Stripe Express so Canopy can pay
              you directly after each completed visit. Stripe handles W-9 and
              1099 filings on your behalf.
            </p>
            {provider?.stripe_connect_onboarding_complete && (
              <p style={{ color: Colors.sage, fontSize: 14 /* allow-lint */, marginBottom: 12 }}>
                ✓ Stripe onboarding is already complete.
              </p>
            )}
            <button aria-label="action"
              className="btn btn-primary"
              onClick={handleStartStripe}
              disabled={stripeStarting}
              style={{ width: '100%' }}
            >
              {stripeStarting
                ? 'Opening Stripe…'
                : provider?.stripe_connect_account_id
                  ? 'Resume Stripe onboarding'
                  : 'Start Stripe onboarding'}
            </button>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={{ fontSize: 48 /* allow-lint */, marginBottom: 8 }}>✅</div>
            <h3 style={sectionTitleStyle}>Onboarding complete</h3>
            <p style={{ color: Colors.medGray, fontSize: 14 /* allow-lint */, marginBottom: 16 }}>
              You're ready to receive jobs. An admin will move you to the active
              roster after final review.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/add-on-provider')}
              style={{ width: '100%' }}
            >
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StepNav({ step, setStep }: { step: Step; setStep: (s: Step) => void }) {
  const items: { key: Step; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'documents', label: 'Documents' },
    { key: 'stripe', label: 'Stripe Connect' },
    { key: 'done', label: 'Done' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => setStep(it.key)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: step === it.key ? `2px solid ${Colors.sage}` : '1px solid var(--color-border)',
            background: step === it.key ? Colors.sage + '15' : 'var(--color-card)',
            color: step === it.key ? Colors.sage : 'var(--text-secondary)',
            fontSize: 12 /* allow-lint */,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function LabelInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13 /* allow-lint */, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
          fontSize: 14 /* allow-lint */,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: 32,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--color-card-background)',
  borderRadius: 16,
  padding: 32,
  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16 /* allow-lint */,
  fontWeight: 700,
  marginBottom: 12,
  color: Colors.charcoal,
};
