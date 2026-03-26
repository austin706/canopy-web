import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { upsertEquipment, deleteEquipment as deleteEquipApi, getEquipment, createTasks } from '@/services/supabase';
import { getEquipmentLimit } from '@/services/subscriptionGate';
import { generateTasksForHome, generateEquipmentLifecycleAlerts } from '@/services/taskEngine';
import EquipmentScanner from '@/components/EquipmentScanner';
import { Colors } from '@/constants/theme';
import { EQUIPMENT_LIFESPAN_DEFAULTS } from '@/constants/maintenance';
import type { Equipment as EquipmentType, EquipmentCategory } from '@/types';

/** Common equipment items to guide users on what to scan */
const SCAN_SUGGESTIONS = [
  { label: 'Furnace / Air Handler', hint: 'Label on front panel or inside door', icon: '🔥' },
  { label: 'AC Condenser (outdoor unit)', hint: 'Nameplate on the side of the unit', icon: '❄️' },
  { label: 'Water Heater', hint: 'Sticker on the front or side of the tank', icon: '🚿' },
  { label: 'Evaporator Coil (indoor AC)', hint: 'Sticker on the coil housing near your furnace', icon: '🌀' },
  { label: 'Thermostat', hint: 'Model info on the back or in settings', icon: '🌡️' },
  { label: 'Dishwasher', hint: 'Label inside the door edge', icon: '🍽️' },
  { label: 'Washer & Dryer', hint: 'Label inside the lid or door frame', icon: '👕' },
  { label: 'Garage Door Opener', hint: 'Sticker on the motor housing', icon: '🚗' },
];

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
  const { user, home, equipment, tasks, setEquipment, addEquipment, removeEquipment, setTasks } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [form, setForm] = useState({ name: '', category: 'hvac' as EquipmentCategory, make: '', model: '', serial_number: '', install_date: '', expected_lifespan_years: '', location_in_home: '', notes: '' });
  const [scanExtras, setScanExtras] = useState<{ equipment_subtype?: string; refrigerant_type?: string }>({});
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
        equipment_subtype: scanExtras.equipment_subtype || undefined,
        refrigerant_type: scanExtras.refrigerant_type || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await upsertEquipment(newItem);
      addEquipment(newItem);

      // Auto-generate tasks for the new equipment
      try {
        const updatedEquipment = [...equipment, newItem];
        const newTasks = generateTasksForHome(home, updatedEquipment, tasks);
        const lifecycleAlerts = generateEquipmentLifecycleAlerts([newItem], home);
        const allNewTasks = [...newTasks, ...lifecycleAlerts];
        if (allNewTasks.length > 0) {
          const saved = await createTasks(allNewTasks);
          setTasks([...tasks, ...saved]);
        }
      } catch (taskErr) {
        console.warn('Task generation after equipment add failed:', taskErr);
      }

      setShowModal(false);
      setForm({ name: '', category: 'hvac', make: '', model: '', serial_number: '', install_date: '', expected_lifespan_years: '', location_in_home: '', notes: '' });
      setScanExtras({});
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
    const { name, category, make, model, serial_number, install_date, capacity, fuel_type, efficiency_rating, filter_size, additional_info, equipment_subtype, estimated_lifespan_years, refrigerant_type, alerts } = scannedData;

    // Build notes from extra scan data
    const notesParts: string[] = [];
    if (equipment_subtype) notesParts.push(`Type: ${equipment_subtype}`);
    if (capacity) notesParts.push(`Capacity: ${capacity}`);
    if (fuel_type) notesParts.push(`Fuel Type: ${fuel_type}`);
    if (efficiency_rating) notesParts.push(`Efficiency: ${efficiency_rating}`);
    if (filter_size) notesParts.push(`Filter Size: ${filter_size}`);
    if (refrigerant_type) notesParts.push(`Refrigerant: ${refrigerant_type}`);
    if (alerts && Array.isArray(alerts) && alerts.length > 0) {
      notesParts.push('');
      notesParts.push('--- Alerts ---');
      alerts.forEach((a: string) => notesParts.push(`⚠ ${a}`));
    }
    if (additional_info && typeof additional_info === 'object') {
      for (const [key, value] of Object.entries(additional_info)) {
        notesParts.push(`${key.replace(/_/g, ' ')}: ${value}`);
      }
    }

    // Validate category maps to our known categories
    const validCategories = CATEGORIES.map(c => c.value);
    const mappedCategory = category && validCategories.includes(category) ? category : form.category;

    setForm({
      ...form,
      name: name || form.name,
      category: mappedCategory,
      make: make || form.make,
      model: model || form.model,
      serial_number: serial_number || form.serial_number,
      install_date: install_date
        || additional_info?.manufacture_date
        || additional_info?.manufactured_date
        || additional_info?.production_date
        || form.install_date,
      expected_lifespan_years: estimated_lifespan_years
        ? String(estimated_lifespan_years)
        : (equipment_subtype && EQUIPMENT_LIFESPAN_DEFAULTS[equipment_subtype.toLowerCase()])
          ? String(EQUIPMENT_LIFESPAN_DEFAULTS[equipment_subtype.toLowerCase()])
          : (mappedCategory && EQUIPMENT_LIFESPAN_DEFAULTS[mappedCategory])
            ? String(EQUIPMENT_LIFESPAN_DEFAULTS[mappedCategory])
            : form.expected_lifespan_years,
      notes: notesParts.length > 0 ? notesParts.join('\n') : form.notes,
    });
    // Store subtype and refrigerant for saving to DB
    setScanExtras({ equipment_subtype, refrigerant_type });
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
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: Colors.copper, marginBottom: 8 }}>EQ</div>
            <h3 style={{ marginBottom: 8 }}>No equipment yet</h3>
            <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6 }}>
              Scanning your equipment labels lets Canopy build a personalized maintenance schedule, track warranty info, and alert you to issues.
            </p>
          </div>

          {/* Scan button */}
          <button
            className="btn btn-primary"
            onClick={() => atLimit ? alert(`Free plan allows ${limit} items. Upgrade for unlimited.`) : setShowScanner(true)}
            style={{ width: '100%', padding: '14px 0', fontSize: 15, marginBottom: 24 }}
          >
            Scan Equipment Label
          </button>

          {/* Equipment suggestion checklist */}
          <div style={{
            backgroundColor: '#faf9f7',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal, marginBottom: 4 }}>
              What should I scan?
            </p>
            <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 16, lineHeight: 1.5 }}>
              Look for stickers or nameplates on these common items. Each scan gives Canopy more data to work with.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SCAN_SUGGESTIONS.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 18, lineHeight: '24px', flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: Colors.charcoal }}>{item.label}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 12, color: Colors.medGray }}>{item.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Manual add option */}
          <button
            className="btn btn-ghost"
            onClick={() => atLimit ? alert(`Free plan allows ${limit} items. Upgrade for unlimited.`) : setShowModal(true)}
            style={{ width: '100%', fontSize: 13 }}
          >
            Or add equipment manually
          </button>
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
