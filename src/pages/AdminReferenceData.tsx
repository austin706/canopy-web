import { useState, useEffect } from 'react';
import { PageSkeleton } from '@/components/Skeleton';
import { showToast } from '@/components/Toast';
import {
  getReferenceData,
  getAllReferenceTypes,
  upsertReferenceData,
  deleteReferenceData,
  getTaskTemplates,
  upsertTaskTemplate,
  deleteTaskTemplate,
  type ReferenceData,
  type TaskTemplateDB,
} from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { Colors } from '@/constants/theme';

const TYPE_LABELS: Record<string, string> = {
  equipment_category: 'Equipment Categories',
  roof_type: 'Roof Types',
  heating_type: 'Heating Types',
  cooling_type: 'Cooling Types',
  lawn_type: 'Lawn Types',
  task_category: 'Task Categories',
  task_templates: 'Task Templates',
};

export default function AdminReferenceData() {
  const [types, setTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [items, setItems] = useState<ReferenceData[]>([]);
  const [templates, setTemplates] = useState<TaskTemplateDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Partial<ReferenceData> | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<TaskTemplateDB> | null>(null);

  useEffect(() => {
    loadTypes();
  }, []);

  useEffect(() => {
    if (selectedType) loadData();
  }, [selectedType]);

  const loadTypes = async () => {
    try {
      const dbTypes = await getAllReferenceTypes();
      const allTypes = [...new Set([...dbTypes, 'task_templates'])];
      setTypes(allTypes.sort());
      if (allTypes.length > 0 && !selectedType) {
        setSelectedType(allTypes[0]);
      }
    } catch (err) {
      console.error('Failed to load types:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (selectedType === 'task_templates') {
        const data = await getTaskTemplates(true);
        setTemplates(data);
        setItems([]);
      } else {
        const data = await getReferenceData(selectedType, true);
        setItems(data);
        setTemplates([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItem = async () => {
    if (!editingItem || !editingItem.key || !editingItem.label) return;
    try {
      await upsertReferenceData({
        ...editingItem,
        type: editingItem.type || selectedType,
        key: editingItem.key,
        label: editingItem.label,
      } as any);
      await logAdminAction('reference.upsert', 'reference_data', editingItem.id || 'new', { type: selectedType, key: editingItem.key });
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message });
    }
  };

  const handleDeleteItem = async (item: ReferenceData) => {
    if (!confirm(`Delete "${item.label}"?`)) return;
    try {
      await deleteReferenceData(item.id);
      await logAdminAction('reference.delete', 'reference_data', item.id, { type: item.type, key: item.key });
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message });
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate || !editingTemplate.title || !editingTemplate.category) return;
    try {
      await upsertTaskTemplate(editingTemplate as any);
      await logAdminAction('reference.upsert', 'task_template', editingTemplate.id || 'new', { title: editingTemplate.title });
      setEditingTemplate(null);
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message });
    }
  };

  const handleDeleteTemplate = async (t: TaskTemplateDB) => {
    if (!confirm(`Delete template "${t.title}"?`)) return;
    try {
      await deleteTaskTemplate(t.id);
      await logAdminAction('reference.delete', 'task_template', t.id, { title: t.title });
      await loadData();
    } catch (err: any) {
      showToast({ message: err.message });
    }
  };

  const isTemplateMode = selectedType === 'task_templates';

  return (
    <div className="page-wide">
      <div className="admin-page-header mb-lg">
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Reference Data</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage equipment types, task categories, home detail options, and task templates
          </p>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
        {types.map(t => (
          <button
            key={t}
            className={`admin-tab ${selectedType === t ? 'active' : ''}`}
            onClick={() => setSelectedType(t)}
          >
            {TYPE_LABELS[t] || t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Reference Data Table */}
      {!isTemplateMode && (
        <div className="admin-table-wrapper">
          <div className="admin-table-toolbar mb-md">
            <span style={{ fontWeight: 600, fontSize: 14 }}>{items.length} items</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEditingItem({ type: selectedType, key: '', label: '', value: {}, sort_order: items.length + 1, active: true })}
            >
              + Add Item
            </button>
          </div>

          {/* Edit form */}
          {editingItem && (
            <div style={{ background: Colors.cream, border: `1px solid ${Colors.lightGray}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 12px 0' }}>{editingItem.id ? 'Edit Item' : 'New Item'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8, alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Key</label>
                  <input className="form-input" value={editingItem.key || ''} onChange={e => setEditingItem({ ...editingItem, key: e.target.value })} placeholder="e.g., metal" disabled={!!editingItem.id} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Label</label>
                  <input className="form-input" value={editingItem.label || ''} onChange={e => setEditingItem({ ...editingItem, label: e.target.value })} placeholder="e.g., Metal Roof" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Order</label>
                  <input className="form-input" type="number" value={editingItem.sort_order || 0} onChange={e => setEditingItem({ ...editingItem, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Value (JSON)</label>
                <textarea
                  className="form-input"
                  value={JSON.stringify(editingItem.value || {}, null, 2)}
                  onChange={e => {
                    try { setEditingItem({ ...editingItem, value: JSON.parse(e.target.value) }); } catch {}
                  }}
                  style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 60 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={editingItem.active !== false} onChange={e => setEditingItem({ ...editingItem, active: e.target.checked })} />
                  Active
                </label>
                <div style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingItem(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveItem}>Save</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="page-wide"><PageSkeleton rows={6} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Key</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Label</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Value</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>Order</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>Active</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: item.active ? 1 : 0.5 }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'monospace' }}>{item.key}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{item.label}</td>
                    <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'monospace', color: Colors.medGray, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {JSON.stringify(item.value)}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13 }}>{item.sort_order}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ color: item.active ? Colors.success : Colors.error, fontSize: 12, fontWeight: 600 }}>
                        {item.active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingItem(item)} style={{ fontSize: 11, marginRight: 4 }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteItem(item)} style={{ fontSize: 11, color: Colors.error }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Task Templates Table */}
      {isTemplateMode && (
        <div className="admin-table-wrapper">
          <div className="admin-table-toolbar mb-md">
            <span style={{ fontWeight: 600, fontSize: 14 }}>{templates.length} templates</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEditingTemplate({ title: '', category: 'hvac', priority: 'medium', frequency: 'annual', applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], regions: ['all'], active: true, sort_order: templates.length + 1 })}
            >
              + Add Template
            </button>
          </div>

          {/* Template edit form */}
          {editingTemplate && (
            <div style={{ background: Colors.cream, border: `1px solid ${Colors.lightGray}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, margin: '0 0 12px 0' }}>{editingTemplate.id ? 'Edit Template' : 'New Template'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Title *</label>
                  <input className="form-input" value={editingTemplate.title || ''} onChange={e => setEditingTemplate({ ...editingTemplate, title: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Category *</label>
                  <input className="form-input" value={editingTemplate.category || ''} onChange={e => setEditingTemplate({ ...editingTemplate, category: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Priority</label>
                  <select className="form-select" value={editingTemplate.priority || 'medium'} onChange={e => setEditingTemplate({ ...editingTemplate, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Frequency</label>
                  <select className="form-select" value={editingTemplate.frequency || 'annual'} onChange={e => setEditingTemplate({ ...editingTemplate, frequency: e.target.value })}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="biannual">Biannual</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="annual">Annual</option>
                    <option value="as_needed">As Needed</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Description</label>
                <textarea className="form-input" value={editingTemplate.description || ''} onChange={e => setEditingTemplate({ ...editingTemplate, description: e.target.value })} style={{ minHeight: 40 }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Instructions (step-by-step)</label>
                <textarea className="form-input" value={editingTemplate.instructions || ''} onChange={e => setEditingTemplate({ ...editingTemplate, instructions: e.target.value })} style={{ minHeight: 60 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Est. Minutes</label>
                  <input className="form-input" type="number" value={editingTemplate.estimated_minutes || ''} onChange={e => setEditingTemplate({ ...editingTemplate, estimated_minutes: parseInt(e.target.value) || null })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Cost Low ($)</label>
                  <input className="form-input" type="number" value={editingTemplate.estimated_cost_low || ''} onChange={e => setEditingTemplate({ ...editingTemplate, estimated_cost_low: parseFloat(e.target.value) || null })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Cost High ($)</label>
                  <input className="form-input" type="number" value={editingTemplate.estimated_cost_high || ''} onChange={e => setEditingTemplate({ ...editingTemplate, estimated_cost_high: parseFloat(e.target.value) || null })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Order</label>
                  <input className="form-input" type="number" value={editingTemplate.sort_order || 0} onChange={e => setEditingTemplate({ ...editingTemplate, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={editingTemplate.active !== false} onChange={e => setEditingTemplate({ ...editingTemplate, active: e.target.checked })} />
                  Active
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={editingTemplate.pro_required || false} onChange={e => setEditingTemplate({ ...editingTemplate, pro_required: e.target.checked })} />
                  Pro Required
                </label>
                <div style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingTemplate(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveTemplate}>Save</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="page-wide"><PageSkeleton rows={6} /></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Title</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Category</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Priority</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Frequency</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>Active</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: t.active ? 1 : 0.5 }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{t.title}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{t.category}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      <span style={{ color: t.priority === 'high' ? Colors.error : t.priority === 'medium' ? Colors.warning : Colors.medGray, fontWeight: 600 }}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{t.frequency}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ color: t.active ? Colors.success : Colors.error, fontSize: 12, fontWeight: 600 }}>
                        {t.active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingTemplate(t)} style={{ fontSize: 11, marginRight: 4 }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTemplate(t)} style={{ fontSize: 11, color: Colors.error }}>Delete</button>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: Colors.medGray }}>
                      No task templates in database yet. The app still uses hardcoded templates as fallback. Add templates here to override them.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
