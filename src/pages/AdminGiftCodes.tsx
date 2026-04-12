import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllGiftCodes, createGiftCodes, getAllAgents } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';
import { PLANS } from '@/services/subscriptionGate';
import { logAdminAction } from '@/services/auditLog';
import { showToast } from '@/components/Toast';
import type { SubscriptionTier } from '@/types';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomValues = new Uint8Array(8);
  crypto.getRandomValues(randomValues);
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[randomValues[i] % chars.length];
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
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'redeemed' | 'expired'>('all');
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
      setForm({ count: '5', tier: 'home', agent_id: '', duration_months: '12' });
    } catch (e: any) { showToast({ message: e.message }); }
    finally { setGenerating(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = confirm(`Delete ${selectedIds.size} selected code(s)?`);
    if (!confirmed) return;
    try {
      const deletedIds = Array.from(selectedIds);
      await logAdminAction('code.delete', 'gift_code', 'bulk', { count: deletedIds.length });
      setCodes(prev => prev.filter(c => !deletedIds.includes(c.id)));
      setSelectedIds(new Set());
    } catch (e: any) { showToast({ message: e.message }); }
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

  const getCodeStatus = (code: any): 'active' | 'redeemed' | 'expired' => {
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
    if (filterTab === 'all') return true;
    return getCodeStatus(code) === filterTab;
  });

  const activeCodes = codes.filter(c => !c.redeemed_by && !isExpired(c));
  const redeemedCodes = codes.filter(c => c.redeemed_by);
  const expiredCodes = codes.filter(c => !c.redeemed_by && isExpired(c));

  const getStatusBadgeClass = (status: 'active' | 'redeemed' | 'expired') => {
    if (status === 'active') return 'admin-status admin-status-active';
    if (status === 'redeemed') return 'admin-status admin-status-sage';
    return 'admin-status admin-status-expired';
  };

  const getStatusBadgeColor = (status: 'active' | 'redeemed' | 'expired') => {
    if (status === 'active') return Colors.success;
    if (status === 'redeemed') return Colors.sage;
    return Colors.error;
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 28, fontWeight: 700 }}>Gift Codes</h1>
          <p style={{ margin: 0, fontSize: 14, color: Colors.medGray }}>{codes.length} total codes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Generate Codes</button>
      </div>

      {/* KPI Grid */}
      {!loading && (
        <div className="admin-kpi-grid" style={{ marginBottom: 32 }}>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Total Codes</p>
            <p className="admin-kpi-value">{codes.length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Active</p>
            <p className="admin-kpi-value" style={{ color: Colors.success }}>{activeCodes.length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Redeemed</p>
            <p className="admin-kpi-value" style={{ color: Colors.sage }}>{redeemedCodes.length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Expired</p>
            <p className="admin-kpi-value" style={{ color: Colors.error }}>{expiredCodes.length}</p>
          </div>
        </div>
      )}

      {/* Tabs for Filtering */}
      {!loading && (
        <div className="admin-tabs" style={{ marginBottom: 24 }}>
          {(['all', 'active', 'redeemed', 'expired'] as const).map(tab => {
            const count = tab === 'all' ? codes.length :
                         tab === 'active' ? activeCodes.length :
                         tab === 'redeemed' ? redeemedCodes.length : expiredCodes.length;
            return (
              <button
                key={tab}
                className={`admin-tab ${filterTab === tab ? 'admin-tab-active' : ''}`}
                onClick={() => { setFilterTab(tab); setSelectedIds(new Set()); }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="page-wide"><PageSkeleton rows={6} /></div>
      ) : (
        <>
          {/* Bulk Selection Bar */}
          {selectedIds.size > 0 && (
            <div className="admin-bulk-bar" style={{ marginBottom: 24 }}>
              <span>{selectedIds.size} selected</span>
              <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete Selected</button>
            </div>
          )}

          {/* Search and Filter Toolbar */}
          <div className="admin-table-toolbar" style={{ marginBottom: 24 }}>
            <input
              type="text"
              className="admin-search"
              placeholder="Search by code, name, or agent..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Table */}
          <div className="admin-table-wrapper">
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
                      <td>
                        <code style={{ background: Colors.cream, padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>
                          {c.code}
                        </code>
                      </td>
                      <td><span style={{ fontSize: 12, fontWeight: 500 }}>{c.tier}</span></td>
                      <td style={{ fontSize: 13 }}>{c.duration_months} months</td>
                      <td style={{ fontSize: 13 }}>{agents.find(a => a.id === c.agent_id)?.name || '—'}</td>
                      <td>
                        <span className={getStatusBadgeClass(status)} style={{ color: getStatusBadgeColor(status) }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: Colors.medGray }}>
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredCodes.length === 0 && (
              <div className="admin-empty">
                <p>No codes found</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Generate Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Generate Gift Codes</h2>
            <div className="form-group">
              <label>Number of Codes</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="50"
                value={form.count}
                onChange={e => setForm({...form, count: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Subscription Tier</label>
              <select className="form-select" value={form.tier} onChange={e => setForm({...form, tier: e.target.value as SubscriptionTier})}>
                {PLANS.filter(p => p.value !== 'free').map(p => (
                  <option key={p.value} value={p.value}>
                    {p.name}{p.price ? ` ($${p.price}${p.period})` : ' (Concierge)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Duration (months)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="24"
                value={form.duration_months}
                onChange={e => setForm({...form, duration_months: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Assign to Agent (optional)</label>
              <select className="form-select" value={form.agent_id} onChange={e => setForm({...form, agent_id: e.target.value})}>
                <option value="">— No agent —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.brokerage})</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : `Generate ${form.count} Codes`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
