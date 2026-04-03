import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { invalidateServiceAreaCache } from '@/services/subscriptionGate';
import { logAdminAction } from '@/services/auditLog';
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

interface ProProvider {
  id: string;
  name: string;
  service_area_zips: string[];
}

interface ProRequest {
  zip_code: string;
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
  const [providers, setProviders] = useState<ProProvider[]>([]);
  const [proRequests, setProRequests] = useState<ProRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

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
      // Fetch service areas
      const { data: areasData, error: areasError } = await supabase
        .from('service_areas')
        .select('*')
        .order('state', { ascending: true })
        .order('city_name', { ascending: true })
        .order('zip_code', { ascending: true });

      if (areasError) throw areasError;
      setAreas(areasData || []);

      // Fetch pro providers with their service area ZIPs
      const { data: providersData, error: providersError } = await supabase
        .from('pro_providers')
        .select('id, name, service_area_zips');

      if (providersError) throw providersError;
      setProviders((providersData || []) as ProProvider[]);

      // Fetch pro requests to identify demand ZIPs
      const { data: requestsData, error: requestsError } = await supabase
        .from('pro_requests')
        .select('zip_code');

      if (requestsError) throw requestsError;
      setProRequests((requestsData || []) as ProRequest[]);
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
      const { data: insertData, error } = await supabase.from('service_areas').insert({
        zip_code: newZipCode,
        state: newState,
        city_name: newCityName || null,
        region_name: newRegionName || null,
      }).select();

      if (error) {
        if (error.code === '23505') {
          setMessage(`ZIP code ${newZipCode} already exists`);
        } else {
          throw error;
        }
      } else {
        const newId = insertData?.[0]?.id || 'unknown';
        await logAdminAction('service_area.create', 'service_area', newId, {
          zip_code: newZipCode,
          city: newCityName,
        });
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

      const { data: upsertData, error } = await supabase
        .from('service_areas')
        .upsert(rows, { onConflict: 'zip_code' })
        .select();

      if (error) throw error;

      // Log each upserted area
      for (const item of (upsertData || [])) {
        await logAdminAction('service_area.create', 'service_area', item.id, {
          zip_code: item.zip_code,
          city: item.city_name,
        });
      }

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

      await logAdminAction('service_area.delete', 'service_area', area.id, {
        zip_code: area.zip_code,
      });

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

  // === Coverage Analysis for Visualization ===
  // Count providers per ZIP code
  const zipProviderMap = new Map<string, string[]>();
  providers.forEach(provider => {
    if (provider.service_area_zips && Array.isArray(provider.service_area_zips)) {
      provider.service_area_zips.forEach(zip => {
        if (!zipProviderMap.has(zip)) {
          zipProviderMap.set(zip, []);
        }
        zipProviderMap.get(zip)!.push(provider.name);
      });
    }
  });

  // Get demand ZIPs (have pro_requests)
  const demandZips = new Set(proRequests.map(r => r.zip_code));

  // Find coverage gaps: ZIPs with requests but no providers
  const gapZips = new Set<string>();
  demandZips.forEach(zip => {
    if (!zipProviderMap.has(zip) || zipProviderMap.get(zip)!.length === 0) {
      gapZips.add(zip);
    }
  });

  // Categorize ZIPs by coverage level
  const wellCoveredZips = filteredAreas.filter(a => {
    const count = zipProviderMap.get(a.zip_code)?.length || 0;
    return count >= 3;
  });
  const coveredZips = filteredAreas.filter(a => {
    const count = zipProviderMap.get(a.zip_code)?.length || 0;
    return count >= 1 && count < 3;
  });
  const uncoveredZips = filteredAreas.filter(a => {
    const count = zipProviderMap.get(a.zip_code)?.length || 0;
    return count === 0;
  });

  // Coverage stats
  const totalZips = filteredAreas.length;
  const totalUniqueZips = new Set(areas.map(a => a.zip_code)).size;
  const zipsWithProvider = filteredAreas.filter(a => zipProviderMap.has(a.zip_code) && zipProviderMap.get(a.zip_code)!.length > 0).length;
  const zipsNoProvider = uncoveredZips.length;
  const avgProvidersPerZip = totalZips > 0
    ? (filteredAreas.reduce((sum, a) => sum + (zipProviderMap.get(a.zip_code)?.length || 0), 0) / totalZips).toFixed(1)
    : '0';
  const totalProviders = providers.length;

  // Provider coverage (sorted by coverage count)
  const providerCoverageList = providers
    .map(p => ({
      name: p.name,
      count: p.service_area_zips?.length || 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Color intensity function for ZIP cards
  const getZipColor = (zipCode: string): string => {
    const count = zipProviderMap.get(zipCode)?.length || 0;
    if (count >= 3) return Colors.sage;
    if (count >= 1) return Colors.copper;
    return Colors.silver;
  };

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

      {/* View Mode Toggle */}
      <div className="flex items-center gap-sm mb-lg" style={{ justifyContent: 'flex-end' }}>
        <button
          className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setViewMode('list')}
        >
          List View
        </button>
        <button
          className={`btn ${viewMode === 'map' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setViewMode('map')}
        >
          Map View
        </button>
      </div>

      {/* Stats */}
      {viewMode === 'map' ? (
        <>
          {/* Coverage Summary Stats */}
          <div className="grid-5 mb-lg">
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="text-xs text-gray">Total Unique ZIPs</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: Colors.charcoal }}>{totalUniqueZips}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="text-xs text-gray">With Provider</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: Colors.sage }}>{zipsWithProvider}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="text-xs text-gray">No Coverage</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: Colors.error }}>{zipsNoProvider}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="text-xs text-gray">Avg Providers/ZIP</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: Colors.copper }}>{avgProvidersPerZip}</p>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <p className="text-xs text-gray">Total Providers</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: Colors.darkGray }}>{totalProviders}</p>
            </div>
          </div>

          {/* Coverage Gaps Alert */}
          {gapZips.size > 0 && (
            <div className="card mb-lg" style={{
              background: '#FFE5E5',
              borderLeft: `4px solid ${Colors.error}`,
              padding: 16,
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: Colors.charcoal, fontSize: 14, fontWeight: 600 }}>
                Critical Coverage Gaps
              </h4>
              <p style={{ margin: 0, color: Colors.medGray, fontSize: 13 }}>
                {gapZips.size} ZIP code(s) with customer requests but NO provider coverage:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {Array.from(gapZips).sort().map(zip => (
                  <span key={zip} style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: Colors.error,
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                  }}>
                    {zip}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Provider Coverage Heatmap */}
          <div className="card mb-lg">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, margin: '0 0 16px 0' }}>
              Provider Coverage Heatmap
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {providerCoverageList.map(provider => (
                <div key={provider.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: Colors.charcoal }}>
                      {provider.name}
                    </span>
                    <span style={{ fontSize: 12, color: Colors.medGray }}>
                      {provider.count} ZIP{provider.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{
                    height: 20,
                    background: Colors.lightGray,
                    borderRadius: 4,
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${totalUniqueZips > 0 ? (provider.count / totalUniqueZips) * 100 : 0}%`,
                        background: Colors.sage,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ZIP Code Coverage Map */}
          <div className="card mb-lg">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, margin: '0 0 16px 0' }}>
              ZIP Code Coverage Map
            </h3>

            {/* Well Covered */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{
                fontSize: 13,
                fontWeight: 600,
                color: Colors.charcoal,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: Colors.sage,
                }}></span>
                Well Covered (3+ providers) — {wellCoveredZips.length} ZIPs
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {wellCoveredZips.map(area => (
                  <div
                    key={area.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: `${Colors.sage}20`,
                      border: `1px solid ${Colors.sage}`,
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                    title={`${zipProviderMap.get(area.zip_code)?.join(', ')}`}
                  >
                    <div>{area.zip_code}</div>
                    <div style={{ fontSize: 10, color: Colors.medGray, marginTop: 2 }}>
                      {zipProviderMap.get(area.zip_code)?.length || 0} providers
                    </div>
                  </div>
                ))}
                {wellCoveredZips.length === 0 && (
                  <span style={{ color: Colors.silver, fontSize: 13 }}>No well-covered ZIPs</span>
                )}
              </div>
            </div>

            {/* Covered */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{
                fontSize: 13,
                fontWeight: 600,
                color: Colors.charcoal,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: Colors.copper,
                }}></span>
                Covered (1-2 providers) — {coveredZips.length} ZIPs
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {coveredZips.map(area => (
                  <div
                    key={area.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: `${Colors.copper}20`,
                      border: `1px solid ${Colors.copper}`,
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    title={`${zipProviderMap.get(area.zip_code)?.join(', ')}`}
                  >
                    <div>{area.zip_code}</div>
                    <div style={{ fontSize: 10, color: Colors.medGray, marginTop: 2 }}>
                      {zipProviderMap.get(area.zip_code)?.length || 0} provider{((zipProviderMap.get(area.zip_code)?.length || 0) !== 1 ? 's' : '')}
                    </div>
                  </div>
                ))}
                {coveredZips.length === 0 && (
                  <span style={{ color: Colors.silver, fontSize: 13 }}>No covered ZIPs</span>
                )}
              </div>
            </div>

            {/* No Coverage */}
            <div>
              <h4 style={{
                fontSize: 13,
                fontWeight: 600,
                color: Colors.charcoal,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: Colors.silver,
                }}></span>
                No Coverage (0 providers) — {uncoveredZips.length} ZIPs
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {uncoveredZips.map(area => (
                  <div
                    key={area.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: Colors.lightGray,
                      border: `1px solid ${Colors.silver}`,
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      color: Colors.medGray,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    title={`No provider coverage${gapZips.has(area.zip_code) ? ' (has pending requests)' : ''}`}
                  >
                    <div>{area.zip_code}</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>
                      {gapZips.has(area.zip_code) ? '⚠ Gap' : 'Inactive'}
                    </div>
                  </div>
                ))}
                {uncoveredZips.length === 0 && (
                  <span style={{ color: Colors.silver, fontSize: 13 }}>All ZIPs covered!</span>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
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
      )}

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

      {/* List View */}
      {viewMode === 'list' && (
        <>
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
        </>
      )}
    </div>
  );
}
