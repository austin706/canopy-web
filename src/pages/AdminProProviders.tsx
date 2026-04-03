import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAllProProviders, createProProvider, updateProProvider, deleteProProvider,
} from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';

const SERVICE_CATEGORIES = [
  'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping', 'Pest Control',
  'Appliance Repair', 'Painting', 'General Handyman', 'Pool/Spa', 'Cleaning',
  'Foundation', 'Garage Door', 'Windows/Doors', 'Flooring', 'Other',
];

const emptyForm = {
  business_name: '', contact_name: '', email: '', phone: '',
  service_categories: [] as string[], service_area_miles: 25,
  service_area_zips: '' as string,
  license_number: '', bio: '', years_experience: 0,
  is_available: true,
};

export default function AdminProProviders() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    getAllProProviders()
      .then(setProviders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const { data, error } = await supabase
        .from('pro_requests')
        .select('id, assigned_provider, status, rating, created_at, completed_at');

      if (error) throw error;

      // Group by provider and compute metrics
      const metricsMap: Record<string, any> = {};

      (data || []).forEach((request: any) => {
        const providerId = request.assigned_provider;
        if (!providerId) return;

        if (!metricsMap[providerId]) {
          metricsMap[providerId] = {
            total: 0,
            completed: 0,
            cancelled: 0,
            active: 0,
            ratings: [],
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

      // Compute completion rates and averages
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

  const handleShowMetrics = async () => {
    if (!showMetrics) {
      await loadMetrics();
    }
    setShowMetrics(!showMetrics);
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
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.business_name || !form.contact_name) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        service_area_zips: form.service_area_zips
          ? form.service_area_zips.split(',').map(z => z.trim()).filter(Boolean)
          : [],
      };
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

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      service_categories: prev.service_categories.includes(cat)
        ? prev.service_categories.filter(c => c !== cat)
        : [...prev.service_categories, cat],
    }));
  };

  const filtered = providers.filter(p =>
    p.business_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    (p.service_categories || []).some((c: string) => c.toLowerCase().includes(search.toLowerCase()))
  );

  // Calculate platform-wide metrics
  const platformMetrics = {
    totalJobs: Object.values(metrics).reduce((sum: number, m: any) => sum + (m.total || 0), 0),
    totalCompleted: Object.values(metrics).reduce((sum: number, m: any) => sum + (m.completed || 0), 0),
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
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
          <h1>Pro Provider Management</h1>
          <p className="subtitle">{providers.length} providers</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={handleShowMetrics}
            disabled={loadingMetrics}
            style={{ color: showMetrics ? Colors.sage : Colors.medGray }}
          >
            {loadingMetrics ? '...' : showMetrics ? '✓ Performance Metrics' : 'Performance Metrics'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Provider</button>
        </div>
      </div>

      <input
        className="form-input mb-lg"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, contact, or service..."
        style={{ maxWidth: 400 }}
      />

      {showMetrics && (
        <div className="card mb-lg" style={{ background: Colors.lightGray, padding: 20, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Platform Performance Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0' }}>Total Jobs Assigned</p>
              <p style={{ fontSize: 24, fontWeight: 600, margin: 0, color: Colors.charcoal }}>{platformMetrics.totalJobs}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0' }}>Platform Completion Rate</p>
              <p style={{
                fontSize: 24, fontWeight: 600, margin: 0,
                color: getRatingColor(parseFloat(platformCompletionRate as string))
              }}>
                {platformCompletionRate}%
              </p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 4px 0' }}>Average Rating</p>
              <p style={{ fontSize: 16, fontWeight: 600, margin: 0, color: Colors.charcoal }}>
                {platformAvgRating ? `${platformAvgRating} ★` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center"><div className="spinner" /></div>
      ) : (
        <div className="card table-container">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Services</th>
                <th>Status</th>
                {showMetrics && (
                  <>
                    <th>Jobs</th>
                    <th>Completion</th>
                    <th>Rating</th>
                  </>
                )}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><span className="fw-600">{p.business_name}</span></td>
                  <td>{p.contact_name || '—'}</td>
                  <td>{p.email || '—'}</td>
                  <td>{p.phone || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(p.service_categories || []).slice(0, 3).map((c: string) => (
                        <span key={c} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: Colors.sageMuted, color: Colors.sage, fontWeight: 600 }}>{c}</span>
                      ))}
                      {(p.service_categories || []).length > 3 && (
                        <span style={{ fontSize: 11, color: Colors.medGray }}>+{p.service_categories.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                      background: p.is_available ? Colors.success + '20' : Colors.error + '20',
                      color: p.is_available ? Colors.success : Colors.error,
                    }}>
                      {p.is_available ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {showMetrics && (
                    <>
                      <td>
                        <span style={{ fontWeight: 600 }}>{metrics[p.id]?.total || 0}</span>
                        <span style={{ fontSize: 11, color: Colors.medGray, marginLeft: 4 }}>
                          ({metrics[p.id]?.active || 0} active)
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 12, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                          background: getRatingColor(metrics[p.id]?.completionRate || 0) + '20',
                          color: getRatingColor(metrics[p.id]?.completionRate || 0),
                        }}>
                          {metrics[p.id] ? `${metrics[p.id].completionRate}%` : '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: Colors.charcoal }}>
                          {metrics[p.id] ? renderStars(parseFloat(metrics[p.id].avgRating || 0)) : '—'}
                        </span>
                      </td>
                    </>
                  )}
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: Colors.error }}
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                      >
                        {deleting === p.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={showMetrics ? 10 : 7} className="text-center text-gray" style={{ padding: 32 }}>No providers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2>{editing ? 'Edit Provider' : 'Add Pro Provider'}</h2>
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
