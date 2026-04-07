import { useState } from 'react';
import { Colors } from '@/constants/theme';
import { submitBuilderApplication } from '@/services/supabase';
import { useStore } from '@/store/useStore';

interface Form {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  website: string;
  license_number: string;
  license_state: string;
  years_in_business: string;
  annual_home_volume: string;
  service_area_zips: string;
  primary_markets: string;
  home_types: string[];
  price_range: string;
  bio: string;
  referral_source: string;
  agreed_to_terms: boolean;
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const HOME_TYPES = ['single_family', 'townhome', 'custom', 'multi_family', 'patio_home', 'modular'];
const PRICE_RANGES = ['Under $250k', '$250k–$400k', '$400k–$600k', '$600k–$900k', '$900k–$1.5M', '$1.5M+'];
const REFERRAL_SOURCES = ['Google Search', 'Industry Event', 'Word of Mouth', 'Real Estate Partner', 'Email Campaign', 'Other'];

export default function BuilderApplication() {
  const { user } = useStore();
  const [form, setForm] = useState<Form>({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    company_name: '',
    website: '',
    license_number: '',
    license_state: '',
    years_in_business: '',
    annual_home_volume: '',
    service_area_zips: '',
    primary_markets: '',
    home_types: [],
    price_range: '',
    bio: '',
    referral_source: '',
    agreed_to_terms: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof Form>(field: K, value: Form[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors(prev => { const u = { ...prev }; delete u[field as string]; return u; });
    }
  };

  const toggleHomeType = (type: string) => {
    set('home_types', form.home_types.includes(type)
      ? form.home_types.filter(t => t !== type)
      : [...form.home_types, type]);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'Name is required';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required';
    if (!form.company_name.trim()) e.company_name = 'Company name is required';
    if (form.years_in_business && (isNaN(Number(form.years_in_business)) || Number(form.years_in_business) < 0)) {
      e.years_in_business = 'Must be a positive number';
    }
    if (form.annual_home_volume && (isNaN(Number(form.annual_home_volume)) || Number(form.annual_home_volume) < 0)) {
      e.annual_home_volume = 'Must be a positive number';
    }
    if (form.service_area_zips.trim() && !form.service_area_zips.split(',').every(z => /^\d{5}$/.test(z.trim()))) {
      e.service_area_zips = 'ZIPs must be 5-digit, comma-separated';
    }
    if (!form.agreed_to_terms) e.agreed_to_terms = 'You must agree to the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const zips = form.service_area_zips.split(',').map(z => z.trim()).filter(Boolean);
      await submitBuilderApplication({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        company_name: form.company_name,
        website: form.website || null,
        license_number: form.license_number || null,
        license_state: form.license_state || null,
        years_in_business: form.years_in_business ? Number(form.years_in_business) : null,
        annual_home_volume: form.annual_home_volume ? Number(form.annual_home_volume) : null,
        service_area_zips: zips,
        primary_markets: form.primary_markets || null,
        home_types: form.home_types,
        price_range: form.price_range || null,
        bio: form.bio || null,
        referral_source: form.referral_source || null,
        agreed_to_terms: true,
        agreed_to_terms_at: new Date().toISOString(),
        status: 'pending',
      });
      setSubmitted(true);
    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to submit application' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page-container" style={{ maxWidth: 600, margin: '0 auto', padding: '60px 20px' }}>
        <div style={{
          textAlign: 'center',
          padding: '40px 30px',
          backgroundColor: Colors.sage + '20',
          borderRadius: 12,
          border: `2px solid ${Colors.sage}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 20, color: Colors.sage }}>✓</div>
          <h2 style={{ color: Colors.charcoal, marginBottom: 12 }}>You're on the waitlist!</h2>
          <p style={{ color: Colors.medGray, marginBottom: 20, lineHeight: 1.6 }}>
            Thanks for your interest in the Canopy Builder Partner program. We're onboarding builders in waves after our Tulsa launch — we'll reach out as soon as we're ready to activate your account.
          </p>
          <p style={{ color: Colors.medGray, fontSize: 14 }}>
            Updates will be sent to <strong>{form.email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: Colors.charcoal, margin: '0 0 12px 0' }}>
          Join the Canopy Builder Partner Waitlist
        </h1>
        <p style={{ fontSize: 16, color: Colors.medGray, margin: 0, lineHeight: 1.6 }}>
          Give every home you build a digital passport. Hand off a fully-provisioned Canopy account at closing — equipment, warranties, and maintenance schedule pre-loaded. We're activating builder partners in waves after our Tulsa launch; tell us about your company and we'll reach out when it's your turn.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {errors.submit && (
          <div style={{
            backgroundColor: Colors.error + '15',
            border: `1px solid ${Colors.error}`,
            color: Colors.error,
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 24,
            fontSize: 14,
          }}>
            {errors.submit}
          </div>
        )}

        {/* Contact */}
        <Section title="Primary Contact">
          <Field label="Full Name *" error={errors.full_name}>
            <input className="form-input" type="text" value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              style={{ borderColor: errors.full_name ? Colors.error : undefined }} />
          </Field>
          <Field label="Email *" error={errors.email}>
            <input className="form-input" type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              style={{ borderColor: errors.email ? Colors.error : undefined }} />
          </Field>
          <Field label="Phone">
            <input className="form-input" type="tel" value={form.phone}
              onChange={e => set('phone', e.target.value)} />
          </Field>
        </Section>

        {/* Company */}
        <Section title="Company Info">
          <Field label="Company Name *" error={errors.company_name}>
            <input className="form-input" type="text" value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              style={{ borderColor: errors.company_name ? Colors.error : undefined }} />
          </Field>
          <Field label="Website">
            <input className="form-input" type="url" placeholder="https://" value={form.website}
              onChange={e => set('website', e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="License #">
              <input className="form-input" type="text" value={form.license_number}
                onChange={e => set('license_number', e.target.value)} />
            </Field>
            <Field label="License State">
              <select className="form-input" value={form.license_state}
                onChange={e => set('license_state', e.target.value)}>
                <option value="">Select</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="Years in Business" error={errors.years_in_business}>
              <input className="form-input" type="number" min="0" value={form.years_in_business}
                onChange={e => set('years_in_business', e.target.value)}
                style={{ borderColor: errors.years_in_business ? Colors.error : undefined }} />
            </Field>
            <Field label="Homes Built / Year" error={errors.annual_home_volume}>
              <input className="form-input" type="number" min="0" value={form.annual_home_volume}
                onChange={e => set('annual_home_volume', e.target.value)}
                style={{ borderColor: errors.annual_home_volume ? Colors.error : undefined }} />
            </Field>
          </div>
        </Section>

        {/* Build Footprint */}
        <Section title="Build Footprint">
          <Field label="Primary Markets">
            <input className="form-input" type="text" placeholder="Tulsa, OKC, NW Arkansas…"
              value={form.primary_markets}
              onChange={e => set('primary_markets', e.target.value)} />
          </Field>
          <Field label="Service Area ZIP Codes" error={errors.service_area_zips}>
            <input className="form-input" type="text" placeholder="74011, 74012, 74037"
              value={form.service_area_zips}
              onChange={e => set('service_area_zips', e.target.value)}
              style={{ borderColor: errors.service_area_zips ? Colors.error : undefined }} />
            <p style={{ fontSize: 12, color: Colors.medGray, margin: '6px 0 0 0' }}>
              Comma-separated 5-digit ZIPs where you build
            </p>
          </Field>
          <Field label="Home Types">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {HOME_TYPES.map(type => {
                const active = form.home_types.includes(type);
                return (
                  <button type="button" key={type}
                    onClick={() => toggleHomeType(type)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? Colors.sage : Colors.lightGray}`,
                      backgroundColor: active ? Colors.sage + '20' : '#fff',
                      color: active ? Colors.sage : Colors.medGray,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}>
                    {type.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Price Range">
            <select className="form-input" value={form.price_range}
              onChange={e => set('price_range', e.target.value)}>
              <option value="">Select</option>
              {PRICE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </Section>

        {/* About */}
        <Section title="About">
          <Field label="Tell us about your company">
            <textarea className="form-input" rows={4} value={form.bio}
              onChange={e => set('bio', e.target.value)}
              style={{ minHeight: 100, fontFamily: 'inherit', resize: 'vertical' }} />
          </Field>
          <Field label="How did you hear about us?">
            <select className="form-input" value={form.referral_source}
              onChange={e => set('referral_source', e.target.value)}>
              <option value="">Select</option>
              {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </Section>

        {/* Terms */}
        <div style={{ marginBottom: 32 }}>
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            cursor: 'pointer',
            padding: '12px',
            backgroundColor: Colors.copperMuted,
            borderRadius: 8,
          }}>
            <input type="checkbox" checked={form.agreed_to_terms}
              onChange={e => set('agreed_to_terms', e.target.checked)}
              style={{ marginTop: 4, width: 20, height: 20 }} />
            <span style={{ fontSize: 14, color: Colors.charcoal, lineHeight: 1.5 }}>
              I'd like to join the Canopy Builder Partner waitlist and confirm the information above is accurate.
            </span>
          </label>
          {errors.agreed_to_terms && (
            <p style={{ color: Colors.error, fontSize: 12, margin: '8px 0 0 12px' }}>{errors.agreed_to_terms}</p>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}
          style={{ width: '100%', minHeight: 48 }}>
          {submitting ? 'Joining…' : 'Join the Waitlist'}
        </button>

        <p style={{ fontSize: 12, color: Colors.medGray, margin: '20px 0 0 0', textAlign: 'center', lineHeight: 1.6 }}>
          You'll receive a confirmation email. We'll reach out directly when we're activating builders in your region.
        </p>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{
        fontSize: 16,
        fontWeight: 600,
        color: Colors.charcoal,
        marginBottom: 16,
        borderBottom: `2px solid ${Colors.copper}`,
        paddingBottom: 8,
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="form-group">
      <label style={{ fontWeight: 500 }}>{label}</label>
      {children}
      {error && <p style={{ color: Colors.error, fontSize: 12, margin: '4px 0 0 0' }}>{error}</p>}
    </div>
  );
}
