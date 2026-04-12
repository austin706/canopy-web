import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import AdminPreviewBanner from '@/components/AdminPreviewBanner';
import { showToast } from '@/components/Toast';

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
  zip_codes?: string[];
}

export default function ProProfile() {
  const navigate = useNavigate();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');

  // Admin preview
  const [allProviders, setAllProviders] = useState<ProviderProfile[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  // When admin selects a different provider
  useEffect(() => {
    if (isAdmin && selectedProviderId && allProviders.length > 0) {
      const p = allProviders.find(p => p.id === selectedProviderId);
      if (p) applyProfileData(p);
    }
  }, [selectedProviderId]);

  const applyProfileData = (data: ProviderProfile) => {
    setProfile(data);
    setContactName(data.contact_name || '');
    setEmail(data.email || '');
    setPhone(data.phone || '');
    setLicenseNumber(data.license_number || '');
    setBio(data.bio || '');
    setYearsExperience(data.years_experience?.toString() || '');
  };

  const loadProfile = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      // Admin: load all providers, preview the first one
      if (isAdmin) {
        const { data: providers } = await supabase.from('pro_providers').select('*').order('business_name');
        const list = (providers || []) as ProviderProfile[];
        setAllProviders(list);
        if (list.length > 0) {
          setSelectedProviderId(list[0].id);
          applyProfileData(list[0]);
        }
        setLoading(false);
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
        setContactName(data.contact_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setLicenseNumber(data.license_number || '');
        setBio(data.bio || '');
        setYearsExperience(data.years_experience?.toString() || '');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      showToast({ message: 'Failed to load provider profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!contactName.trim() || !email.trim() || !phone.trim()) {
      showToast({ message: 'Please fill in all required fields.' });
      return;
    }

    setSaving(true);
    try {
      const years = yearsExperience ? parseInt(yearsExperience, 10) : null;
      if (yearsExperience && (isNaN(years!) || years! < 0 || years! > 60)) {
        showToast({ message: 'Please enter a valid number of years (0-60).' });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('pro_providers')
        .update({
          contact_name: contactName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          license_number: licenseNumber.trim() || null,
          bio: bio.trim() || null,
          years_experience: years,
        })
        .eq('id', profile.id);

      if (error) throw error;
      showToast({ message: 'Your profile has been updated.' });
    } catch (err) {
      showToast({ message: 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      {isAdmin && (
        <AdminPreviewBanner
          portalType="pro"
          providers={allProviders}
          selectedId={selectedProviderId}
          onSelect={setSelectedProviderId}
        />
      )}
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/pro-portal')}>
            &larr; Back
          </button>
          <h1>{isAdmin ? 'Provider Profile' : 'My Profile'}</h1>
        </div>
      </div>

      {/* Contact Information */}
      <div className="card mb-lg">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Contact Information</h2>

        <div className="form-group">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Full Name *</label>
          <input className="form-input" placeholder="Full Name" value={contactName} onChange={e => setContactName(e.target.value)} />
        </div>

        <div className="form-group">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Email *</label>
          <input className="form-input" placeholder="email@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="form-group">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Phone *</label>
          <input className="form-input" placeholder="(555) 123-4567" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>

      {/* Credentials */}
      <div className="card mb-lg">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Credentials</h2>

        <div className="form-group">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>License Number</label>
          <input className="form-input" placeholder="State license number (optional)" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
        </div>

        <div className="form-group">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Years of Experience</label>
          <input className="form-input" type="number" placeholder="e.g. 10" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} />
        </div>
      </div>

      {/* Bio */}
      <div className="card mb-lg">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>About You</h2>

        <div className="form-group">
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Bio</label>
          <textarea
            className="form-input"
            placeholder="Tell homeowners about your experience and specialties..."
            value={bio}
            onChange={e => setBio(e.target.value)}
            style={{ minHeight: 100, resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Service Area (read-only — managed by admin) */}
      <div className="card mb-lg" style={{ backgroundColor: Colors.cream }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Service Area</h2>
        <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12 }}>
          Your service zip codes are managed by your Canopy admin.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(profile?.zip_codes || []).length > 0 ? (
            (profile?.zip_codes || []).map(zip => (
              <span key={zip} style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 13, fontWeight: 500,
                backgroundColor: Colors.sageMuted, color: Colors.sage,
              }}>{zip}</span>
            ))
          ) : (
            <span style={{ fontSize: 13, color: Colors.medGray, fontStyle: 'italic' }}>
              No zip codes assigned yet. Contact your Canopy admin.
            </span>
          )}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => navigate('/pro-portal')}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
