import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { createProRequest, getProRequests, supabase, sendNotification } from '@/services/supabase';
import { isProOrHigher } from '@/services/subscriptionGate';
import MessageBanner from '@/components/MessageBanner';
import { Colors, StatusColors } from '@/constants/theme';
import { ImageViewer } from '@/components/ImageViewer';
import type { ProRequest as ProRequestType } from '@/types';

const SERVICE_TYPES = ['HVAC Maintenance', 'Filter Change', 'Gutter Cleaning', 'Plumbing Repair', 'Electrical Inspection', 'Roof Inspection', 'Pool Service', 'Deck Maintenance', 'Lawn Care', 'General Handyman', 'Custom/Other'];

const STATUS_STEPS = ['pending', 'matched', 'scheduled', 'completed'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Submitted',
  matched: 'Provider Matched',
  scheduled: 'Scheduled',
  completed: 'Completed',
};

export default function ProRequest() {
  const navigate = useNavigate();
  const { user, home } = useStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsWithProviders, setRequestsWithProviders] = useState<any[]>([]);
  const [form, setForm] = useState({ service_type: SERVICE_TYPES[0], description: '', preferred_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  const tier = user?.subscription_tier || 'free';
  const hasPro = isProOrHigher(tier);

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    try {
      const data = await getProRequests(user.id);
      setRequests(data);
      const enriched = await Promise.all(data.map(async (req: any) => {
        if (req.assigned_provider || req.provider_id) {
          try {
            const pid = req.assigned_provider || req.provider_id;
            const { data: provider } = await supabase.from('pro_providers').select('*').eq('id', pid).single();
            return { ...req, provider };
          } catch {
            return req;
          }
        }
        return req;
      }));
      setRequestsWithProviders(enriched);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !home) return;
    setSubmitting(true);
    try {
      const r = await createProRequest({ id: crypto.randomUUID(), user_id: user.id, home_id: home.id, ...form, status: 'pending', created_at: new Date().toISOString() });
      setRequests(prev => [r, ...prev]);
      setRequestsWithProviders(prev => [r, ...prev]);

      try {
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
        for (const admin of (admins || [])) {
          await sendNotification({
            user_id: admin.id,
            title: `New Pro Request: ${form.service_type}`,
            body: `${user.full_name || user.email} submitted a ${form.service_type} request.${form.preferred_date ? ` Preferred date: ${new Date(form.preferred_date).toLocaleDateString()}.` : ''}`,
            category: 'admin',
            action_url: '/admin/pro-requests',
          });
        }
      } catch { /* Non-blocking */ }

      setMessage('Request submitted!');
      setForm({ service_type: SERVICE_TYPES[0], description: '', preferred_date: '' });
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) { setMessage(e.message); }
    finally { setSubmitting(false); }
  };

  const handleUploadPhoto = async (file: File) => {
    if (!selectedRequest) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${selectedRequest.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('pro-request-photos')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('pro-request-photos')
        .getPublicUrl(fileName);

      const currentPhotos = selectedRequest.photos || [];
      const newPhotos = [...currentPhotos, urlData.publicUrl];

      const { error: updateError } = await supabase
        .from('pro_requests')
        .update({ photos: newPhotos })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      setSelectedRequest({ ...selectedRequest, photos: newPhotos });
      setRequestsWithProviders(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, photos: newPhotos } : r));
    } catch (err: any) {
      setMessage('Upload failed: ' + (err.message || 'Unknown error'));
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!selectedRequest || !confirm('Cancel this service request?')) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('pro_requests')
        .update({ status: 'cancelled' })
        .eq('id', selectedRequest.id);
      if (error) throw error;
      setSelectedRequest({ ...selectedRequest, status: 'cancelled' });
      setRequestsWithProviders(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: 'cancelled' } : r));
    } catch {
      setMessage('Failed to cancel request');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setCancelling(false);
    }
  };

  if (!hasPro) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Pro Services</h1></div>
        <div className="card text-center" style={{ padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 20, color: Colors.copper }}>PRO</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Pro Services Locked</h2>
          <p className="text-gray mb-lg">Upgrade to a Pro plan to request professional maintenance visits including filter changes, gutter cleaning, and more.</p>
          <button className="btn btn-primary" onClick={() => navigate('/subscription')}>View Plans</button>
        </div>
      </div>
    );
  }

  // Detail View
  if (selectedRequest) {
    const currentStepIndex = STATUS_STEPS.indexOf(selectedRequest.status);
    const isCancelled = selectedRequest.status === 'cancelled';

    return (
      <div className="page" style={{ maxWidth: 800 }}>
        <div className="page-header">
          <button className="btn btn-ghost" onClick={() => setSelectedRequest(null)} style={{ marginRight: 12 }}>
            &larr; Back
          </button>
          <h1>Request Details</h1>
          <span className="badge" style={{ marginLeft: 'auto', background: (StatusColors[selectedRequest.status] || '#ccc') + '20', color: StatusColors[selectedRequest.status] || '#666' }}>
            {isCancelled ? 'Cancelled' : selectedRequest.status?.charAt(0).toUpperCase() + selectedRequest.status?.slice(1)}
          </span>
        </div>

        {message && <MessageBanner message={message} />}

        {/* Progress Tracker */}
        {!isCancelled && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14, color: Colors.charcoal }}>Progress</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              {STATUS_STEPS.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center', marginBottom: 8 }}>
                      {index > 0 && <div style={{ flex: 1, height: 2, background: isActive ? Colors.copper : Colors.lightGray }} />}
                      <div style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: isActive ? Colors.copper : Colors.lightGray,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: isCurrent ? `3px solid ${Colors.copperLight}` : 'none',
                        color: 'white', fontSize: 14,
                      }}>
                        {isActive ? '✓' : ''}
                      </div>
                      {index < STATUS_STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: (index < currentStepIndex) ? Colors.copper : '#E8E2D8' }} />}
                    </div>
                    <span style={{ fontSize: 11, color: isActive ? Colors.charcoal : Colors.silver, fontWeight: isCurrent ? 700 : 400, textAlign: 'center' }}>
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Service Info */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-sm">
            <p style={{ fontWeight: 600, fontSize: 16 }}>{selectedRequest.service_type || selectedRequest.category}</p>
            {selectedRequest.urgency && (
              <span className="badge" style={{ background: Colors.warning.slice(0, -2) + '15', color: Colors.warning, fontSize: 12 }}>
                {selectedRequest.urgency.charAt(0).toUpperCase() + selectedRequest.urgency.slice(1)}
              </span>
            )}
          </div>
          <p style={{ color: Colors.darkGray, fontSize: 14, lineHeight: 1.6 }}>{selectedRequest.description}</p>
          <p style={{ color: '#B8B8B8', fontSize: 12, marginTop: 8 }}>
            Submitted {new Date(selectedRequest.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          {selectedRequest.preferred_date && (
            <p style={{ color: '#B8B8B8', fontSize: 12, marginTop: 4 }}>
              Preferred: {new Date(selectedRequest.preferred_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Provider Card */}
        {selectedRequest.provider && (
          <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${Colors.copper}` }}>
            <p style={{ fontWeight: 600, fontSize: 12, color: Colors.copper, marginBottom: 8, textTransform: 'uppercase' }}>Assigned Provider</p>
            <p style={{ fontWeight: 600, fontSize: 15 }}>{selectedRequest.provider.business_name}</p>
            <p style={{ color: Colors.medGray, fontSize: 13, marginTop: 2 }}>
              {selectedRequest.provider.contact_name}
              {selectedRequest.provider.phone && ` · ${selectedRequest.provider.phone}`}
            </p>
            {selectedRequest.provider.rating && (
              <p style={{ color: Colors.warning, fontSize: 13, marginTop: 4 }}>★ {selectedRequest.provider.rating.toFixed(1)}</p>
            )}
          </div>
        )}

        {/* Scheduled Date */}
        {selectedRequest.scheduled_date && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Scheduled</p>
            <p style={{ fontSize: 15, fontWeight: 600 }}>
              {new Date(selectedRequest.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        )}

        {/* Completion Details */}
        {selectedRequest.status === 'completed' && (
          <div className="card" style={{ marginBottom: 16, background: Colors.sage.slice(0, -2) + '10' }}>
            <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Completion Details</p>
            {selectedRequest.completion_notes && <p style={{ fontSize: 14, color: Colors.darkGray }}>{selectedRequest.completion_notes}</p>}
            {selectedRequest.cost != null && <p style={{ fontSize: 16, fontWeight: 700, color: Colors.sage, marginTop: 8 }}>Cost: ${selectedRequest.cost.toFixed(2)}</p>}
          </div>
        )}

        {/* Photos Section */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-sm">
            <p style={{ fontWeight: 600, fontSize: 14 }}>Photos</p>
            {!isCancelled && selectedRequest.status !== 'completed' && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ color: Colors.copper, fontSize: 13 }}
              >
                {uploading ? 'Uploading...' : '+ Add Photo'}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) handleUploadPhoto(e.target.files[0]); e.target.value = ''; }}
          />
          {(selectedRequest.photos && selectedRequest.photos.length > 0) ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedRequest.photos.map((url: string, idx: number) => (
                <img
                  key={url}
                  src={url}
                  alt={`Photo`}
                  onClick={() => {
                    setViewerImages(selectedRequest.photos);
                    setViewerInitialIndex(idx);
                    setViewerOpen(true);
                  }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    objectFit: 'cover',
                    background: '#E8E2D8',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                />
              ))}
            </div>
          ) : (
            <p style={{ color: '#B8B8B8', fontSize: 13 }}>No photos yet. Add photos to help your provider.</p>
          )}
        </div>

        {/* Cancel Button */}
        {!isCancelled && selectedRequest.status !== 'completed' && (
          <button
            className="btn btn-outline btn-lg"
            onClick={handleCancelRequest}
            disabled={cancelling}
            style={{ width: '100%', borderColor: Colors.error, color: Colors.error }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Request'}
          </button>
        )}
      </div>
    );
  }

  // Main list/form view
  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <h1>Pro Services</h1>
      </div>

      {message && <MessageBanner message={message} />}

      <div className="tabs mb-lg">
        <button className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>New Request</button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History ({requests.length})</button>
      </div>

      {tab === 'new' ? (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Service Type</label>
              <select className="form-select" value={form.service_type} onChange={e => setForm({...form, service_type: e.target.value})}>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe the work needed..." required />
            </div>
            <div className="form-group">
              <label>Preferred Date</label>
              <input className="form-input" type="date" value={form.preferred_date} onChange={e => setForm({...form, preferred_date: e.target.value})} />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</button>
          </form>
        </div>
      ) : (
        <div className="flex-col gap-md">
          {requestsWithProviders.length === 0 ? (
            <div className="empty-state"><div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div><h3>No requests yet</h3><p>Submit a request to get started.</p></div>
          ) : requestsWithProviders.map(r => (
            <div
              key={r.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
              onClick={() => setSelectedRequest(r)}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '')}
            >
              <div className="flex items-center justify-between mb-sm">
                <div>
                  <p style={{ fontWeight: 600 }}>{r.service_type || r.category}</p>
                  <p className="text-xs text-gray mt-xs">Submitted: {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <span className="badge" style={{ background: (StatusColors[r.status] || '#ccc') + '20', color: StatusColors[r.status] }}>{r.status}</span>
              </div>
              <p className="text-sm text-gray">{r.description}</p>

              {r.provider && (
                <div style={{ marginTop: 12, padding: 12, background: Colors.cream, borderRadius: 8 }}>
                  <p className="text-xs fw-600 text-copper mb-xs">Assigned Provider</p>
                  <p style={{ fontWeight: 500, fontSize: 13 }}>{r.provider.business_name}</p>
                  <p className="text-xs text-gray">Contact: {r.provider.contact_name} · {r.provider.phone}</p>
                </div>
              )}

              {r.preferred_date && (
                <p className="text-xs text-gray mt-sm">Preferred Date: {new Date(r.preferred_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              )}
              {r.cost && (
                <p className="text-xs text-gray mt-xs">Cost: ${r.cost}</p>
              )}
              <p style={{ fontSize: 11, color: Colors.copper, marginTop: 8, fontWeight: 600 }}>View Details →</p>
            </div>
          ))}
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewerOpen && (
        <ImageViewer
          images={viewerImages}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
