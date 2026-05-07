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
import logger from '@/utils/logger';

const TYPE_LABELS: Record<string, string> = {
  equipment_category: 'Equipment Categories',
  roof_type: 'Roof Types',
  heating_type: 'Heating Types',
  cooling_type: 'Cooling Types',
  lawn_type: 'Lawn Types',
  task_category: 'Task Categories',
  task_templates: 'Task Templates',
};

/**
 * Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes, and embedded newlines.
 * Returns array of row objects keyed by header.
 */
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
    return obj;
  });
}

/** Split a pipe- or semicolon-delimited string into a trimmed array, or pass through arrays. */
function splitList(v: any): string[] | null {
  if (v == null || v === '') return null;
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed.startsWith('[')) {
      try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) return parsed.map(String); } catch {}
    }
    return trimmed.split(/[|;]/).map(s => s.trim()).filter(Boolean);
  }
  return null;
}

function toBool(v: any, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes', 'y'].includes(v.toLowerCase().trim());
  return fallback;
}

function toNumOrNull(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Normalize a raw CSV/JSON row into a TaskTemplateDB-shaped upsert payload. */
function normalizeImportedTemplate(row: any): Partial<TaskTemplateDB> & { title: string; category: string } {
  const months = row.applicable_months;
  let monthsArr: number[] = [];
  if (Array.isArray(months)) monthsArr = months.map(Number).filter(n => n >= 1 && n <= 12);
  else if (typeof months === 'string' && months.trim()) {
    monthsArr = months.split(/[|;,]/).map(s => Number(s.trim())).filter(n => n >= 1 && n <= 12);
  }
  if (!monthsArr.length) monthsArr = [1,2,3,4,5,6,7,8,9,10,11,12];

  return {
    id: row.id || undefined,
    title: String(row.title || '').trim(),
    category: String(row.category || '').trim(),
    description: row.description ?? null,
    instructions: row.instructions ?? null,
    instructions_json: splitList(row.instructions_json ?? row.steps),
    items_to_have_on_hand: splitList(row.items_to_have_on_hand ?? row.tools),
    safety_warnings: splitList(row.safety_warnings ?? row.warnings),
    service_purpose: row.service_purpose ?? null,
    priority: row.priority || 'medium',
    frequency: row.frequency || 'annual',
    applicable_months: monthsArr,
    estimated_minutes: toNumOrNull(row.estimated_minutes),
    estimated_cost_low: toNumOrNull(row.estimated_cost_low ?? row.cost_low),
    estimated_cost_high: toNumOrNull(row.estimated_cost_high ?? row.cost_high),
    regions: splitList(row.regions) || ['all'],
    requires_feature: row.requires_feature ?? null,
    requires_equipment: row.requires_equipment ?? null,
    requires_equipment_subtype: splitList(row.requires_equipment_subtype),
    excludes_equipment_subtype: splitList(row.excludes_equipment_subtype),
    requires_home_type: splitList(row.requires_home_type),
    requires_flooring_type: splitList(row.requires_flooring_type),
    requires_water_source: splitList(row.requires_water_source) as any,
    requires_sewer_type: splitList(row.requires_sewer_type) as any,
    requires_septic_type: splitList(row.requires_septic_type) as any,
    requires_construction_type: splitList(row.requires_construction_type),
    requires_foundation_type: splitList(row.requires_foundation_type),
    requires_countertop_type: splitList(row.requires_countertop_type),
    requires_pool_type: splitList(row.requires_pool_type) as any,
    add_on_category: row.add_on_category ?? null,
    pro_recommended: toBool(row.pro_recommended, false),
    service_type: (row.service_type as any) || 'diy',
    is_weather_triggered: toBool(row.is_weather_triggered, false),
    equipment_keyed: toBool(row.equipment_keyed, false),
    consumable_spec: row.consumable_spec ?? null,
    consumable_replacement_months: toNumOrNull(row.consumable_replacement_months),
    scheduling_type: (row.scheduling_type as any) || 'seasonal',
    interval_days: toNumOrNull(row.interval_days),
    is_cleaning: toBool(row.is_cleaning, false),
    task_level: (row.task_level as any) || 'standard',
    sort_order: toNumOrNull(row.sort_order) ?? 100,
    active: row.active == null ? true : toBool(row.active, true),
    source: (row.source as any) || 'user_created',
  };
}

/**
 * StringListEditor — inline editor for string[] fields (how-to steps, tools list, safety warnings).
 * Adds a numbered prefix when `ordered` is true and a red warning tint when `warning` is true.
 */
function StringListEditor({
  label,
  value,
  onChange,
  placeholder,
  ordered = false,
  warning = false,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ordered?: boolean;
  warning?: boolean;
}) {
  const updateAt = (idx: number, text: string) => {
    const next = [...value];
    next[idx] = text;
    onChange(next);
  };
  const removeAt = (idx: number) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...value];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next);
  };
  const moveDown = (idx: number) => {
    if (idx === value.length - 1) return;
    const next = [...value];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    onChange(next);
  };
  const add = () => onChange([...value, '']);

  return (
    <div style={{
      marginTop: 12,
      padding: 8,
      border: `1px solid ${warning ? '#FBCFCF' : 'var(--color-border)'}`,
      borderRadius: 6,
      background: warning ? '#FFF8F8' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <label style={{ flex: 1, fontSize: 11, fontWeight: 600, color: warning ? '#A04040' : undefined }}>{label}</label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={add} style={{ fontSize: 11 }}>+ Add</button>
      </div>
      {value.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px 0' }}>None. Click Add to create one.</div>
      )}
      {value.map((text, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          {ordered && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', width: 20, textAlign: 'right' }}>{idx + 1}.</span>
          )}
          <input
            className="form-input"
            style={{ flex: 1, fontSize: 12 }}
            value={text}
            onChange={e => updateAt(idx, e.target.value)}
            placeholder={placeholder}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveUp(idx)} disabled={idx === 0} aria-label="Move up" style={{ fontSize: 11, padding: '2px 6px' }}>▲</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => moveDown(idx)} disabled={idx === value.length - 1} aria-label="Move down" style={{ fontSize: 11, padding: '2px 6px' }}>▼</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeAt(idx)} aria-label="Remove item" style={{ fontSize: 11, padding: '2px 6px', color: '#A04040' }}>✕</button>
        </div>
      ))}
    </div>
  );
}

export default function AdminReferenceData() {
  const [types, setTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [items, setItems] = useState<ReferenceData[]>([]);
  const [templates, setTemplates] = useState<TaskTemplateDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Partial<ReferenceData> | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<TaskTemplateDB> | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; errors: string[] } | null>(null);

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
      logger.error('Failed to load types:', err);
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
      logger.error('Failed to load data:', err);
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

  const handleBulkImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    const errors: string[] = [];
    let inserted = 0;
    let updated = 0;
    try {
      const text = await file.text();
      let rows: any[] = [];
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : (parsed.templates || []);
      } else {
        // CSV — naive parser (handles quoted fields)
        rows = parseCSV(text);
      }
      if (!rows.length) {
        errors.push('No rows found in file.');
        setImportResult({ inserted: 0, updated: 0, errors });
        return;
      }
      const existingIds = new Set(templates.map(t => t.id));
      for (const row of rows) {
        try {
          const normalized = normalizeImportedTemplate(row);
          if (!normalized.title || !normalized.category) {
            errors.push(`Row "${row.title || '(unnamed)'}" missing title or category`);
            continue;
          }
          await upsertTaskTemplate(normalized);
          if (normalized.id && existingIds.has(normalized.id)) updated += 1;
          else inserted += 1;
        } catch (e: any) {
          errors.push(`Row "${row.title || '(unnamed)'}": ${e?.message || 'unknown error'}`);
        }
      }
      await logAdminAction('reference.bulk_import', 'task_template', 'bulk', {
        filename: file.name,
        inserted,
        updated,
        errors: errors.length,
      });
      await loadData();
      setImportResult({ inserted, updated, errors });
    } catch (err: any) {
      errors.push(err?.message || 'Parse failed');
      setImportResult({ inserted, updated, errors });
    } finally {
      setImporting(false);
    }
  };

  const handleExportTemplates = () => {
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canopy-task-templates-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Key</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Label</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Value</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600 }} scope="col">Order</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600 }} scope="col">Active</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600 }} scope="col">Actions</th>
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
          <div className="admin-table-toolbar mb-md" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{templates.length} templates</span>
            <div style={{ flex: 1 }} />
            <label className="btn btn-ghost btn-sm" style={{ cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.5 : 1 }}>
              {importing ? 'Importing…' : '⬆ Bulk Import (CSV/JSON)'}
              <input
                type="file"
                accept=".csv,.json,text/csv,application/json"
                style={{ display: 'none' }}
                disabled={importing}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleBulkImport(f);
                  e.target.value = '';
                }}
              />
            </label>
            <button className="btn btn-ghost btn-sm" onClick={handleExportTemplates} disabled={templates.length === 0}>⬇ Export JSON</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setEditingTemplate({ title: '', category: 'hvac', priority: 'medium', frequency: 'annual', applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], regions: ['all'], active: true, sort_order: templates.length + 1, service_type: 'diy', pro_recommended: false, source: 'user_created' })}
            >
              + Add Template
            </button>
          </div>

          {importResult && (
            <div style={{
              background: importResult.errors.length ? '#FFF8F0' : '#F0FAF0',
              border: `1px solid ${importResult.errors.length ? '#F5C27F' : '#9BC99B'}`,
              borderRadius: 6,
              padding: 12,
              marginBottom: 12,
              fontSize: 12,
            }}>
              <strong>Import complete.</strong> Inserted: {importResult.inserted}. Updated: {importResult.updated}. Errors: {importResult.errors.length}.
              {importResult.errors.length > 0 && (
                <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                  {importResult.errors.slice(0, 10).map((err, i) => (
                    <li key={i} style={{ color: '#A04040' }}>{err}</li>
                  ))}
                  {importResult.errors.length > 10 && <li>…and {importResult.errors.length - 10} more.</li>}
                </ul>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setImportResult(null)} style={{ fontSize: 11, marginTop: 4 }}>Dismiss</button>
            </div>
          )}

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
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Legacy Instructions (single paragraph, prefer Steps below)</label>
                <textarea className="form-input" value={editingTemplate.instructions || ''} onChange={e => setEditingTemplate({ ...editingTemplate, instructions: e.target.value })} style={{ minHeight: 40, fontSize: 12 }} />
              </div>

              {/* Ordered How-To Steps (instructions_json) */}
              <StringListEditor
                label="How-To Steps (ordered, shown numbered on TaskDetail)"
                value={editingTemplate.instructions_json || []}
                onChange={arr => setEditingTemplate({ ...editingTemplate, instructions_json: arr.length ? arr : null })}
                placeholder="e.g., Turn off breaker at the panel"
                ordered
              />

              {/* Items to Have on Hand */}
              <StringListEditor
                label="Items to Have on Hand"
                value={editingTemplate.items_to_have_on_hand || []}
                onChange={arr => setEditingTemplate({ ...editingTemplate, items_to_have_on_hand: arr.length ? arr : null })}
                placeholder="e.g., 20x25x1 filter, screwdriver"
              />

              {/* Safety Warnings */}
              <StringListEditor
                label="Safety Warnings (red-bordered panel on TaskDetail)"
                value={editingTemplate.safety_warnings || []}
                onChange={arr => setEditingTemplate({ ...editingTemplate, safety_warnings: arr.length ? arr : null })}
                placeholder="e.g., Turn off breaker before opening panel"
                warning
              />

              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Service Purpose (what the Pro actually does on-site)</label>
                <input className="form-input" value={editingTemplate.service_purpose || ''} onChange={e => setEditingTemplate({ ...editingTemplate, service_purpose: e.target.value || null })} placeholder="e.g., Inspect & flush water heater" />
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Service Type</label>
                  <select className="form-select" value={editingTemplate.service_type || 'diy'} onChange={e => setEditingTemplate({ ...editingTemplate, service_type: e.target.value as any })}>
                    <option value="diy">DIY: Homeowner handles</option>
                    <option value="canopy_visit">Canopy Visit: Bimonthly tech</option>
                    <option value="canopy_pro">Canopy Pro: Certified Pro dispatch</option>
                    <option value="licensed_pro">Licensed Pro: Licensed contractor</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Task Level</label>
                  <select className="form-select" value={editingTemplate.task_level || 'standard'} onChange={e => setEditingTemplate({ ...editingTemplate, task_level: e.target.value as any })}>
                    <option value="core">Core: Basic essentials</option>
                    <option value="standard">Standard: Recommended</option>
                    <option value="comprehensive">Comprehensive: Everything</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'end', paddingBottom: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <input type="checkbox" checked={editingTemplate.pro_recommended || false} onChange={e => setEditingTemplate({ ...editingTemplate, pro_recommended: e.target.checked })} />
                    Pro Recommended
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <input type="checkbox" checked={editingTemplate.active !== false} onChange={e => setEditingTemplate({ ...editingTemplate, active: e.target.checked })} />
                  Active
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
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Title</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Category</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Level</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Service Type</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Priority</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600 }} scope="col">Frequency</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600 }} scope="col">Active</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600 }} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: t.active ? 1 : 0.5 }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{t.title}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>{t.category}</td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                        background: t.task_level === 'core' ? '#E0ECFF' : t.task_level === 'comprehensive' ? '#F5E6FF' : '#F0F0F0',
                        color: t.task_level === 'core' ? '#3366AA' : t.task_level === 'comprehensive' ? '#7733AA' : '#666',
                      }}>
                        {t.task_level === 'core' ? 'Core' : t.task_level === 'comprehensive' ? 'Comprehensive' : 'Standard'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                        background: t.service_type === 'canopy_visit' ? '#E8F0E4' : t.service_type === 'canopy_pro' ? '#FDF0E6' : t.service_type === 'licensed_pro' ? '#FDE8E8' : '#F0F0F0',
                        color: t.service_type === 'canopy_visit' ? '#5A7A4A' : t.service_type === 'canopy_pro' ? '#A0623A' : t.service_type === 'licensed_pro' ? '#A04040' : '#666',
                      }}>
                        {t.service_type === 'canopy_visit' ? 'Canopy Visit' : t.service_type === 'canopy_pro' ? 'Canopy Pro' : t.service_type === 'licensed_pro' ? 'Licensed Pro' : 'DIY'}
                      </span>
                    </td>
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
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', fontSize: 13, color: Colors.medGray }}>
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
