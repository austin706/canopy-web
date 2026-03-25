import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

interface ServiceArea {
  id: string;
  zip_prefix: string;
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
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [newZipPrefix, setNewZipPrefix] = useState('');
  const [newState, setNewState] = useState('');
  const [newCityName, setNewCityName] = useState('');
  const [newRegionName, setNewRegionName] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkStart, setBulkStart] = useState('');
  const [bulkEnd, setBulkEnd] = useState('');
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
        .order('zip_prefix', { ascending: true });

      if (error) throw error;
      setAreas(data || []);
    } catch (err: any) {
      console.error('Error fetching service areas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSingle = async () => {
    if (!newZipPrefix || !newState) {
      setMessage('Zip prefix and state are required');
      return;
    }
    if (!/^\d{3}$/.test(newZipPrefix)) {
      setMessage('Zip prefix must be exactly 3 digits');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('service_areas').insert({
        zip_prefix: newZipPrefix,
        state: newState,
        city_name: newCityName || null,
        region_name: newRegionName || null,
      });

      if (error) {
        if (error.code === '23505') {
          setMessage(`Zip prefix ${newZipPrefix} already exists`);
        } else {
          throw error;
        }
      } else {
        setMessage(`Added ${newZipPrefix} (${newState})`);
        setNewZipPrefix('');
        setNewCityName('');
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
    if (!bulkStart || !bulkEnd || !newState) {
      setMessage('Start prefix, end prefix, and state are required');
      return;
    }
    const start = parseInt(bulkStart);
    const end = parseInt(bulkEnd);
    if (isNaN(start) || isNaN(end) || start > end) {
      setMessage('Invalid range');
      return;
    }

    setSaving(true);
    try {
      const rows = [];
      for (let i = start; i <= end; i++) {
        rows.push({
          zip_prefix: String(i).padStart(3, '0'),
          state: newState,
          region_name: newRegionName || null,
        });
      }

      const { error } = await supabase
        .from('service_areas')
        .upsert(rows, { onConflict: 'zip_prefix' });

      if (error) throw error;

      setMessage(`Added ${rows.length} zip prefixes (${bulkStart}–${bulkEnd})`);
      setBulkStart('');
      setBulkEnd('');
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
    } catch (err: any) {
      console.error('Error toggling area:', err);
    }
  };

  const handleDelete = async (area: ServiceArea) => {
    if (!confirm(`Delete zip prefix ${area.zip_prefix} (${area.state})?`)) return;
    try {
      const { error } = await supabase
        .from('service_areas')
        .delete()
        .eq('id', area.id);

      if (error) throw error;
      setAreas(prev => prev.filter(a => a.id !== area.id));
    } catch (err: any) {
      console.error('Error deleting area:', err);
    }
  };

  // Group areas by state for display
  const filteredAreas = filterState
    ? areas.filter(a => a.state === filterState)
    : areas;

  const groupedByState = filteredAreas.reduce((acc, area) => {
    if (!acc[area.state]) acc[area.state] = [];
    acc[area.state].push(area);
    return acc;
  }, {} as Record<string, ServiceArea[]>);

  const activeCount = areas.filter(a => a.is_active).length;
  const stateCount = new Set(areas.map(a => a.state)).size;

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin-portal')}>
            &larr; Admin Portal
          </button>
          <h1>Service Areas</h1>
          <p className="text-sm text-gray">
            Manage where Pro services are available by zip code prefix.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Close' : '+ Add Area'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid-3 mb-lg">
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="text-xs text-gray">Total Prefixes</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: Colors.copper }}>{areas.length}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="text-xs text-gray">Active</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: Colors.sage }}>{activeCount}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="text-xs text-gray">States Covered</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: Colors.charcoal }}>{stateCount}</p>
        </div>
      </div>

      {/* Add area form */}
      {showAdd && (
        <div className="card mb-lg" style={{ background: Colors.copperMuted }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Add Service Area
          </h3>

          {message && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: message.includes('Added') ? '#4CAF5020' : '#E5393520',
              color: message.includes('Added') ? '#2E7D32' : '#C62828',
              fontSize: 13,
              marginBottom: 12,
            }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="radio"
                checked={!bulkMode}
                onChange={() => setBulkMode(false)}
              />
              Single prefix
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="radio"
                checked={bulkMode}
                onChange={() => setBulkMode(true)}
              />
              Bulk range
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
                placeholder="e.g., Oklahoma"
                value={newRegionName}
                onChange={e => setNewRegionName(e.target.value)}
              />
            </div>
          </div>

          {bulkMode ? (
            <div className="grid-2">
              <div className="form-group">
                <label>Start Prefix (3 digits) *</label>
                <input
                  className="form-input"
                  placeholder="730"
                  value={bulkStart}
                  onChange={e => setBulkStart(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  maxLength={3}
                />
              </div>
              <div className="form-group">
                <label>End Prefix (3 digits) *</label>
                <input
                  className="form-input"
                  placeholder="749"
                  value={bulkEnd}
                  onChange={e => setBulkEnd(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  maxLength={3}
                />
              </div>
            </div>
          ) : (
            <div className="grid-2">
              <div className="form-group">
                <label>Zip Prefix (3 digits) *</label>
                <input
                  className="form-input"
                  placeholder="741"
                  value={newZipPrefix}
                  onChange={e => setNewZipPrefix(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  maxLength={3}
                />
              </div>
              <div className="form-group">
                <label>City / Metro Name</label>
                <input
                  className="form-input"
                  placeholder="e.g., Tulsa Metro"
                  value={newCityName}
                  onChange={e => setNewCityName(e.target.value)}
                />
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={bulkMode ? handleAddBulk : handleAddSingle}
            disabled={saving}
          >
            {saving ? 'Adding...' : bulkMode ? 'Add Range' : 'Add Prefix'}
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-sm mb-md">
        <label className="text-sm text-gray">Filter by state:</label>
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
        <span className="text-sm text-gray" style={{ marginLeft: 'auto' }}>
          Showing {filteredAreas.length} prefix{filteredAreas.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Areas grouped by state */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="text-gray">Loading service areas...</p>
        </div>
      ) : (
        Object.entries(groupedByState)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([state, stateAreas]) => (
            <div key={state} className="card mb-md">
              <div className="flex items-center justify-between mb-md">
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                  {stateAreas[0]?.region_name || state}
                  <span className="text-sm text-gray" style={{ marginLeft: 8, fontWeight: 400 }}>
                    {stateAreas.length} prefix{stateAreas.length !== 1 ? 'es' : ''}
                  </span>
                </h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {stateAreas.map(area => (
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
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title={`${area.zip_prefix}xx ${area.city_name ? `(${area.city_name})` : ''} — Click to ${area.is_active ? 'deactivate' : 'activate'}`}
                  >
                    <span>{area.zip_prefix}xx</span>
                    {area.city_name && (
                      <span style={{ fontSize: 11, fontWeight: 400, fontFamily: 'inherit', color: Colors.medGray }}>
                        {area.city_name}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleActive(area); }}
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
                      onClick={(e) => { e.stopPropagation(); handleDelete(area); }}
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
          <p className="text-gray">No service areas found. Add your first one above!</p>
        </div>
      )}
    </div>
  );
}
