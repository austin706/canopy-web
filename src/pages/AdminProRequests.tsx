import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllProRequests, updateProRequest } from '@/services/supabase';
import { StatusColors, Colors } from '@/constants/theme';

export default function AdminProRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { getAllProRequests().then(setRequests).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateProRequest(id, { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e: any) { alert(e.message); }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="page-wide">
      <div className="mb-lg">
        <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
        <h1>Pro Service Requests</h1>
        <p className="subtitle">{requests.length} total requests</p>
      </div>

      <div className="tabs mb-lg">
        {['all', 'pending', 'matched', 'scheduled', 'completed'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? requests.length : requests.filter(r => r.status === f).length})
          </button>
        ))}
      </div>

      {loading ? <div className="text-center"><div className="spinner" /></div> : (
        <div className="flex-col gap-md">
          {filtered.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between mb-sm">
                <div>
                  <p style={{ fontWeight: 600 }}>{r.service_type}</p>
                  <p className="text-xs text-gray">User: {r.user?.full_name || r.user?.email || '—'}</p>
                </div>
                <div className="flex items-center gap-sm">
                  <span className="badge" style={{ background: (StatusColors[r.status] || '#ccc') + '20', color: StatusColors[r.status] }}>{r.status}</span>
                  <select className="form-select" value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)} style={{ width: 130, padding: '4px 8px', fontSize: 12 }}>
                    <option value="pending">Pending</option><option value="matched">Matched</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-gray">{r.description}</p>
              <div className="flex gap-lg mt-sm text-xs text-gray">
                <span>Submitted: {new Date(r.created_at).toLocaleDateString()}</span>
                {r.preferred_date && <span>Preferred: {new Date(r.preferred_date).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state"><div className="icon">&#128203;</div><h3>No requests</h3></div>}
        </div>
      )}
    </div>
  );
}
