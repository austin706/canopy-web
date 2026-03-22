import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

const SERVICE_CATEGORIES = [
  { id: 'hvac', label: 'HVAC' },
  { id: 'plumbing', label: 'Plumbing' },
  { id: 'electrical', label: 'Electrical' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'general', label: 'General' },
  { id: 'lawn', label: 'Lawn Care' },
  { id: 'pool', label: 'Pool' },
];

interface ProviderProfile {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  license_number?: string;
  bio?: string;
  years_experience?: number;
  service_categories: string[];
  service_area_miles: number;
}

export default function ProProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [serviceAreaMiles, setServiceAreaMiles] = useState(25);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      const { data, error } = await supabase
        .from('pro_providers')
        .select('*')
        .eq('user_id', authUser.user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile(data);
        setBusinessName(data.business_name || '');
        setContactName(data.contact_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setLicenseNumber(data.license_number || '');
        setBio(data.bio || '');
        setYearsExperience(data.years_experience?.toString() || '');
        setSelectedCategories(data.service_categories || []);
        setServiceAreaMiles(data.service_area_miles || 25);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      alert('Failed to load provider profile');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId) ? prev.filter(c => c !== categoryId) : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!businessName.trim() || !contactName.trim() || !email.trim() || !phone.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    if (selectedCategories.length === 0) {
      alert('Please select at least one service category.');
      return;
    }

    setSaving(true);
    try {
      const years = yearsExperience ? parseInt(yearsExperience, 10) : null;
      if (yearsExperience && (isNaN(years!) || years! < 0 || years! > 60)) {
        alert('Please enter a valid number of years (0-60).');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('pro_providers')
        .update({
          business_name: businessName.trim(),
          contact_name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          license_number: licenseNumber.trim() || null,
          bio: bio.trim() || null,
          years_experience: years,
          service_categories: selectedCategories,
          service_area_miles: serviceAreaMiles,
        })
        .eq('id', profile.id);

      if (error) throw error;
      alert('Your profile has been updated.');
    } catch (err) {
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/pro-portal')}>
            ← Back
          </button>
          <h1>Provider Profile</h1>
        </div>
      </div>

      {/* Business Information */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Business Information</h2>

        <div className="form-group">
          <label>Business Name *</label>
          <input
            className="form-input"
            placeholder="Your Company Name"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Contact Name *</label>
          <input
            className="form-input"
            placeholder="Full Name"
            value={contactName}
            onChange={e => setContactName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input
            className="form-input"
            placeholder="business@email.com"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Phone *</label>
          <input
            className="form-input"
            placeholder="(555) 123-4567"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </div>
      </div>

      {/* Credentials */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Credentials</h2>

        <div className="form-group">
          <label>License Number</label>
          <input
            className="form-input"
            placeholder="State license number"
            value={licenseNumber}
            onChange={e => setLicenseNumber(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Years of Experience</label>
          <input
            className="form-input"
            type="number"
            placeholder="e.g. 10"
            value={yearsExperience}
            onChange={e => setYearsExperience(e.target.value)}
          />
        </div>
      </div>

      {/* Bio */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>About Your Business</h2>

        <div className="form-group">
          <label>Bio</label>
          <textarea
            className="form-textarea"
            placeholder="Tell homeowners about your experience and specialties..."
            value={bio}
            onChange={e => setBio(e.target.value)}
            style={{ minHeight: 100 }}
          />
        </div>
      </div>

      {/* Service Area */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Service Area</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            className="form-input"
            type="range"
            min="5"
            max="100"
            step="5"
            value={serviceAreaMiles}
            onChange={e => setServiceAreaMiles(parseInt(e.target.value))}
            style={{ flex: 1 }}
          />
          <div style={{ minWidth: 60, textAlign: 'right' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{serviceAreaMiles}</span>
            <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>miles</p>
          </div>
        </div>
      </div>

      {/* Service Categories */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Service Categories *</h2>
        <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
          Select all categories you provide service for
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SERVICE_CATEGORIES.map(cat => {
            const selected = selectedCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                className={`badge ${selected ? 'badge-sage' : ''}`}
                onClick={() => toggleCategory(cat.id)}
                style={{
                  backgroundColor: selected ? Colors.sage : Colors.lightGray,
                  color: selected ? 'white' : Colors.charcoal,
                  border: 'none',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                {selected ? '✓ ' : ''}{cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-sm">
        <button className="btn btn-ghost" onClick={() => navigate('/pro-portal')}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
