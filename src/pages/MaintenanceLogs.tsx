import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { getMaintenanceLogs, addMaintenanceLog as addLogApi, updateMaintenanceLog as updateLogApi } from '@/services/supabase';
import { trackLogEdit, getLogEditHistory } from '@/services/homeTransfer';
import { Colors } from '@/constants/theme';

const CATEGORIES = ['general','hvac','plumbing','electrical','roof','appliance','outdoor','safety','pool','garage','fireplace','pest_control'];

const sourceLabel = (source?: string) => {
  if (source === 'pro_visit') return { text: 'Pro Verified', bg: Colors.sage + '20', color: Colors.sageDark || Colors.sage };
  if (source === 'agent') return { text: 'Agent Entry', bg: Colors.copper + '20', color: Colors.copper };
  if (source === 'system') return { text: 'System', bg: Colors.info + '20', color: Colors.info };
  return { text: 'Self-Reported', bg: Colors.lightGray, color: Colors.medGray };
};

export default function MaintenanceLogs() {
  const { home, user, maintenanceLogs, setMaintenanceLogs, addMaintenanceLog } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', completed_by: 'homeowner' as const, cost: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editHistory, setEditHistory] = useState<Record<string, any[]>>({});
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  useEffect(() => {
    if (home) {
      setLoading(true);
      getMaintenanceLogs(home.id)
        .then(setMaintenanceLogs)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [home]);

  const handleAdd = async () => {
    if (!form.title || !home) return;
    setSaving(true);
    try {
      const log: any = { id: crypto.randomUUID(), home_id: home.id, ...form, cost: form.cost ? parseFloat(form.cost) : undefined, completed_date: new Date().toISOString(), source: 'homeowner', photos: [], created_at: new Date().toISOString() };
      try { await addLogApi(log); } catch {}
      addMaintenanceLog(log);
      setShowModal(false);
      setForm({ title: '', description: '', category: 'general', completed_by: 'homeowner', cost: '', notes: '' });
    } finally { setSaving(false); }
  };

  const startEdit = (log: any) => {
    setEditingLog(log);
    setForm({
      title: log.title || '',
      description: log.description || '',
      category: log.category || 'general',
      completed_by: log.completed_by || 'homeowner',
      cost: log.cost?.toString() || '',
      notes: log.notes || '',
    });
    setShowModal(true);
  };

  const handleUpdate = async () => {
    if (!editingLog || !form.title) return;
    setSaving(true);
    try {
      const changes: { field: string; old: string | null; new_: string | null }[] = [];
      if (form.title !== editingLog.title) changes.push({ field: 'title', old: editingLog.title, new_: form.title });
      if (form.description !== (editingLog.description || '')) changes.push({ field: 'description', old: editingLog.description || null, new_: form.description || null });
      if (form.category !== editingLog.category) changes.push({ field: 'category', old: editingLog.category, new_: form.category });
      if (form.completed_by !== editingLog.completed_by) changes.push({ field: 'completed_by', old: editingLog.completed_by, new_: form.completed_by });
      const newCost = form.cost ? parseFloat(form.cost) : null;
      if (newCost !== (editingLog.cost || null)) changes.push({ field: 'cost', old: editingLog.cost?.toString() || null, new_: newCost?.toString() || null });
      if (form.notes !== (editingLog.notes || '')) changes.push({ field: 'notes', old: editingLog.notes || null, new_: form.notes || null });

      const updated = { ...editingLog, ...form, cost: form.cost ? parseFloat(form.cost) : null };
      try { await updateLogApi(editingLog.id, { title: form.title, description: form.description || null, category: form.category, completed_by: form.completed_by, cost: form.cost ? parseFloat(form.cost) : null, notes: form.notes || null }); } catch {}

      // Track each field change
      for (const c of changes) {
        try { await trackLogEdit(editingLog.id, user?.id || 'unknown', c.field, c.old, c.new_); } catch {}
      }

      // Update local state
      setMaintenanceLogs(maintenanceLogs.map((l: any) => l.id === editingLog.id ? { ...l, ...updated } : l));
      setShowModal(false);
      setEditingLog(null);
      setForm({ title: '', description: '', category: 'general', completed_by: 'homeowner', cost: '', notes: '' });
    } finally { setSaving(false); }
  };

  const toggleHistory = async (logId: string) => {
    if (expandedHistory === logId) { setExpandedHistory(null); return; }
    setExpandedHistory(logId);
    if (!editHistory[logId]) {
      try {
        const history = await getLogEditHistory(logId);
        setEditHistory(prev => ({ ...prev, [logId]: history }));
      } catch { setEditHistory(prev => ({ ...prev, [logId]: [] })); }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLog(null);
    setForm({ title: '', description: '', category: 'general', completed_by: 'homeowner', cost: '', notes: '' });
  };

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div><h1>Maintenance Log</h1><p className="subtitle">{maintenanceLogs.length} entries</p></div>
        <button className="btn btn-primary" onClick={() => { setEditingLog(null); setForm({ title: '', description: '', category: 'general', completed_by: 'homeowner', cost: '', notes: '' }); setShowModal(true); }}>+ Add Entry</button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <p className="text-sm text-gray">Loading maintenance logs...</p>
        </div>
      ) : maintenanceLogs.length === 0 ? (
        <div className="empty-state"><div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div><h3>No entries yet</h3><p>Track your maintenance activities and costs.</p></div>
      ) : (
        <div className="flex-col gap-md">
          {maintenanceLogs.map((log: any) => {
            const badge = sourceLabel(log.source);
            return (
              <div key={log.id} className="card">
                <div className="flex items-center justify-between mb-sm">
                  <div className="flex items-center gap-sm">
                    <p style={{ fontWeight: 600 }}>{log.title}</p>
                    {/* Verification badge */}
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: badge.bg, color: badge.color, whiteSpace: 'nowrap',
                    }}>{badge.text}</span>
                  </div>
                  <div className="flex items-center gap-sm">
                    <span className="badge badge-sage">{log.category}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(log)}
                      style={{ padding: '4px 8px', fontSize: 12 }}
                    >Edit</button>
                  </div>
                </div>
                {log.description && <p className="text-sm text-gray">{log.description}</p>}
                <div className="flex gap-lg mt-sm" style={{ flexWrap: 'wrap' }}>
                  <span className="text-xs text-gray">Date: {new Date(log.completed_date).toLocaleDateString()}</span>
                  <span className="text-xs text-gray">By: {log.completed_by}</span>
                  {log.cost && <span className="text-xs text-gray">Cost: ${log.cost}</span>}
                  {/* Edit history toggle */}
                  <button
                    onClick={() => toggleHistory(log.id)}
                    style={{ fontSize: 11, color: Colors.copper, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    {expandedHistory === log.id ? 'Hide history' : 'View edit history'}
                  </button>
                </div>

                {/* Edit History Panel */}
                {expandedHistory === log.id && (
                  <div style={{ marginTop: 10, padding: 12, background: Colors.cream, borderRadius: 8, fontSize: 12 }}>
                    {!editHistory[log.id] ? (
                      <p style={{ color: Colors.medGray }}>Loading...</p>
                    ) : editHistory[log.id].length === 0 ? (
                      <p style={{ color: Colors.medGray }}>No edits recorded — original entry.</p>
                    ) : (
                      editHistory[log.id].map((edit: any, idx: number) => (
                        <div key={edit.edited_at || `edit-${idx}`} style={{ marginBottom: idx < editHistory[log.id].length - 1 ? 8 : 0, paddingBottom: 8, borderBottom: idx < editHistory[log.id].length - 1 ? `1px solid ${Colors.lightGray}` : 'none' }}>
                          <div className="flex justify-between">
                            <span style={{ fontWeight: 500, color: Colors.charcoal }}>
                              {edit.field_changed?.replace(/_/g, ' ')}
                            </span>
                            <span style={{ color: Colors.medGray }}>
                              {new Date(edit.edited_at).toLocaleDateString()} {new Date(edit.edited_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{ color: Colors.medGray, marginTop: 2 }}>
                            <span style={{ textDecoration: 'line-through' }}>{edit.old_value || '(empty)'}</span>
                            {' → '}
                            <span style={{ color: Colors.charcoal }}>{edit.new_value || '(empty)'}</span>
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingLog ? 'Edit Entry' : 'Add Maintenance Entry'}</h2>
            <div className="form-group"><label>Title *</label><input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="What was done?" /></div>
            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c === 'hvac' ? 'HVAC' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Done By</label>
                <select className="form-select" value={form.completed_by} onChange={e => setForm({...form, completed_by: e.target.value as typeof form.completed_by})}>
                  <option value="homeowner">Homeowner</option><option value="pro">Professional</option><option value="contractor">Contractor</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Cost ($)</label><input className="form-input" type="number" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} placeholder="0.00" /></div>
            <div className="form-group"><label>Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={editingLog ? handleUpdate : handleAdd} disabled={saving || !form.title}>
                {saving ? 'Saving...' : editingLog ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
