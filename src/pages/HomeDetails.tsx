import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { upsertHome, updateProfile, uploadPhoto, deleteTask, createTasks, getStructures, addStructure, deleteStructure, STRUCTURE_TYPES, submitOwnershipVerification, uploadVerificationDocument } from '@/services/supabase';
import { generateTasksForHome } from '@/services/taskEngine';
import { TASK_TEMPLATES } from '@/constants/maintenance';
import { Colors } from '@/constants/theme';
import HomeMembers from '@/components/HomeMembers';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { showToast } from '@/components/Toast';
import type { Home } from '@/types';
import HomeQRCode from '@/components/HomeQRCode';
import { findExistingProperty } from '@/services/addressVerification';
import { createHomeJoinRequest } from '@/services/home';

export default function HomeDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, home, setHome, equipment, consumables, customTemplates, tasks, setTasks, addTask, removeTask } = useStore();
  const [editing, setEditing] = useState(!home || searchParams.get('edit') === 'emergency');
  const emergencySectionRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [structures, setStructures] = useState<Home[]>([]);
  const [showAddStructure, setShowAddStructure] = useState(false);
  const [structureFormType, setStructureFormType] = useState<keyof typeof STRUCTURE_TYPES>('guest_house');
  const [structureFormLabel, setStructureFormLabel] = useState('');
  const [addingStructure, setAddingStructure] = useState(false);
  const [form, setForm] = useState({
    address: home?.address || '', city: home?.city || '', state: home?.state || '', zip_code: home?.zip_code || '',
    year_built: home?.year_built?.toString() || '', square_footage: home?.square_footage?.toString() || '',
    stories: home?.stories?.toString() || '1', bedrooms: home?.bedrooms?.toString() || '3', bathrooms: home?.bathrooms?.toString() || '2',
    garage_spaces: home?.garage_spaces?.toString() || '2',
    roof_type: home?.roof_type || '', roof_install_year: home?.roof_install_year?.toString() || '',
    heating_type: home?.heating_type || '', cooling_type: home?.cooling_type || '',
    water_source: home?.water_source || '', sewer_type: home?.sewer_type || '',
    has_pool: home?.has_pool || false, has_deck: home?.has_deck || false, has_sprinkler_system: home?.has_sprinkler_system || false,
    has_fireplace: home?.has_fireplace || false,
    has_fountain: home?.has_fountain || false,
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
    // Trash & recycling service
    trash_provider: home?.trash_provider || '',
    trash_day: home?.trash_day || '',
    recycling_day: home?.recycling_day || '',
    recycling_frequency: home?.recycling_frequency || 'weekly',
    yard_waste_day: home?.yard_waste_day || '',
    yard_waste_seasonal: home?.yard_waste_seasonal ?? true,
    // Advanced Home Details (InterNACHI Building Standards) — H-3
    structure_type: home?.structure_type || '',
    frame_size: home?.frame_size || '',
    siding_type: home?.siding_type || '',
    window_frame_material: home?.window_frame_material || '',
    window_glazing: home?.window_glazing || '',
    exterior_door_material: home?.exterior_door_material || '',
    plumbing_supply_type: home?.plumbing_supply_type || '',
    electrical_wiring_type: home?.electrical_wiring_type || '',
    insulation_wall_type: home?.insulation_wall_type || '',
    insulation_attic_type: home?.insulation_attic_type || '',
    ductwork_type: home?.ductwork_type || '',
    electrical_panel_amps: home?.electrical_panel_amps?.toString() || '',
    construction_type: home?.construction_type || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Duplicate address detection — prompt to join instead of creating a new home
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimInfo, setClaimInfo] = useState<{ homeId: string; ownerId: string } | null>(null);
  const [joinRequesting, setJoinRequesting] = useState(false);
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // Auto-scroll to emergency/infrastructure section if linked from Dashboard
  useEffect(() => {
    if (searchParams.get('edit') === 'emergency' && emergencySectionRef.current) {
      setTimeout(() => emergencySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
  }, [editing]);

  // Load structures for this home (only if it's a primary home)
  useEffect(() => {
    const loadStructures = async () => {
      if (home && !home.parent_home_id) {
        try {
          const data = await getStructures(home.id);
          setStructures(data);
        } catch (err) {
          console.warn('Failed to load structures:', err);
        }
      } else {
        setStructures([]);
      }
    };
    loadStructures();
  }, [home?.id]);

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

  const handleJoinRequest = async () => {
    if (!user || !claimInfo) return;
    setJoinRequesting(true);
    try {
      await createHomeJoinRequest(claimInfo.homeId, user.id, claimInfo.ownerId, 'Requesting to join this home (from Home Details).');
      setJoinRequestSent(true);
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to send join request' });
    } finally {
      setJoinRequesting(false);
    }
  };

  const handleSave = async () => {
    if (!user || !form.address) return;
    if (!validateForm()) return;
    setSaving(true);
    try {
      // If creating a new home, check for duplicate addresses first
      if (!home) {
        try {
          const match = await findExistingProperty(
            '', undefined, undefined,
            form.address, form.city, form.state, form.zip_code,
            user.id,
            selectedPlaceId || undefined,
          );
          if (match.found && match.homeId && match.ownerId) {
            setClaimInfo({ homeId: match.homeId, ownerId: match.ownerId });
            setShowClaimModal(true);
            setSaving(false);
            return;
          }
        } catch {
          // Non-fatal — proceed with save if check fails
        }
      }

      const homeData: any = {
        id: home?.id || crypto.randomUUID(),
        user_id: user.id,
        ...form,
        google_place_id: selectedPlaceId || home?.google_place_id || null,
        year_built: form.year_built ? parseInt(form.year_built) : null,
        square_footage: form.square_footage ? parseInt(form.square_footage) : null,
        stories: parseInt(form.stories) || 1,
        bedrooms: parseInt(form.bedrooms) || 3,
        bathrooms: parseInt(form.bathrooms) || 2,
        garage_spaces: parseInt(form.garage_spaces) || 0,
        roof_install_year: form.roof_install_year ? parseInt(form.roof_install_year) : null,
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
        // Advanced Home Details (InterNACHI Building Standards) — H-3
        structure_type: form.structure_type || null,
        frame_size: form.frame_size || null,
        siding_type: form.siding_type || null,
        window_frame_material: form.window_frame_material || null,
        window_glazing: form.window_glazing || null,
        exterior_door_material: form.exterior_door_material || null,
        plumbing_supply_type: form.plumbing_supply_type || null,
        electrical_wiring_type: form.electrical_wiring_type || null,
        insulation_wall_type: form.insulation_wall_type || null,
        insulation_attic_type: form.insulation_attic_type || null,
        ductwork_type: form.ductwork_type || null,
        electrical_panel_amps: form.electrical_panel_amps ? parseInt(form.electrical_panel_amps) : null,
        construction_type: form.construction_type || null,
        // Trash & recycling
        trash_provider: form.trash_provider || null,
        trash_day: form.trash_day || null,
        recycling_day: form.recycling_day || null,
        recycling_frequency: form.recycling_day ? form.recycling_frequency : null,
        yard_waste_day: form.yard_waste_day || null,
        yard_waste_seasonal: form.yard_waste_day ? form.yard_waste_seasonal : null,
        created_at: home?.created_at || new Date().toISOString(),
      };
      try { const saved = await upsertHome(homeData); setHome(saved); } catch { setHome(homeData); }
      // Mark onboarding complete on first home save
      if (!home && user) {
        try { await updateProfile(user.id, { onboarding_complete: true }); } catch {}
      }

      // ─── Retrigger task generation when home features or trash/recycling change ───
      const featureFields = [
        'has_pool', 'has_deck', 'has_sprinkler_system', 'has_fireplace',
        'has_fountain', 'has_gutters', 'has_water_softener', 'has_sump_pump',
      ] as const;
      const trashFields = ['trash_day', 'recycling_day', 'recycling_frequency', 'yard_waste_day'] as const;
      const oldHome = home as Record<string, any> | undefined;
      const newHome = homeData as Record<string, any>;

      const featureChanged = featureFields.some(
        (f) => Boolean(oldHome?.[f]) !== Boolean(newHome[f])
      );
      const trashChanged = trashFields.some(
        (f) => (oldHome?.[f] || null) !== (newHome[f] || null)
      );

      if (featureChanged || trashChanged) {
        try {
          // 1. Remove tasks whose required home feature was turned OFF
          const removedFeatures = featureFields.filter(
            (f) => oldHome?.[f] && !newHome[f]
          );
          if (removedFeatures.length > 0) {
            const orphanTemplateIds = TASK_TEMPLATES
              .filter((t) => t.requires_home_feature && removedFeatures.includes(t.requires_home_feature as any))
              .map((t) => t.id);
            const orphanedTasks = tasks.filter(
              (t) => t.template_id && orphanTemplateIds.includes(t.template_id) && t.status !== 'completed'
            );
            for (const task of orphanedTasks) {
              try { await deleteTask(task.id); } catch { /* best effort */ }
              removeTask(task.id);
            }
          }

          // 2. If trash/recycling day changed, remove old pickup tasks before regenerating
          if (trashChanged) {
            const pickupTitles = ['Take Out Trash', 'Put Out Recycling', 'Yard Waste Pickup'];
            const stalePickups = tasks.filter(
              (t) => pickupTitles.includes(t.title) && t.status !== 'completed'
            );
            for (const task of stalePickups) {
              try { await deleteTask(task.id); } catch { /* best effort */ }
              removeTask(task.id);
            }
          }

          // 3. Re-run task generation with updated home data
          const currentTasks = tasks.filter(
            (t) => t.status !== 'completed' || t.status === 'completed'
          ); // pass all tasks for dedup
          const newTasks = generateTasksForHome(
            homeData as any,
            equipment || [],
            currentTasks,
            consumables || [],
            undefined,
            customTemplates,
          );
          if (newTasks.length > 0) {
            for (const task of newTasks) addTask(task);
            try { await createTasks(newTasks); } catch { /* best effort */ }
          }
        } catch (err) {
          console.error('[HomeDetails] task regeneration error:', err);
        }
      }

      setEditing(false);
    } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !home) return;

    // Client-side file size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = Math.round(file.size / 1024 / 1024);
      showToast({ message: `File too large (${fileSizeMB}MB). Maximum file size is 10MB. Please choose a smaller file.` });
      return;
    }

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
      showToast({ message: 'Failed to upload photo. Please try again.' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddStructure = async () => {
    if (!home || !structureFormLabel.trim()) return;
    setAddingStructure(true);
    try {
      const newStructure = await addStructure(home.id, structureFormType, structureFormLabel);
      setStructures([...structures, newStructure]);
      setStructureFormType('guest_house');
      setStructureFormLabel('');
      setShowAddStructure(false);
    } catch (err) {
      console.error('Failed to add structure:', err);
      showToast({ message: 'Failed to add structure. Please try again.' });
    } finally {
      setAddingStructure(false);
    }
  };

  const handleDeleteStructure = async (structureId: string) => {
    if (!window.confirm('Are you sure you want to delete this structure? This cannot be undone.')) return;
    try {
      await deleteStructure(structureId);
      setStructures(structures.filter(s => s.id !== structureId));
    } catch (err) {
      console.error('Failed to delete structure:', err);
      showToast({ message: 'Failed to delete structure. Please try again.' });
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

          {/* Address fields — locked after initial setup (address = property identity) */}
          {home ? (
            <div style={{ padding: 14, background: 'var(--color-background, #f9f7f2)', border: '1px solid var(--border-color, #E8E2D8)', borderRadius: 8, marginBottom: 16 }}>
              <p className="text-xs text-gray" style={{ marginBottom: 4 }}>Address</p>
              <p style={{ fontWeight: 600, marginBottom: 2 }}>{form.address}</p>
              <p style={{ fontSize: 13, color: 'var(--color-med-gray)' }}>{form.city}, {form.state} {form.zip_code}</p>
              <p className="text-xs text-gray" style={{ marginTop: 8, fontStyle: 'italic' }}>
                Address can't be changed — it's tied to your Home Token and verification. Moving? Transfer this home to the buyer, then set up your new address.
              </p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Address *</label>
                <AddressAutocomplete
                  value={form.address}
                  onChange={(v) => setForm({...form, address: v})}
                  onPlaceSelected={(details) => {
                    setSelectedPlaceId(details.placeId || null);
                    setForm({
                      ...form,
                      address: details.address || form.address,
                      city: details.city || form.city,
                      state: details.state || form.state,
                      zip_code: (details.zipCode || form.zip_code).split('-')[0],
                    });
                  }}
                />
              </div>
              <div className="grid-3">
                <div className="form-group"><label>City</label><input className="form-input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
                <div className="form-group"><label>State</label><input className="form-input" value={form.state} onChange={e => setForm({...form, state: e.target.value})} /></div>
                <div className="form-group">
                  <label>Zip</label>
                  <input className="form-input" value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} />
                  {errors.zip_code && <p style={{ color: 'var(--color-error)', fontSize: 13, marginTop: 4 }}>{errors.zip_code}</p>}
                </div>
              </div>
            </>
          )}
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
            <div className="form-group"><label>Roof Install Year</label><input className="form-input" type="number" value={form.roof_install_year} onChange={e => setForm({...form, roof_install_year: e.target.value})} /></div>
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
              <label>Water Source</label>
              <select className="form-select" value={form.water_source} onChange={e => setForm({...form, water_source: e.target.value})}>
                <option value="">Select...</option>
                <option value="municipal">Municipal</option>
                <option value="well">Well</option>
              </select>
            </div>
            <div className="form-group">
              <label>Sewer Type</label>
              <select className="form-select" value={form.sewer_type} onChange={e => setForm({...form, sewer_type: e.target.value})}>
                <option value="">Select...</option>
                <option value="municipal">Public sewer</option>
                <option value="septic">Septic</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Lawn Type</label>
              <select className="form-select" value={form.lawn_type} onChange={e => setForm({...form, lawn_type: e.target.value as typeof form.lawn_type})}>
                <option value="none">None</option>
                {['bermuda','fescue','zoysia','st_augustine','bluegrass','buffalo','mixed'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label>&nbsp;</label><p className="text-xs text-gray" style={{ padding: '10px 0' }}>Used for seasonal lawn care tasks</p></div>
          </div>
          <div className="grid-2 mt-md">
            {(['has_pool','has_deck','has_sprinkler_system','has_fireplace','has_fountain','has_gutters','has_fire_extinguisher','has_water_softener','has_sump_pump','has_storm_shelter'] as const).map(key => (
              <label key={key} className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={form[key] as boolean} onChange={e => setForm({...form, [key]: e.target.checked})} />
                <span style={{ fontSize: 14 }}>{key.replace(/has_/,'').replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
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

          {/* Trash & Recycling Service */}
          <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>Trash & Recycling</h3>
          <div className="grid-2">
            <div className="form-group">
              <label>Trash Provider</label>
              <input className="form-input" value={form.trash_provider} onChange={e => setForm({...form, trash_provider: e.target.value})} placeholder="e.g., Waste Management, City of Tulsa" />
            </div>
            <div className="form-group">
              <label>Trash Pickup Day</label>
              <select className="form-select" value={form.trash_day} onChange={e => setForm({...form, trash_day: e.target.value})}>
                <option value="">Select day...</option>
                {['monday','tuesday','wednesday','thursday','friday','saturday'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Recycling Pickup Day</label>
              <select className="form-select" value={form.recycling_day} onChange={e => setForm({...form, recycling_day: e.target.value})}>
                <option value="">Select day...</option>
                {['monday','tuesday','wednesday','thursday','friday','saturday'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Recycling Frequency</label>
              <select className="form-select" value={form.recycling_frequency} onChange={e => setForm({...form, recycling_frequency: e.target.value as 'weekly' | 'biweekly'})}>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every other week</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Yard Waste Pickup Day</label>
              <select className="form-select" value={form.yard_waste_day} onChange={e => setForm({...form, yard_waste_day: e.target.value})}>
                <option value="">No yard waste service</option>
                {['monday','tuesday','wednesday','thursday','friday','saturday'].map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            {form.yard_waste_day && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.yard_waste_seasonal} onChange={e => setForm({...form, yard_waste_seasonal: e.target.checked})} />
                  Seasonal only (spring through fall)
                </label>
              </div>
            )}
          </div>

          {/* Advanced Home Details (InterNACHI Building Standards) — H-3 */}
          <details style={{ marginTop: 24, border: '1px solid var(--light-gray)', borderRadius: 8, padding: 16 }}>
            <summary style={{ fontWeight: 600, fontSize: 16, cursor: 'pointer', marginBottom: 16 }}>Advanced Home Details</summary>
            <p className="text-xs text-gray" style={{ marginBottom: 12 }}>Building standards and system specifications for reference.</p>

            {/* Structure & Frame */}
            <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Structure & Frame</h4>
            <div className="grid-2">
              <div className="form-group">
                <label>Construction Type</label>
                <select className="form-select" value={form.construction_type} onChange={e => setForm({...form, construction_type: e.target.value})}>
                  <option value="">Select...</option>
                  {['wood_frame','steel_frame','masonry','concrete'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Structure Type</label>
                <select className="form-select" value={form.structure_type} onChange={e => setForm({...form, structure_type: e.target.value})}>
                  <option value="">Select...</option>
                  {['single_family','multi_family','townhouse','custom'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Frame Size</label>
                <select className="form-select" value={form.frame_size} onChange={e => setForm({...form, frame_size: e.target.value})}>
                  <option value="">Select...</option>
                  {['2x4','2x6','2x8','2x10','other'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Siding Type</label>
                <select className="form-select" value={form.siding_type} onChange={e => setForm({...form, siding_type: e.target.value})}>
                  <option value="">Select...</option>
                  {['wood','vinyl','brick','fiber_cement','metal','stucco','stone'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>

            {/* Windows & Doors */}
            <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Windows & Doors</h4>
            <div className="grid-2">
              <div className="form-group">
                <label>Window Frame Material</label>
                <select className="form-select" value={form.window_frame_material} onChange={e => setForm({...form, window_frame_material: e.target.value})}>
                  <option value="">Select...</option>
                  {['wood','vinyl','aluminum','fiberglass','composite'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Window Glazing</label>
                <select className="form-select" value={form.window_glazing} onChange={e => setForm({...form, window_glazing: e.target.value})}>
                  <option value="">Select...</option>
                  {['single_pane','double_pane','triple_pane','low_e'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Exterior Door Material</label>
                <select className="form-select" value={form.exterior_door_material} onChange={e => setForm({...form, exterior_door_material: e.target.value})}>
                  <option value="">Select...</option>
                  {['wood','metal','vinyl','fiberglass','glass'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>

            {/* Insulation */}
            <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Insulation</h4>
            <div className="grid-2">
              <div className="form-group">
                <label>Wall Insulation Type</label>
                <select className="form-select" value={form.insulation_wall_type} onChange={e => setForm({...form, insulation_wall_type: e.target.value})}>
                  <option value="">Select...</option>
                  {['fiberglass','cellulose','foam','mineral_wool','none'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Attic Insulation Type</label>
                <select className="form-select" value={form.insulation_attic_type} onChange={e => setForm({...form, insulation_attic_type: e.target.value})}>
                  <option value="">Select...</option>
                  {['fiberglass','cellulose','foam','mineral_wool','none'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>

            {/* Systems */}
            <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>Plumbing & Electrical</h4>
            <div className="grid-2">
              <div className="form-group">
                <label>Plumbing Supply Type</label>
                <select className="form-select" value={form.plumbing_supply_type} onChange={e => setForm({...form, plumbing_supply_type: e.target.value})}>
                  <option value="">Select...</option>
                  {['copper','pvc','pex','galvanized','pvc_pex_mix'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Electrical Wiring Type</label>
                <select className="form-select" value={form.electrical_wiring_type} onChange={e => setForm({...form, electrical_wiring_type: e.target.value})}>
                  <option value="">Select...</option>
                  {['knob_tube','armored','pvc_conduit','romex'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Electrical Panel Amps</label>
                <input className="form-input" type="number" value={form.electrical_panel_amps} onChange={e => setForm({...form, electrical_panel_amps: e.target.value})} placeholder="e.g., 200" />
              </div>
              <div className="form-group">
                <label>Ductwork Type</label>
                <select className="form-select" value={form.ductwork_type} onChange={e => setForm({...form, ductwork_type: e.target.value})}>
                  <option value="">Select...</option>
                  {['fiberglass','metal','flex','sealed','unsealed','none'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                </select>
              </div>
            </div>
          </details>

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
          <Field label="Roof"><p style={{ fontWeight: 500 }}>{home.roof_type?.replace(/_/g,' ') || '—'} {home.roof_install_year ? `(installed ${home.roof_install_year})` : ''}</p></Field>
          <Field label="HVAC"><p style={{ fontWeight: 500 }}>{home.heating_type?.replace(/_/g,' ') || '—'} / {home.cooling_type?.replace(/_/g,' ') || '—'}</p></Field>
          {home.lawn_type && home.lawn_type !== 'none' && <Field label="Lawn"><p style={{ fontWeight: 500 }}>{home.lawn_type.replace(/_/g,' ')}</p></Field>}
          <Field label="Features">
            <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
              {home.has_pool && <span className="badge badge-info">Pool</span>}
              {home.has_deck && <span className="badge badge-sage">Deck</span>}
              {home.has_sprinkler_system && <span className="badge badge-success">Sprinklers</span>}
              {home.has_fireplace && <span className="badge badge-warning">Fireplace{home.fireplace_type ? ` (${home.fireplace_type.replace(/_/g, ' ')})` : ''}{home.fireplace_count ? ` x${home.fireplace_count}` : ''}</span>}
              {home.has_fountain && <span className="badge badge-info">Fountain</span>}
              {home.has_gutters && <span className="badge badge-info">Gutters</span>}
              {home.has_fire_extinguisher && <span className="badge badge-warning">Fire Extinguisher</span>}
              {home.has_water_softener && <span className="badge badge-sage">Water Softener</span>}
              {home.has_sump_pump && <span className="badge badge-info">Sump Pump</span>}
              {home.has_storm_shelter && <span className="badge badge-warning">Storm Shelter</span>}
              {!home.has_pool && !home.has_deck && !home.has_sprinkler_system && !home.has_fireplace && !home.has_fountain && !home.has_gutters && !home.has_fire_extinguisher && !home.has_water_softener && !home.has_sump_pump && !home.has_storm_shelter && <span className="text-sm text-gray">None selected</span>}
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

          {/* Advanced Home Details Display (InterNACHI Building Standards) — H-3 */}
          {(home.structure_type || home.frame_size || home.siding_type || home.window_frame_material || home.window_glazing || home.exterior_door_material || home.plumbing_supply_type || home.electrical_wiring_type || home.insulation_wall_type || home.insulation_attic_type || home.ductwork_type || home.electrical_panel_amps || home.construction_type) && (
            <details style={{ marginTop: 20, border: '1px solid var(--light-gray)', borderRadius: 8, padding: 12 }}>
              <summary style={{ fontWeight: 600, fontSize: 15, cursor: 'pointer', marginBottom: 8 }}>Advanced Home Details</summary>
              {home.construction_type && <Field label="Construction Type"><p style={{ fontWeight: 500 }}>{home.construction_type.replace(/_/g,' ')}</p></Field>}
              {home.structure_type && <Field label="Structure Type"><p style={{ fontWeight: 500 }}>{home.structure_type.replace(/_/g,' ')}</p></Field>}
              {home.frame_size && <Field label="Frame Size"><p style={{ fontWeight: 500 }}>{home.frame_size}</p></Field>}
              {home.siding_type && <Field label="Siding Type"><p style={{ fontWeight: 500 }}>{home.siding_type.replace(/_/g,' ')}</p></Field>}
              {home.window_frame_material && <Field label="Window Frame Material"><p style={{ fontWeight: 500 }}>{home.window_frame_material.replace(/_/g,' ')}</p></Field>}
              {home.window_glazing && <Field label="Window Glazing"><p style={{ fontWeight: 500 }}>{home.window_glazing.replace(/_/g,' ')}</p></Field>}
              {home.exterior_door_material && <Field label="Exterior Door Material"><p style={{ fontWeight: 500 }}>{home.exterior_door_material.replace(/_/g,' ')}</p></Field>}
              {home.insulation_wall_type && <Field label="Wall Insulation Type"><p style={{ fontWeight: 500 }}>{home.insulation_wall_type.replace(/_/g,' ')}</p></Field>}
              {home.insulation_attic_type && <Field label="Attic Insulation Type"><p style={{ fontWeight: 500 }}>{home.insulation_attic_type.replace(/_/g,' ')}</p></Field>}
              {home.plumbing_supply_type && <Field label="Plumbing Supply Type"><p style={{ fontWeight: 500 }}>{home.plumbing_supply_type.replace(/_/g,' ')}</p></Field>}
              {home.electrical_wiring_type && <Field label="Electrical Wiring Type"><p style={{ fontWeight: 500 }}>{home.electrical_wiring_type.replace(/_/g,' ')}</p></Field>}
              {home.electrical_panel_amps && <Field label="Electrical Panel Amps"><p style={{ fontWeight: 500 }}>{home.electrical_panel_amps}</p></Field>}
              {home.ductwork_type && <Field label="Ductwork Type"><p style={{ fontWeight: 500 }}>{home.ductwork_type.replace(/_/g,' ')}</p></Field>}
            </details>
          )}

          {/* Additional Structures (only shown for primary homes) */}
          {!home.parent_home_id && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Additional Structures</div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddStructure(true)}
                >
                  + Add Structure
                </button>
              </div>

              {structures.length === 0 ? (
                <p className="text-sm text-gray" style={{ padding: '16px 0' }}>
                  No additional structures yet. Add a guest house, garage, workshop, or other secondary building.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                  {structures.map(struct => (
                    <div
                      key={struct.id}
                      style={{
                        padding: 12,
                        border: `1px solid var(--light-gray)`,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, marginBottom: 4 }}>
                          {STRUCTURE_TYPES[struct.structure_type as keyof typeof STRUCTURE_TYPES] || 'Structure'}
                        </p>
                        {struct.structure_label && <p className="text-sm text-gray">{struct.structure_label}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/home-details?id=${struct.id}`)}
                        >
                          View Details
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: Colors.error }}
                          onClick={() => handleDeleteStructure(struct.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showAddStructure && (
                <div style={{
                  padding: 16,
                  border: `2px solid ${Colors.copper}`,
                  borderRadius: 8,
                  marginBottom: 16,
                  backgroundColor: Colors.warmWhite,
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add a Structure</h3>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Structure Type *</label>
                    <select
                      className="form-select"
                      value={structureFormType}
                      onChange={e => setStructureFormType(e.target.value as keyof typeof STRUCTURE_TYPES)}
                    >
                      {Object.entries(STRUCTURE_TYPES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Custom Label (optional)</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g., West Side Guest House"
                      value={structureFormLabel}
                      onChange={e => setStructureFormLabel(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-sm">
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setShowAddStructure(false);
                        setStructureFormLabel('');
                        setStructureFormType('guest_house');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleAddStructure}
                      disabled={addingStructure || !structureFormLabel.trim()}
                    >
                      {addingStructure ? 'Adding...' : 'Add Structure'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Structure Banner (shown when viewing a structure) */}
          {home.parent_home_id && (
            <div style={{
              padding: 12,
              backgroundColor: Colors.copperMuted,
              border: `1px solid ${Colors.copper}`,
              borderRadius: 8,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>
                    {STRUCTURE_TYPES[home.structure_type as keyof typeof STRUCTURE_TYPES] || 'Structure'}
                  </p>
                  {home.structure_label && <p className="text-sm text-gray">{home.structure_label}</p>}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
                  ← Back to Main Home
                </button>
              </div>
            </div>
          )}

          {/* Ownership Verification */}
          <OwnershipVerification home={home} onUpdate={(updated) => setHome(updated)} />

          {/* Home Members */}
          <HomeMembers homeId={home.id} />

          {/* Home QR Code */}
          <HomeQRCode />
        </div>
      ) : null}

      {/* Duplicate Address / Join Home Modal */}
      {showClaimModal && claimInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ maxWidth: 440, width: '100%', padding: 28 }}>
            {joinRequestSent ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${Colors.sage}20`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 12 }}>✓</div>
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>Request Sent!</h3>
                  <p style={{ fontSize: 14, color: Colors.medGray }}>
                    The home owner will receive your request. Once approved, you'll be added as a household member.
                  </p>
                </div>
                <button className="btn btn-primary btn-full" onClick={() => { setShowClaimModal(false); setJoinRequestSent(false); }}>Got it</button>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: 18, marginBottom: 8 }}>This address is already on Canopy</h3>
                <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 20 }}>
                  Someone already has a home set up at <strong>{form.address}, {form.city}</strong>. Would you like to request to join their home as a household member?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={handleJoinRequest} disabled={joinRequesting} style={{ flex: 1 }}>
                    {joinRequesting ? 'Sending...' : 'Request to Join'}
                  </button>
                  <button className="btn" onClick={() => setShowClaimModal(false)} style={{ flex: 1, background: Colors.cream, color: Colors.charcoal, border: `1px solid ${Colors.lightGray}` }}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ownership Verification sub-component ──────────────────────
function OwnershipVerification({ home, onUpdate }: { home: Home; onUpdate: (h: Home) => void }) {
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const status = home.ownership_verification_status || 'none';
  const isVerified = status === 'verified';
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';

  const handleAddDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setDocFiles(prev => [...prev, ...files]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmitVerification = async () => {
    if (docFiles.length === 0) {
      setMessage('Please upload at least one document');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      // Upload all documents
      const urls: string[] = [];
      for (const file of docFiles) {
        const url = await uploadVerificationDocument(home.id, file);
        urls.push(url);
      }
      // Submit for review
      const updated = await submitOwnershipVerification(home.id, urls);
      onUpdate(updated);
      setDocFiles([]);
      setMessage('Verification submitted! Our team will review your documents.');
    } catch (err: any) {
      setMessage('Failed to submit: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = () => {
    if (isVerified) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'rgba(139,158,126,0.15)', color: Colors.sageDark }}>Verified</span>;
    if (isPending) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>Pending Review</span>;
    if (isRejected) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>Rejected</span>;
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: 'rgba(0,0,0,0.06)', color: Colors.medGray }}>Not Verified</span>;
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div className="card" style={{ borderLeft: `4px solid ${isVerified ? Colors.sage : isPending ? '#f59e0b' : Colors.copper}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Ownership Verification</h3>
          {statusBadge()}
        </div>

        {isVerified && (
          <div>
            <p style={{ fontSize: 13, color: Colors.sageDark, lineHeight: 1.6 }}>
              Your ownership of this home has been verified. This activates your Home Token for transfer and adds a trust badge to your home record.
            </p>
            {home.ownership_verification_date && (
              <p className="text-xs text-gray" style={{ marginTop: 8 }}>
                Verified on {new Date(home.ownership_verification_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {isPending && (
          <div>
            <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
              Your verification documents are under review. This typically takes 1–2 business days.
            </p>
            {home.ownership_verification_date && (
              <p className="text-xs text-gray" style={{ marginTop: 8 }}>
                Submitted on {new Date(home.ownership_verification_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {isRejected && (
          <div>
            <p style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.6, marginBottom: 8 }}>
              Your verification was not approved. Please review the notes below and resubmit.
            </p>
            {home.ownership_verification_notes && (
              <div style={{ padding: 12, background: 'rgba(220,38,38,0.06)', borderRadius: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Review Notes:</p>
                <p style={{ fontSize: 13 }}>{home.ownership_verification_notes}</p>
              </div>
            )}
          </div>
        )}

        {(status === 'none' || isRejected) && (
          <div style={{ marginTop: status === 'none' ? 0 : 12 }}>
            {status === 'none' && (
              <p style={{ fontSize: 13, color: Colors.medGray, lineHeight: 1.6, marginBottom: 16 }}>
                Verify your ownership to activate your Home Token. Upload a copy of your ID along with a document showing your name at this address (utility bill, tax statement, or closing documents).
              </p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleAddDoc}
              style={{ display: 'none' }}
            />

            {docFiles.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {docFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-background)', borderRadius: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{f.name}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: Colors.error, fontSize: 12, padding: '2px 6px' }}
                      onClick={() => setDocFiles(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ flex: 1 }}
              >
                + Add Document
              </button>
              {docFiles.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleSubmitVerification}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              )}
            </div>
          </div>
        )}

        {message && (
          <p style={{ marginTop: 12, fontSize: 13, color: message.includes('Failed') ? Colors.error : Colors.sageDark }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
