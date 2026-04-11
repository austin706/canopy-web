import { useState, useEffect, useRef } from 'react';
import { getAllAgents, createAgentRecord, updateAgent, uploadPhoto, deleteAgent, getAgentApplications, reviewAgentApplication, getAgentApplicationById } from '@/services/supabase';
import type { AgentApplication } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { AgentAvatar } from '@/components/AgentAvatar';
import PhotoCropModal from '@/components/PhotoCropModal';
import { logAdminAction } from '@/services/auditLog';
import { useStore } from '@/store/useStore';
import { PageSkeleton } from '@/components/Skeleton';

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  approved: Colors.success,
  rejected: Colors.error,
  withdrawn: Colors.silver,
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export default function AdminAgents() {
  const { user: currentUser } = useStore();
  const [tab, setTab] = useState<'agents' | 'applications'>('agents');

  // ─── Agents Tab State ───
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
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
  const [cropFile, setCropFile] = useState<File | null>(null);

  // ─── Applications Tab State ───
  const [applications, setApplications] = useState<AgentApplication[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationFilter, setApplicationFilter] = useState<string>('pending');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [reviewingAppId, setReviewingAppId] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewingApp, setReviewingApp] = useState(false);

  // Load agents on mount
  useEffect(() => {
    getAllAgents()
      .then(setAgents)
      .catch(() => {})
      .finally(() => setAgentsLoading(false));
  }, []);

  // Load applications when tab changes or filter changes
  useEffect(() => {
    if (tab !== 'applications') return;
    loadApplications();
  }, [tab, applicationFilter]);

  const loadApplications = async () => {
    setApplicationsLoading(true);
    try {
      const data = await getAgentApplications(applicationFilter !== 'all' ? applicationFilter : undefined);
      setApplications(data);
    } catch (e) {
      console.error('Failed to load applications:', e);
      alert('Failed to load applications');
    } finally {
      setApplicationsLoading(false);
    }
  };

  // ─── Agent Management Handlers ───

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
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
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
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!selectedAgent || !file) return;

    // Client-side file size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = Math.round(file.size / 1024 / 1024);
      alert(`File too large (${fileSizeMB}MB). Maximum file size is 10MB. Please choose a smaller file.`);
      return;
    }

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
    } catch (e: any) {
      alert('Failed to delete: ' + e.message);
    }
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

  // ─── Application Review Handlers ───

  const handleReviewApplication = async () => {
    if (!reviewingAppId || !reviewDecision || !currentUser?.id) return;

    setReviewingApp(true);
    try {
      await reviewAgentApplication(
        reviewingAppId,
        reviewDecision,
        currentUser.id,
        reviewNotes || undefined
      );
      await logAdminAction('agent_application.review', 'agent_application', reviewingAppId, {
        decision: reviewDecision,
        notes: reviewNotes,
      });

      // Reload applications
      await loadApplications();
      setReviewingAppId(null);
      setReviewDecision(null);
      setReviewNotes('');
      setExpandedAppId(null);
      alert(`Application ${reviewDecision} successfully!`);
    } catch (e: any) {
      alert('Failed to review application: ' + e.message);
    } finally {
      setReviewingApp(false);
    }
  };

  const filtered = agents.filter(a =>
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase()) ||
    a.brokerage?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-wide">
      {/* Page Header */}
      <div className="admin-page-header mb-lg">
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Agents</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            {tab === 'agents' ? `${agents.length} agents` : `${applications.length} applications`}
          </p>
        </div>
        {tab === 'agents' && (
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
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: `1px solid ${Colors.lightGray}` }}>
        <button
          onClick={() => setTab('agents')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: tab === 'agents' ? `3px solid ${Colors.copper}` : 'none',
            color: tab === 'agents' ? Colors.copper : Colors.medGray,
            fontWeight: tab === 'agents' ? 600 : 400,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Agents ({agents.length})
        </button>
        <button
          onClick={() => setTab('applications')}
          style={{
            padding: '12px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: tab === 'applications' ? `3px solid ${Colors.copper}` : 'none',
            color: tab === 'applications' ? Colors.copper : Colors.medGray,
            fontWeight: tab === 'applications' ? 600 : 400,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Applications ({applications.length})
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════
          AGENTS TAB
          ═══════════════════════════════════════════════════════ */}
      {tab === 'agents' && (
        <>
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
          {agentsLoading ? (
            <div className="page-wide"><PageSkeleton rows={6} /></div>
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
                        {agent.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}
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
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowPhotoModal(true);
                      }}
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
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          APPLICATIONS TAB
          ═══════════════════════════════════════════════════════ */}
      {tab === 'applications' && (
        <>
          {/* Filter */}
          <div style={{ marginBottom: 24 }}>
            <select
              value={applicationFilter}
              onChange={e => setApplicationFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                border: `1px solid ${Colors.lightGray}`,
                borderRadius: 6,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <option value="all">All Applications</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          {/* Applications List */}
          {applicationsLoading ? (
            <div className="page-wide"><PageSkeleton rows={6} /></div>
          ) : applications.length === 0 ? (
            <div className="admin-empty">
              <p>No applications found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {applications.map(app => (
                <div
                  key={app.id}
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    padding: 16,
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)}
                >
                  {/* Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 15, margin: 0, marginBottom: 4, color: Colors.charcoal }}>
                        {app.full_name}
                      </p>
                      <p style={{ fontSize: 13, color: Colors.medGray, margin: 0, marginBottom: 4 }}>
                        {app.email}
                      </p>
                      <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                        Applied: {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        padding: '6px 12px',
                        backgroundColor: STATUS_COLORS[app.status] + '20',
                        color: STATUS_COLORS[app.status],
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {STATUS_LABELS[app.status]}
                      </div>
                      <div style={{ fontSize: 20, color: Colors.medGray }}>
                        {expandedAppId === app.id ? '▼' : '▶'}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedAppId === app.id && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${Colors.lightGray}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 500 }}>Brokerage</p>
                          <p style={{ fontSize: 14, color: Colors.charcoal, margin: 0 }}>{app.brokerage || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 500 }}>License Number</p>
                          <p style={{ fontSize: 14, color: Colors.charcoal, margin: 0 }}>{app.license_number || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 500 }}>License State</p>
                          <p style={{ fontSize: 14, color: Colors.charcoal, margin: 0 }}>{app.license_state || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 500 }}>Phone</p>
                          <p style={{ fontSize: 14, color: Colors.charcoal, margin: 0 }}>{app.phone || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 500 }}>Experience</p>
                          <p style={{ fontSize: 14, color: Colors.charcoal, margin: 0 }}>{app.years_experience ? `${app.years_experience} years` : '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 500 }}>Referral Source</p>
                          <p style={{ fontSize: 14, color: Colors.charcoal, margin: 0 }}>{app.referral_source || '—'}</p>
                        </div>
                      </div>

                      {app.service_area_zips && app.service_area_zips.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 500 }}>Service Area ZIPs</p>
                          <p style={{ fontSize: 14, color: Colors.charcoal, margin: 0 }}>
                            {Array.isArray(app.service_area_zips) ? app.service_area_zips.join(', ') : '—'}
                          </p>
                        </div>
                      )}

                      {app.bio && (
                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 500 }}>Bio</p>
                          <p style={{ fontSize: 14, color: Colors.charcoal, margin: 0, lineHeight: 1.5 }}>
                            {app.bio}
                          </p>
                        </div>
                      )}

                      {/* Review Section */}
                      {app.status === 'pending' && (
                        <div style={{
                          backgroundColor: Colors.copperMuted,
                          borderRadius: 8,
                          padding: 16,
                          marginTop: 16,
                        }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal, margin: '0 0 12px 0' }}>
                            Review Application
                          </p>

                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 500, color: Colors.charcoal, display: 'block', marginBottom: 6 }}>
                              Decision
                            </label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                className="btn btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewingAppId(app.id);
                                  setReviewDecision('approved');
                                }}
                                style={{
                                  flex: 1,
                                  backgroundColor: reviewingAppId === app.id && reviewDecision === 'approved' ? Colors.success : Colors.lightGray,
                                  color: reviewingAppId === app.id && reviewDecision === 'approved' ? Colors.white : Colors.charcoal,
                                }}
                              >
                                Approve
                              </button>
                              <button
                                className="btn btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewingAppId(app.id);
                                  setReviewDecision('rejected');
                                }}
                                style={{
                                  flex: 1,
                                  backgroundColor: reviewingAppId === app.id && reviewDecision === 'rejected' ? Colors.error : Colors.lightGray,
                                  color: reviewingAppId === app.id && reviewDecision === 'rejected' ? Colors.white : Colors.charcoal,
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </div>

                          {reviewingAppId === app.id && (
                            <>
                              <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 12, fontWeight: 500, color: Colors.charcoal, display: 'block', marginBottom: 6 }}>
                                  Review Notes (optional)
                                </label>
                                <textarea
                                  value={reviewNotes}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setReviewNotes(e.target.value);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Add feedback or notes..."
                                  rows={3}
                                  style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: `1px solid ${Colors.lightGray}`,
                                    borderRadius: 4,
                                    fontFamily: 'inherit',
                                    fontSize: 13,
                                    resize: 'vertical',
                                  }}
                                />
                              </div>

                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReviewingAppId(null);
                                    setReviewDecision(null);
                                    setReviewNotes('');
                                  }}
                                  style={{ flex: 1 }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReviewApplication();
                                  }}
                                  disabled={reviewingApp}
                                  style={{ flex: 1 }}
                                >
                                  {reviewingApp ? 'Submitting...' : 'Submit Review'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {app.status !== 'pending' && app.review_notes && (
                        <div style={{
                          backgroundColor: Colors.lightGray + '40',
                          borderRadius: 8,
                          padding: 12,
                          marginTop: 16,
                        }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal, margin: '0 0 6px 0' }}>
                            Review Notes
                          </p>
                          <p style={{ fontSize: 13, color: Colors.medGray, margin: 0, lineHeight: 1.5 }}>
                            {app.review_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
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
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                className="form-input"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Brokerage</label>
              <input
                className="form-input"
                value={form.brokerage}
                onChange={e => setForm({ ...form, brokerage: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModals}>
                Cancel
              </button>
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
            <p className="text-gray" style={{ marginBottom: 16 }}>
              {selectedAgent.name}
            </p>
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
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowPhotoModal(false)}>
                Cancel
              </button>
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
