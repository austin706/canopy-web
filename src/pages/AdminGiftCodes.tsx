import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllGiftCodes, createGiftCodes, getAllAgents } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { PLANS } from '@/services/subscriptionGate';
import { logAdminAction } from '@/services/auditLog';
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'redeemed' | 'expired'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      await logAdminAction('code.generate', 'gift_code', 'bulk', { count, tier: form.tier });
      setCodes(prev => [...created, ...prev]);
      setShowModal(false);
    } catch (e: any) { alert(e.message); }
    finally { setGenerating(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = confirm(`Delete ${selectedIds.size} selected code(s)?`);
    if (!confirmed) return;
    try {
      // Note: implement actual delete endpoint in supabase service
      // For now, filter from local state
      const deletedIds = Array.from(selectedIds);
      await logAdminAction('code.delete', 'gift_code', 'bulk', { count: deletedIds.length });
      setCodes(prev => prev.filter(c => !deletedIds.includes(c.id)));
      setSelectedIds(new Set());
    } catch (e: any) { alert(e.message); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCodes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCodes.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const isExpired = (code: any) => new Date(code.expires_at) < new Date();

  const getCodeStatus = (code: any) => {
    if (code.redeemed_by) return 'redeemed';
    if (isExpired(code)) return 'expired';
    return 'active';
  };

  const matchesSearch = (code: any) => {
    const lowerSearch = search.toLowerCase();
    const agentName = agents.find(a => a.id === code.agent_id)?.name || '';
    return code.code.toLowerCase().includes(lowerSearch) ||
           code.client_name?.toLowerCase().includes(lowerSearch) ||
           agentName.toLowerCase().includes(lowerSearch);
  };

  const filteredCodes = codes.filter(code => {
    if (!matchesSearch(code)) return false;
    if (filter === 'all') return true;
    return getCodeStatus(code) === filter;
  });

  const active = codes.filter(c => !c.redeemed_by && !isExpired(c));
  const redeemed = codes.filter(c => c.redeemed_by);
  const expired = codes.filter(c => !c.redeemed_by && isExpired(c));

  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
          <h1>Gift Codes</h1>
          <p className="subtitle">{active.length} active, {expired.length} expired, {redeemed.length} redeemed</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Generate Codes</button>
      </div>

      {loading ? <div className="text-center"><div className="spinner" /></div> : (
        <>
          {selectedIds.size > 0 && (
            <div className="card mb-lg" style={{ background: Colors.info + '20', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14 }}>{selectedIds.size} selected</span>
              <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete Selected</button>
            </div>
          )}

          <div className="card mb-lg">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Search</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by code, name, or agent..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Filter</label>
                <select className="form-select" value={filter} onChange={e => setFilter(e.target.value as any)}>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="redeemed">Redeemed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Codes ({filteredCodes.length})</h2>
          <div className="card table-container mb-lg">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={filteredCodes.length > 0 && selectedIds.size === filteredCodes.length}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Code</th>
                  <th>Tier</th>
                  <th>Duration</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map(c => {
                  const status = getCodeStatus(c);
                  const statusBadgeClass = status === 'active' ? 'badge-copper' : status === 'redeemed' ? 'badge-gray' : 'badge-orange';
                  return (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td><code style={{ background: Colors.cream, padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{c.code}</code></td>
                      <td><span className="badge badge-copper">{c.tier}</span></td>
                      <td>{c.duration_months} mo</td>
                      <td>{agents.find(a => a.id === c.agent_id)?.name || '—'}</td>
                      <td><span className={`badge ${statusBadgeClass}`}>{status}</span></td>
                      <td className="text-sm text-gray">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  );
                })}
                {filteredCodes.length === 0 && <tr><td colSpan={7} className="text-center text-gray" style={{ padding: 32 }}>No codes found</td></tr>}
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
                {PLANS.filter(p => p.value !== 'free').map(p => (
                  <option key={p.value} value={p.value}>{p.name}{p.price ? ` ($${p.price}${p.period})` : ' (Concierge)'}</option>
                ))}
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
