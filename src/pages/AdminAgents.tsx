import { useState, useEffect, useRef } from 'react';
import { getAllAgents, createAgentRecord, updateAgent, uploadPhoto, deleteAgent } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { AgentAvatar } from '@/components/AgentAvatar';
import { logAdminAction } from '@/services/auditLog';

export default function AdminAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', brokerage: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getAllAgents().then(setAgents).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      const newAgent = { id: crypto.randomUUID(), ...form, created_at: new Date().toISOString() };
      const agent = await createAgentRecord(newAgent);
      await logAdminAction('agent.create', 'agent', newAgent.id, { name: form.name, email: form.email });
      setAgents(prev => [...prev, agent]);
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', brokerage: '' });
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!selectedAgent || !form.name || !form.email) return;
    setSaving(true);
    try {
      const updated = await updateAgent(selectedAgent.id, form);
      await logAdminAction('agent.update', 'agent', selectedAgent.id, { name: form.name, email: form.email });
      setAgents(prev => prev.map(a => a.id === selectedAgent.id ? updated : a));
      setShowModal(false);
      setSelectedAgent(null);
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
      await logAdminAction('agent.update', 'agent', selectedAgent.id, { name: selectedAgent.name, email: selectedAgent.email });
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

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`Delete ${selectedIds.size} agent(s)? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      const agentsToDelete = agents.filter(a => selectedIds.has(a.id));
      for (const agent of agentsToDelete) {
        await deleteAgent(agent.id);
        await logAdminAction('agent.delete', 'agent', agent.id, { name: agent.name, email: agent.email });
      }
      await logAdminAction('agent.bulk_delete', 'agent', 'bulk', { count: selectedIds.size });
      setAgents(prev => prev.filter(a => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
      alert(`${selectedIds.size} agent(s) deleted successfully.`);
    } catch (e: any) {
      alert('Failed to delete agents: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Delete this agent? This action cannot be undone.')) return;
    try {
      const agent = agents.find(a => a.id === agentId);
      await deleteAgent(agentId);
      await logAdminAction('agent.delete', 'agent', agentId, { name: agent?.name, email: agent?.email });
      setAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (e: any) { alert('Failed to delete: ' + e.message); }
  };

  const openEditModal = (agent: any) => {
    setSelectedAgent(agent);
    setForm({ name: agent.name, email: agent.email, phone: agent.phone || '', brokerage: agent.brokerage || '' });
    setShowModal(true);
  };

  const closeModals = () => {
    setShowModal(false);
    setSelectedAgent(null);
    setForm({ name: '', email: '', phone: '', brokerage: '' });
  };

  const filtered = agents.filter(a => a.name?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase()) || a.brokerage?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-wide">
      {/* Page Header */}
      <div className="admin-page-header mb-lg">
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Agents</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{agents.length} agents</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedAgent(null);
            setForm({ name: '', email: '', phone: '', brokerage: '' });
            setShowModal(true);
          }}
        >
          + Add Agent
        </button>
      </div>

      {/* Search */}
      <input
        className="admin-search"
        aria-label="Search agents by name or email"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search agents..."
        style={{ marginBottom: 24 }}
      />

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="admin-bulk-bar mb-md">
          <span style={{ fontWeight: 600 }}>{selectedIds.size} agent(s) selected</span>
          <button
            className="btn btn-danger btn-sm"
            onClick={handleBulkDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}

      {/* Agent Cards Grid */}
      {loading ? (
        <div className="text-center" style={{ padding: '32px 16px' }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-empty">
          <p>No agents found</p>
        </div>
      ) : (
        <div className="admin-card-grid">
          {filtered.map(agent => (
            <div
              key={agent.id}
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 20,
                position: 'relative',
              }}
            >
              {/* Checkbox */}
              <div style={{ position: 'absolute', top: 12, left: 12 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(agent.id)}
                  onChange={() => handleToggleSelect(agent.id)}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              {/* Photo */}
              <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 24 }}>
                <AgentAvatar
                  name={agent.name}
                  photoUrl={agent.photo_url}
                  size="lg"
                  accentColor={agent.accent_color || Colors.copper}
                />
              </div>

              {/* Info */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontWeight: 600, fontSize: 16, margin: '0 0 4px 0', color: 'var(--charcoal)', textAlign: 'center' }}>
                  {agent.name}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px 0', textAlign: 'center' }}>
                  {agent.email}
                </p>
                {agent.phone && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 4px 0', textAlign: 'center' }}>
                    {agent.phone}
                  </p>
                )}
                {agent.brokerage && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
                    {agent.brokerage}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSelectedAgent(agent); setShowPhotoModal(true); }}
                  style={{ flex: 1 }}
                >
                  Photo
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openEditModal(agent)}
                  style={{ flex: 1 }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteAgent(agent.id)}
                  style={{ flex: 1 }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModals}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{selectedAgent ? 'Edit Agent' : 'Add Agent'}</h2>
            <div className="form-group">
              <label>Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                className="form-input"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Brokerage</label>
              <input
                className="form-input"
                value={form.brokerage}
                onChange={e => setForm({...form, brokerage: e.target.value})}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModals}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={selectedAgent ? handleEdit : handleAdd}
                disabled={saving || !form.name || !form.email}
              >
                {saving ? 'Saving...' : selectedAgent ? 'Save Changes' : 'Add Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
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
