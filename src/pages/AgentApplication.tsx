import { useState, useEffect } from 'react';
import { Colors } from '@/constants/theme';
import { submitAgentApplication } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';

interface ApplicationForm {
  full_name: string;
  email: string;
  phone: string;
  brokerage: string;
  license_number: string;
  license_state: string;
  years_experience: string;
  bio: string;
  service_area_zips: string;
  referral_source: string;
  agreed_to_terms: boolean;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const REFERRAL_SOURCES = [
  'Google Search',
  'Social Media',
  'Word of Mouth',
  'Real Estate Partner',
  'Industry Event',
  'Email Campaign',
  'Other',
];

export default function AgentApplication() {
  const { user } = useStore();
  const [form, setForm] = useState<ApplicationForm>({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    brokerage: '',
    license_number: '',
    license_state: '',
    years_experience: '',
    bio: '',
    service_area_zips: '',
    referral_source: '',
    agreed_to_terms: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (user?.full_name) {
      setForm(prev => ({ ...prev, full_name: user.full_name }));
    }
    if (user?.email) {
      setForm(prev => ({ ...prev, email: user.email }));
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.full_name.trim()) newErrors.full_name = 'Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    if (!form.email.includes('@')) newErrors.email = 'Invalid email address';
    if (!form.license_number.trim()) newErrors.license_number = 'License number is required';
    if (!form.license_state) newErrors.license_state = 'License state is required';
    if (!form.brokerage.trim()) newErrors.brokerage = 'Brokerage is required';
    if (form.years_experience && (isNaN(Number(form.years_experience)) || Number(form.years_experience) < 0)) {
      newErrors.years_experience = 'Years of experience must be a positive number';
    }
    if (!form.agreed_to_terms) newErrors.agreed_to_terms = 'You must agree to the terms';
    if (form.service_area_zips.trim() && !form.service_area_zips.trim().split(',').every(z => /^\d{5}$/.test(z.trim()))) {
      newErrors.service_area_zips = 'ZIP codes must be valid 5-digit codes, separated by commas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const serviceAreaZips = form.service_area_zips
        .trim()
        .split(',')
        .map(z => z.trim())
        .filter(z => z);

      await submitAgentApplication({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        brokerage: form.brokerage,
        license_number: form.license_number,
        license_state: form.license_state,
        years_experience: form.years_experience ? Number(form.years_experience) : null,
        bio: form.bio || null,
        service_area_zips: serviceAreaZips,
        referral_source: form.referral_source || null,
        agreed_to_terms: true,
        agreed_to_terms_at: new Date().toISOString(),
        status: 'pending',
      });

      setSubmitted(true);
      setForm({
        full_name: user?.full_name || '',
        email: user?.email || '',
        phone: '',
        brokerage: '',
        license_number: '',
        license_state: '',
        years_experience: '',
        bio: '',
        service_area_zips: '',
        referral_source: '',
        agreed_to_terms: false,
      });
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to submit application' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFieldChange = (field: keyof ApplicationForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
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
          <div style={{
            fontSize: 48,
            marginBottom: 20,
            color: Colors.sage,
          }}>
            ✓
          </div>
          <h2 style={{ color: Colors.charcoal, marginBottom: 12 }}>Application Submitted!</h2>
          <p style={{ color: Colors.medGray, marginBottom: 20, lineHeight: 1.6 }}>
            Thank you for your interest in becoming a Canopy Agent Partner. We've received your application and will review it within 2-3 business days.
          </p>
          <p style={{ color: Colors.medGray, fontSize: 14 }}>
            We'll send updates to <strong>{form.email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: 700, margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: Colors.charcoal,
          margin: '0 0 12px 0',
        }}>
          Become a Canopy Agent Partner
        </h1>
        <p style={{
          fontSize: 16,
          color: Colors.medGray,
          margin: 0,
          lineHeight: 1.6,
        }}>
          Join our network of real estate agents and help homeowners protect and maintain their investments.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* Submit Error */}
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

        {/* Personal Info Section */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: Colors.charcoal,
            marginBottom: 16,
            borderBottom: `2px solid ${Colors.copper}`,
            paddingBottom: 8,
          }}>
            Personal Information
          </h3>

          <div className="form-group">
            <label style={{ fontWeight: 500 }}>Full Name *</label>
            <input
              className="form-input"
              type="text"
              placeholder="John Smith"
              value={form.full_name}
              onChange={e => handleFieldChange('full_name', e.target.value)}
              style={{ borderColor: errors.full_name ? Colors.error : undefined }}
            />
            {errors.full_name && <p style={{ color: Colors.error, fontSize: 12, margin: '4px 0 0 0' }}>{errors.full_name}</p>}
          </div>

          <div className="form-group">
            <label style={{ fontWeight: 500 }}>Email *</label>
            <input
              className="form-input"
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={e => handleFieldChange('email', e.target.value)}
              style={{ borderColor: errors.email ? Colors.error : undefined }}
            />
            {errors.email && <p style={{ color: Colors.error, fontSize: 12, margin: '4px 0 0 0' }}>{errors.email}</p>}
          </div>

          <div className="form-group">
            <label style={{ fontWeight: 500 }}>Phone</label>
            <input
              className="form-input"
              type="tel"
              placeholder="(555) 123-4567"
              value={form.phone}
              onChange={e => handleFieldChange('phone', e.target.value)}
            />
          </div>
        </div>

        {/* Professional Info Section */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: Colors.charcoal,
            marginBottom: 16,
            borderBottom: `2px solid ${Colors.copper}`,
            paddingBottom: 8,
          }}>
            Professional Information
          </h3>

          <div className="form-group">
            <label style={{ fontWeight: 500 }}>Brokerage *</label>
            <input
              className="form-input"
              type="text"
              placeholder="ABC Realty Group"
              value={form.brokerage}
              onChange={e => handleFieldChange('brokerage', e.target.value)}
              style={{ borderColor: errors.brokerage ? Colors.error : undefined }}
            />
            {errors.brokerage && <p style={{ color: Colors.error, fontSize: 12, margin: '4px 0 0 0' }}>{errors.brokerage}</p>}
          </div>

          <div className="form-group">
            <label style={{ fontWeight: 500 }}>License Number *</label>
            <input
              className="form-input"
              type="text"
              placeholder="RE1234567"
              value={form.license_number}
              onChange={e => handleFieldChange('license_number', e.target.value)}
              style={{ borderColor: errors.license_number ? Colors.error : undefined }}
            />
            {errors.license_number && <p style={{ color: Colors.error, fontSize: 12, margin: '4px 0 0 0' }}>{errors.license_number}</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label style={{ fontWeight: 500 }}>License State *</label>
              <select
                className="form-input"
                value={form.license_state}
                onChange={e => handleFieldChange('license_state', e.target.value)}
                style={{ borderColor: errors.license_state ? Colors.error : undefined }}
              >
                <option value="">Select state</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              {errors.license_state && <p style={{ color: Colors.error, fontSize: 12, margin: '4px 0 0 0' }}>{errors.license_state}</p>}
            </div>

            <div className="form-group">
              <label style={{ fontWeight: 500 }}>Years of Experience</label>
              <input
                className="form-input"
                type="number"
                placeholder="10"
                min="0"
                value={form.years_experience}
                onChange={e => handleFieldChange('years_experience', e.target.value)}
                style={{ borderColor: errors.years_experience ? Colors.error : undefined }}
              />
              {errors.years_experience && <p style={{ color: Colors.error, fontSize: 12, margin: '4px 0 0 0' }}>{errors.years_experience}</p>}
            </div>
          </div>
        </div>

        {/* About You Section */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{
            fontSize: 16,
            fontWeight: 600,
            color: Colors.charcoal,
            marginBottom: 16,
            borderBottom: `2px solid ${Colors.copper}`,
            paddingBottom: 8,
          }}>
            About You
          </h3>

          <div className="form-group">
            <label style={{ fontWeight: 500 }}>About (Bio)</label>
            <textarea
              className="form-input"
              placeholder="Tell us about your experience and specialties..."
              rows={4}
              value={form.bio}
              onChange={e => handleFieldChange('bio', e.target.value)}
              style={{ minHeight: 100, fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label style={{ fontWeight: 500 }}>Service Area ZIP Codes</label>
            <input
              className="form-input"
              type="text"
              placeholder="90210, 90211, 90212"
              value={form.service_area_zips}
              onChange={e => handleFieldChange('service_area_zips', e.target.value)}
              style={{ borderColor: errors.service_area_zips ? Colors.error : undefined }}
            />
            <p style={{ fontSize: 12, color: Colors.medGray, margin: '6px 0 0 0' }}>
              Comma-separated 5-digit ZIP codes where you primarily operate
            </p>
            {errors.service_area_zips && <p style={{ color: Colors.error, fontSize: 12, margin: '4px 0 0 0' }}>{errors.service_area_zips}</p>}
          </div>

          <div className="form-group">
            <label style={{ fontWeight: 500 }}>How did you hear about us?</label>
            <select
              className="form-input"
              value={form.referral_source}
              onChange={e => handleFieldChange('referral_source', e.target.value)}
            >
              <option value="">Select source</option>
              {REFERRAL_SOURCES.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>

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
            <input
              type="checkbox"
              checked={form.agreed_to_terms}
              onChange={e => handleFieldChange('agreed_to_terms', e.target.checked)}
              style={{
                marginTop: 4,
                cursor: 'pointer',
                width: 20,
                height: 20,
                borderColor: errors.agreed_to_terms ? Colors.error : Colors.copper,
                borderWidth: 2,
              }}
            />
            <span style={{ fontSize: 14, color: Colors.charcoal, lineHeight: 1.5 }}>
              I agree to the Canopy Agent Partner terms and conditions, and confirm that the information I've provided is accurate.
            </span>
          </label>
          {errors.agreed_to_terms && <p style={{ color: Colors.error, fontSize: 12, margin: '8px 0 0 12px' }}>{errors.agreed_to_terms}</p>}
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ flex: 1, minHeight: 48 }}
          >
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>

        <p style={{
          fontSize: 12,
          color: Colors.medGray,
          margin: '20px 0 0 0',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          We'll review your application within 2-3 business days and contact you with next steps.
        </p>
      </form>
    </div>
  );
}
