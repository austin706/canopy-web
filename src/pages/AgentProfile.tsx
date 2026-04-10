import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getAllAgents, updateAgent, uploadPhoto } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { AgentAvatar } from '@/components/AgentAvatar';
import PhotoCropModal from '@/components/PhotoCropModal';

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  brokerage: string;
  photo_url?: string;
  logo_url?: string;
  accent_color?: string;
}

export default function AgentProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [brokerage, setBrokerage] = useState('');
  const [accentColor, setAccentColor] = useState(Colors.copper);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    loadAgent();
  }, []);

  const loadAgent = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user?.email) {
        navigate('/login');
        return;
      }

      const agents = await getAllAgents();
      const currentAgent = agents.find(a => a.email === authUser.user.email);

      if (!currentAgent) {
        setMessage('Agent not found');
        return;
      }

      setAgent(currentAgent);
      setName(currentAgent.name || '');
      setPhone(currentAgent.phone || '');
      setBrokerage(currentAgent.brokerage || '');
      setAccentColor(currentAgent.accent_color || Colors.copper);
    } catch (err: any) {
      console.error('Error loading agent:', err);
      setMessage('Failed to load agent profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!agent || !file) return;

    setUploadingPhoto(true);
    try {
      const photoUrl = await uploadPhoto('agent-photos', `${agent.id}/${Date.now()}_${file.name}`, file);
      const updatedAgent = await updateAgent(agent.id, { photo_url: photoUrl });
      setAgent(updatedAgent);
      setMessage('Photo uploaded successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('Failed to upload photo: ' + err.message);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!agent || !file) return;

    setUploadingLogo(true);
    try {
      const logoUrl = await uploadPhoto('agent-photos', `${agent.id}/logo_${Date.now()}_${file.name}`, file);
      const updatedAgent = await updateAgent(agent.id, { logo_url: logoUrl });
      setAgent(updatedAgent);
      setMessage('Logo uploaded successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('Failed to upload logo: ' + err.message);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!agent) return;
    try {
      const updatedAgent = await updateAgent(agent.id, { logo_url: null });
      setAgent(updatedAgent);
      setMessage('Logo removed.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('Failed to remove logo: ' + err.message);
    }
  };

  const handleSave = async () => {
    if (!agent) return;

    if (!name.trim() || !brokerage.trim()) {
      setMessage('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const updatedAgent = await updateAgent(agent.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        brokerage: brokerage.trim(),
        accent_color: accentColor,
      });
      setAgent(updatedAgent);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('Failed to update profile: ' + err.message);
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

  if (!agent) {
    return (
      <div className="page">
        <div className="card text-center">
          <p className="text-gray">Agent profile not found</p>
          <button className="btn btn-primary mt-lg" onClick={() => navigate('/agent-portal')}>
            Back to Agent Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/agent-portal')}>
            ← Back to Portal
          </button>
          <h1>My Agent Profile</h1>
          <p className="subtitle">Manage your profile and photo</p>
        </div>
      </div>

      {/* Photo Section */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Profile Photo</h2>

        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <AgentAvatar
              name={agent.name}
              photoUrl={agent.photo_url}
              size="lg"
              accentColor={accentColor}
            />
          </div>
          <p className="text-sm text-gray">Recommended: Square image, 500x500px or larger</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) setCropFile(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          style={{ display: 'none' }}
        />

        {cropFile && (
          <PhotoCropModal
            imageFile={cropFile}
            shape="circle"
            outputSize={500}
            onCancel={() => setCropFile(null)}
            onCrop={async (blob) => {
              setCropFile(null);
              const croppedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
              await handlePhotoUpload(croppedFile);
            }}
          />
        )}

        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          style={{ width: '100%' }}
        >
          {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
        </button>
      </div>

      {/* Brokerage Logo */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Brokerage Logo</h2>
        <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
          Shown on your client-facing QR code page. Use a transparent PNG for best results.
        </p>

        {agent.logo_url ? (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'inline-block', padding: 16, background: 'var(--color-background)', borderRadius: 8 }}>
              <img
                src={agent.logo_url}
                alt="Brokerage logo"
                style={{ maxHeight: 60, maxWidth: 240, objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '24px 16px', marginBottom: 16,
            background: 'var(--color-background)', borderRadius: 8,
            border: '2px dashed var(--color-border)',
          }}>
            <p className="text-sm text-gray">No logo uploaded yet</p>
          </div>
        )}

        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleLogoUpload(file);
          }}
          style={{ display: 'none' }}
        />

        <div className="flex gap-sm">
          <button
            className="btn btn-secondary"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            style={{ flex: 1 }}
          >
            {uploadingLogo ? 'Uploading...' : agent.logo_url ? 'Change Logo' : 'Upload Logo'}
          </button>
          {agent.logo_url && (
            <button
              className="btn btn-ghost"
              onClick={handleRemoveLogo}
              style={{ color: 'var(--color-error)' }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Basic Information</h2>

        <div className="form-group">
          <label>Name *</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your Full Name"
          />
        </div>

        <div className="form-group">
          <label>Phone</label>
          <input
            className="form-input"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>

        <div className="form-group">
          <label>Brokerage *</label>
          <input
            className="form-input"
            value={brokerage}
            onChange={e => setBrokerage(e.target.value)}
            placeholder="Your Brokerage Name"
          />
        </div>
      </div>

      {/* Brand Customization */}
      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Brand Color</h2>
        <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12 }}>
          This color appears in the homeowner app and web interface
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="color"
            value={accentColor}
            onChange={e => setAccentColor(e.target.value)}
            style={{ width: 60, height: 60, borderRadius: 8, border: 'none', cursor: 'pointer' }}
          />
          <div>
            <p style={{ fontSize: 13, color: Colors.medGray }}>Selected Color</p>
            <code style={{ fontSize: 12, background: 'var(--color-background)', padding: '4px 8px', borderRadius: 4 }}>
              {accentColor}
            </code>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className="card"
          style={{
            background: message.includes('success') ? 'var(--color-success)' : 'var(--color-warning)',
            opacity: 0.15,
            borderLeft: `4px solid ${message.includes('success') ? 'var(--color-success)' : 'var(--color-warning)'}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-sm">
        <button className="btn btn-ghost" onClick={() => navigate('/agent-portal')}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
