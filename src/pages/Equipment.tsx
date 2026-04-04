import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { upsertEquipment, deleteEquipment as deleteEquipApi, getEquipment, createTasks } from '@/services/supabase';
import { getEquipmentLimit } from '@/services/subscriptionGate';
import { generateTasksForHome, generateEquipmentLifecycleAlerts } from '@/services/taskEngine';
import EquipmentScanner from '@/components/EquipmentScanner';
import { Colors } from '@/constants/theme';
import { EQUIPMENT_LIFESPAN_DEFAULTS } from '@/constants/maintenance';
import { ROOF_LIFESPANS } from '@/services/taskEngine';
import type { Equipment as EquipmentType, EquipmentCategory } from '@/types';

/** Compute lifespan percentage for an equipment item */
function getLifespanPct(item: EquipmentType, home: any): number | null {
  // Roof special handling
  if (item.category === 'roof' && home?.roof_type) {
    const lifespan = ROOF_LIFESPANS[home.roof_type as keyof typeof ROOF_LIFESPANS];
    if (!lifespan) return null;
    const roofAge = home.roof_age_years ?? 0;
    return lifespan.min > 0 ? (roofAge / lifespan.min) * 100 : 0;
  }
  if (!item.install_date || !item.expected_lifespan_years) return null;
  const age = (Date.now() - new Date(item.install_date).getTime()) / (365.25 * 86400000);
  return Math.min(100, (age / item.expected_lifespan_years) * 100);
}

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

const CATEGORIES: { value: EquipmentCategory; label: string; abbr: string; icon?: string }[] = [
  { value: 'hvac', label: 'HVAC', abbr: 'HC', icon: '/icons/equipment/furnace.svg' },
  { value: 'water_heater', label: 'Water Heater', abbr: 'WH', icon: '/icons/equipment/water-heater.svg' },
  { value: 'appliance', label: 'Appliance', abbr: 'AP', icon: '/icons/equipment/appliances.svg' },
  { value: 'roof', label: 'Roof', abbr: 'RF', icon: '/icons/equipment/Roof.png' },
  { value: 'plumbing', label: 'Plumbing', abbr: 'PL', icon: '/icons/equipment/Plumbing.png' },
  { value: 'electrical', label: 'Electrical', abbr: 'EL', icon: '/icons/equipment/electrical-panel.svg' },
  { value: 'outdoor', label: 'Outdoor', abbr: 'OD', icon: '/icons/equipment/septic-well.svg' },
  { value: 'safety', label: 'Safety', abbr: 'SF', icon: '/icons/equipment/fireplace.svg' },
  { value: 'pool', label: 'Pool', abbr: 'PO', icon: '/icons/equipment/pool-spa.svg' },
  { value: 'garage', label: 'Garage', abbr: 'GR', icon: '/icons/equipment/garage-door.svg' },
];

export default function Equipment() {
  const { user, home, equipment, tasks, setEquipment, addEquipment, removeEquipment, setTasks } = useStore();
  const navigate = useNavigate();
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
  const catIcon = (cat: string) => CATEGORIES.find(c => c.value === cat)?.icon;
  const catLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label || cat;

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
        <button className="btn btn-primary" onClick={() => atLimit ? alert(`Free plan allows ${limit} items. Upgrade for unlimited.`) : setShowScanner(true)}>+ Add Equipment</button>
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
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 0' }}>
          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: Colors.copperMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 32,
            }} role="img" aria-label="Clipboard">📋</div>
            <h3 style={{ marginBottom: 8, fontSize: 20 }}>Your Equipment Registry</h3>
            <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
              Scan your equipment labels and Canopy handles the rest — maintenance reminders, warranty tracking, and lifecycle alerts all personalized to your home.
            </p>
          </div>

          {/* What happens when you scan — 1-2-3 flow */}
          <div style={{
            background: 'var(--color-card-background)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            border: `1px solid var(--color-border)`,
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-charcoal)', margin: '0 0 14px 0' }}>
              What happens when you scan
            </p>
            {[
              { step: '1', title: 'Snap a photo', desc: 'of the equipment nameplate or label' },
              { step: '2', title: 'AI reads the label', desc: 'and extracts make, model, specs, and age' },
              { step: '3', title: 'Canopy builds your plan', desc: '— maintenance schedule, warranty tracking, replacement alerts' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: i < 2 ? 14 : 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--color-copper)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <div style={{ paddingTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-charcoal)' }}>{item.title} </span>
                  <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            className="btn btn-primary"
            onClick={() => atLimit ? alert(`Free plan allows ${limit} items. Upgrade for unlimited.`) : setShowScanner(true)}
            style={{ width: '100%', padding: '14px 0', fontSize: 15, marginBottom: 20 }}
          >
            + Add Equipment
          </button>

          {/* Where to look checklist */}
          <div style={{
            backgroundColor: 'var(--color-cream)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: 4 }}>
              Not sure what to scan?
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Start with these — each scan gives Canopy more data to protect your home.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SCAN_SUGGESTIONS.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 18, lineHeight: '24px', flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-charcoal)' }}>{item.label}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
        {/* Replacement Alerts Summary */}
        {(() => {
          const alerts = equipment.filter(item => {
            const pct = getLifespanPct(item, home);
            return pct !== null && pct >= 95;
          });
          if (alerts.length === 0) return null;
          return (
            <div style={{
              background: 'var(--color-copper-muted, #FFF3E0)',
              border: `1px solid var(--color-warning)`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>&#9888;</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-charcoal)' }}>
                  {alerts.length} item{alerts.length > 1 ? 's' : ''} nearing end of life
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                {alerts.map(a => a.name).join(', ')} — tap an item below for details and to request a pro quote.
              </p>
            </div>
          );
        })()}

        <div className="grid-2">
          {filtered.map(item => {
            const pct = getLifespanPct(item, home);
            const isReplacement = pct !== null && pct >= 95;
            const isInspect = pct !== null && pct >= 80 && pct < 95;
            return (
            <div key={item.id} className="card" onClick={() => navigate(`/equipment/${item.id}`)} style={{ cursor: 'pointer', position: 'relative', borderLeft: isReplacement ? `4px solid var(--color-error)` : isInspect ? `4px solid var(--color-warning)` : undefined }}>
              {isReplacement && (
                <div style={{
                  background: 'var(--color-error)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '0 0 8px 0',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}>REPLACEMENT DUE</div>
              )}
              {isInspect && !isReplacement && (
                <div style={{
                  background: 'var(--color-warning)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '0 0 8px 0',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}>SCHEDULE INSPECTION</div>
              )}
              <div className="equip-card" style={{ paddingTop: isReplacement || isInspect ? 24 : undefined }}>
                <div className="equip-icon" style={{ background: 'var(--color-copper-muted, #FFF3E0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {catIcon(item.category)
                    ? <img src={catIcon(item.category)} alt={item.category} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-copper)' }}>{catAbbr(item.category)}</span>
                  }
                </div>
                <div className="equip-info">
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-sage)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{catLabel(item.category)}</div>
                  <div className="equip-name">{item.name}</div>
                  <div className="equip-detail">{item.make} {item.model}</div>
                  {item.install_date && <div className="equip-detail">Installed: {new Date(item.install_date).toLocaleDateString()}</div>}
                  {item.location_in_home && <div className="equip-detail">Location: {item.location_in_home}</div>}
                  {pct !== null && (() => {
                    const rounded = Math.round(pct);
                    const ageYrs = item.install_date ? Math.round((Date.now() - new Date(item.install_date).getTime()) / (365.25 * 86400000)) : 0;
                    const lifespan = item.expected_lifespan_years || 15;
                    return (
                      <div className="mt-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray">Lifespan: {rounded}%</span>
                          <span className="text-xs" style={{ color: rounded > 80 ? 'var(--color-error)' : rounded > 60 ? 'var(--color-warning)' : 'var(--color-sage)' }}>{ageYrs}yr / {lifespan}yr</span>
                        </div>
                        <div className="progress-bar mt-sm"><div className="progress-fill" style={{ width: `${rounded}%`, background: rounded > 80 ? 'var(--color-error)' : rounded > 60 ? 'var(--color-warning)' : 'var(--color-sage)' }} /></div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            );
          })}
        </div>
        </>
      )}
      </>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <div className="modal-overlay" onClick={() => setShowScanner(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Add Equipment</h2>
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
              {formErrors.name && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 4 }}>{formErrors.name}</p>}
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
