import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { getMaintenanceLogs, addMaintenanceLog as addLogApi } from '@/services/supabase';
import { Colors } from '@/constants/theme';

export default function MaintenanceLogs() {
  const { home, maintenanceLogs, setMaintenanceLogs, addMaintenanceLog } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', completed_by: 'homeowner' as const, cost: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

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
      const log: any = { id: crypto.randomUUID(), home_id: home.id, ...form, cost: form.cost ? parseFloat(form.cost) : undefined, completed_date: new Date().toISOString(), photos: [], created_at: new Date().toISOString() };
      try { await addLogApi(log); } catch {}
      addMaintenanceLog(log);
      setShowModal(false);
      setForm({ title: '', description: '', category: 'general', completed_by: 'homeowner', cost: '', notes: '' });
    } finally { setSaving(false); }
  };

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div><h1>Maintenance Log</h1><p className="subtitle">{maintenanceLogs.length} entries</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Entry</button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <p className="text-sm text-gray">Loading maintenance logs...</p>
        </div>
      ) : maintenanceLogs.length === 0 ? (
        <div className="empty-state"><div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div><h3>No entries yet</h3><p>Track your maintenance activities and costs.</p></div>
      ) : (
        <div className="flex-col gap-md">
          {maintenanceLogs.map(log => (
            <div key={log.id} className="card">
              <div className="flex items-center justify-between mb-sm">
                <p style={{ fontWeight: 600 }}>{log.title}</p>
                <span className="badge badge-sage">{log.category}</span>
              </div>
              {log.description && <p className="text-sm text-gray">{log.description}</p>}
              <div className="flex gap-lg mt-sm">
                <span className="text-xs text-gray">Date: {new Date(log.completed_date).toLocaleDateString()}</span>
                <span className="text-xs text-gray">By: {log.completed_by}</span>
                {log.cost && <span className="text-xs text-gray">Cost: ${log.cost}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Maintenance Entry</h2>
            <div className="form-group"><label>Title *</label><input className="form-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="What was done?" /></div>
            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid-2">
              <div className="form-group">
                <label>Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {['general','hvac','plumbing','electrical','roof','appliance','outdoor','safety','pool','garage'].map(c => <option key={c} value={c}>{c === 'hvac' ? 'HVAC' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Done By</label>
                <select className="form-select" value={form.completed_by} onChange={e => setForm({...form, completed_by: e.target.value as any})}>
                  <option value="homeowner">Homeowner</option><option value="pro">Professional</option><option value="contractor">Contractor</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label>Cost ($)</label><input className="form-input" type="number" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} placeholder="0.00" /></div>
            <div className="form-group"><label>Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !form.title}>{saving ? 'Saving...' : 'Add Entry'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
