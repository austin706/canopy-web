import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors, FontSize } from '@/constants/theme';
import { getErrorMessage } from '@/utils/errors';
import logger from '@/utils/logger';

// ApplyAddOnProvider — public "Become an add-on service provider" landing.
// Scaffold mirrors ApplyPro.tsx visually, but persists via the
// `apply_as_add_on_provider` RPC (migration_105) and routes the applicant
// into `/add-on-provider/onboarding` on success rather than just showing
// a thank-you. Approval is admin-gated via `approve_add_on_provider`.

interface AddOnCategory {
  id: string;
  display_name: string;
  active: boolean | null;
}

export default function ApplyAddOnProvider() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [categories, setCategories] = useState<AddOnCategory[]>([]);

  const [formData, setFormData] = useState({
    categoryId: '',
    companyName: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    licenseNumber: '',
    serviceZipCodes: '',
    serviceRadiusMiles: '',
  });

  // Load active add_on_categories so the dropdown is grounded in real ids
  // (the apply RPC validates p_category_id against add_on_categories.id and
  // raises 23503 on a miss).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error: catErr } = await supabase
          .from('add_on_categories')
          .select('id, display_name, active')
          .eq('active', true)
          .order('display_name');
        if (catErr) throw catErr;
        if (!cancelled) {
          setCategories(data || []);
          if (data && data.length > 0) {
            setFormData((prev) => ({ ...prev, categoryId: data[0].id }));
          }
        }
      } catch (err) {
        logger.error('Failed to load add-on categories:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreedToTerms) {
      setError('You must agree to the Contractor Terms of Service.');
      return;
    }
    if (!formData.categoryId) {
      setError('Please pick a service category.');
      return;
    }
    if (!formData.companyName.trim()) {
      setError('Company name is required.');
      return;
    }

    // Caller must be authenticated — apply_as_add_on_provider keys off
    // auth.uid(). Bounce to login (with return URL) if no session exists.
    const { data: sessData } = await supabase.auth.getSession();
    if (!sessData?.session?.user?.id) {
      navigate(`/login?redirect=${encodeURIComponent('/apply-add-on-provider')}`);
      return;
    }

    setSubmitting(true);
    try {
      const zips = formData.serviceZipCodes
        .split(',')
        .map((z) => z.trim())
        .filter((z) => /^\d{5}$/.test(z));

      const { data, error: rpcErr } = await supabase.rpc('apply_as_add_on_provider', {
        p_category_id: formData.categoryId,
        p_company_name: formData.companyName.trim(),
        p_contact_name: formData.contactName.trim() || null,
        p_contact_phone: formData.contactPhone.trim() || null,
        p_contact_email: formData.contactEmail.trim() || null,
        p_license_number: formData.licenseNumber.trim() || null,
        p_service_zip_codes: zips,
        p_service_radius_miles: formData.serviceRadiusMiles
          ? parseInt(formData.serviceRadiusMiles, 10)
          : null,
      });

      if (rpcErr) throw rpcErr;
      logger.info('apply_as_add_on_provider returned provider row id:', data);
      navigate('/add-on-provider/onboarding');
    } catch (err) {
      setError(getErrorMessage(err) || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: '40px 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: Colors.charcoal,
        lineHeight: 1.7,
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ color: Colors.sage, textDecoration: 'none', fontSize: 14 /* allow-lint */ }}>← Back</a>
      </div>

      <h1 style={{ fontSize: 32 /* allow-lint */, fontWeight: 700, marginBottom: 8 }}>
        Become a Canopy Add-On Provider
      </h1>
      <p style={{ color: Colors.medGray, marginBottom: 32 }}>
        Join Canopy's network of specialty service providers (pest, lawn, pool, and more).
        Applications are reviewed by our team before activation.
      </p>

      <div
        style={{
          backgroundColor: 'var(--color-copper-muted, #FFF3E0)' /* allow-lint */,
          border: `1px solid var(--color-border)`,
          borderRadius: 8,
          padding: 24,
          marginBottom: 48,
        }}
      >
        <h2 style={{ fontSize: FontSize.lg, fontWeight: 600, marginBottom: 16 }}>Requirements</h2>
        <ul style={{ paddingLeft: 24, margin: 0 }}>
          <li style={{ marginBottom: 12 }}>Valid state/local trade license</li>
          <li style={{ marginBottom: 12 }}>General liability insurance ($1M minimum)</li>
          <li style={{ marginBottom: 12 }}>Smartphone with Canopy app installed</li>
          <li style={{ marginBottom: 0 }}>Commitment to professional service standards</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div
            style={{
              backgroundColor: 'var(--color-error)',
              opacity: 0.15,
              color: 'var(--color-error)',
              padding: 16,
              borderRadius: 6,
              marginBottom: 24,
              fontSize: 14 /* allow-lint */,
            }}
          >
            {error}
          </div>
        )}

        <h3 style={{ fontSize: 16 /* allow-lint */, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>
          Service Category
        </h3>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 /* allow-lint */ }}>
            Category <span style={{ color: Colors.error }}>*</span>
          </label>
          <select
            required
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            disabled={loading}
            style={selectStyle}
          >
            {loading && <option value="">Loading…</option>}
            {!loading && categories.length === 0 && (
              <option value="">No active categories</option>
            )}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
              </option>
            ))}
          </select>
        </div>

        <h3 style={{ fontSize: 16 /* allow-lint */, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>
          Business Information
        </h3>

        <Field
          label="Company Name"
          required
          value={formData.companyName}
          onChange={(v) => setFormData({ ...formData, companyName: v })}
          placeholder="e.g., Acme Pest Control LLC"
        />

        <Field
          label="Primary Contact Name"
          value={formData.contactName}
          onChange={(v) => setFormData({ ...formData, contactName: v })}
          placeholder="Your name"
        />

        <Field
          label="Contact Phone"
          value={formData.contactPhone}
          onChange={(v) => setFormData({ ...formData, contactPhone: v })}
          placeholder="(555) 123-4567"
          type="tel"
        />

        <Field
          label="Contact Email"
          value={formData.contactEmail}
          onChange={(v) => setFormData({ ...formData, contactEmail: v })}
          placeholder="dispatch@yourbusiness.com"
          type="email"
        />

        <Field
          label="License Number"
          value={formData.licenseNumber}
          onChange={(v) => setFormData({ ...formData, licenseNumber: v })}
          placeholder="Your state/local license number"
        />

        <h3 style={{ fontSize: 16 /* allow-lint */, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>
          Service Area
        </h3>

        <Field
          label="Service ZIP Codes"
          value={formData.serviceZipCodes}
          onChange={(v) => setFormData({ ...formData, serviceZipCodes: v })}
          placeholder="e.g., 74101, 74102, 74103 (comma-separated)"
          helper="Only 5-digit ZIPs are kept; others are dropped silently."
        />

        <Field
          label="Service Radius (miles)"
          value={formData.serviceRadiusMiles}
          onChange={(v) => setFormData({ ...formData, serviceRadiusMiles: v })}
          placeholder="e.g., 25"
          type="number"
        />

        <h3 style={{ fontSize: 16 /* allow-lint */, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>Agreement</h3>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            cursor: 'pointer',
            marginBottom: 24,
            fontSize: 14 /* allow-lint */,
          }}
        >
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            style={{ marginRight: 12, cursor: 'pointer', marginTop: 2, width: 18, height: 18 }}
          />
          <span>
            I agree to the{' '}
            <a href="/contractor-terms" style={{ color: Colors.copper, textDecoration: 'none' }}>
              Contractor Terms of Service
            </a>{' '}
            <span style={{ color: Colors.error }}>*</span>
          </span>
        </label>

        <button aria-label="Submit application"
          type="submit"
          disabled={submitting || loading}
          style={{
            width: '100%',
            padding: '12px 24px',
            backgroundColor: Colors.copper,
            color: Colors.white,
            border: 'none',
            borderRadius: 6,
            fontSize: 16 /* allow-lint */,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Application & Continue'}
        </button>
      </form>

      <div
        style={{
          borderTop: `1px solid var(--color-border)`,
          marginTop: 48,
          paddingTop: 24,
          color: 'var(--color-text-secondary)',
          fontSize: 14 /* allow-lint */,
          textAlign: 'center',
        }}
      >
        © {new Date().getFullYear()} Canopy. All rights reserved.
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid var(--color-border)',
  backgroundColor: Colors.inputBackground,
  fontSize: 14 /* allow-lint */,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = 'text',
  helper,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  helper?: string;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 /* allow-lint */ }}>
        {label} {required && <span style={{ color: Colors.error }}>*</span>}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 6,
          border: '1px solid var(--color-border)',
          backgroundColor: Colors.inputBackground,
          fontSize: 14 /* allow-lint */,
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
      {helper && (
        <div style={{ fontSize: 12 /* allow-lint */, color: Colors.medGray, marginTop: 4 }}>{helper}</div>
      )}
    </div>
  );
}
