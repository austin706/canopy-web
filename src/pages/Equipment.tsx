import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { upsertEquipment, deleteEquipment as deleteEquipApi, getEquipment } from '@/services/supabase';
import { getEquipmentLimit } from '@/services/subscriptionGate';
import EquipmentScanner from '@/components/EquipmentScanner';
import { Colors } from '@/constants/theme';
import type { Equipment as EquipmentType, EquipmentCategory } from '@/types';

const CATEGORIES: { value: EquipmentCategory; label: string; abbr: string }[] = [
  { value: 'hvac', label: 'HVAC', abbr: 'HC' },
  { value: 'water_heater', label: 'Water Heater', abbr: 'WH' },
  { value: 'appliance', label: 'Appliance', abbr: 'AP' },
  { value: 'roof', label: 'Roof', abbr: 'RF' },
  { value: 'plumbing', label: 'Plumbing', abbr: 'PL' },
  { value: 'electrical', label: 'Electrical', abbr: 'EL' },
  { value: 'outdoor', label: 'Outdoor', abbr: 'OD' },
  { value: 'safety', label: 'Safety', abbr: 'SF' },
  { value: 'pool', label: 'Pool', abbr: 'PO' },
  { value: 'garage', label: 'Garage', abbr: 'GR' },
];

export default function Equipment() {
  const { user, home, equipment, setEquipment, addEquipment, removeEquipment } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [form, setForm] = useState({ name: '', category: 'hvac' as EquipmentCategory, make: '', model: '', serial_number: '', install_date: '', expected_lifespan_years: '', location_in_home: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const tier = user?.subscription_tier || 'free';
  const limit = getEquipmentLimit(tier);
  const atLimit = limit !== null && equipment.length >= limit;

  // Fetch equipment on mount if not already loaded
  useEffect(() => {
    const loadEquipment = async () => {
      if (!equipment.length && home) {
        try {
          setLoading(true);
          const data = await getEquipment(home.id);
          if (data) setEquipment(data);
        } catch (err) {
          console.warn('Failed to fetch equipment:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    loadEquipment();
  }, [home?.id]);

  const filtered = filter === 'all' ? equipment : equipment.filter(e => e.category === filter);
  const catAbbr = (cat: string) => CATEGORIES.find(c => c.value === cat)?.abbr || 'EQ';

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Equipment name is required';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!home) return;
    if (!validateForm()) return;
    setSaving(true);
    try {
      const newItem: any = {
        id: crypto.randomUUID(),
        home_id: home.id,
        ...form,
        expected_lifespan_years: form.expected_lifespan_years ? parseInt(form.expected_lifespan_years) : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await upsertEquipment(newItem);
      addEquipment(newItem);
      setShowModal(false);
      setForm({ name: '', category: 'hvac', make: '', model: '', serial_number: '', install_date: '', expected_lifespan_years: '', location_in_home: '', notes: '' });
    } catch (err: any) {
      alert('Failed to save equipment: ' + (err.message || 'Unknown error'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this equipment?')) return;
    try {
      await deleteEquipApi(id);
      removeEquipment(id);
    } catch (err: any) {
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

  const handleScannerComplete = (scannedData: any) => {
    const { name, category, make, model, ...rest } = scannedData;
    setForm({
      ...form,
      name,
      category,
      make,
      model,
    });
    setShowScanner(false);
    setShowModal(true);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Equipment</h1>
          <p className="subtitle">{equipment.length} items registered {limit ? `(max ${limit})` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowScanner(true)}>Scan Label</button>
          <button className="btn btn-primary" onClick={() => atLimit ? alert(`Free plan allows ${limit} items. Upgrade for unlimited.`) : setShowModal(true)}>+ Add Equipment</button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <p className="text-sm text-gray">Loading equipment...</p>
        </div>
      ) : (
      <>
      <div className="tabs mb-lg">
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All ({equipment.length})</button>
        {CATEGORIES.filter(c => equipment.some(e => e.category === c.value)).map(c => (
          <button key={c.value} className={`tab ${filter === c.value ? 'active' : ''}`} onClick={() => setFilter(c.value)}>
            {c.label} ({equipment.filter(e => e.category === c.value).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>EQ</div>
          <h3>No equipment yet</h3>
          <p>Add your home systems and appliances to get personalized maintenance schedules.</p>
          <button className="btn btn-primary mt-lg" onClick={() => atLimit ? alert(`Free plan allows ${limit} items. Upgrade for unlimited.`) : setShowModal(true)}>Add Your First Item</button>
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map(item => (
            <div key={item.id} className="card">
              <div className="equip-card">
                <div className="equip-icon" style={{ background: Colors.copperMuted, fontSize: 11, fontWeight: 700, color: Colors.copper }}>{catAbbr(item.category)}</div>
                <div className="equip-info">
                  <div className="equip-name">{item.name}</div>
                  <div className="equip-detail">{item.make} {item.model}</div>
                  {item.install_date && <div className="equip-detail">Installed: {new Date(item.install_date).toLocaleDateString()}</div>}
                  {item.location_in_home && <div className="equip-detail">Location: {item.location_in_home}</div>}
                  {item.expected_lifespan_years && item.install_date && (() => {
                    const age = (Date.now() - new Date(item.install_date).getTime()) / (365.25 * 86400000);
                    const pct = Math.min(100, Math.round((age / item.expected_lifespan_years) * 100));
                    return (
                      <div className="mt-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray">Lifespan: {pct}%</span>
                          <span className="text-xs" style={{ color: pct > 80 ? Colors.error : pct > 60 ? Colors.warning : Colors.sage }}>{Math.round(age)}yr / {item.expected_lifespan_years}yr</span>
                        </div>
                        <div className="progress-bar mt-sm"><div className="progress-fill" style={{ width: `${pct}%`, background: pct > 80 ? Colors.error : pct > 60 ? Colors.warning : Colors.sage }} /></div>
                      </div>
                    );
                  })()}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} title="Delete" style={{ color: Colors.error }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <div className="modal-overlay" onClick={() => setShowScanner(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Scan Equipment Label</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowScanner(false)}>✕</button>
            </div>
            <EquipmentScanner
              onScanComplete={handleScannerComplete}
              onClose={() => setShowScanner(false)}
            />
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Equipment</h2>
            <div className="form-group">
              <label>Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Central AC Unit" />
              {formErrors.name && <p style={{ color: '#C62828', fontSize: 13, marginTop: 4 }}>{formErrors.name}</p>}
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-select" value={form.category} onChange={e => setForm({...form, category: e.target.value as EquipmentCategory})}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group"><label>Make</label><input className="form-input" value={form.make} onChange={e => setForm({...form, make: e.target.value})} placeholder="Carrier" /></div>
              <div className="form-group"><label>Model</label><input className="form-input" value={form.model} onChange={e => setForm({...form, model: e.target.value})} placeholder="24ACC636" /></div>
            </div>
            <div className="form-group"><label>Serial Number</label><input className="form-input" value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} /></div>
            <div className="grid-2">
              <div className="form-group"><label>Install Date</label><input className="form-input" type="date" value={form.install_date} onChange={e => setForm({...form, install_date: e.target.value})} /></div>
              <div className="form-group"><label>Lifespan (years)</label><input className="form-input" type="number" value={form.expected_lifespan_years} onChange={e => setForm({...form, expected_lifespan_years: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Location in Home</label><input className="form-input" value={form.location_in_home} onChange={e => setForm({...form, location_in_home: e.target.value})} placeholder="Basement, Attic, etc." /></div>
            <div className="form-group"><label>Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Add Equipment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
