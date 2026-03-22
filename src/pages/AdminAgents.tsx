import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAgents, createAgentRecord } from '@/services/supabase';
import { Colors } from '@/constants/theme';

export default function AdminAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', brokerage: '' });
  const [saving, setSaving] = useState(false);

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
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Brokerage</th></tr></thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td><div className="flex items-center gap-sm"><div style={{ width: 32, height: 32, borderRadius: '50%', background: Colors.copper, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{a.name?.charAt(0)}</div><span className="fw-600">{a.name}</span></div></td>
                  <td>{a.email}</td>
                  <td>{a.phone || '—'}</td>
                  <td>{a.brokerage || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="text-center text-gray" style={{ padding: 32 }}>No agents found</td></tr>}
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
    </div>
  );
}
