import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getServiceAreaServices, upsertServiceAreaService, deleteServiceAreaService } from '@/services/supabase';
import type { ServiceAreaService } from '@/services/supabase';
import { invalidateServiceAreaCache } from '@/services/subscriptionGate';
import { logAdminAction } from '@/services/auditLog';
import { getMessageVariant, messageColors } from '@/utils/messageType';
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
  max_providers: number;
  pricing_tier: string;
  notes: string | null;
  coverage_radius_miles: number;
}

interface ProProvider {
  id: string;
  name: string;
  service_area_zips: string[];
}

interface ProRequest {
  zip_code: string;
}

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
  const [activeTab, setActiveTab] = useState<'by-state' | 'coverage'>('by-state');
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  // Add form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newZipCode, setNewZipCode] = useState('');
  const [newState, setNewState] = useState('OK');
  const [newCityName, setNewCityName] = useState('');
  const [newRegionName, setNewRegionName] = useState('Tulsa Metro');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkZips, setBulkZips] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Service catalog modal state
  const [catalogArea, setCatalogArea] = useState<ServiceArea | null>(null);
  const [catalogServices, setCatalogServices] = useState<ServiceAreaService[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [editingService, setEditingService] = useState<Partial<ServiceAreaService> | null>(null);

  useEffect(() => {
    fetchAreas();
  }, []);

  const openServiceCatalog = async (area: ServiceArea) => {
    setCatalogArea(area);
    setCatalogLoading(true);
    try {
      const services = await getServiceAreaServices(area.id, true);
      setCatalogServices(services);
    } catch (e) {
      console.error('Error loading service catalog:', e);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleSaveService = async () => {
    if (!catalogArea || !editingService) return;
    try {
      const saved = await upsertServiceAreaService({
        ...editingService,
        service_area_id: catalogArea.id,
        service_key: editingService.service_key || '',
        service_label: editingService.service_label || '',
        category: editingService.category || 'General',
      } as any);
      setCatalogServices(prev => {
        const existing = prev.findIndex(s => s.id === saved.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = saved;
          return updated;
        }
        return [...prev, saved];
      });
      setEditingService(null);
      await logAdminAction('service_area_service.upsert', 'service_area_services', saved.id, { service_key: saved.service_key, area: catalogArea.zip_code });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Remove this service from this area?')) return;
    try {
      await deleteServiceAreaService(serviceId);
      setCatalogServices(prev => prev.filter(s => s.id !== serviceId));
      await logAdminAction('service_area_service.delete', 'service_area_services', serviceId, { area: catalogArea?.zip_code });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const { data: areasData, error: areasError } = await supabase
        .from('service_areas')
        .select('*')
        .order('state', { ascending: true })
        .order('city_name', { ascending: true })
        .order('zip_code', { ascending: true });

      if (areasError) throw areasError;
      setAreas(areasData || []);

      const { data: providersData, error: providersError } = await supabase
        .from('pro_providers')
        .select('id, name, service_area_zips');

      if (providersError) throw providersError;
      setProviders((providersData || []) as ProProvider[]);

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
      setShowAddModal(false);
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

  // Coverage Analysis Data
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

  const demandZips = new Set(proRequests.map(r => r.zip_code));
  const gapZips = new Set<string>();
  demandZips.forEach(zip => {
    if (!zipProviderMap.has(zip) || zipProviderMap.get(zip)!.length === 0) {
      gapZips.add(zip);
    }
  });

  const wellCoveredZips = areas.filter(a => {
    const count = zipProviderMap.get(a.zip_code)?.length || 0;
    return count >= 3;
  });
  const coveredZips = areas.filter(a => {
    const count = zipProviderMap.get(a.zip_code)?.length || 0;
    return count >= 1 && count < 3;
  });
  const uncoveredZips = areas.filter(a => {
    const count = zipProviderMap.get(a.zip_code)?.length || 0;
    return count === 0;
  });

  const totalZips = areas.length;
  const activeCount = areas.filter(a => a.is_active).length;
  const statesCount = new Set(areas.map(a => a.state)).size;
  const uncoveredDemandCount = gapZips.size;
  const totalProviders = providers.length;

  const groupedByState: Record<string, Record<string, ServiceArea[]>> = {};
  areas.forEach(area => {
    if (!groupedByState[area.state]) {
      groupedByState[area.state] = {};
    }
    const cityKey = area.city_name || 'Unassigned';
    if (!groupedByState[area.state][cityKey]) {
      groupedByState[area.state][cityKey] = [];
    }
    groupedByState[area.state][cityKey].push(area);
  });

  const toggleStateExpanded = (state: string) => {
    const newSet = new Set(expandedStates);
    if (newSet.has(state)) {
      newSet.delete(state);
    } else {
      newSet.add(state);
    }
    setExpandedStates(newSet);
  };

  const providerCoverageList = providers
    .map(p => ({
      name: p.name,
      count: p.service_area_zips?.length || 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1>Service Areas</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: Colors.medGray }}>
            Manage where Pro services are available by 5-digit ZIP code.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add ZIP Code
        </button>
      </div>

      {/* KPI Grid */}
      <div className="admin-kpi-grid" style={{ marginBottom: 24 }}>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Total ZIPs</p>
          <p className="admin-kpi-value" style={{ color: Colors.copper }}>{totalZips}</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Active</p>
          <p className="admin-kpi-value" style={{ color: Colors.sage }}>{activeCount}</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">States Covered</p>
          <p className="admin-kpi-value" style={{ color: Colors.charcoal }}>{statesCount}</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Uncovered Demand ZIPs</p>
          <p className="admin-kpi-value" style={{ color: Colors.error }}>{uncoveredDemandCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 24 }}>
        <button
          className={`admin-tab ${activeTab === 'by-state' ? 'active' : ''}`}
          onClick={() => setActiveTab('by-state')}
        >
          By State
        </button>
        <button
          className={`admin-tab ${activeTab === 'coverage' ? 'active' : ''}`}
          onClick={() => setActiveTab('coverage')}
        >
          Coverage Analysis
        </button>
      </div>

      {/* By State Tab */}
      {activeTab === 'by-state' && (
        <div>
          {loading ? (
            <div className="admin-empty" style={{ textAlign: 'center', padding: 40 }}>
              <p>Loading service areas...</p>
            </div>
          ) : Object.keys(groupedByState).length === 0 ? (
            <div className="admin-empty" style={{ textAlign: 'center', padding: 40 }}>
              <p>No service areas configured. Add your first ZIP code above.</p>
            </div>
          ) : (
            Object.entries(groupedByState)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([state, cities]) => (
                <div key={state} className="admin-section" style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      padding: '12px 16px',
                      background: Colors.cream,
                      borderRadius: '8px 8px 0 0',
                      borderBottom: '1px solid var(--border-color)',
                    }}
                    onClick={() => toggleStateExpanded(state)}
                  >
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                        {state}
                        <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 400, color: Colors.medGray }}>
                          {Object.values(cities).flat().length} ZIPs
                        </span>
                      </h3>
                    </div>
                    <span style={{ color: Colors.medGray }}>
                      {expandedStates.has(state) ? '▼' : '▶'}
                    </span>
                  </div>

                  {expandedStates.has(state) && (
                    <div style={{ padding: '12px 16px' }}>
                      {Object.entries(cities)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([city, cityAreas]) => (
                          <div key={city} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <p style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: Colors.medGray,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                margin: 0,
                              }}>
                                {city}
                              </p>
                              <button
                                onClick={() => openServiceCatalog(cityAreas[0])}
                                style={{
                                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                  background: Colors.sage + '15', color: Colors.sage,
                                  border: `1px solid ${Colors.sage}30`, cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                                title="Manage service catalog for this area"
                              >
                                Services ({cityAreas.length} zips)
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {cityAreas.map(area => (
                                <div
                                  key={area.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    fontFamily: 'monospace',
                                    background: area.is_active ? `${Colors.sage}15` : '#f5f5f5',
                                    color: area.is_active ? Colors.charcoal : Colors.silver,
                                    border: `1px solid ${area.is_active ? Colors.sage : Colors.lightGray}`,
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
                        ))}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* Coverage Analysis Tab */}
      {activeTab === 'coverage' && (
        <div className="admin-chart-container" style={{ marginBottom: 24 }}>
          <div className="admin-chart-header">
            <h3>Provider Coverage Distribution</h3>
          </div>

          {providerCoverageList.map(provider => {
            const percentage = totalZips > 0 ? (provider.count / totalZips) * 100 : 0;
            return (
              <div key={provider.name} className="admin-chart-bar-row" style={{ marginBottom: 12 }}>
                <div className="admin-chart-bar-label">{provider.name}</div>
                <div className="admin-chart-bar" style={{ flex: 1, minWidth: 200, marginLeft: 12 }}>
                  <div
                    className="admin-chart-bar-fill"
                    style={{
                      width: `${percentage}%`,
                      background: Colors.sage,
                    }}
                  />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, marginLeft: 12, minWidth: 60, textAlign: 'right' }}>
                  {provider.count} / {totalZips}
                </div>
              </div>
            );
          })}

          {/* Coverage Status Breakdown */}
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid var(--border-color)` }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px 0' }}>Coverage Levels</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Well Covered (3+)
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>
                  {wellCoveredZips.length}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.copperMuted, borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Covered (1-2)
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>
                  {coveredZips.length}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.error + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 12, color: Colors.error, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Uncovered (0)
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.error, margin: 0 }}>
                  {uncoveredZips.length}
                </p>
              </div>
            </div>
          </div>

          {/* Coverage Gaps Alert */}
          {gapZips.size > 0 && (
            <div style={{
              marginTop: 16,
              padding: 12,
              background: Colors.error + '15',
              borderLeft: `3px solid ${Colors.error}`,
              borderRadius: 6,
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: Colors.error, margin: '0 0 8px 0' }}>
                Critical Coverage Gaps
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Array.from(gapZips).sort().map(zip => (
                  <span key={zip} style={{
                    padding: '2px 8px',
                    borderRadius: 3,
                    background: Colors.error,
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                  }}>
                    {zip}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 24,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                Add ZIP Code{bulkMode ? 's' : ''}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: Colors.silver,
                }}
              >
                ×
              </button>
            </div>

            {message && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 6,
                background: messageColors(getMessageVariant(message)).bg,
                color: messageColors(getMessageVariant(message)).fg,
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
                Bulk Import
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
              <div className="form-group" style={{ marginBottom: 12 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>City Name (applied to all)</label>
                <input
                  className="form-input"
                  placeholder="e.g., Tulsa"
                  value={newCityName}
                  onChange={e => setNewCityName(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={bulkMode ? handleAddBulk : handleAddSingle}
                disabled={saving}
                style={{ flex: 1 }}
              >
                {saving ? 'Adding...' : bulkMode ? 'Import ZIPs' : 'Add ZIP'}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowAddModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Catalog Modal */}
      {catalogArea && (
        <div className="modal-overlay" onClick={() => { setCatalogArea(null); setEditingService(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, maxHeight: '85vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>
              Service Catalog — {catalogArea.city_name || catalogArea.zip_code} ({catalogArea.state})
            </h2>
            <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 20 }}>
              Manage which services are available in this area. Services apply to all zip codes in this region.
            </p>

            {catalogLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div className="spinner" />
              </div>
            ) : (
              <>
                {/* Service List */}
                <table className="admin-table" style={{ fontSize: 13, width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Time</th>
                      <th>Active</th>
                      <th style={{ width: 80 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogServices.sort((a, b) => a.sort_order - b.sort_order).map(svc => (
                      <tr key={svc.id}>
                        <td style={{ fontWeight: 500 }}>{svc.service_label}</td>
                        <td>
                          <span style={{
                            fontSize: 11, padding: '2px 6px', borderRadius: 4,
                            background: Colors.sageMuted, color: Colors.sage,
                          }}>
                            {svc.category}
                          </span>
                        </td>
                        <td>{svc.base_price_cents ? `$${(svc.base_price_cents / 100).toFixed(2)}` : 'Free'}</td>
                        <td>{svc.estimated_minutes ? `${svc.estimated_minutes}m` : '—'}</td>
                        <td>
                          <span style={{ color: svc.is_active ? Colors.success : Colors.medGray }}>
                            {svc.is_active ? '●' : '○'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, padding: '2px 6px' }}
                              onClick={() => setEditingService({ ...svc })}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 11, padding: '2px 6px', color: Colors.error }}
                              onClick={() => handleDeleteService(svc.id)}
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {catalogServices.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: Colors.medGray }}>
                          No services configured for this area
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Add/Edit Service Form */}
                {editingService ? (
                  <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: Colors.cream, border: `1px solid ${Colors.lightGray}` }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>
                      {editingService.id ? 'Edit Service' : 'Add Service'}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Service Key</label>
                        <input
                          className="form-input"
                          value={editingService.service_key || ''}
                          onChange={e => setEditingService({ ...editingService, service_key: e.target.value })}
                          placeholder="hvac_inspection"
                          disabled={!!editingService.id}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Display Label</label>
                        <input
                          className="form-input"
                          value={editingService.service_label || ''}
                          onChange={e => setEditingService({ ...editingService, service_label: e.target.value })}
                          placeholder="HVAC Inspection"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Category</label>
                        <input
                          className="form-input"
                          value={editingService.category || ''}
                          onChange={e => setEditingService({ ...editingService, category: e.target.value })}
                          placeholder="HVAC"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Base Price (cents)</label>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          value={editingService.base_price_cents ?? ''}
                          onChange={e => setEditingService({ ...editingService, base_price_cents: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Estimated Minutes</label>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          value={editingService.estimated_minutes ?? ''}
                          onChange={e => setEditingService({ ...editingService, estimated_minutes: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Sort Order</label>
                        <input
                          className="form-input"
                          type="number"
                          value={editingService.sort_order ?? 0}
                          onChange={e => setEditingService({ ...editingService, sort_order: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={editingService.is_active !== false}
                          onChange={e => setEditingService({ ...editingService, is_active: e.target.checked })}
                        />
                        Active
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <input
                          type="checkbox"
                          checked={editingService.requires_pro_plus || false}
                          onChange={e => setEditingService({ ...editingService, requires_pro_plus: e.target.checked })}
                        />
                        Requires Pro+
                      </label>
                      <div style={{ flex: 1 }} />
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingService(null)}>Cancel</button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveService}
                        disabled={!editingService.service_key || !editingService.service_label}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: 12 }}
                    onClick={() => setEditingService({
                      service_key: '', service_label: '', category: 'General',
                      is_active: true, base_price_cents: 0, estimated_minutes: 30,
                      sort_order: (catalogServices.length + 1) * 10,
                      requires_pro_plus: false,
                    })}
                  >
                    + Add Service
                  </button>
                )}
              </>
            )}

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => { setCatalogArea(null); setEditingService(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
