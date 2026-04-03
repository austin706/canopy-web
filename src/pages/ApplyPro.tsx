import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

type ServiceCategory = 'hvac' | 'plumbing' | 'electrical' | 'roofing' | 'landscaping' | 'pest' | 'appliance' | 'handyman' | 'painting' | 'flooring' | 'windows' | 'gutters' | 'foundation' | 'pool' | 'garage' | 'locksmith';

const SERVICE_CATEGORIES: Record<ServiceCategory, string> = {
  hvac: 'HVAC',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  roofing: 'Roofing',
  landscaping: 'Landscaping',
  pest: 'Pest Control',
  appliance: 'Appliance Repair',
  handyman: 'General Handyman',
  painting: 'Painting',
  flooring: 'Flooring',
  windows: 'Windows & Doors',
  gutters: 'Gutters',
  foundation: 'Foundation',
  pool: 'Pool & Spa',
  garage: 'Garage Door',
  locksmith: 'Locksmith',
};

export default function ApplyPro() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    yearsExperience: '',
    licenseNumber: '',
    licenseState: 'Oklahoma' as 'Oklahoma' | 'Florida',
    insuranceCarrier: '',
    insurancePolicyNumber: '',
    insuranceExpiresAt: '',
    serviceCategories: [] as ServiceCategory[],
    serviceAreaZips: '',
    bio: '',
  });

  const handleServiceCategoryToggle = (category: ServiceCategory) => {
    setFormData((prev) => ({
      ...prev,
      serviceCategories: prev.serviceCategories.includes(category)
        ? prev.serviceCategories.filter((c) => c !== category)
        : [...prev.serviceCategories, category],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!agreedToTerms) {
      setError('You must agree to the Contractor Terms of Service.');
      return;
    }

    if (formData.serviceCategories.length === 0) {
      setError('Please select at least one service category.');
      return;
    }

    setLoading(true);

    try {
      // Insert into provider_applications table
      const { error: dbError } = await supabase.from('provider_applications').insert([
        {
          business_name: formData.businessName,
          contact_name: formData.contactName,
          email: formData.email,
          phone: formData.phone,
          years_experience: formData.yearsExperience ? parseInt(formData.yearsExperience) : null,
          license_number: formData.licenseNumber,
          license_state: formData.licenseState,
          insurance_carrier: formData.insuranceCarrier,
          insurance_policy_number: formData.insurancePolicyNumber,
          insurance_expires_at: formData.insuranceExpiresAt,
          service_categories: formData.serviceCategories,
          service_area_zips: formData.serviceAreaZips,
          bio: formData.bio,
          agreed_to_terms: true,
          status: 'pending',
        },
      ]);

      if (dbError) throw dbError;

      // Send branded confirmation email to applicant
      try {
        await supabase.functions.invoke('support-email', {
          body: {
            mode: 'provider-application-received',
            email: formData.email,
            contact_name: formData.contactName,
            business_name: formData.businessName,
          },
        });
      } catch (emailErr) {
        console.error('Applicant confirmation email error:', emailErr);
      }

      // Send admin notification email
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: 'support@canopyhome.app',
            subject: `New Pro Provider Application: ${formData.businessName}`,
            html: `
              <h2>New Pro Provider Application</h2>
              <p><strong>Business Name:</strong> ${formData.businessName}</p>
              <p><strong>Contact Name:</strong> ${formData.contactName}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Phone:</strong> ${formData.phone}</p>
              <p><strong>Years of Experience:</strong> ${formData.yearsExperience}</p>
              <p><strong>License State:</strong> ${formData.licenseState}</p>
              <p><strong>Service Categories:</strong> ${formData.serviceCategories.map((c) => SERVICE_CATEGORIES[c]).join(', ')}</p>
              <p><strong>Service Area ZIPs:</strong> ${formData.serviceAreaZips}</p>
              <hr />
              <h3>Bio/Description:</h3>
              <p>${formData.bio.replace(/\n/g, '<br>')}</p>
            `,
          },
        });
      } catch (adminEmailErr) {
        console.error('Admin notification email error:', adminEmailErr);
      }

      setSubmitted(true);
      setTimeout(() => {
        navigate('/');
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ color: Colors.sage, textDecoration: 'none', fontSize: 14 }}>← Back to Canopy</a>
        </div>

        <div style={{ marginTop: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: Colors.charcoal }}>Application Submitted!</h1>
          <p style={{ color: Colors.medGray, fontSize: 18, marginBottom: 32 }}>
            We review applications within 48 hours. You'll receive an email at <strong>{formData.email}</strong> with next steps.
          </p>
          <p style={{ color: Colors.medGray, fontSize: 14 }}>
            Thank you for your interest in joining the Canopy Pro network.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: Colors.charcoal, lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ color: Colors.sage, textDecoration: 'none', fontSize: 14 }}>← Back to Canopy</a>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Become a Canopy Pro Provider</h1>
      <p style={{ color: Colors.medGray, marginBottom: 32 }}>
        Join our network of trusted home maintenance professionals. We're currently serving the Tulsa, OK and Florida markets.
      </p>

      {/* Requirements section */}
      <div style={{
        backgroundColor: Colors.cream,
        border: `1px solid ${Colors.lightGray}`,
        borderRadius: 8,
        padding: 24,
        marginBottom: 48,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Requirements</h2>
        <ul style={{ paddingLeft: 24, margin: 0 }}>
          <li style={{ marginBottom: 12, color: Colors.charcoal }}>Valid state/local trade license</li>
          <li style={{ marginBottom: 12, color: Colors.charcoal }}>General liability insurance ($1M minimum)</li>
          <li style={{ marginBottom: 12, color: Colors.charcoal }}>Reliable transportation</li>
          <li style={{ marginBottom: 12, color: Colors.charcoal }}>Smartphone with Canopy app</li>
          <li style={{ marginBottom: 0, color: Colors.charcoal }}>Commitment to professional service standards</li>
        </ul>
      </div>

      {/* Application form */}
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{
            backgroundColor: '#ffebee',
            color: Colors.error,
            padding: 16,
            borderRadius: 6,
            marginBottom: 24,
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>Business Information</h3>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Business Name <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.businessName}
            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="Your business name"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Contact Name <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.contactName}
            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="Your name"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Email <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="your@email.com"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Phone <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="(555) 123-4567"
          />
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>Professional Credentials</h3>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Years of Experience
          </label>
          <input
            type="number"
            min="0"
            max="70"
            value={formData.yearsExperience}
            onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="e.g., 10"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            License Number <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.licenseNumber}
            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="Your state/local license number"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            License State <span style={{ color: Colors.error }}>*</span>
          </label>
          <select
            required
            value={formData.licenseState}
            onChange={(e) => setFormData({ ...formData, licenseState: e.target.value as 'Oklahoma' | 'Florida' })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          >
            <option value="Oklahoma">Oklahoma</option>
            <option value="Florida">Florida</option>
          </select>
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>Insurance Information</h3>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Insurance Carrier <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.insuranceCarrier}
            onChange={(e) => setFormData({ ...formData, insuranceCarrier: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="e.g., XYZ Insurance Company"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Insurance Policy Number <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.insurancePolicyNumber}
            onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="Your policy number"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Insurance Expiration Date <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="date"
            required
            value={formData.insuranceExpiresAt}
            onChange={(e) => setFormData({ ...formData, insuranceExpiresAt: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>Service Details</h3>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
            Service Categories <span style={{ color: Colors.error }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {(Object.entries(SERVICE_CATEGORIES) as [ServiceCategory, string][]).map(([key, label]) => (
              <label key={key} style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: 14,
              }}>
                <input
                  type="checkbox"
                  checked={formData.serviceCategories.includes(key)}
                  onChange={() => handleServiceCategoryToggle(key)}
                  style={{
                    marginRight: 8,
                    cursor: 'pointer',
                    width: 18,
                    height: 18,
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Service Area ZIP Codes <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.serviceAreaZips}
            onChange={(e) => setFormData({ ...formData, serviceAreaZips: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            placeholder="e.g., 74101, 74102, 74103 (comma-separated)"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Brief Bio / Description of Services
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              minHeight: 120,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
            placeholder="Tell us about your experience and the services you provide..."
          />
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 32 }}>Agreement</h3>

        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          cursor: 'pointer',
          marginBottom: 24,
          fontSize: 14,
        }}>
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            style={{
              marginRight: 12,
              cursor: 'pointer',
              marginTop: 2,
              width: 18,
              height: 18,
              flexShrink: 0,
            }}
          />
          <span>
            I agree to the{' '}
            <a href="/contractor-terms" style={{ color: Colors.copper, textDecoration: 'none' }}>
              Contractor Terms of Service
            </a>
            {' '}<span style={{ color: Colors.error }}>*</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 24px',
            backgroundColor: Colors.copper,
            color: Colors.white,
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </form>

      <div style={{ borderTop: `1px solid ${Colors.lightGray}`, marginTop: 48, paddingTop: 24, color: '#999', fontSize: 14, textAlign: 'center' }}>
        © {new Date().getFullYear()} Canopy. All rights reserved.
      </div>
    </div>
  );
}
