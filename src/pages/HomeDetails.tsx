import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { upsertHome } from '@/services/supabase';
import { Colors } from '@/constants/theme';

export default function HomeDetails() {
  const navigate = useNavigate();
  const { user, home, setHome } = useStore();
  const [editing, setEditing] = useState(!home);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    address: home?.address || '', city: home?.city || '', state: home?.state || '', zip_code: home?.zip_code || '',
    year_built: home?.year_built?.toString() || '', square_footage: home?.square_footage?.toString() || '',
    stories: home?.stories?.toString() || '1', bedrooms: home?.bedrooms?.toString() || '3', bathrooms: home?.bathrooms?.toString() || '2',
    garage_spaces: home?.garage_spaces?.toString() || '2',
    roof_type: home?.roof_type || '', roof_age_years: home?.roof_age_years?.toString() || '',
    heating_type: home?.heating_type || '', cooling_type: home?.cooling_type || '',
    has_pool: home?.has_pool || false, has_deck: home?.has_deck || false, has_sprinkler_system: home?.has_sprinkler_system || false,
    has_fireplace: home?.has_fireplace || false,
    lawn_type: home?.lawn_type || 'none',
  });

  const handleSave = async () => {
    if (!user || !form.address) return;
    setSaving(true);
    try {
      const homeData: any = {
        id: home?.id || crypto.randomUUID(),
        user_id: user.id,
        ...form,
        year_built: form.year_built ? parseInt(form.year_built) : null,
        square_footage: form.square_footage ? parseInt(form.square_footage) : null,
        stories: parseInt(form.stories) || 1,
        bedrooms: parseInt(form.bedrooms) || 3,
        bathrooms: parseInt(form.bathrooms) || 2,
        garage_spaces: parseInt(form.garage_spaces) || 0,
        roof_age_years: form.roof_age_years ? parseInt(form.roof_age_years) : null,
        created_at: home?.created_at || new Date().toISOString(),
      };
      try { const saved = await upsertHome(homeData); setHome(saved); } catch { setHome(homeData); }
      setEditing(false);
    } finally { setSaving(false); }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
      <p className="text-xs text-gray" style={{ marginBottom: 4 }}>{label}</p>
      {children}
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate(-1)}>&larr; Back</button>
          <h1>Home Details</h1>
        </div>
        {home && !editing && <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>}
      </div>

      {editing ? (
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>{home ? 'Edit Home' : 'Set Up Your Home'}</h2>
          <div className="form-group"><label>Address *</label><input className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
          <div className="grid-3">
            <div className="form-group"><label>City</label><input className="form-input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
            <div className="form-group"><label>State</label><input className="form-input" value={form.state} onChange={e => setForm({...form, state: e.target.value})} /></div>
            <div className="form-group"><label>Zip</label><input className="form-input" value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label>Year Built</label><input className="form-input" type="number" value={form.year_built} onChange={e => setForm({...form, year_built: e.target.value})} /></div>
            <div className="form-group"><label>Sq Ft</label><input className="form-input" type="number" value={form.square_footage} onChange={e => setForm({...form, square_footage: e.target.value})} /></div>
          </div>
          <div className="grid-4">
            <div className="form-group"><label>Stories</label><input className="form-input" type="number" value={form.stories} onChange={e => setForm({...form, stories: e.target.value})} /></div>
            <div className="form-group"><label>Beds</label><input className="form-input" type="number" value={form.bedrooms} onChange={e => setForm({...form, bedrooms: e.target.value})} /></div>
            <div className="form-group"><label>Baths</label><input className="form-input" type="number" value={form.bathrooms} onChange={e => setForm({...form, bathrooms: e.target.value})} /></div>
            <div className="form-group"><label>Garage</label><input className="form-input" type="number" value={form.garage_spaces} onChange={e => setForm({...form, garage_spaces: e.target.value})} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Roof Type</label>
              <select className="form-select" value={form.roof_type} onChange={e => setForm({...form, roof_type: e.target.value})}>
                <option value="">Select...</option>
                {['asphalt_shingle','metal','tile','slate','flat','wood_shake'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Roof Age (years)</label><input className="form-input" type="number" value={form.roof_age_years} onChange={e => setForm({...form, roof_age_years: e.target.value})} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Heating</label>
              <select className="form-select" value={form.heating_type} onChange={e => setForm({...form, heating_type: e.target.value})}>
                <option value="">Select...</option>
                {['forced_air','heat_pump','radiant','boiler','baseboard'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Cooling</label>
              <select className="form-select" value={form.cooling_type} onChange={e => setForm({...form, cooling_type: e.target.value})}>
                <option value="">Select...</option>
                {['central_ac','heat_pump','window_units','mini_split','none'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Lawn Type</label>
              <select className="form-select" value={form.lawn_type} onChange={e => setForm({...form, lawn_type: e.target.value})}>
                <option value="none">None</option>
                {['bermuda','fescue','zoysia','st_augustine','bluegrass','buffalo','mixed'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label>&nbsp;</label><p className="text-xs text-gray" style={{ padding: '10px 0' }}>Used for seasonal lawn care tasks</p></div>
          </div>
          <div className="grid-2 mt-md">
            {(['has_pool','has_deck','has_sprinkler_system','has_fireplace'] as const).map(key => (
              <label key={key} className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={form[key] as boolean} onChange={e => setForm({...form, [key]: e.target.checked})} />
                <span style={{ fontSize: 14 }}>{key.replace(/has_/,'').replace(/_/g,' ')}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-sm mt-lg">
            {home && <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.address}>{saving ? 'Saving...' : 'Save Home'}</button>
          </div>
        </div>
      ) : home ? (
        <div className="card">
          {home.photo_url && <img src={home.photo_url} alt="Home" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8, marginBottom: 20 }} />}
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>{home.address}</h2>
          <p className="text-sm text-gray mb-lg">{home.city}, {home.state} {home.zip_code}</p>
          <Field label="Year Built"><p style={{ fontWeight: 500 }}>{home.year_built || '—'}</p></Field>
          <Field label="Size"><p style={{ fontWeight: 500 }}>{home.square_footage?.toLocaleString() || '—'} sq ft &middot; {home.stories} stories &middot; {home.bedrooms} bed / {home.bathrooms} bath</p></Field>
          <Field label="Roof"><p style={{ fontWeight: 500 }}>{home.roof_type?.replace(/_/g,' ') || '—'} {home.roof_age_years ? `(${home.roof_age_years} years old)` : ''}</p></Field>
          <Field label="HVAC"><p style={{ fontWeight: 500 }}>{home.heating_type?.replace(/_/g,' ') || '—'} / {home.cooling_type?.replace(/_/g,' ') || '—'}</p></Field>
          {home.lawn_type && home.lawn_type !== 'none' && <Field label="Lawn"><p style={{ fontWeight: 500 }}>{home.lawn_type.replace(/_/g,' ')}</p></Field>}
          <Field label="Features">
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              {home.has_pool && <span className="badge badge-info">Pool</span>}
              {home.has_deck && <span className="badge badge-sage">Deck</span>}
              {home.has_sprinkler_system && <span className="badge badge-success">Sprinklers</span>}
              {home.has_fireplace && <span className="badge badge-warning">Fireplace</span>}
              {!home.has_pool && !home.has_deck && !home.has_sprinkler_system && !home.has_fireplace && <span className="text-sm text-gray">None selected</span>}
            </div>
          </Field>
        </div>
      ) : null}
    </div>
  );
}
