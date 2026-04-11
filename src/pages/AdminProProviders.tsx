import { useState, useEffect } from 'react';
import {
  getAllProProviders, createProProvider, updateProProvider, deleteProProvider,
} from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { PageSkeleton } from '@/components/Skeleton';
import { logAdminAction } from '@/services/auditLog';

const SERVICE_CATEGORIES = [
  'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping', 'Pest Control',
  'Appliance Repair', 'Painting', 'General Handyman', 'Pool/Spa', 'Cleaning',
  'Foundation', 'Garage Door', 'Windows/Doors', 'Flooring', 'Other',
];

const PROVIDER_TYPES = {
  canopy_technician: { label: 'Canopy Technician', color: '#1a6b4a', bg: '#e6f5ee' },
  partner_pro: { label: 'Partner Pro', color: '#6b4a1a', bg: '#fdf3e6' },
} as const;

const CERTIFICATION_LEVELS = ['trainee', 'standard', 'senior', 'lead'] as const;
const CONTRACT_TYPES = ['per_job', 'retainer', 'hybrid'] as const;
const PAYMENT_TERMS = ['net_15', 'net_30', 'net_45', 'on_completion'] as const;

const emptyForm = {
  business_name: '', contact_name: '', email: '', phone: '',
  service_categories: [] as string[], service_area_miles: 25,
  service_area_zips: '' as string,
  license_number: '', bio: '', years_experience: 0,
  is_available: true,
  provider_type: 'partner_pro' as 'canopy_technician' | 'partner_pro',
  // Technician fields
  employee_id: '', certification_level: 'standard' as string,
  assigned_zones: '' as string, specializations: '' as string,
  max_daily_visits: 6,
  // Partner fields
  commission_rate: 15, contract_type: 'per_job' as string,
  payment_terms: 'net_30' as string,
};

export default function AdminProProviders() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'canopy_technician' | 'partner_pro'>('all');

  useEffect(() => {
    Promise.all([
      getAllProProviders().then(setProviders).catch(() => []),
      loadMetrics(),
    ]).finally(() => setLoading(false));
  }, []);

  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const { data, error } = await supabase
        .from('pro_requests')
        .select('id, assigned_provider, status, rating, created_at, completed_at');

      if (error) throw error;

      const metricsMap: Record<string, any> = {};
      (data || []).forEach((request: any) => {
        const providerId = request.assigned_provider;
        if (!providerId) return;

        if (!metricsMap[providerId]) {
          metricsMap[providerId] = {
            total: 0, completed: 0, cancelled: 0, active: 0, ratings: [],
          };
        }

        metricsMap[providerId].total += 1;
        if (request.status === 'completed') {
          metricsMap[providerId].completed += 1;
        } else if (request.status === 'cancelled') {
          metricsMap[providerId].cancelled += 1;
        } else if (request.status === 'matched' || request.status === 'in_progress') {
          metricsMap[providerId].active += 1;
        }
        if (request.rating) {
          metricsMap[providerId].ratings.push(request.rating);
        }
      });

      const computedMetrics: Record<string, any> = {};
      Object.entries(metricsMap).forEach(([providerId, data]: [string, any]) => {
        const completionRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
        const avgRating = data.ratings.length > 0
          ? (data.ratings.reduce((a: number, b: number) => a + b, 0) / data.ratings.length).toFixed(1)
          : null;

        computedMetrics[providerId] = {
          total: data.total,
          completed: data.completed,
          cancelled: data.cancelled,
          active: data.active,
          completionRate: parseFloat(completionRate.toFixed(1)),
          avgRating,
        };
      });

      setMetrics(computedMetrics);
    } catch (e) {
      console.error('Error loading metrics:', e);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (provider: any) => {
    setEditing(provider);
    setForm({
      business_name: provider.business_name || '',
      contact_name: provider.contact_name || '',
      email: provider.email || '',
      phone: provider.phone || '',
      service_categories: provider.service_categories || [],
      service_area_miles: provider.service_area_miles || 25,
      service_area_zips: (provider.service_area_zips || []).join(', '),
      license_number: provider.license_number || '',
      bio: provider.bio || '',
      years_experience: provider.years_experience || 0,
      is_available: provider.is_available !== false,
      provider_type: provider.provider_type || 'partner_pro',
      employee_id: provider.employee_id || '',
      certification_level: provider.certification_level || 'standard',
      assigned_zones: (provider.assigned_zones || []).join(', '),
      specializations: (provider.specializations || []).join(', '),
      max_daily_visits: provider.max_daily_visits || 6,
      commission_rate: provider.commission_rate || 15,
      contract_type: provider.contract_type || 'per_job',
      payment_terms: provider.payment_terms || 'net_30',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.business_name || !form.contact_name) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        business_name: form.business_name,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
        service_categories: form.service_categories,
        service_area_miles: form.service_area_miles,
        service_area_zips: form.service_area_zips
          ? form.service_area_zips.split(',').map(z => z.trim()).filter(Boolean)
          : [],
        license_number: form.license_number,
        bio: form.bio,
        years_experience: form.years_experience,
        is_available: form.is_available,
        provider_type: form.provider_type,
      };
      // Add type-specific fields
      if (form.provider_type === 'canopy_technician') {
        payload.employee_id = form.employee_id || null;
        payload.certification_level = form.certification_level;
        payload.assigned_zones = form.assigned_zones
          ? form.assigned_zones.split(',').map(z => z.trim()).filter(Boolean)
          : [];
        payload.specializations = form.specializations
          ? form.specializations.split(',').map(s => s.trim()).filter(Boolean)
          : [];
        payload.max_daily_visits = form.max_daily_visits;
      } else {
        payload.commission_rate = form.commission_rate;
        payload.contract_type = form.contract_type;
        payload.payment_terms = form.payment_terms;
      }
      if (editing) {
        const updated = await updateProProvider(editing.id, payload);
        setProviders(prev => prev.map(p => p.id === editing.id ? updated : p));
        await logAdminAction('provider.update', 'pro_provider', editing.id, { business_name: form.business_name });
      } else {
        const id = crypto.randomUUID();
        const created = await createProProvider({ id, ...payload, created_at: new Date().toISOString() });
        setProviders(prev => [...prev, created]);
        await logAdminAction('provider.create', 'pro_provider', id, { business_name: form.business_name });
      }
      setShowModal(false);
      setForm({ ...emptyForm });
      setEditing(null);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pro provider? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const provider = providers.find(p => p.id === id);
      await deleteProProvider(id);
      setProviders(prev => prev.filter(p => p.id !== id));
      await logAdminAction('provider.delete', 'pro_provider', id, { business_name: provider?.business_name });
    } catch (e: any) { alert(e.message); }
    finally { setDeleting(null); }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      const provider = providers.find(p => p.id === id);
      const updated = await updateProProvider(id, { is_available: !currentStatus });
      setProviders(prev => prev.map(p => p.id === id ? updated : p));
      await logAdminAction('provider.toggle_availability', 'pro_provider', id, { business_name: provider?.business_name, is_available: !currentStatus });
    } catch (e: any) { alert(e.message); }
  };

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      service_categories: prev.service_categories.includes(cat)
        ? prev.service_categories.filter(c => c !== cat)
        : [...prev.service_categories, cat],
    }));
  };

  const filtered = providers.filter(p => {
    const matchesSearch = !search ||
      p.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      (p.service_categories || []).some((c: string) => c.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || p.provider_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const platformMetrics = {
    totalJobs: Object.values(metrics).reduce((sum: number, m: any) => sum + (m.total || 0), 0),
    totalCompleted: Object.values(metrics).reduce((sum: number, m: any) => sum + (m.completed || 0), 0),
    availableProviders: providers.filter(p => p.is_available).length,
    allRatings: Object.values(metrics).reduce((acc: any[], m: any) => acc.concat(m.ratings || []), []),
  };
  const platformCompletionRate = platformMetrics.totalJobs > 0
    ? ((platformMetrics.totalCompleted / platformMetrics.totalJobs) * 100).toFixed(1)
    : 0;
  const platformAvgRating = platformMetrics.allRatings.length > 0
    ? (platformMetrics.allRatings.reduce((a, b) => a + b, 0) / platformMetrics.allRatings.length).toFixed(1)
    : null;

  const getRatingColor = (rate: number) => {
    if (rate >= 80) return Colors.success;
    if (rate >= 50) return Colors.warning;
    return Colors.error;
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return 'N/A';
    const fullStars = Math.floor(rating);
    return '★'.repeat(fullStars) + (rating % 1 >= 0.5 ? '½' : '') + '☆'.repeat(5 - Math.ceil(rating));
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 28, fontWeight: 700 }}>Pro Providers</h1>
          <p style={{ margin: 0, fontSize: 14, color: Colors.medGray }}>{providers.length} total providers</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Provider</button>
      </div>

      {/* KPI Grid */}
      {!loading && (
        <div className="admin-kpi-grid" style={{ marginBottom: 32 }}>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Total Providers</p>
            <p className="admin-kpi-value">{providers.length}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Canopy Technicians</p>
            <p className="admin-kpi-value" style={{ color: PROVIDER_TYPES.canopy_technician.color }}>
              {providers.filter(p => p.provider_type === 'canopy_technician').length}
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Partner Pros</p>
            <p className="admin-kpi-value" style={{ color: PROVIDER_TYPES.partner_pro.color }}>
              {providers.filter(p => p.provider_type === 'partner_pro').length}
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Available</p>
            <p className="admin-kpi-value" style={{ color: Colors.success }}>{platformMetrics.availableProviders}</p>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Avg Completion Rate</p>
            <p className="admin-kpi-value" style={{ color: getRatingColor(parseFloat(platformCompletionRate as string)) }}>
              {platformCompletionRate}%
            </p>
          </div>
          <div className="admin-kpi-card">
            <p className="admin-kpi-label">Total Jobs</p>
            <p className="admin-kpi-value">{platformMetrics.totalJobs}</p>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      {!loading && (
        <div className="admin-table-toolbar" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="admin-search"
            placeholder="Search by business name, contact, or service..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'canopy_technician', 'partner_pro'] as const).map(type => (
              <button
                key={type}
                className="btn btn-sm"
                onClick={() => setTypeFilter(type)}
                style={{
                  fontSize: 12, padding: '4px 12px', borderRadius: 6,
                  background: typeFilter === type ? Colors.sage : 'transparent',
                  color: typeFilter === type ? '#fff' : Colors.medGray,
                  border: `1px solid ${typeFilter === type ? Colors.sage : Colors.lightGray}`,
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                {type === 'all' ? 'All' : PROVIDER_TYPES[type].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="page-wide"><PageSkeleton rows={6} /></div>
      ) : (
        <div className="admin-card-grid">
          {filtered.map(p => {
            const m = metrics[p.id];
            const completionRate = m?.completionRate || 0;
            return (
              <div key={p.id} className="admin-provider-card" style={{
                border: `1px solid ${Colors.lightGray}`,
                borderRadius: 8,
                padding: 20,
                background: '#fff',
              }}>
                {/* Header with type badge and availability dot */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: Colors.charcoal }}>
                        {p.business_name}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                        background: PROVIDER_TYPES[p.provider_type as keyof typeof PROVIDER_TYPES]?.bg || PROVIDER_TYPES.partner_pro.bg,
                        color: PROVIDER_TYPES[p.provider_type as keyof typeof PROVIDER_TYPES]?.color || PROVIDER_TYPES.partner_pro.color,
                      }}>
                        {PROVIDER_TYPES[p.provider_type as keyof typeof PROVIDER_TYPES]?.label || 'Partner Pro'}
                      </span>
                      {p.provider_type === 'canopy_technician' && p.certification_level && (
                        <span style={{ fontSize: 10, color: Colors.medGray, fontWeight: 500 }}>
                          {p.certification_level.charAt(0).toUpperCase() + p.certification_level.slice(1)}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>
                      {p.contact_name}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: Colors.medGray }}>
                      {p.email} &middot; {p.phone}
                    </p>
                    {p.provider_type === 'canopy_technician' && p.employee_id && (
                      <p style={{ margin: '2px 0 0 0', fontSize: 11, color: Colors.medGray }}>
                        Employee ID: {p.employee_id}
                      </p>
                    )}
                    {p.provider_type === 'partner_pro' && p.commission_rate && (
                      <p style={{ margin: '2px 0 0 0', fontSize: 11, color: Colors.medGray }}>
                        {p.commission_rate}% commission &middot; {(p.payment_terms || 'net_30').replace('_', ' ')}
                      </p>
                    )}
                  </div>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: p.is_available ? Colors.success : Colors.medGray,
                    flexShrink: 0,
                  }} />
                </div>

                {/* Service Categories */}
                {(p.service_categories || []).length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(p.service_categories || []).slice(0, 4).map((c: string) => (
                        <span key={c} style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                          background: Colors.sageMuted, color: Colors.sage, fontWeight: 600
                        }}>
                          {c}
                        </span>
                      ))}
                      {(p.service_categories || []).length > 4 && (
                        <span style={{ fontSize: 11, color: Colors.medGray, alignSelf: 'center' }}>
                          +{p.service_categories.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Performance Metrics */}
                {showMetrics && m && (
                  <div style={{
                    padding: 12, borderRadius: 6, background: Colors.cream, marginBottom: 16,
                    fontSize: 12, color: Colors.charcoal,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <p style={{ margin: '0 0 4px 0', color: Colors.medGray, fontSize: 11 }}>Completion</p>
                        <p style={{ margin: 0, fontWeight: 700, color: getRatingColor(completionRate) }}>
                          {completionRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 4px 0', color: Colors.medGray, fontSize: 11 }}>Rating</p>
                        <p style={{ margin: 0, fontWeight: 600 }}>
                          {m.avgRating ? `${m.avgRating} ★` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 4px 0', color: Colors.medGray, fontSize: 11 }}>Total Jobs</p>
                        <p style={{ margin: 0, fontWeight: 600 }}>{m.total}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 4px 0', color: Colors.medGray, fontSize: 11 }}>Active</p>
                        <p style={{ margin: 0, fontWeight: 600 }}>{m.active}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)} style={{ flex: 1 }}>
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{
                      color: p.is_available ? Colors.warning : Colors.success,
                      flex: 1,
                    }}
                    onClick={() => toggleAvailability(p.id, p.is_available)}
                  >
                    {p.is_available ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: Colors.error, flex: 1 }}
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                  >
                    {deleting === p.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="admin-empty" style={{ gridColumn: '1 / -1' }}>
              <p>No providers found</p>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ marginTop: 0 }}>{editing ? 'Edit Pro Provider' : 'Add Pro Provider'}</h2>

            {/* Provider Type Selector */}
            <div className="form-group">
              <label>Provider Type *</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {(['canopy_technician', 'partner_pro'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, provider_type: type })}
                    style={{
                      flex: 1, padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${form.provider_type === type ? PROVIDER_TYPES[type].color : Colors.lightGray}`,
                      background: form.provider_type === type ? PROVIDER_TYPES[type].bg : '#fff',
                      color: form.provider_type === type ? PROVIDER_TYPES[type].color : Colors.medGray,
                      fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
                    }}
                  >
                    {PROVIDER_TYPES[type].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Business Name *</label>
              <input className="form-input" value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Contact Name *</label>
              <input className="form-input" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>License Number</label>
                <input className="form-input" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Years Experience</label>
                <input className="form-input" type="number" min="0" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="form-group">
              <label>Service Area Zip Codes</label>
              <input className="form-input" value={form.service_area_zips} onChange={e => setForm({ ...form, service_area_zips: e.target.value })} placeholder="74101, 74103, 74105..." />
              <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 4 }}>Comma-separated zip codes this provider services</p>
            </div>
            <div className="form-group">
              <label>Service Categories</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {SERVICE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    style={{
                      fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid',
                      cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
                      background: form.service_categories.includes(cat) ? Colors.sage : 'transparent',
                      color: form.service_categories.includes(cat) ? '#fff' : Colors.medGray,
                      borderColor: form.service_categories.includes(cat) ? Colors.sage : Colors.lightGray,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea className="form-input" rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Short bio about this provider..." />
            </div>

            {/* Technician-specific fields */}
            {form.provider_type === 'canopy_technician' && (
              <div style={{ padding: 16, borderRadius: 8, background: PROVIDER_TYPES.canopy_technician.bg, marginBottom: 16 }}>
                <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: PROVIDER_TYPES.canopy_technician.color }}>
                  Canopy Technician Details
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Employee ID</label>
                    <input className="form-input" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} placeholder="CT-001" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Certification Level</label>
                    <select className="form-input" value={form.certification_level} onChange={e => setForm({ ...form, certification_level: e.target.value })}>
                      {CERTIFICATION_LEVELS.map(l => (
                        <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ margin: '12px 0 0 0' }}>
                  <label>Max Daily Visits</label>
                  <input className="form-input" type="number" min="1" max="20" value={form.max_daily_visits} onChange={e => setForm({ ...form, max_daily_visits: parseInt(e.target.value) || 6 })} />
                </div>
                <div className="form-group" style={{ margin: '12px 0 0 0' }}>
                  <label>Assigned Zones</label>
                  <input className="form-input" value={form.assigned_zones} onChange={e => setForm({ ...form, assigned_zones: e.target.value })} placeholder="Zone A, Zone B..." />
                  <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 4 }}>Comma-separated zone names</p>
                </div>
                <div className="form-group" style={{ margin: '12px 0 0 0' }}>
                  <label>Specializations</label>
                  <input className="form-input" value={form.specializations} onChange={e => setForm({ ...form, specializations: e.target.value })} placeholder="HVAC inspection, Water heater..." />
                  <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 4 }}>Comma-separated specializations</p>
                </div>
              </div>
            )}

            {/* Partner Pro-specific fields */}
            {form.provider_type === 'partner_pro' && (
              <div style={{ padding: 16, borderRadius: 8, background: PROVIDER_TYPES.partner_pro.bg, marginBottom: 16 }}>
                <p style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, color: PROVIDER_TYPES.partner_pro.color }}>
                  Partner Pro Details
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Commission Rate (%)</label>
                    <input className="form-input" type="number" min="0" max="100" step="0.5" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 15 })} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Contract Type</label>
                    <select className="form-input" value={form.contract_type} onChange={e => setForm({ ...form, contract_type: e.target.value })}>
                      {CONTRACT_TYPES.map(t => (
                        <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Payment Terms</label>
                    <select className="form-input" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}>
                      {PAYMENT_TERMS.map(t => (
                        <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="is_available" checked={form.is_available} onChange={e => setForm({ ...form, is_available: e.target.checked })} />
              <label htmlFor="is_available" style={{ margin: 0 }}>Available for jobs</label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); setEditing(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.business_name || !form.contact_name}>
                {saving ? 'Saving...' : editing ? 'Update Provider' : 'Add Provider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
