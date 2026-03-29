import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAllProProviders, createProProvider, updateProProvider, deleteProProvider,
} from '@/services/supabase';
import { Colors } from '@/constants/theme';

const SERVICE_CATEGORIES = [
  'HVAC', 'Plumbing', 'Electrical', 'Roofing', 'Landscaping', 'Pest Control',
  'Appliance Repair', 'Painting', 'General Handyman', 'Pool/Spa', 'Cleaning',
  'Foundation', 'Garage Door', 'Windows/Doors', 'Flooring', 'Other',
];

const emptyForm = {
  business_name: '', contact_name: '', email: '', phone: '',
  service_categories: [] as string[], service_area_miles: 25,
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

  useEffect(() => {
    getAllProProviders()
      .then(setProviders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      if (editing) {
        const updated = await updateProProvider(editing.id, form);
        setProviders(prev => prev.map(p => p.id === editing.id ? updated : p));
      } else {
        const created = await createProProvider({ id: crypto.randomUUID(), ...form, created_at: new Date().toISOString() });
        setProviders(prev => [...prev, created]);
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
      await deleteProProvider(id);
      setProviders(prev => prev.filter(p => p.id !== id));
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

  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
          <h1>Pro Provider Management</h1>
          <p className="subtitle">{providers.length} providers</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Provider</button>
      </div>

      <input
        className="form-input mb-lg"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, contact, or service..."
        style={{ maxWidth: 400 }}
      />

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
                <tr><td colSpan={7} className="text-center text-gray" style={{ padding: 32 }}>No providers found</td></tr>
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
              <label>Service Area (miles)</label>
              <input className="form-input" type="number" min="1" value={form.service_area_miles} onChange={e => setForm({ ...form, service_area_miles: parseInt(e.target.value) || 25 })} style={{ maxWidth: 200 }} />
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
