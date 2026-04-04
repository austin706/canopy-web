import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { upsertHome, updateProfile, uploadPhoto } from '@/services/supabase';
import { Colors } from '@/constants/theme';

export default function HomeDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, home, setHome } = useStore();
  const [editing, setEditing] = useState(!home || searchParams.get('edit') === 'emergency');
  const emergencySectionRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    address: home?.address || '', city: home?.city || '', state: home?.state || '', zip_code: home?.zip_code || '',
    year_built: home?.year_built?.toString() || '', square_footage: home?.square_footage?.toString() || '',
    stories: home?.stories?.toString() || '1', bedrooms: home?.bedrooms?.toString() || '3', bathrooms: home?.bathrooms?.toString() || '2',
    garage_spaces: home?.garage_spaces?.toString() || '2',
    roof_type: home?.roof_type || '', roof_age_years: home?.roof_age_years?.toString() || '',
    heating_type: home?.heating_type || '', cooling_type: home?.cooling_type || '',
    has_pool: home?.has_pool || false, has_deck: home?.has_deck || false, has_sprinkler_system: home?.has_sprinkler_system || false,
    has_fireplace: home?.has_fireplace || false,
    fireplace_type: home?.fireplace_type || '',
    has_gutters: home?.has_gutters ?? true,
    has_fire_extinguisher: home?.has_fire_extinguisher || false,
    has_water_softener: home?.has_water_softener || false,
    has_sump_pump: home?.has_sump_pump || false,
    has_storm_shelter: home?.has_storm_shelter || false,
    countertop_type: home?.countertop_type || '',
    fireplace_count: home?.fireplace_count?.toString() || '1',
    lawn_type: home?.lawn_type || 'none',
    number_of_hvac_filters: home?.number_of_hvac_filters?.toString() || '',
    hvac_filter_size: home?.hvac_filter_size || '',
    hvac_return_location: home?.hvac_return_location || '',
    // Infrastructure locations
    main_breaker_location: home?.main_breaker_location || '',
    sub_panel_locations: home?.sub_panel_locations || '',
    water_shutoff_location: home?.water_shutoff_location || '',
    gas_meter_location: home?.gas_meter_location || '',
    water_meter_location: home?.water_meter_location || '',
    hose_bib_locations: home?.hose_bib_locations || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-scroll to emergency/infrastructure section if linked from Dashboard
  useEffect(() => {
    if (searchParams.get('edit') === 'emergency' && emergencySectionRef.current) {
      setTimeout(() => emergencySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
  }, [editing]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const currentYear = new Date().getFullYear();

    if (!form.zip_code.trim()) {
      newErrors.zip_code = 'ZIP code is required';
    } else if (!/^\d{5}$/.test(form.zip_code.trim())) {
      newErrors.zip_code = 'ZIP code must be 5 digits';
    }

    if (form.year_built) {
      const year = parseInt(form.year_built);
      if (isNaN(year) || year < 1800 || year > currentYear) {
        newErrors.year_built = `Year built must be between 1800 and ${currentYear}`;
      }
    }

    if (form.square_footage) {
      const sqft = parseFloat(form.square_footage);
      if (isNaN(sqft) || sqft <= 0) {
        newErrors.square_footage = 'Square footage must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!user || !form.address) return;
    if (!validateForm()) return;
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
        number_of_hvac_filters: form.number_of_hvac_filters ? parseInt(form.number_of_hvac_filters) : null,
        hvac_filter_size: form.hvac_filter_size || null,
        hvac_return_location: form.hvac_return_location || null,
        fireplace_type: form.has_fireplace && form.fireplace_type ? form.fireplace_type : null,
        has_gutters: form.has_gutters,
        has_fire_extinguisher: form.has_fire_extinguisher,
        has_water_softener: form.has_water_softener,
        has_sump_pump: form.has_sump_pump,
        has_storm_shelter: form.has_storm_shelter,
        countertop_type: form.countertop_type || null,
        fireplace_count: form.has_fireplace ? (parseInt(form.fireplace_count) || 1) : null,
        created_at: home?.created_at || new Date().toISOString(),
      };
      try { const saved = await upsertHome(homeData); setHome(saved); } catch { setHome(homeData); }
      // Mark onboarding complete on first home save
      if (!home && user) {
        try { await updateProfile(user.id, { onboarding_complete: true }); } catch {}
      }
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !home) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `homes/${home.id}/photo.${ext}`;
      const url = await uploadPhoto('photos', path, file);
      const updated = { ...home, photo_url: url };
      await upsertHome(updated);
      setHome(updated);
    } catch (err) {
      console.error('Photo upload failed:', err);
      alert('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
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
            <div className="form-group">
              <label>Zip</label>
              <input className="form-input" value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} />
              {errors.zip_code && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 4 }}>{errors.zip_code}</p>}
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Year Built</label>
              <input className="form-input" type="number" value={form.year_built} onChange={e => setForm({...form, year_built: e.target.value})} />
              {errors.year_built && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 4 }}>{errors.year_built}</p>}
            </div>
            <div className="form-group">
              <label>Sq Ft</label>
              <input className="form-input" type="number" value={form.square_footage} onChange={e => setForm({...form, square_footage: e.target.value})} />
              {errors.square_footage && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 4 }}>{errors.square_footage}</p>}
            </div>
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
              <select className="form-select" value={form.lawn_type} onChange={e => setForm({...form, lawn_type: e.target.value as string})}>
                <option value="none">None</option>
                {['bermuda','fescue','zoysia','st_augustine','bluegrass','buffalo','mixed'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label>&nbsp;</label><p className="text-xs text-gray" style={{ padding: '10px 0' }}>Used for seasonal lawn care tasks</p></div>
          </div>
          <div className="grid-2 mt-md">
            {(['has_pool','has_deck','has_sprinkler_system','has_fireplace','has_gutters','has_fire_extinguisher','has_water_softener','has_sump_pump','has_storm_shelter'] as const).map(key => (
              <label key={key} className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={form[key] as boolean} onChange={e => setForm({...form, [key]: e.target.checked})} />
                <span style={{ fontSize: 14 }}>{key.replace(/has_/,'').replace(/_/g,' ')}</span>
              </label>
            ))}
          </div>
          {/* Fireplace Type and Count - shown when has_fireplace is checked */}
          {form.has_fireplace && (
            <>
              <div className="form-group mt-md">
                <label>Fireplace Type</label>
                <select className="form-select" value={form.fireplace_type} onChange={e => setForm({...form, fireplace_type: e.target.value})}>
                  <option value="">Select type...</option>
                  <option value="wood_burning">Wood Burning</option>
                  <option value="gas_starter">Gas Starter</option>
                  <option value="gas">Gas</option>
                </select>
              </div>
              <div className="form-group">
                <label>Number of Fireplaces</label>
                <input className="form-input" type="number" min="1" value={form.fireplace_count} onChange={e => setForm({...form, fireplace_count: e.target.value})} placeholder="1" />
              </div>
            </>
          )}

          {/* Countertop Type */}
          <div className="form-group mt-md">
            <label>Countertop Type</label>
            <select className="form-select" value={form.countertop_type} onChange={e => setForm({...form, countertop_type: e.target.value})}>
              <option value="">Select...</option>
              {['granite','marble','quartz','butcher_block','laminate','tile','concrete','stainless_steel'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
            </select>
          </div>

          {/* HVAC Filters */}
          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>HVAC Filters</h3>
          <div className="grid-3">
            <div className="form-group">
              <label>Number of Filters</label>
              <input className="form-input" type="number" min="0" value={form.number_of_hvac_filters} onChange={e => setForm({...form, number_of_hvac_filters: e.target.value})} placeholder="e.g., 3" />
            </div>
            <div className="form-group">
              <label>Filter Size</label>
              <input className="form-input" value={form.hvac_filter_size} onChange={e => setForm({...form, hvac_filter_size: e.target.value})} placeholder="e.g., 20x25x1" />
            </div>
            <div className="form-group">
              <label>Return Location</label>
              <select className="form-select" value={form.hvac_return_location} onChange={e => setForm({...form, hvac_return_location: e.target.value})}>
                <option value="">Select...</option>
                <option value="ceiling">Ceiling</option>
                <option value="wall">Wall</option>
                <option value="floor">Floor</option>
                <option value="furnace">At Furnace</option>
                <option value="multiple">Multiple Locations</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray" style={{ marginTop: -8, marginBottom: 8 }}>Helps track filter replacement tasks and sizes to order</p>

          {/* Infrastructure Locations */}
          <div ref={emergencySectionRef} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Infrastructure Locations</h3>
          <p className="text-xs text-gray" style={{ marginBottom: 12 }}>Know where your key systems are in an emergency.</p>
          <div className="grid-2">
            <div className="form-group">
              <label>Main Breaker</label>
              <input className="form-input" value={form.main_breaker_location} onChange={e => setForm({...form, main_breaker_location: e.target.value})} placeholder="e.g., Garage wall, left side" />
            </div>
            <div className="form-group">
              <label>Sub Panels</label>
              <input className="form-input" value={form.sub_panel_locations} onChange={e => setForm({...form, sub_panel_locations: e.target.value})} placeholder="e.g., Master closet, basement" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Water Shutoff</label>
              <input className="form-input" value={form.water_shutoff_location} onChange={e => setForm({...form, water_shutoff_location: e.target.value})} placeholder="e.g., Front yard, near sidewalk" />
            </div>
            <div className="form-group">
              <label>Gas Meter</label>
              <input className="form-input" value={form.gas_meter_location} onChange={e => setForm({...form, gas_meter_location: e.target.value})} placeholder="e.g., Right side of house" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Water Meter</label>
              <input className="form-input" value={form.water_meter_location} onChange={e => setForm({...form, water_meter_location: e.target.value})} placeholder="e.g., Front yard, curb" />
            </div>
            <div className="form-group">
              <label>Hose Bib Locations</label>
              <input className="form-input" value={form.hose_bib_locations} onChange={e => setForm({...form, hose_bib_locations: e.target.value})} placeholder="e.g., Front, back, garage side" />
            </div>
          </div>

          <div className="flex gap-sm mt-lg">
            {home && <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.address}>{saving ? 'Saving...' : 'Save Home'}</button>
          </div>
        </div>
      ) : home ? (
        <div className="card">
          {/* Home Photo with upload */}
          <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          {home.photo_url ? (
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <img src={home.photo_url} alt="Home" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 8 }} />
              <button
                className="btn btn-secondary btn-sm"
                style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(255,255,255,0.9)' }}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? 'Uploading...' : 'Change Photo'}
              </button>
            </div>
          ) : (
            <div
              style={{ textAlign: 'center', padding: 32, border: '2px dashed var(--light-gray)', borderRadius: 8, marginBottom: 20, cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <p style={{ fontWeight: 600, color: 'var(--color-copper)', marginBottom: 4 }}>{uploadingPhoto ? 'Uploading...' : 'Add a photo of your home'}</p>
              <p className="text-xs text-gray">Click to upload a photo</p>
            </div>
          )}
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
              {home.has_fireplace && <span className="badge badge-warning">Fireplace{home.fireplace_type ? ` (${home.fireplace_type.replace(/_/g, ' ')})` : ''}{home.fireplace_count ? ` x${home.fireplace_count}` : ''}</span>}
              {home.has_gutters && <span className="badge badge-info">Gutters</span>}
              {home.has_fire_extinguisher && <span className="badge badge-warning">Fire Extinguisher</span>}
              {home.has_water_softener && <span className="badge badge-sage">Water Softener</span>}
              {home.has_sump_pump && <span className="badge badge-info">Sump Pump</span>}
              {home.has_storm_shelter && <span className="badge badge-warning">Storm Shelter</span>}
              {!home.has_pool && !home.has_deck && !home.has_sprinkler_system && !home.has_fireplace && !home.has_gutters && !home.has_fire_extinguisher && !home.has_water_softener && !home.has_sump_pump && !home.has_storm_shelter && <span className="text-sm text-gray">None selected</span>}
            </div>
          </Field>
          {home.number_of_hvac_filters && (
            <Field label="HVAC Filters">
              <p style={{ fontWeight: 500 }}>
                {home.number_of_hvac_filters} filter{home.number_of_hvac_filters > 1 ? 's' : ''}
                {home.hvac_filter_size ? ` (${home.hvac_filter_size})` : ''}
                {home.hvac_return_location ? ` — ${home.hvac_return_location === 'furnace' ? 'at furnace' : home.hvac_return_location}` : ''}
              </p>
            </Field>
          )}
          {home.countertop_type && <Field label="Countertop Type"><p style={{ fontWeight: 500 }}>{home.countertop_type.replace(/_/g,' ')}</p></Field>}
          {(home.main_breaker_location || home.water_shutoff_location || home.gas_meter_location || home.water_meter_location || home.sub_panel_locations || home.hose_bib_locations) && (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Infrastructure Locations</div>
              {home.main_breaker_location && <Field label="Main Breaker"><p style={{ fontWeight: 500 }}>{home.main_breaker_location}</p></Field>}
              {home.sub_panel_locations && <Field label="Sub Panels"><p style={{ fontWeight: 500 }}>{home.sub_panel_locations}</p></Field>}
              {home.water_shutoff_location && <Field label="Water Shutoff"><p style={{ fontWeight: 500 }}>{home.water_shutoff_location}</p></Field>}
              {home.gas_meter_location && <Field label="Gas Meter"><p style={{ fontWeight: 500 }}>{home.gas_meter_location}</p></Field>}
              {home.water_meter_location && <Field label="Water Meter"><p style={{ fontWeight: 500 }}>{home.water_meter_location}</p></Field>}
              {home.hose_bib_locations && <Field label="Hose Bibs"><p style={{ fontWeight: 500 }}>{home.hose_bib_locations}</p></Field>}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
