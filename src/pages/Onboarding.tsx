import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { upsertHome, upsertEquipment, updateProfile, createTasks, redeemGiftCode, supabase } from '@/services/supabase';
import { generateTasksForHome, generateEquipmentLifecycleAlerts } from '@/services/taskEngine';
import { PLANS, isProAvailableInArea, loadServiceAreas } from '@/services/subscriptionGate';
import { EQUIPMENT_LIFESPAN_DEFAULTS } from '@/constants/maintenance';
import EquipmentScanner from '@/components/EquipmentScanner';
import InspectionUploader from '@/components/InspectionUploader';
import { lookupByModelNumber } from '@/services/ai';
import { Colors } from '@/constants/theme';
import { CheckCircleIcon, CheckIcon } from '@/components/icons/Icons';
import type { EquipmentCategory, Equipment as EquipmentType, SubscriptionTier } from '@/types';

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

const SCAN_SUGGESTIONS = [
  { label: 'Furnace / Air Handler', hint: 'Label on front panel or inside door', icon: '🔥' },
  { label: 'AC Condenser (outdoor unit)', hint: 'Nameplate on the side of the unit', icon: '❄️' },
  { label: 'Water Heater', hint: 'Sticker on the front or side of the tank', icon: '🚿' },
  { label: 'Evaporator Coil (indoor AC)', hint: 'Sticker on the coil housing near your furnace', icon: '🌀' },
  { label: 'Thermostat', hint: 'Model info on the back or in settings', icon: '🌡️' },
  { label: 'Dishwasher', hint: 'Label inside the door edge', icon: '🍽️' },
  { label: 'Washer & Dryer', hint: 'Label inside the lid or door frame', icon: '👕' },
  { label: 'Garage Door Opener', hint: 'Sticker on the motor housing', icon: '🚗' },
];

const VALUE_PROPS = [
  { icon: '📋', title: 'Smart Scheduling', desc: 'AI-powered maintenance plans tailored to your home, climate, and equipment' },
  { icon: '🔍', title: 'Equipment Tracking', desc: 'Scan labels to track warranties, lifespan, and get alerts on issues' },
  { icon: '🌦️', title: 'Weather Alerts', desc: 'Proactive tasks when severe weather threatens your area' },
  { icon: '🏠', title: 'Home Health Score', desc: 'See how well-maintained your home is at a glance' },
];

const FIREPLACE_TYPES = [
  { value: 'wood_burning', label: 'Wood Burning' },
  { value: 'gas_starter', label: 'Gas Starter' },
  { value: 'gas', label: 'Gas' },
  { value: 'electric', label: 'Electric' },
];

interface Equipment {
  name: string;
  category: EquipmentCategory;
  make: string;
  model: string;
  serial_number?: string;
  equipment_subtype?: string;
  refrigerant_type?: string;
  estimated_lifespan_years?: number;
}

// Total onboarding steps (0-indexed): Welcome(0), Address(1), Systems(2), Plan(3), Equipment(4), Done(5)
const TOTAL_STEPS = 6;
const PROGRESS_STEPS = 4; // Steps shown in progress bar (Address, Systems, Plan, Equipment)

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, home, setHome, addEquipment, setTasks } = useStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  // Handle Stripe redirect back
  useEffect(() => {
    const stepParam = searchParams.get('step');
    const success = searchParams.get('success');
    const plan = searchParams.get('plan');
    if (stepParam) setStep(parseInt(stepParam));
    if (success === 'true' && plan) {
      const { setUser } = useStore.getState();
      if (user) {
        setUser({ ...user, subscription_tier: plan as SubscriptionTier });
      }
    }
  }, []);

  // Prevent back button from logging user out — push state on step changes
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      if (step > 0) {
        setStep(s => s - 1);
      }
      // If at step 0 (welcome), don't go back — stay on onboarding
      window.history.pushState(null, '', '/onboarding');
    };

    window.history.pushState(null, '', '/onboarding');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [step]);

  // Step 1: Address
  const [addressForm, setAddressForm] = useState({
    address: '', city: '', state: '', zip_code: '',
    year_built: '', square_footage: '',
    stories: '1', bedrooms: '3', bathrooms: '2', garage_spaces: '0',
  });

  // Step 2: Home Systems
  const [systemsForm, setSystemsForm] = useState({
    foundation_type: '',
    roof_type: '', roof_age_years: '',
    heating_type: '', cooling_type: '',
    water_source: '', sewer_type: '',
    lawn_type: 'none',
    has_pool: false, has_deck: false, has_sprinkler_system: false,
    has_fireplace: false, has_gutters: true,
    has_fire_extinguisher: false, has_water_softener: false,
    has_sump_pump: false, has_storm_shelter: false,
    countertop_type: '',
    // Per-fireplace tracking
    fireplace_count: '1',
    fireplaces: [{ type: 'wood_burning' }] as { type: string }[],
    // HVAC filter tracking
    number_of_hvac_filters: '1',
    hvac_filter_size: '',
    filters: [{ size: '' }] as { size: string }[],
    // Hose bib tracking
    hose_bib_count: '0',
    hose_bib_locations: '',
  });

  // Step 3: Plan Selection
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>('free');
  const [agentCode, setAgentCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [planMessage, setPlanMessage] = useState('');
  const [planMessageType, setPlanMessageType] = useState<'success' | 'error'>('success');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Step 4: Equipment
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentForm, setEquipmentForm] = useState<Equipment>({
    name: '', category: 'hvac', make: '', model: '', serial_number: '',
  });
  const [showScanner, setShowScanner] = useState(false);
  const [lookingUpModel, setLookingUpModel] = useState(false);

  // Helpers for fireplace/filter arrays
  const updateFireplaceCount = (count: string) => {
    const n = Math.max(1, Math.min(10, parseInt(count) || 1));
    const fireplaces = [...systemsForm.fireplaces];
    while (fireplaces.length < n) fireplaces.push({ type: 'wood_burning' });
    while (fireplaces.length > n) fireplaces.pop();
    setSystemsForm({ ...systemsForm, fireplace_count: String(n), fireplaces });
  };

  const updateFilterCount = (count: string) => {
    const n = Math.max(1, Math.min(10, parseInt(count) || 1));
    const filters = [...systemsForm.filters];
    while (filters.length < n) filters.push({ size: '' });
    while (filters.length > n) filters.pop();
    setSystemsForm({ ...systemsForm, number_of_hvac_filters: String(n), filters });
  };

  // ----- Submit Handlers -----

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
        created_at: new Date().toISOString(),
      };
      try {
        const saved = await upsertHome(homeData);
        setHome(saved);
      } catch {
        setHome(homeData);
      }
      setStep(2);
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

      // Determine primary fireplace type (most common among the list)
      const primaryFireplaceType = systemsForm.has_fireplace
        ? systemsForm.fireplaces[0]?.type || ''
        : '';

      const updatedHome: any = {
        ...home,
        foundation_type: systemsForm.foundation_type || null,
        roof_type: systemsForm.roof_type || null,
        roof_age_years: systemsForm.roof_age_years ? parseInt(systemsForm.roof_age_years) : null,
        heating_type: systemsForm.heating_type || null,
        cooling_type: systemsForm.cooling_type || null,
        water_source: systemsForm.water_source || null,
        sewer_type: systemsForm.sewer_type || null,
        lawn_type: systemsForm.lawn_type || null,
        has_pool: systemsForm.has_pool,
        has_deck: systemsForm.has_deck,
        has_sprinkler_system: systemsForm.has_sprinkler_system,
        has_fireplace: systemsForm.has_fireplace,
        fireplace_type: primaryFireplaceType || null,
        fireplace_count: systemsForm.has_fireplace ? (parseInt(systemsForm.fireplace_count) || 1) : null,
        has_gutters: systemsForm.has_gutters,
        has_fire_extinguisher: systemsForm.has_fire_extinguisher,
        has_water_softener: systemsForm.has_water_softener,
        has_sump_pump: systemsForm.has_sump_pump,
        has_storm_shelter: systemsForm.has_storm_shelter,
        countertop_type: systemsForm.countertop_type || null,
        number_of_hvac_filters: parseInt(systemsForm.number_of_hvac_filters) || null,
        hvac_filter_size: systemsForm.filters.map(f => f.size).filter(Boolean).join(', ') || null,
        hose_bib_locations: systemsForm.hose_bib_locations || null,
      };

      try {
        const saved = await upsertHome(updatedHome);
        setHome(saved);
      } catch {
        setHome(updatedHome);
      }
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  const handleAddEquipment = () => {
    if (!equipmentForm.name) { alert('Please enter equipment name'); return; }
    setEquipmentList([...equipmentList, { ...equipmentForm }]);
    setEquipmentForm({ name: '', category: 'hvac', make: '', model: '', serial_number: '' });
  };

  const handleModelLookup = async () => {
    if (!equipmentForm.model?.trim() && !equipmentForm.serial_number?.trim()) {
      alert('Please enter a model number or serial number to look up.');
      return;
    }
    setLookingUpModel(true);
    try {
      const result = await lookupByModelNumber(equipmentForm.model?.trim() || '', equipmentForm.serial_number?.trim() || undefined);
      const name = result.equipment_subtype
        ? `${result.make || ''} ${result.equipment_subtype}`.trim()
        : `${result.make || ''} ${result.model || equipmentForm.model}`.trim();

      const validCats: EquipmentCategory[] = ['hvac', 'water_heater', 'appliance', 'roof', 'plumbing', 'electrical', 'outdoor', 'safety', 'pool', 'garage'];
      const cat = result.category && validCats.includes(result.category as EquipmentCategory)
        ? result.category as EquipmentCategory
        : equipmentForm.category;

      setEquipmentForm(prev => ({
        ...prev,
        name: name || prev.name,
        make: result.make || prev.make,
        model: equipmentForm.model?.trim() || result.model || prev.model,
        serial_number: equipmentForm.serial_number?.trim() || result.serial_number || prev.serial_number,
        category: cat,
        equipment_subtype: result.equipment_subtype || prev.equipment_subtype,
        refrigerant_type: result.refrigerant_type || prev.refrigerant_type,
        estimated_lifespan_years: result.estimated_lifespan_years || prev.estimated_lifespan_years,
      }));
    } catch (err) {
      console.warn('Model lookup failed:', err);
      alert('Could not identify this model automatically. You can still enter details manually.');
    } finally {
      setLookingUpModel(false);
    }
  };

  const handleRemoveEquipment = (index: number) => {
    setEquipmentList(equipmentList.filter((_, i) => i !== index));
  };

  const handleScannerComplete = (scannedData: any) => {
    const { name, category, make, model, serial_number, equipment_subtype, refrigerant_type, estimated_lifespan_years } = scannedData;
    setEquipmentList([
      ...equipmentList,
      { name, category, make: make || '', model: model || '', serial_number: serial_number || '', equipment_subtype, refrigerant_type, estimated_lifespan_years },
    ]);
    setShowScanner(false);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { home, equipment: existingEquipment } = useStore.getState();
      if (!home) return;

      const allEquipment = [...existingEquipment];
      for (const item of equipmentList) {
        const equip: any = {
          id: crypto.randomUUID(),
          home_id: home.id,
          category: item.category,
          name: item.name,
          make: item.make || undefined,
          model: item.model || undefined,
          serial_number: item.serial_number || undefined,
          equipment_subtype: item.equipment_subtype || undefined,
          refrigerant_type: item.refrigerant_type || undefined,
          expected_lifespan_years: item.estimated_lifespan_years
            || (item.equipment_subtype && EQUIPMENT_LIFESPAN_DEFAULTS[item.equipment_subtype.toLowerCase()])
            || EQUIPMENT_LIFESPAN_DEFAULTS[item.category]
            || undefined,
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

      // Generate maintenance tasks
      setGeneratingTasks(true);
      try {
        const { tasks: existingTasks } = useStore.getState();
        const generatedTasks = generateTasksForHome(home, allEquipment, existingTasks);
        const lifecycleAlerts = generateEquipmentLifecycleAlerts(allEquipment, home);
        const allNewTasks = [...generatedTasks, ...lifecycleAlerts];
        if (allNewTasks.length > 0) {
          const tasksToInsert = allNewTasks.map((task) => ({
            home_id: task.home_id, equipment_id: task.equipment_id,
            title: task.title, description: task.description, instructions: task.instructions,
            category: task.category, priority: task.priority, frequency: task.frequency,
            due_date: task.due_date, status: task.status,
            estimated_minutes: task.estimated_minutes, estimated_cost: task.estimated_cost,
            applicable_months: task.applicable_months, is_weather_triggered: task.is_weather_triggered,
          }));
          try {
            const createdTasks = await createTasks(tasksToInsert);
            setTasks(createdTasks);
          } catch {
            setTasks(allNewTasks);
          }
        }
      } catch (error) {
        console.error('Error generating tasks:', error);
      } finally {
        setGeneratingTasks(false);
      }

      // Mark onboarding complete
      try { await updateProfile(user.id, { onboarding_complete: true }); } catch {}

      setStep(5);
    } finally {
      setSaving(false);
    }
  };

  const handleRedeemCode = async () => {
    if (!agentCode.trim() || !user) return;
    setRedeeming(true);
    try {
      const result = await redeemGiftCode(agentCode.trim(), user.id);
      const { setUser, setAgent } = useStore.getState();
      setUser({
        ...user,
        subscription_tier: result.tier as SubscriptionTier,
        subscription_expires_at: result.expiresAt,
        agent_id: result.agent?.id,
      });
      if (result.agent) setAgent(result.agent);
      setSelectedPlan(result.tier as SubscriptionTier);
      setPlanMessage(`Code applied! You now have ${PLANS.find(p => p.value === result.tier)?.name || result.tier} access.`);
      setPlanMessageType('success');
      setAgentCode('');
    } catch (e: any) {
      setPlanMessage(e.message || 'Invalid or expired code');
      setPlanMessageType('error');
    } finally {
      setRedeeming(false);
      setTimeout(() => setPlanMessage(''), 5000);
    }
  };

  const handlePlanCheckout = async () => {
    if (selectedPlan === 'free' || user?.subscription_tier !== 'free') {
      setStep(4);
      return;
    }
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
    if (selectedPlan === 'home' || selectedPlan === 'pro') {
      try {
        setCheckoutLoading(true);
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (token && SUPABASE_URL) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              plan: selectedPlan,
              success_url: `${window.location.origin}/onboarding?step=4&success=true&plan=${selectedPlan}`,
              cancel_url: `${window.location.origin}/onboarding?step=3&canceled=true`,
            }),
          });
          const data = await res.json();
          if (res.ok && data.url) { window.location.href = data.url; return; }
        }
      } catch (e) {
        console.warn('Stripe checkout not available:', e);
      } finally {
        setCheckoutLoading(false);
      }
    }
    setStep(4);
  };

  const [proAvailable, setProAvailable] = useState(true);

  useEffect(() => {
    loadServiceAreas().then(() => {
      const h = useStore.getState().home;
      setProAvailable(isProAvailableInArea(h?.state, h?.zip_code));
    });
  }, [home?.state, home?.zip_code]);

  // Progress bar: steps 1-4 (Address through Equipment), welcome and done don't count
  const progressStep = Math.max(0, Math.min(step - 1, PROGRESS_STEPS));
  const showProgress = step >= 1 && step <= 4;

  return (
    <div className="page" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 40, paddingBottom: 60 }}>
      {/* Progress Bar — only visible during steps 1-4 */}
      {showProgress && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {Array.from({ length: PROGRESS_STEPS }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1, height: 4,
                  backgroundColor: i < progressStep ? Colors.copper : i === progressStep ? Colors.copper : Colors.lightGray,
                  borderRadius: 2,
                  transition: 'background-color 0.3s ease',
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
            Step {progressStep + 1} of {PROGRESS_STEPS}
          </p>
        </div>
      )}

      {/* ===== STEP 0: Welcome / What is Canopy ===== */}
      {step === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: `linear-gradient(135deg, ${Colors.sage}40, ${Colors.copper}30)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            border: `3px solid ${Colors.sage}`,
            fontSize: 36,
          }}>
            🏡
          </div>

          <h1 style={{ fontSize: 28, fontWeight: 700, color: Colors.charcoal, marginBottom: 8, lineHeight: 1.2 }}>
            Welcome to Canopy
          </h1>
          <p style={{ fontSize: 16, color: Colors.medGray, maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Your home's maintenance co-pilot. We'll help you stay on top of everything your home needs — so nothing falls through the cracks.
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
            maxWidth: 420, margin: '0 auto 32px', textAlign: 'left',
          }}>
            {VALUE_PROPS.map((prop, i) => (
              <div key={i} style={{
                padding: 16, backgroundColor: '#faf9f7', borderRadius: 12,
                borderLeft: `3px solid ${Colors.sage}`,
              }}>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>{prop.icon}</span>
                <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 4px', color: Colors.charcoal }}>{prop.title}</p>
                <p style={{ fontSize: 12, color: Colors.medGray, margin: 0, lineHeight: 1.4 }}>{prop.desc}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 24, lineHeight: 1.5 }}>
            Setup takes about 3 minutes. We'll ask about your home, then you can scan your equipment labels for a personalized maintenance plan.
          </p>

          <button
            className="btn btn-primary"
            style={{ padding: '14px 48px', fontSize: 16 }}
            onClick={() => setStep(1)}
          >
            Let's Set Up Your Home
          </button>
        </div>
      )}

      {/* ===== STEP 1: Address ===== */}
      {step === 1 && (
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Where is your home?</h2>
          <p style={{ color: Colors.medGray, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
            We'll use this to tailor maintenance tasks to your climate and local conditions.
          </p>

          <div className="form-group">
            <label>Street Address *</label>
            <input className="form-input" placeholder="123 Oak Street" value={addressForm.address}
              onChange={e => setAddressForm({ ...addressForm, address: e.target.value })} />
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label>City *</label>
              <input className="form-input" placeholder="Tulsa" value={addressForm.city}
                onChange={e => setAddressForm({ ...addressForm, city: e.target.value })} />
            </div>
            <div className="form-group">
              <label>State *</label>
              <input className="form-input" placeholder="OK" value={addressForm.state}
                onChange={e => setAddressForm({ ...addressForm, state: e.target.value })} />
            </div>
            <div className="form-group">
              <label>ZIP *</label>
              <input className="form-input" placeholder="74103" value={addressForm.zip_code}
                onChange={e => setAddressForm({ ...addressForm, zip_code: e.target.value })} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Year Built</label>
              <input className="form-input" type="number" placeholder="1998" value={addressForm.year_built}
                onChange={e => setAddressForm({ ...addressForm, year_built: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Sq Ft</label>
              <input className="form-input" type="number" placeholder="2400" value={addressForm.square_footage}
                onChange={e => setAddressForm({ ...addressForm, square_footage: e.target.value })} />
            </div>
          </div>

          <div className="grid-4">
            <div className="form-group">
              <label>Stories</label>
              <input className="form-input" type="number" value={addressForm.stories}
                onChange={e => setAddressForm({ ...addressForm, stories: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Beds</label>
              <input className="form-input" type="number" value={addressForm.bedrooms}
                onChange={e => setAddressForm({ ...addressForm, bedrooms: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Baths</label>
              <input className="form-input" type="number" value={addressForm.bathrooms}
                onChange={e => setAddressForm({ ...addressForm, bathrooms: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Garage</label>
              <input className="form-input" type="number" value={addressForm.garage_spaces}
                onChange={e => setAddressForm({ ...addressForm, garage_spaces: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-sm mt-lg">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" onClick={handleAddressSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 2: Home Systems ===== */}
      {step === 2 && (
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>What systems does your home have?</h2>
          <p style={{ color: Colors.medGray, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
            This helps us generate the right maintenance tasks for your specific home.
          </p>

          {/* Foundation */}
          <div className="form-group">
            <label>Foundation Type</label>
            <select className="form-select" value={systemsForm.foundation_type}
              onChange={e => setSystemsForm({ ...systemsForm, foundation_type: e.target.value })}>
              <option value="">Select...</option>
              {['slab', 'crawlspace', 'basement', 'pier_and_beam'].map(v => (
                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Roof Type</label>
              <select className="form-select" value={systemsForm.roof_type}
                onChange={e => setSystemsForm({ ...systemsForm, roof_type: e.target.value })}>
                <option value="">Select...</option>
                {['asphalt_shingle', 'metal', 'tile', 'slate', 'flat', 'wood_shake'].map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Roof Age (years)</label>
              <input className="form-input" type="number" value={systemsForm.roof_age_years}
                onChange={e => setSystemsForm({ ...systemsForm, roof_age_years: e.target.value })} />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Heating</label>
              <select className="form-select" value={systemsForm.heating_type}
                onChange={e => setSystemsForm({ ...systemsForm, heating_type: e.target.value })}>
                <option value="">Select...</option>
                {['forced_air', 'heat_pump', 'radiant', 'boiler', 'baseboard'].map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Cooling</label>
              <select className="form-select" value={systemsForm.cooling_type}
                onChange={e => setSystemsForm({ ...systemsForm, cooling_type: e.target.value })}>
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
              <select className="form-select" value={systemsForm.water_source}
                onChange={e => setSystemsForm({ ...systemsForm, water_source: e.target.value })}>
                <option value="">Select...</option>
                <option value="municipal">Municipal</option>
                <option value="well">Well</option>
              </select>
            </div>
            <div className="form-group">
              <label>Sewer Type</label>
              <select className="form-select" value={systemsForm.sewer_type}
                onChange={e => setSystemsForm({ ...systemsForm, sewer_type: e.target.value })}>
                <option value="">Select...</option>
                <option value="municipal">Municipal</option>
                <option value="septic">Septic</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Lawn Type</label>
            <select className="form-select" value={systemsForm.lawn_type}
              onChange={e => setSystemsForm({ ...systemsForm, lawn_type: e.target.value as any })}>
              <option value="none">None</option>
              {['bermuda', 'fescue', 'zoysia', 'st_augustine', 'bluegrass', 'buffalo', 'mixed'].map(v => (
                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {/* System toggles */}
          <p style={{ fontSize: 14, fontWeight: 600, margin: '20px 0 12px', color: Colors.charcoal }}>Home features</p>
          <div className="grid-2">
            {(['has_pool', 'has_deck', 'has_sprinkler_system', 'has_fireplace', 'has_gutters', 'has_fire_extinguisher', 'has_water_softener', 'has_sump_pump', 'has_storm_shelter'] as const).map(key => (
              <label key={key} className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={systemsForm[key] as boolean}
                  onChange={e => setSystemsForm({ ...systemsForm, [key]: e.target.checked })} />
                <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{key.replace(/has_/, '').replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>

          {/* Per-fireplace details */}
          {systemsForm.has_fireplace && (
            <div style={{ backgroundColor: '#faf9f7', borderRadius: 12, padding: 16, marginTop: 16 }}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Number of Fireplaces</label>
                <input className="form-input" type="number" min="1" max="10"
                  value={systemsForm.fireplace_count}
                  onChange={e => updateFireplaceCount(e.target.value)} />
              </div>
              {systemsForm.fireplaces.map((fp, i) => (
                <div key={i} className="form-group" style={{ marginBottom: i < systemsForm.fireplaces.length - 1 ? 8 : 0 }}>
                  <label style={{ fontSize: 13 }}>Fireplace {systemsForm.fireplaces.length > 1 ? `#${i + 1}` : ''} Type</label>
                  <select className="form-select" value={fp.type}
                    onChange={e => {
                      const updated = [...systemsForm.fireplaces];
                      updated[i] = { ...updated[i], type: e.target.value };
                      setSystemsForm({ ...systemsForm, fireplaces: updated });
                    }}>
                    {FIREPLACE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* HVAC filter details — show if heating or cooling is set */}
          {(systemsForm.heating_type || systemsForm.cooling_type) && (
            <div style={{ backgroundColor: '#faf9f7', borderRadius: 12, padding: 16, marginTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: Colors.charcoal }}>HVAC Filters</p>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Number of HVAC Filters/Returns</label>
                <input className="form-input" type="number" min="1" max="10"
                  value={systemsForm.number_of_hvac_filters}
                  onChange={e => updateFilterCount(e.target.value)} />
              </div>
              {systemsForm.filters.map((filter, i) => (
                <div key={i} className="form-group" style={{ marginBottom: i < systemsForm.filters.length - 1 ? 8 : 0 }}>
                  <label style={{ fontSize: 13 }}>Filter {systemsForm.filters.length > 1 ? `#${i + 1}` : ''} Size</label>
                  <input className="form-input" placeholder='e.g., 20x25x1'
                    value={filter.size}
                    onChange={e => {
                      const updated = [...systemsForm.filters];
                      updated[i] = { ...updated[i], size: e.target.value };
                      setSystemsForm({ ...systemsForm, filters: updated });
                    }} />
                </div>
              ))}
            </div>
          )}

          {/* Hose bibs */}
          <div style={{ backgroundColor: '#faf9f7', borderRadius: 12, padding: 16, marginTop: 16 }}>
            <div className="grid-2">
              <div className="form-group">
                <label>Outdoor Hose Bibs</label>
                <input className="form-input" type="number" min="0" max="20"
                  value={systemsForm.hose_bib_count}
                  onChange={e => setSystemsForm({ ...systemsForm, hose_bib_count: e.target.value })} />
              </div>
              {parseInt(systemsForm.hose_bib_count) > 0 && (
                <div className="form-group">
                  <label>Locations</label>
                  <input className="form-input" placeholder="Front, Back, Garage"
                    value={systemsForm.hose_bib_locations}
                    onChange={e => setSystemsForm({ ...systemsForm, hose_bib_locations: e.target.value })} />
                </div>
              )}
            </div>
          </div>

          {/* Countertop */}
          <div className="form-group mt-md">
            <label>Countertop Type</label>
            <select className="form-select" value={systemsForm.countertop_type}
              onChange={e => setSystemsForm({ ...systemsForm, countertop_type: e.target.value })}>
              <option value="">Select...</option>
              {['granite', 'marble', 'quartz', 'butcher_block', 'laminate', 'tile', 'concrete', 'stainless_steel'].map(v => (
                <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-sm mt-lg">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={handleSystemsSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: Choose Your Plan ===== */}
      {step === 3 && (
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Choose your plan</h2>
          <p style={{ color: Colors.medGray, marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
            Start free or unlock the full Canopy experience. You can change your plan anytime.
          </p>

          {planMessage && (
            <div style={{
              padding: '10px 16px', borderRadius: 8,
              background: planMessageType === 'success' ? '#4CAF5020' : '#E5393520',
              color: planMessageType === 'success' ? '#2E7D32' : '#C62828',
              fontSize: 14, marginBottom: 16,
            }}>
              {planMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {PLANS.map(plan => {
              const isSelected = selectedPlan === plan.value;
              const isInquiry = (plan as any).inquireForPricing === true;
              const isProTier = plan.value === 'pro' || plan.value === 'pro_plus';
              const isLocked = isProTier && !proAvailable;

              return (
                <div
                  key={plan.id}
                  onClick={() => { if (!isLocked) setSelectedPlan(plan.value); }}
                  style={{
                    border: `2px solid ${isSelected ? Colors.copper : 'transparent'}`,
                    borderRadius: 12, padding: 20,
                    backgroundColor: isSelected ? Colors.copperMuted : '#fff',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.55 : 1,
                    position: 'relative', transition: 'all 0.2s ease',
                  }}
                >
                  {plan.value === 'home' && (
                    <span style={{
                      position: 'absolute', top: -10, right: 16,
                      background: Colors.copper, color: '#fff',
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                    }}>
                      Most Popular
                    </span>
                  )}
                  {isLocked && (
                    <div style={{ fontSize: 12, color: Colors.medGray, marginBottom: 8 }}>
                      Not available in your area yet
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: isSelected ? Colors.copper : Colors.charcoal }}>
                        {plan.name}
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: isSelected ? Colors.copper : Colors.charcoal, marginTop: 2 }}>
                        {isInquiry ? 'Custom Pricing' : `$${plan.price}`}
                        {!isInquiry && plan.period && (
                          <span style={{ fontSize: 13, color: Colors.medGray, fontWeight: 400 }}>{plan.period}</span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{
                        width: 24, height: 24, borderRadius: 12,
                        background: Colors.copper, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CheckIcon size={14} color="#fff" />
                      </div>
                    )}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
                    {plan.features.map((f, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                        <CheckIcon size={12} color={isSelected ? Colors.copper : Colors.sage} />
                        <span style={{ color: isLocked ? Colors.silver : Colors.charcoal }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Agent / Gift Code */}
          <div style={{ background: '#f9f9f7', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Have an agent or gift code?</h3>
            <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12 }}>
              Enter a code from your real estate agent to unlock premium features.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" value={agentCode}
                onChange={e => setAgentCode(e.target.value.toUpperCase())}
                placeholder="Enter code" style={{ flex: 1, fontWeight: 600, letterSpacing: 1 }} />
              <button className="btn btn-primary" onClick={handleRedeemCode}
                disabled={redeeming || !agentCode.trim()}>
                {redeeming ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>

          <div className="flex gap-sm">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-primary" onClick={handlePlanCheckout} disabled={checkoutLoading}>
              {checkoutLoading ? 'Setting up checkout...'
                : selectedPlan === 'free' ? 'Continue with Free'
                : `Continue with ${PLANS.find(p => p.value === selectedPlan)?.name}`}
            </button>
          </div>
          <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12 }}>
            You can always change your plan later from Settings.
          </p>
        </div>
      )}

      {/* ===== STEP 4: Scan Equipment ===== */}
      {step === 4 && (
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Scan your equipment</h2>
          <p style={{ color: Colors.medGray, marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            Scanning your equipment labels lets Canopy build a personalized maintenance schedule, track warranty info, and alert you to issues like phased-out refrigerants.
          </p>

          {showScanner ? (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, margin: 0 }}>Scan Equipment Label</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowScanner(false)}>Back to list</button>
              </div>
              <EquipmentScanner onScanComplete={handleScannerComplete} onClose={() => setShowScanner(false)} />
            </div>
          ) : (
            <>
              {/* Scanned items list */}
              {equipmentList.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal, marginBottom: 12 }}>
                    {equipmentList.length} item{equipmentList.length !== 1 ? 's' : ''} added
                  </p>
                  {equipmentList.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', backgroundColor: '#f8f8f6', borderRadius: 10,
                      marginBottom: 8, borderLeft: `3px solid ${Colors.sage}`,
                    }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>{item.name}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: Colors.medGray }}>
                          {item.equipment_subtype || item.category}{item.make ? ` · ${item.make}` : ''}
                        </p>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveEquipment(i)} style={{ fontSize: 12 }}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn btn-primary" onClick={() => setShowScanner(true)}
                style={{ width: '100%', marginBottom: 24, padding: '14px 0', fontSize: 15 }}>
                {equipmentList.length > 0 ? '+ Scan Another Label' : 'Scan Equipment Label'}
              </button>

              {/* Equipment suggestions */}
              <div style={{ backgroundColor: '#faf9f7', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal, marginBottom: 4 }}>
                  {equipmentList.length > 0 ? 'What else can you scan?' : 'What should I scan?'}
                </p>
                <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 16, lineHeight: 1.5 }}>
                  Look for stickers or nameplates on these common items. Each scan gives Canopy more data to work with.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {SCAN_SUGGESTIONS.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 18, lineHeight: '24px', flexShrink: 0 }}>{item.icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: Colors.charcoal }}>{item.label}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: Colors.medGray }}>{item.hint}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual entry */}
              <details style={{ marginBottom: 24 }}>
                <summary style={{ fontSize: 13, color: Colors.copper, cursor: 'pointer', fontWeight: 500, marginBottom: 12 }}>
                  Or enter model/serial number manually
                </summary>
                <div style={{ paddingTop: 12 }}>
                  <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 16, lineHeight: 1.5 }}>
                    Enter the model number from the label and we'll try to identify the equipment automatically.
                  </p>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Model Number</label>
                      <input className="form-input" placeholder="e.g., CAPF3743C6" value={equipmentForm.model}
                        onChange={e => setEquipmentForm({ ...equipmentForm, model: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Serial Number <span style={{ color: Colors.medGray, fontWeight: 400 }}>(optional)</span></label>
                      <input className="form-input" placeholder="e.g., 1911123456" value={equipmentForm.serial_number || ''}
                        onChange={e => setEquipmentForm({ ...equipmentForm, serial_number: e.target.value })} />
                    </div>
                  </div>

                  {(equipmentForm.model?.trim() || equipmentForm.serial_number?.trim()) && (
                    <button
                      className="btn btn-primary"
                      onClick={handleModelLookup}
                      disabled={lookingUpModel}
                      style={{ width: '100%', marginBottom: 16, backgroundColor: Colors.charcoal }}
                    >
                      {lookingUpModel ? 'Looking up...' : 'Auto-identify from model #'}
                    </button>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
                    <div style={{ flex: 1, height: 1, backgroundColor: '#e0e0e0' }} />
                    <span style={{ fontSize: 11, color: Colors.medGray }}>or fill in manually</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: '#e0e0e0' }} />
                  </div>

                  <div className="form-group">
                    <label>Equipment Name *</label>
                    <input className="form-input" placeholder="e.g., Central AC Unit" value={equipmentForm.name}
                      onChange={e => setEquipmentForm({ ...equipmentForm, name: e.target.value })} />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Category</label>
                      <select className="form-select" value={equipmentForm.category}
                        onChange={e => setEquipmentForm({ ...equipmentForm, category: e.target.value as EquipmentCategory })}>
                        {EQUIPMENT_CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Make / Brand</label>
                      <input className="form-input" placeholder="Carrier, Trane, Goodman" value={equipmentForm.make}
                        onChange={e => setEquipmentForm({ ...equipmentForm, make: e.target.value })} />
                    </div>
                  </div>
                  <button className="btn btn-secondary" onClick={handleAddEquipment} style={{ width: '100%' }}>
                    + Add Equipment
                  </button>
                </div>
              </details>

              {/* Inspection report upload */}
              <details style={{ marginBottom: 24 }}>
                <summary style={{ fontSize: 13, color: Colors.copper, cursor: 'pointer', fontWeight: 500, marginBottom: 12 }}>
                  Have a home inspection report?
                </summary>
                <div style={{ paddingTop: 12 }}>
                  <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 16, lineHeight: 1.5 }}>
                    Upload your inspection report and Canopy will extract maintenance items and add them to your plan automatically.
                  </p>
                  <InspectionUploader onTasksCreated={(count) => {
                    if (count > 0) {
                      // Refresh tasks in store so the plan reflects inspection items
                      const { tasks } = useStore.getState();
                      supabase.from('tasks').select('*').eq('home_id', home?.id).then(({ data }) => {
                        if (data) setTasks(data);
                      });
                    }
                  }} />
                </div>
              </details>
            </>
          )}

          <div className="flex gap-sm mt-lg">
            <button className="btn btn-ghost" onClick={() => setStep(3)} disabled={saving || generatingTasks}>Back</button>
            <button className="btn btn-primary" onClick={handleFinish} disabled={saving || generatingTasks} style={{ flex: 1 }}>
              {generatingTasks ? 'Generating your plan...' : saving ? 'Finishing...' : equipmentList.length > 0 ? "Done — Build My Plan" : "Skip — I'll Add Later"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12, textAlign: 'center' }}>
            You can always scan more equipment later from the Equipment tab.
          </p>
        </div>
      )}

      {/* ===== STEP 5: Personalized Welcome ===== */}
      {step === 5 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: `linear-gradient(135deg, ${Colors.sage}30, ${Colors.copper}20)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', border: `3px solid ${Colors.sage}`,
          }}>
            <CheckCircleIcon size={48} color={Colors.sage} />
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Welcome to Canopy!</h2>
          <p style={{ fontSize: 16, color: Colors.medGray, maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.6 }}>
            Your personalized home maintenance plan is ready.
            {equipmentList.length > 0 && ` We've set up ${equipmentList.length} equipment item${equipmentList.length !== 1 ? 's' : ''} and generated maintenance tasks based on your home profile.`}
            {equipmentList.length === 0 && ' Head to the Equipment tab anytime to scan labels and get tailored maintenance reminders.'}
          </p>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, maxWidth: 420, margin: '0 auto 32px' }}>
            {[
              { label: 'Equipment', value: equipmentList.length, icon: '🔧' },
              { label: 'Systems', value: Object.entries(systemsForm).filter(([k, v]) => k.startsWith('has_') && v === true).length, icon: '🏠' },
              { label: 'Plan', value: PLANS.find(p => p.value === (user?.subscription_tier || selectedPlan))?.name || 'Free', icon: '⭐' },
            ].map((card, i) => (
              <div key={i} style={{
                padding: 16, backgroundColor: '#faf9f7', borderRadius: 12, textAlign: 'center',
              }}>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>{card.icon}</span>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.charcoal, margin: 0 }}>{card.value}</p>
                <p style={{ fontSize: 12, color: Colors.medGray, margin: '4px 0 0' }}>{card.label}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{ textAlign: 'left', maxWidth: 420, margin: '0 auto 32px' }}>
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Explore your dashboard:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Check your calendar', desc: 'See upcoming maintenance tasks by month' },
                { label: 'Monitor the weather', desc: 'Get proactive alerts for storms and freeze warnings' },
                { label: 'Add more equipment', desc: 'Scan labels for tailored maintenance reminders' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%', background: Colors.copperMuted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, color: Colors.copper, flexShrink: 0, marginTop: 2,
                  }}>
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: Colors.medGray, margin: '2px 0 0' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: '14px 48px', fontSize: 16 }}
            onClick={() => navigate('/', { replace: true })}
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
