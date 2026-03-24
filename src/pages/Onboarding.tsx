import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { upsertHome, upsertEquipment, updateProfile, createTasks } from '@/services/supabase';
import { generateTasksForHome, generateEquipmentLifecycleAlerts } from '@/services/taskEngine';
import EquipmentScanner from '@/components/EquipmentScanner';
import { Colors } from '@/constants/theme';
import { CheckCircleIcon } from '@/components/icons/Icons';
import type { EquipmentCategory, Equipment as EquipmentType } from '@/types';

const EQUIPMENT_CATEGORIES: { value: EquipmentCategory; label: string }[] = [
  { value: 'hvac', label: 'HVAC' },
  { value: 'water_heater', label: 'Water Heater' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'roof', label: 'Roof' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'safety', label: 'Safety' },
  { value: 'pool', label: 'Pool' },
  { value: 'garage', label: 'Garage' },
];

interface Equipment {
  name: string;
  category: EquipmentCategory;
  make: string;
  model: string;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setHome, addEquipment, setTasks } = useStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  // Step 1: Address
  const [addressForm, setAddressForm] = useState({
    address: '',
    city: '',
    state: '',
    zip_code: '',
    year_built: '',
    square_footage: '',
    stories: '1',
    bedrooms: '3',
    bathrooms: '2',
    garage_spaces: '0',
  });

  // Step 2: Home Systems
  const [systemsForm, setSystemsForm] = useState({
    foundation_type: '',
    roof_type: '',
    roof_age_years: '',
    siding: '',
    heating_type: '',
    cooling_type: '',
    water_source: '',
    sewer_type: '',
    lawn_type: 'none',
    has_pool: false,
    has_deck: false,
    has_sprinkler_system: false,
    has_fireplace: false,
    fireplace_type: '',
    has_gutters: true,
    has_fire_extinguisher: false,
    has_water_softener: false,
    countertop_type: '',
    fireplace_count: '1',
  });

  // Step 3: Equipment
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentForm, setEquipmentForm] = useState<Equipment>({
    name: '',
    category: 'hvac',
    make: '',
    model: '',
  });
  const [showScanner, setShowScanner] = useState(false);

  const handleAddressSubmit = async () => {
    if (!user || !addressForm.address || !addressForm.city || !addressForm.state || !addressForm.zip_code) {
      alert('Please fill in address, city, state, and zip code');
      return;
    }

    setSaving(true);
    try {
      const homeData: any = {
        id: crypto.randomUUID(),
        user_id: user.id,
        ...addressForm,
        year_built: addressForm.year_built ? parseInt(addressForm.year_built) : null,
        square_footage: addressForm.square_footage ? parseInt(addressForm.square_footage) : null,
        stories: parseInt(addressForm.stories) || 1,
        bedrooms: parseInt(addressForm.bedrooms) || 3,
        bathrooms: parseInt(addressForm.bathrooms) || 2,
        garage_spaces: parseInt(addressForm.garage_spaces) || 0,
        roof_age_years: null,
        created_at: new Date().toISOString(),
      };

      try {
        const saved = await upsertHome(homeData);
        setHome(saved);
      } catch {
        setHome(homeData);
      }

      setStep(1);
    } finally {
      setSaving(false);
    }
  };

  const handleSystemsSubmit = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { home } = useStore.getState();
      if (!home) return;

      const updatedHome: any = {
        ...home,
        ...systemsForm,
        roof_age_years: systemsForm.roof_age_years ? parseInt(systemsForm.roof_age_years) : null,
        countertop_type: systemsForm.countertop_type || null,
        fireplace_count: systemsForm.has_fireplace ? (parseInt(systemsForm.fireplace_count) || 1) : null,
      };

      try {
        const saved = await upsertHome(updatedHome);
        setHome(saved);
      } catch {
        setHome(updatedHome);
      }

      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const handleAddEquipment = () => {
    if (!equipmentForm.name) {
      alert('Please enter equipment name');
      return;
    }
    setEquipmentList([...equipmentList, { ...equipmentForm }]);
    setEquipmentForm({ name: '', category: 'hvac', make: '', model: '' });
  };

  const handleRemoveEquipment = (index: number) => {
    setEquipmentList(equipmentList.filter((_, i) => i !== index));
  };

  const handleScannerComplete = (scannedData: any) => {
    const { name, category, ...rest } = scannedData;
    setEquipmentList([
      ...equipmentList,
      {
        name,
        category,
        make: rest.make || '',
        model: rest.model || '',
      },
    ]);
    setShowScanner(false);
  };

  const handleFinish = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { home, equipment: existingEquipment } = useStore.getState();
      if (!home) return;

      // Save equipment items
      const allEquipment = [...existingEquipment];
      for (const item of equipmentList) {
        const equip: any = {
          id: crypto.randomUUID(),
          home_id: home.id,
          category: item.category,
          name: item.name,
          make: item.make || undefined,
          model: item.model || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          await upsertEquipment(equip);
          addEquipment(equip);
          allEquipment.push(equip);
        } catch {
          addEquipment(equip);
          allEquipment.push(equip);
        }
      }

      // Generate and insert maintenance tasks
      setGeneratingTasks(true);
      try {
        const { tasks: existingTasks } = useStore.getState();
        const generatedTasks = generateTasksForHome(home, allEquipment, existingTasks);
        const lifecycleAlerts = generateEquipmentLifecycleAlerts(allEquipment, home);
        const allNewTasks = [...generatedTasks, ...lifecycleAlerts];

        if (allNewTasks.length > 0) {
          // Prepare tasks for Supabase insert
          const tasksToInsert = allNewTasks.map((task) => ({
            home_id: task.home_id,
            equipment_id: task.equipment_id,
            title: task.title,
            description: task.description,
            instructions: task.instructions,
            category: task.category,
            priority: task.priority,
            frequency: task.frequency,
            due_date: task.due_date,
            status: task.status,
            estimated_minutes: task.estimated_minutes,
            estimated_cost: task.estimated_cost,
            applicable_months: task.applicable_months,
            is_weather_triggered: task.is_weather_triggered,
          }));

          try {
            const createdTasks = await createTasks(tasksToInsert);
            setTasks(createdTasks);
          } catch (error) {
            console.error('Error creating tasks:', error);
            // Fallback: use client-generated tasks in local store
            setTasks(allNewTasks);
          }
        }
      } catch (error) {
        console.error('Error generating tasks:', error);
        // Continue even if task generation fails
      } finally {
        setGeneratingTasks(false);
      }

      // Mark onboarding complete
      try {
        await updateProfile(user.id, { onboarding_complete: true });
      } catch {
        // Continue even if profile update fails
      }

      // Show completion screen instead of immediately navigating
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = step >= 3 ? 100 : ((step + 1) / 3) * 100;

  return (
    <div className="page" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 40 }}>
      {/* Progress Bar */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                backgroundColor: i <= step ? Colors.copper : Colors.lightGray,
                borderRadius: 2,
                transition: 'background-color 0.3s ease',
              }}
            />
          ))}
        </div>
        <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
          Step {step + 1} of 3
        </p>
      </div>

      {/* Step 1: Address */}
      {step === 0 && (
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>Where is your home?</h2>
          <p style={{ color: Colors.medGray, marginBottom: 20, fontSize: 14 }}>
            We'll use this to tailor maintenance tasks to your climate and local conditions.
          </p>

          <div className="form-group">
            <label>Street Address *</label>
            <input
              className="form-input"
              placeholder="123 Oak Street"
              value={addressForm.address}
              onChange={e => setAddressForm({ ...addressForm, address: e.target.value })}
            />
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label>City *</label>
              <input
                className="form-input"
                placeholder="Tulsa"
                value={addressForm.city}
                onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>State *</label>
              <input
                className="form-input"
                placeholder="OK"
                value={addressForm.state}
                onChange={e => setAddressForm({ ...addressForm, state: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>ZIP *</label>
              <input
                className="form-input"
                placeholder="74103"
                value={addressForm.zip_code}
                onChange={e => setAddressForm({ ...addressForm, zip_code: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Year Built</label>
              <input
                className="form-input"
                type="number"
                placeholder="1998"
                value={addressForm.year_built}
                onChange={e => setAddressForm({ ...addressForm, year_built: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Sq Ft</label>
              <input
                className="form-input"
                type="number"
                placeholder="2400"
                value={addressForm.square_footage}
                onChange={e => setAddressForm({ ...addressForm, square_footage: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-4">
            <div className="form-group">
              <label>Stories</label>
              <input
                className="form-input"
                type="number"
                value={addressForm.stories}
                onChange={e => setAddressForm({ ...addressForm, stories: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Beds</label>
              <input
                className="form-input"
                type="number"
                value={addressForm.bedrooms}
                onChange={e => setAddressForm({ ...addressForm, bedrooms: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Baths</label>
              <input
                className="form-input"
                type="number"
                value={addressForm.bathrooms}
                onChange={e => setAddressForm({ ...addressForm, bathrooms: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Garage</label>
              <input
                className="form-input"
                type="number"
                value={addressForm.garage_spaces}
                onChange={e => setAddressForm({ ...addressForm, garage_spaces: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-sm mt-lg">
            <button className="btn btn-primary" onClick={handleAddressSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Home Systems */}
      {step === 1 && (
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>What systems does your home have?</h2>

          <div className="grid-2">
            <div className="form-group">
              <label>Roof Type</label>
              <select
                className="form-select"
                value={systemsForm.roof_type}
                onChange={e => setSystemsForm({ ...systemsForm, roof_type: e.target.value })}
              >
                <option value="">Select...</option>
                {['asphalt_shingle', 'metal', 'tile', 'slate', 'flat', 'wood_shake'].map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Roof Age (years)</label>
              <input
                className="form-input"
                type="number"
                value={systemsForm.roof_age_years}
                onChange={e => setSystemsForm({ ...systemsForm, roof_age_years: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Heating</label>
              <select
                className="form-select"
                value={systemsForm.heating_type}
                onChange={e => setSystemsForm({ ...systemsForm, heating_type: e.target.value })}
              >
                <option value="">Select...</option>
                {['forced_air', 'heat_pump', 'radiant', 'boiler', 'baseboard'].map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Cooling</label>
              <select
                className="form-select"
                value={systemsForm.cooling_type}
                onChange={e => setSystemsForm({ ...systemsForm, cooling_type: e.target.value })}
              >
                <option value="">Select...</option>
                {['central_ac', 'heat_pump', 'window_units', 'mini_split', 'none'].map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Water Source</label>
              <select
                className="form-select"
                value={systemsForm.water_source}
                onChange={e => setSystemsForm({ ...systemsForm, water_source: e.target.value })}
              >
                <option value="">Select...</option>
                {['municipal', 'well'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Sewer Type</label>
              <select
                className="form-select"
                value={systemsForm.sewer_type}
                onChange={e => setSystemsForm({ ...systemsForm, sewer_type: e.target.value })}
              >
                <option value="">Select...</option>
                {['municipal', 'septic'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Lawn Type</label>
            <select
              className="form-select"
              value={systemsForm.lawn_type}
              onChange={e => setSystemsForm({ ...systemsForm, lawn_type: e.target.value as any })}
            >
              <option value="none">None</option>
              {['bermuda', 'fescue', 'zoysia', 'st_augustine', 'bluegrass', 'buffalo', 'mixed'].map(v => (
                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="grid-2 mt-md">
            {(['has_pool', 'has_deck', 'has_sprinkler_system', 'has_fireplace', 'has_gutters', 'has_fire_extinguisher', 'has_water_softener'] as const).map(key => (
              <label key={key} className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input
                  type="checkbox"
                  checked={systemsForm[key] as boolean}
                  onChange={e => setSystemsForm({ ...systemsForm, [key]: e.target.checked })}
                />
                <span style={{ fontSize: 14 }}>{key.replace(/has_/, '').replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>

          {/* Fireplace Type and Count - shown when fireplace is checked */}
          {systemsForm.has_fireplace && (
            <>
              <div className="form-group mt-md">
                <label>Fireplace Type</label>
                <select
                  className="form-select"
                  value={systemsForm.fireplace_type}
                  onChange={e => setSystemsForm({ ...systemsForm, fireplace_type: e.target.value })}
                >
                  <option value="">Select type...</option>
                  <option value="wood_burning">Wood Burning</option>
                  <option value="gas_starter">Gas Starter</option>
                  <option value="gas">Gas</option>
                </select>
              </div>
              <div className="form-group">
                <label>Number of Fireplaces</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={systemsForm.fireplace_count}
                  onChange={e => setSystemsForm({ ...systemsForm, fireplace_count: e.target.value })}
                  placeholder="1"
                />
              </div>
            </>
          )}

          {/* Countertop Type */}
          <div className="form-group mt-md">
            <label>Countertop Type</label>
            <select
              className="form-select"
              value={systemsForm.countertop_type}
              onChange={e => setSystemsForm({ ...systemsForm, countertop_type: e.target.value })}
            >
              <option value="">Select...</option>
              {['granite', 'marble', 'quartz', 'butcher_block', 'laminate', 'tile', 'concrete', 'stainless_steel'].map(v => (
                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-sm mt-lg">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" onClick={handleSystemsSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Equipment */}
      {step === 2 && (
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>Add your equipment (optional)</h2>
          <p style={{ color: Colors.medGray, marginBottom: 20, fontSize: 14 }}>
            Add any home systems or appliances you'd like to track.
          </p>

          {showScanner ? (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, margin: 0 }}>Scan Equipment Label</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowScanner(false)}>Close</button>
              </div>
              <EquipmentScanner
                onScanComplete={handleScannerComplete}
                onClose={() => setShowScanner(false)}
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Equipment Name</label>
                <input
                  className="form-input"
                  placeholder="e.g., Central AC Unit"
                  value={equipmentForm.name}
                  onChange={e => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    className="form-select"
                    value={equipmentForm.category}
                    onChange={e => setEquipmentForm({ ...equipmentForm, category: e.target.value as EquipmentCategory })}
                  >
                    {EQUIPMENT_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Make</label>
                  <input
                    className="form-input"
                    placeholder="Carrier"
                    value={equipmentForm.make}
                    onChange={e => setEquipmentForm({ ...equipmentForm, make: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Model</label>
                <input
                  className="form-input"
                  placeholder="24ACC636"
                  value={equipmentForm.model}
                  onChange={e => setEquipmentForm({ ...equipmentForm, model: e.target.value })}
                />
              </div>

              <div className="grid-2 mb-lg">
                <button className="btn btn-secondary" onClick={handleAddEquipment}>
                  + Add Equipment
                </button>
                <button className="btn btn-secondary" onClick={() => setShowScanner(true)}>
                  Scan Label
                </button>
              </div>
            </>
          )}

          {equipmentList.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 10 }}>
                {equipmentList.length} item{equipmentList.length !== 1 ? 's' : ''} added
              </p>
              {equipmentList.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: `1px solid ${Colors.lightGray}`,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 500 }}>{item.name}</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: Colors.medGray }}>
                      {item.make} {item.model}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleRemoveEquipment(i)}
                    title="Delete"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-sm mt-lg">
            <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={saving || generatingTasks}>Back</button>
            <button className="btn btn-ghost" onClick={handleFinish} disabled={saving || generatingTasks}>
              Skip
            </button>
            <button className="btn btn-primary" onClick={handleFinish} disabled={saving || generatingTasks}>
              {generatingTasks ? 'Generating plan...' : saving ? 'Finishing...' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Completion / Welcome Screen */}
      {step === 3 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          {/* TODO: Replace with final branded illustration when ready */}
          <div style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${Colors.sage}30, ${Colors.copper}20)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            border: `3px solid ${Colors.sage}`,
          }}>
            <CheckCircleIcon size={48} color={Colors.sage} />
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>You're All Set!</h2>
          <p style={{ fontSize: 16, color: Colors.medGray, maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Your home profile is ready. Canopy has created a personalized maintenance plan based on your home and equipment.
          </p>

          <div className="card" style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto 32px' }}>
            <p style={{ fontWeight: 600, marginBottom: 12 }}>What's next:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Check your calendar', desc: 'See upcoming maintenance tasks' },
                { label: 'Explore weather alerts', desc: 'Stay ahead of severe weather' },
                { label: 'Add more equipment', desc: 'Get tailored maintenance reminders' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: Colors.copper, flexShrink: 0, marginTop: 2 }}>
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</p>
                    <p className="text-xs text-gray">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: '14px 48px', fontSize: 16 }}
            onClick={() => navigate('/')}
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
