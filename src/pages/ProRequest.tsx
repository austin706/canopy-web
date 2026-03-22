import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { createProRequest, getProRequests } from '@/services/supabase';
import { isProOrHigher } from '@/services/subscriptionGate';
import { Colors, StatusColors } from '@/constants/theme';

const SERVICE_TYPES = ['HVAC Maintenance', 'Filter Change', 'Gutter Cleaning', 'Plumbing Repair', 'Electrical Inspection', 'Roof Inspection', 'Pool Service', 'Deck Maintenance', 'Lawn Care', 'General Handyman'];

export default function ProRequest() {
  const navigate = useNavigate();
  const { user, home } = useStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [form, setForm] = useState({ service_type: SERVICE_TYPES[0], description: '', preferred_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'new' | 'history'>('new');

  const tier = user?.subscription_tier || 'free';
  const hasPro = isProOrHigher(tier);

  useEffect(() => {
    if (user) getProRequests(user.id).then(setRequests).catch(() => {});
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !home) return;
    setSubmitting(true);
    try {
      const r = await createProRequest({ id: crypto.randomUUID(), user_id: user.id, home_id: home.id, ...form, status: 'pending', created_at: new Date().toISOString() });
      setRequests(prev => [r, ...prev]);
      setMessage('Request submitted!');
      setForm({ service_type: SERVICE_TYPES[0], description: '', preferred_date: '' });
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) { setMessage(e.message); }
    finally { setSubmitting(false); }
  };

  if (!hasPro) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Pro Services</h1></div>
        <div className="card text-center" style={{ padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128274;</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Pro Services Locked</h2>
          <p className="text-gray mb-lg">Upgrade to Home + Pro to request professional maintenance visits including filter changes, gutter cleaning, and more.</p>
          <button className="btn btn-primary" onClick={() => navigate('/subscription')}>View Plans</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <h1>Pro Services</h1>
      </div>

      {message && <div style={{ padding: '10px 16px', borderRadius: 8, background: message.includes('Failed') || message.includes('Error') || message.includes('error') ? '#E5393520' : '#4CAF5020', color: message.includes('Failed') || message.includes('Error') || message.includes('error') ? '#C62828' : '#2E7D32', fontSize: 14, marginBottom: 16 }}>{message}</div>}

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
          {requests.length === 0 ? (
            <div className="empty-state"><div className="icon">&#128203;</div><h3>No requests yet</h3><p>Submit a request to get started.</p></div>
          ) : requests.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between mb-sm">
                <p style={{ fontWeight: 600 }}>{r.service_type}</p>
                <span className="badge" style={{ background: (StatusColors[r.status] || '#ccc') + '20', color: StatusColors[r.status] }}>{r.status}</span>
              </div>
              <p className="text-sm text-gray">{r.description}</p>
              <p className="text-xs text-gray mt-sm">Submitted: {new Date(r.created_at).toLocaleDateString()}{r.preferred_date ? ` | Preferred: ${new Date(r.preferred_date).toLocaleDateString()}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
