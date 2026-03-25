import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAgents, createAgentRecord, updateAgent, uploadPhoto } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { AgentAvatar } from '@/components/AgentAvatar';

export default function AdminAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', brokerage: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getAllAgents().then(setAgents).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      const agent = await createAgentRecord({ id: crypto.randomUUID(), ...form, created_at: new Date().toISOString() });
      setAgents(prev => [...prev, agent]);
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', brokerage: '' });
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!selectedAgent || !file) return;
    setUploadingPhoto(true);
    try {
      const photoUrl = await uploadPhoto('agent-photos', `${selectedAgent.id}/${Date.now()}_${file.name}`, file);
      const updatedAgent = await updateAgent(selectedAgent.id, { photo_url: photoUrl });
      setAgents(prev => prev.map(a => a.id === selectedAgent.id ? updatedAgent : a));
      setSelectedAgent(updatedAgent);
      alert('Agent photo updated successfully!');
    } catch (e: any) {
      alert('Failed to upload photo: ' + e.message);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filtered = agents.filter(a => a.name?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase()) || a.brokerage?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
          <h1>Agent Management</h1>
          <p className="subtitle">{agents.length} agents</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Agent</button>
      </div>

      <input className="form-input mb-lg" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents..." style={{ maxWidth: 400 }} />

      {loading ? <div className="text-center"><div className="spinner" /></div> : (
        <div className="card table-container">
          <table>
            <thead><tr><th>Photo</th><th>Name</th><th>Email</th><th>Phone</th><th>Brokerage</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="flex items-center">
                      <AgentAvatar
                        name={a.name}
                        photoUrl={a.photo_url}
                        size="sm"
                        accentColor={a.accent_color || Colors.copper}
                      />
                    </div>
                  </td>
                  <td><span className="fw-600">{a.name}</span></td>
                  <td>{a.email}</td>
                  <td>{a.phone || '—'}</td>
                  <td>{a.brokerage || '—'}</td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => { setSelectedAgent(a); setShowPhotoModal(true); }}>Photo</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center text-gray" style={{ padding: 32 }}>No agents found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Agent</h2>
            <div className="form-group"><label>Name *</label><input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="form-group"><label>Email *</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div className="form-group"><label>Phone</label><input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div className="form-group"><label>Brokerage</label><input className="form-input" value={form.brokerage} onChange={e => setForm({...form, brokerage: e.target.value})} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !form.name || !form.email}>{saving ? 'Saving...' : 'Add Agent'}</button>
            </div>
          </div>
        </div>
      )}

      {showPhotoModal && selectedAgent && (
        <div className="modal-overlay" onClick={() => setShowPhotoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Update Agent Photo</h2>
            <p className="text-gray" style={{ marginBottom: 16 }}>{selectedAgent.name}</p>
            <div style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <AgentAvatar
                  name={selectedAgent.name}
                  photoUrl={selectedAgent.photo_url}
                  size="lg"
                  accentColor={selectedAgent.accent_color || Colors.copper}
                />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(file);
              }}
              style={{ display: 'none' }}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowPhotoModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? 'Uploading...' : 'Choose Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
