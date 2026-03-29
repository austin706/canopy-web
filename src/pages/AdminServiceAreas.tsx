import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { invalidateServiceAreaCache } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';

interface ServiceArea {
  id: string;
  zip_code: string;
  state: string;
  city_name: string | null;
  region_name: string | null;
  is_active: boolean;
  launched_at: string;
  created_at: string;
}

// US state abbreviations for the dropdown
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export default function AdminServiceAreas() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [newZipCode, setNewZipCode] = useState('');
  const [newState, setNewState] = useState('OK');
  const [newCityName, setNewCityName] = useState('');
  const [newRegionName, setNewRegionName] = useState('Tulsa Metro');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkZips, setBulkZips] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_areas')
        .select('*')
        .order('state', { ascending: true })
        .order('city_name', { ascending: true })
        .order('zip_code', { ascending: true });

      if (error) throw error;
      setAreas(data || []);
    } catch (err: any) {
      console.error('Error fetching service areas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSingle = async () => {
    if (!newZipCode || !newState) {
      setMessage('ZIP code and state are required');
      return;
    }
    if (!/^\d{5}$/.test(newZipCode)) {
      setMessage('ZIP code must be exactly 5 digits');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('service_areas').insert({
        zip_code: newZipCode,
        state: newState,
        city_name: newCityName || null,
        region_name: newRegionName || null,
      });

      if (error) {
        if (error.code === '23505') {
          setMessage(`ZIP code ${newZipCode} already exists`);
        } else {
          throw error;
        }
      } else {
        setMessage(`Added ${newZipCode} ${newCityName ? `(${newCityName})` : ''}`);
        setNewZipCode('');
        setNewCityName('');
        invalidateServiceAreaCache();
        fetchAreas();
      }
    } catch (err: any) {
      setMessage(err.message || 'Failed to add');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const handleAddBulk = async () => {
    if (!bulkZips.trim() || !newState) {
      setMessage('ZIP codes and state are required');
      return;
    }

    // Parse comma/space/newline-separated ZIP codes
    const zips = bulkZips
      .split(/[\s,]+/)
      .map(z => z.trim())
      .filter(z => /^\d{5}$/.test(z));

    if (zips.length === 0) {
      setMessage('No valid 5-digit ZIP codes found');
      return;
    }

    setSaving(true);
    try {
      const rows = zips.map(zip => ({
        zip_code: zip,
        state: newState,
        city_name: newCityName || null,
        region_name: newRegionName || null,
      }));

      const { error } = await supabase
        .from('service_areas')
        .upsert(rows, { onConflict: 'zip_code' });

      if (error) throw error;

      setMessage(`Added/updated ${rows.length} ZIP codes`);
      setBulkZips('');
      setNewCityName('');
      invalidateServiceAreaCache();
      fetchAreas();
    } catch (err: any) {
      setMessage(err.message || 'Failed to add bulk');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 4000);
    }
  };

  const toggleActive = async (area: ServiceArea) => {
    try {
      const { error } = await supabase
        .from('service_areas')
        .update({ is_active: !area.is_active, updated_at: new Date().toISOString() })
        .eq('id', area.id);

      if (error) throw error;
      setAreas(prev =>
        prev.map(a => a.id === area.id ? { ...a, is_active: !a.is_active } : a)
      );
      invalidateServiceAreaCache();
    } catch (err: any) {
      console.error('Error toggling area:', err);
    }
  };

  const handleDelete = async (area: ServiceArea) => {
    if (!confirm(`Delete ZIP ${area.zip_code} (${area.city_name || area.state})?`)) return;
    try {
      const { error } = await supabase
        .from('service_areas')
        .delete()
        .eq('id', area.id);

      if (error) throw error;
      setAreas(prev => prev.filter(a => a.id !== area.id));
      invalidateServiceAreaCache();
    } catch (err: any) {
      console.error('Error deleting area:', err);
    }
  };

  // Filtering
  const filteredAreas = areas.filter(a => {
    if (filterState && a.state !== filterState) return false;
    if (filterCity && a.city_name !== filterCity) return false;
    return true;
  });

  // Group by city for display
  const groupedByCity = filteredAreas.reduce((acc, area) => {
    const key = area.city_name || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(area);
    return acc;
  }, {} as Record<string, ServiceArea[]>);

  const activeCount = areas.filter(a => a.is_active).length;
  const cityCount = new Set(areas.filter(a => a.city_name).map(a => a.city_name)).size;
  const allCities = [...new Set(areas.filter(a => a.city_name).map(a => a.city_name as string))].sort();

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>
            &larr; Admin Portal
          </button>
          <h1>Service Areas</h1>
          <p className="text-sm text-gray">
            Manage where Pro services are available by 5-digit ZIP code.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Close' : '+ Add ZIP Codes'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid-3 mb-lg">
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="text-xs text-gray">Total ZIP Codes</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: Colors.copper }}>{areas.length}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="text-xs text-gray">Active</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: Colors.sage }}>{activeCount}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="text-xs text-gray">Cities Covered</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: Colors.charcoal }}>{cityCount}</p>
        </div>
      </div>

      {/* Add area form */}
      {showAdd && (
        <div className="card mb-lg" style={{ background: Colors.copperMuted }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Add Service Area ZIP Codes
          </h3>

          {message && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: message.includes('Added') || message.includes('updated') ? '#4CAF5020' : '#E5393520',
              color: message.includes('Added') || message.includes('updated') ? '#2E7D32' : '#C62828',
              fontSize: 13,
              marginBottom: 12,
            }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
              <input type="radio" checked={!bulkMode} onChange={() => setBulkMode(false)} />
              Single ZIP
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
              <input type="radio" checked={bulkMode} onChange={() => setBulkMode(true)} />
              Bulk paste
            </label>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>State *</label>
              <select
                className="form-select"
                value={newState}
                onChange={e => setNewState(e.target.value)}
              >
                <option value="">Select state...</option>
                {US_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Region Name</label>
              <input
                className="form-input"
                placeholder="e.g., Tulsa Metro"
                value={newRegionName}
                onChange={e => setNewRegionName(e.target.value)}
              />
            </div>
          </div>

          {bulkMode ? (
            <div className="form-group">
              <label>ZIP Codes (comma, space, or newline separated) *</label>
              <textarea
                className="form-input"
                placeholder="74101, 74102, 74103&#10;74104, 74105"
                value={bulkZips}
                onChange={e => setBulkZips(e.target.value)}
                rows={4}
                style={{ fontFamily: 'monospace', fontSize: 13 }}
              />
              <p className="text-xs text-gray" style={{ marginTop: 4 }}>
                Enter 5-digit ZIP codes. Non-numeric characters will be ignored.
              </p>
            </div>
          ) : (
            <div className="grid-2">
              <div className="form-group">
                <label>ZIP Code (5 digits) *</label>
                <input
                  className="form-input"
                  placeholder="74103"
                  value={newZipCode}
                  onChange={e => setNewZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  maxLength={5}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
              <div className="form-group">
                <label>City / Town Name</label>
                <input
                  className="form-input"
                  placeholder="e.g., Tulsa"
                  value={newCityName}
                  onChange={e => setNewCityName(e.target.value)}
                />
              </div>
            </div>
          )}

          {bulkMode && (
            <div className="form-group">
              <label>City Name (applied to all)</label>
              <input
                className="form-input"
                placeholder="e.g., Tulsa"
                value={newCityName}
                onChange={e => setNewCityName(e.target.value)}
              />
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={bulkMode ? handleAddBulk : handleAddSingle}
            disabled={saving}
          >
            {saving ? 'Adding...' : bulkMode ? 'Add ZIP Codes' : 'Add ZIP Code'}
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-sm mb-md" style={{ flexWrap: 'wrap' }}>
        <label className="text-sm text-gray">Filter:</label>
        <select
          className="form-select"
          style={{ width: 120 }}
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
        >
          <option value="">All states</option>
          {[...new Set(areas.map(a => a.state))].sort().map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ width: 160 }}
          value={filterCity}
          onChange={e => setFilterCity(e.target.value)}
        >
          <option value="">All cities</option>
          {allCities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-sm text-gray" style={{ marginLeft: 'auto' }}>
          Showing {filteredAreas.length} ZIP code{filteredAreas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Areas grouped by city */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="text-gray">Loading service areas...</p>
        </div>
      ) : (
        Object.entries(groupedByCity)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([city, cityAreas]) => (
            <div key={city} className="card mb-md">
              <div className="flex items-center justify-between mb-md">
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                  {city}
                  <span className="text-sm text-gray" style={{ marginLeft: 8, fontWeight: 400 }}>
                    {cityAreas.length} ZIP{cityAreas.length !== 1 ? 's' : ''}
                    {' · '}
                    {cityAreas[0]?.region_name || cityAreas[0]?.state}
                  </span>
                </h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cityAreas.map(area => (
                  <div
                    key={area.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      background: area.is_active ? `${Colors.sage}20` : '#f5f5f5',
                      color: area.is_active ? Colors.charcoal : Colors.silver,
                      border: `1px solid ${area.is_active ? Colors.sage : Colors.lightGray}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{area.zip_code}</span>
                    <button
                      onClick={() => toggleActive(area)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: 14,
                        color: area.is_active ? Colors.sage : Colors.silver,
                      }}
                      title={area.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {area.is_active ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => handleDelete(area)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: 12,
                        color: '#ccc',
                      }}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}

      {!loading && filteredAreas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="text-gray">No service areas found. Add your first ZIP code above!</p>
        </div>
      )}
    </div>
  );
}
