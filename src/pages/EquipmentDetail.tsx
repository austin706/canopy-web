import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { upsertEquipment, deleteEquipment as deleteEquipApi, createProRequest } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { ROOF_LIFESPANS } from '@/services/taskEngine';
import type { Equipment as EquipmentType, EquipmentCategory } from '@/types';

const CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'water_heater', label: 'Water Heater' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'roof', label: 'Roof' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'safety', label: 'Safety' },
  { value: 'pool', label: 'Pool' },
  { value: 'garage', label: 'Garage' },
];

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, home, equipment, updateEquipment, removeEquipment } = useStore();

  const item = equipment.find(e => e.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [requestingPro, setRequestingPro] = useState(false);
  const [proRequested, setProRequested] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: item?.name || '',
    category: item?.category || 'hvac' as EquipmentCategory,
    make: item?.make || '',
    model: item?.model || '',
    serial_number: item?.serial_number || '',
    install_date: item?.install_date || '',
    expected_lifespan_years: item?.expected_lifespan_years?.toString() || '',
    location_in_home: item?.location_in_home || '',
    notes: item?.notes || '',
    filter_size: item?.filter_size || '',
    tonnage: item?.tonnage?.toString() || '',
    seer_rating: item?.seer_rating?.toString() || '',
    tank_size_gallons: item?.tank_size_gallons?.toString() || '',
    is_tankless: item?.is_tankless || false,
    fuel_type: item?.fuel_type || '',
  });

  if (!item) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Equipment Not Found</h1>
          <button className="btn btn-primary" onClick={() => navigate('/equipment')}>Back to Equipment</button>
        </div>
      </div>
    );
  }

  // Compute lifespan — roof uses ROOF_LIFESPANS, others use install_date + lifespan
  let age = 0;
  let expectedLifespan = item.expected_lifespan_years || 15;
  if (item.category === 'roof' && home?.roof_type) {
    const roofData = ROOF_LIFESPANS[home.roof_type as keyof typeof ROOF_LIFESPANS];
    if (roofData) {
      age = home.roof_install_year
        ? new Date().getFullYear() - home.roof_install_year
        : home.roof_age_years ?? 0;
      expectedLifespan = roofData.min;
    }
  } else if (item.install_date) {
    age = Math.floor((Date.now() - new Date(item.install_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  }
  const lifespanPercent = Math.min((age / expectedLifespan) * 100, 100);
  const isReplacementDue = lifespanPercent >= 95;
  const isInspectionDue = lifespanPercent >= 80 && lifespanPercent < 95;

  const handleGetProQuote = async () => {
    if (!user || !home) return;
    setRequestingPro(true);
    try {
      await createProRequest({
        id: crypto.randomUUID(),
        user_id: user.id,
        home_id: home.id,
        service_type: item.category === 'hvac' ? 'hvac' : item.category === 'plumbing' ? 'plumbing' : item.category === 'electrical' ? 'electrical' : 'general',
        description: `Equipment replacement quote: ${item.name}${item.make ? ` (${item.make} ${item.model || ''})` : ''}. Currently at ${Math.round(lifespanPercent)}% of expected lifespan (${age}yr / ${expectedLifespan}yr).`,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      setProRequested(true);
    } catch (err: any) {
      alert('Failed to submit request: ' + (err.message || 'Unknown error'));
    } finally {
      setRequestingPro(false);
    }
  };

  const getLifespanColor = () => {
    if (lifespanPercent < 50) return Colors.sage;
    if (lifespanPercent < 75) return Colors.warning;
    return Colors.error;
  };

  const handleSave = async () => {
    if (!editForm.name.trim()) {
      alert('Equipment name is required');
      return;
    }

    setIsSaving(true);
    try {
      const updates: any = {
        name: editForm.name,
        category: editForm.category,
        make: editForm.make || undefined,
        model: editForm.model || undefined,
        serial_number: editForm.serial_number || undefined,
        install_date: editForm.install_date || undefined,
        expected_lifespan_years: editForm.expected_lifespan_years ? parseInt(editForm.expected_lifespan_years) : undefined,
        location_in_home: editForm.location_in_home || undefined,
        notes: editForm.notes || undefined,
        updated_at: new Date().toISOString(),
      };

      if (editForm.category === 'hvac') {
        updates.filter_size = editForm.filter_size || undefined;
        updates.tonnage = editForm.tonnage ? parseInt(editForm.tonnage) : undefined;
        updates.seer_rating = editForm.seer_rating ? parseInt(editForm.seer_rating) : undefined;
      }

      if (editForm.category === 'water_heater') {
        updates.tank_size_gallons = editForm.tank_size_gallons ? parseInt(editForm.tank_size_gallons) : undefined;
        updates.is_tankless = editForm.is_tankless;
        updates.fuel_type = editForm.fuel_type || undefined;
      }

      updateEquipment(item.id, updates);
      await upsertEquipment({ ...item, ...updates });
      setIsEditing(false);
    } catch (err: any) {
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    deleteEquipApi(item.id).then(() => {
      removeEquipment(item.id);
      navigate('/equipment');
    }).catch((err: any) => {
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    });
  };

  if (isEditing) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <button className="btn btn-ghost" onClick={() => setIsEditing(false)} style={{ marginBottom: 16 }}>&larr; Back</button>
            <h1>Edit Equipment</h1>
          </div>
        </div>

        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Basic Information</p>
            <div className="flex-col gap-md">
              <div className="form-group">
                <label>Equipment Name *</label>
                <input
                  className="form-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  className="form-select"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as EquipmentCategory })}
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Make</label>
                  <input className="form-input" value={editForm.make} onChange={(e) => setEditForm({ ...editForm, make: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Model</label>
                  <input className="form-input" value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Serial Number</label>
                <input className="form-input" value={editForm.serial_number} onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Installation & Location</p>
            <div className="flex-col gap-md">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Install Date</label>
                  <input className="form-input" type="date" value={editForm.install_date} onChange={(e) => setEditForm({ ...editForm, install_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Lifespan (years)</label>
                  <input className="form-input" type="number" value={editForm.expected_lifespan_years} onChange={(e) => setEditForm({ ...editForm, expected_lifespan_years: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Location in Home</label>
                <input className="form-input" value={editForm.location_in_home} onChange={(e) => setEditForm({ ...editForm, location_in_home: e.target.value })} />
              </div>
            </div>
          </div>

          {editForm.category === 'hvac' && (
            <div className="card mb-lg">
              <p style={{ fontWeight: 600, marginBottom: 12 }}>HVAC Details</p>
              <div className="flex-col gap-md">
                <div className="form-group">
                  <label>Filter Size</label>
                  <input className="form-input" value={editForm.filter_size} onChange={(e) => setEditForm({ ...editForm, filter_size: e.target.value })} placeholder="e.g. 20x25x1" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Tonnage</label>
                    <input className="form-input" type="number" value={editForm.tonnage} onChange={(e) => setEditForm({ ...editForm, tonnage: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>SEER Rating</label>
                    <input className="form-input" type="number" value={editForm.seer_rating} onChange={(e) => setEditForm({ ...editForm, seer_rating: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {editForm.category === 'water_heater' && (
            <div className="card mb-lg">
              <p style={{ fontWeight: 600, marginBottom: 12 }}>Water Heater Details</p>
              <div className="flex-col gap-md">
                <div className="form-group">
                  <label>Tank Size (gallons)</label>
                  <input className="form-input" type="number" value={editForm.tank_size_gallons} onChange={(e) => setEditForm({ ...editForm, tank_size_gallons: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Fuel Type</label>
                  <input className="form-input" value={editForm.fuel_type} onChange={(e) => setEditForm({ ...editForm, fuel_type: e.target.value })} placeholder="Gas, Electric, etc." />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    id="tankless"
                    checked={editForm.is_tankless}
                    onChange={(e) => setEditForm({ ...editForm, is_tankless: e.target.checked })}
                  />
                  <label htmlFor="tankless" style={{ marginBottom: 0 }}>Tankless</label>
                </div>
              </div>
            </div>
          )}

          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Notes</p>
            <textarea
              className="form-textarea"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={4}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button className="btn btn-ghost" onClick={() => setIsEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost" onClick={() => navigate('/equipment')} style={{ marginBottom: 16 }}>&larr; Back</button>
          <h1>{item.name}</h1>
          <p className="subtitle">{item.make} {item.model}</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Replacement / Inspection Alert Banner */}
        {isReplacementDue && (
          <div style={{
            background: 'linear-gradient(135deg, var(--color-error) 0%, #D84315 100%)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            color: 'var(--color-card-background)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>&#9888;</span>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Replacement Due</span>
            </div>
            <p style={{ fontSize: 14, margin: '0 0 4px', opacity: 0.95, lineHeight: 1.5 }}>
              Your {item.name} is at <strong>{Math.round(lifespanPercent)}%</strong> of its expected {expectedLifespan}-year lifespan ({age === 0 ? '<1 year old' : `${age} years old`}).
            </p>
            <p style={{ fontSize: 13, margin: '0 0 16px', opacity: 0.8, lineHeight: 1.5 }}>
              Equipment past its expected lifespan is more likely to fail unexpectedly. Get a pro quote for replacement before it becomes an emergency.
            </p>
            {proRequested ? (
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}>
                Pro quote requested — check Pro Services for updates
              </div>
            ) : (
              <button
                onClick={handleGetProQuote}
                disabled={requestingPro}
                style={{
                  background: 'var(--color-card-background)',
                  color: 'var(--color-error)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                {requestingPro ? 'Submitting...' : 'Get Pro Replacement Quote'}
              </button>
            )}
          </div>
        )}

        {isInspectionDue && (
          <div style={{
            background: 'var(--color-copper-muted, #FFF3E0)',
            border: `1px solid ${Colors.warning}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>&#128269;</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: Colors.charcoal }}>Inspection Recommended</span>
            </div>
            <p style={{ fontSize: 13, color: Colors.medGray, margin: 0, lineHeight: 1.5 }}>
              Your {item.name} is at {Math.round(lifespanPercent)}% of its expected lifespan. Schedule a professional inspection to assess its condition and plan ahead.
            </p>
          </div>
        )}

        {/* Basic Info */}
        <div className="card mb-lg">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p className="text-xs text-gray">Category</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{CATEGORIES.find(c => c.value === item.category)?.label}</p>
            </div>
            {item.make && (
              <div>
                <p className="text-xs text-gray">Make</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.make}</p>
              </div>
            )}
          </div>
          {item.model && (
            <div style={{ marginTop: 16 }}>
              <p className="text-xs text-gray">Model</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.model}</p>
            </div>
          )}
          {item.serial_number && (
            <div style={{ marginTop: 16 }}>
              <p className="text-xs text-gray">Serial Number</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.serial_number}</p>
            </div>
          )}
          {item.location_in_home && (
            <div style={{ marginTop: 16 }}>
              <p className="text-xs text-gray">Location</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.location_in_home}</p>
            </div>
          )}
        </div>

        {/* Lifespan */}
        {item.install_date && (
          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Lifespan</p>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-xs text-gray">Progress</span>
                <span className="text-xs" style={{ color: getLifespanColor() }}>{Math.round(lifespanPercent)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${lifespanPercent}%`, background: getLifespanColor() }} />
              </div>
            </div>
            <p className="text-sm text-gray">{age}yr / {expectedLifespan}yr</p>
          </div>
        )}

        {/* Category-Specific Fields */}
        {item.category === 'hvac' && (
          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>HVAC Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {item.filter_size && (
                <div>
                  <p className="text-xs text-gray">Filter Size</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.filter_size}</p>
                </div>
              )}
              {item.tonnage && (
                <div>
                  <p className="text-xs text-gray">Tonnage</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.tonnage}</p>
                </div>
              )}
              {item.seer_rating && (
                <div>
                  <p className="text-xs text-gray">SEER Rating</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.seer_rating}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {item.category === 'water_heater' && (
          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Water Heater Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {item.tank_size_gallons && (
                <div>
                  <p className="text-xs text-gray">Tank Size</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.tank_size_gallons} gal</p>
                </div>
              )}
              {item.fuel_type && (
                <div>
                  <p className="text-xs text-gray">Fuel Type</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{item.fuel_type}</p>
                </div>
              )}
            </div>
            {item.is_tankless && (
              <p className="badge" style={{ background: Colors.sageMuted, color: Colors.sage, marginTop: 12, width: 'fit-content' }}>Tankless</p>
            )}
          </div>
        )}

        {item.notes && (
          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Notes</p>
            <p style={{ color: Colors.medGray, lineHeight: 1.5 }}>{item.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Edit</button>
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}
