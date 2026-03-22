import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllGiftCodes, createGiftCodes, getAllAgents } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import type { SubscriptionTier } from '@/types';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function AdminGiftCodes() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ count: '5', tier: 'home' as SubscriptionTier, agent_id: '', duration_months: '12' });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Promise.all([getAllGiftCodes(), getAllAgents()]).then(([c, a]) => { setCodes(c); setAgents(a); }).finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const count = parseInt(form.count) || 1;
      const expiry = new Date(Date.now() + 365 * 86400000);
      const newCodes = Array.from({ length: count }, () => ({
        id: crypto.randomUUID(),
        code: generateCode(),
        tier: form.tier,
        agent_id: form.agent_id || null,
        duration_months: parseInt(form.duration_months) || 12,
        expires_at: expiry.toISOString(),
        created_at: new Date().toISOString(),
      }));
      const created = await createGiftCodes(newCodes);
      setCodes(prev => [...created, ...prev]);
      setShowModal(false);
    } catch (e: any) { alert(e.message); }
    finally { setGenerating(false); }
  };

  const active = codes.filter(c => !c.redeemed_by);
  const redeemed = codes.filter(c => c.redeemed_by);

  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
          <h1>Gift Codes</h1>
          <p className="subtitle">{active.length} active, {redeemed.length} redeemed</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Generate Codes</button>
      </div>

      {loading ? <div className="text-center"><div className="spinner" /></div> : (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Active Codes</h2>
          <div className="card table-container mb-lg">
            <table>
              <thead><tr><th>Code</th><th>Tier</th><th>Duration</th><th>Agent</th><th>Expires</th></tr></thead>
              <tbody>
                {active.map(c => (
                  <tr key={c.id}>
                    <td><code style={{ background: Colors.cream, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{c.code}</code></td>
                    <td><span className="badge badge-copper">{c.tier}</span></td>
                    <td>{c.duration_months} mo</td>
                    <td>{agents.find(a => a.id === c.agent_id)?.name || '—'}</td>
                    <td className="text-sm text-gray">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {active.length === 0 && <tr><td colSpan={5} className="text-center text-gray" style={{ padding: 32 }}>No active codes</td></tr>}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Redeemed Codes</h2>
          <div className="card table-container">
            <table>
              <thead><tr><th>Code</th><th>Tier</th><th>Redeemed At</th></tr></thead>
              <tbody>
                {redeemed.map(c => (
                  <tr key={c.id}>
                    <td><code style={{ background: '#cccccc20', padding: '2px 8px', borderRadius: 4 }}>{c.code}</code></td>
                    <td><span className="badge badge-gray">{c.tier}</span></td>
                    <td className="text-sm text-gray">{c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
                {redeemed.length === 0 && <tr><td colSpan={3} className="text-center text-gray" style={{ padding: 32 }}>No redeemed codes yet</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Generate Gift Codes</h2>
            <div className="form-group"><label>Number of Codes</label><input className="form-input" type="number" min="1" max="50" value={form.count} onChange={e => setForm({...form, count: e.target.value})} /></div>
            <div className="form-group">
              <label>Subscription Tier</label>
              <select className="form-select" value={form.tier} onChange={e => setForm({...form, tier: e.target.value as SubscriptionTier})}>
                <option value="home">Home ($6.99/mo)</option><option value="pro">Home + Pro ($149/mo)</option><option value="pro_plus">Home + Pro+ ($179/mo)</option>
              </select>
            </div>
            <div className="form-group"><label>Duration (months)</label><input className="form-input" type="number" min="1" max="24" value={form.duration_months} onChange={e => setForm({...form, duration_months: e.target.value})} /></div>
            <div className="form-group">
              <label>Assign to Agent (optional)</label>
              <select className="form-select" value={form.agent_id} onChange={e => setForm({...form, agent_id: e.target.value})}>
                <option value="">— No agent —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.brokerage})</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>{generating ? 'Generating...' : `Generate ${form.count} Codes`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
