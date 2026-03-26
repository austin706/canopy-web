import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { upsertHome, upsertEquipment, updateProfile, createTasks, redeemGiftCode, supabase } from '@/services/supabase';
import { generateTasksForHome, generateEquipmentLifecycleAlerts } from '@/services/taskEngine';
import { PLANS, isProAvailableInArea } from '@/services/subscriptionGate';
import { EQUIPMENT_LIFESPAN_DEFAULTS } from '@/constants/maintenance';
import EquipmentScanner from '@/components/EquipmentScanner';
import InspectionUploader from '@/components/InspectionUploader';
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

/** Common equipment items to guide users on what to scan */
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

interface Equipment {
  name: string;
  category: EquipmentCategory;
  make: string;
  model: string;
  equipment_subtype?: string;
  refrigerant_type?: string;
  estimated_lifespan_years?: number;
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
    const { name, category, make, model, equipment_subtype, refrigerant_type, estimated_lifespan_years } = scannedData;
    setEquipmentList([
      ...equipmentList,
      {
        name,
        category,
        make: make || '',
        model: model || '',
        equipment_subtype,
        refrigerant_type,
        estimated_lifespan_years,
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
      setStep(4);
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
      setStep(3);
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
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              plan: selectedPlan,
              success_url: `${window.location.origin}/onboarding?step=3&success=true&plan=${selectedPlan}`,
              cancel_url: `${window.location.origin}/onboarding?step=2&canceled=true`,
            }),
          });
          const data = await res.json();
          if (res.ok && data.url) {
            window.location.href = data.url;
            return;
          }
        }
      } catch (e) {
        console.warn('Stripe checkout not available:', e);
      } finally {
        setCheckoutLoading(false);
      }
    }

    // If checkout not available, continue anyway
    setStep(3);
  };

  const proAvailable = isProAvailableInArea(
    useStore.getState().home?.state,
    useStore.getState().home?.zip_code,
  );

  const progressPercent = step >= 4 ? 100 : ((step + 1) / 4) * 100;

  return (
    <div className="page" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 40 }}>
      {/* Progress Bar */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[0, 1, 2, 3].map(i => (
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
          Step {Math.min(step + 1, 4)} of 4
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

      {/* Step 3: Choose Your Plan */}
      {step === 2 && (
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Choose your plan</h2>
          <p style={{ color: Colors.medGray, marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
            Start free or unlock the full Canopy experience. You can change your plan anytime.
          </p>

          {planMessage && (
            <div style={{
              padding: '10px 16px',
              borderRadius: 8,
              background: planMessageType === 'success' ? '#4CAF5020' : '#E5393520',
              color: planMessageType === 'success' ? '#2E7D32' : '#C62828',
              fontSize: 14,
              marginBottom: 16,
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
                  onClick={() => {
                    if (isLocked) return;
                    setSelectedPlan(plan.value);
                  }}
                  style={{
                    border: `2px solid ${isSelected ? Colors.copper : 'transparent'}`,
                    borderRadius: 12,
                    padding: 20,
                    backgroundColor: isSelected ? Colors.copperMuted : '#fff',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.55 : 1,
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Popular badge */}
                  {plan.value === 'home' && (
                    <span style={{
                      position: 'absolute',
                      top: -10,
                      right: 16,
                      background: Colors.copper,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 10,
                    }}>
                      Most Popular
                    </span>
                  )}

                  {/* Locked badge */}
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
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        background: Colors.copper,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
          <div style={{
            background: '#f9f9f7',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Have an agent or gift code?</h3>
            <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12 }}>
              Enter a code from your real estate agent to unlock premium features.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                value={agentCode}
                onChange={e => setAgentCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
                style={{ flex: 1, fontWeight: 600, letterSpacing: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={handleRedeemCode}
                disabled={redeeming || !agentCode.trim()}
              >
                {redeeming ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>

          <div className="flex gap-sm">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button
              className="btn btn-primary"
              onClick={handlePlanCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading
                ? 'Setting up checkout...'
                : selectedPlan === 'free'
                ? 'Continue with Free'
                : `Continue with ${PLANS.find(p => p.value === selectedPlan)?.name}`}
            </button>
          </div>
          <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12 }}>
            You can always change your plan later from Settings.
          </p>
        </div>
      )}

      {/* Step 4: Scan Equipment */}
      {step === 3 && (
        <div className="card">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Scan your equipment</h2>
          <p style={{ color: Colors.medGray, marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            Scanning your equipment labels lets Canopy build a personalized maintenance schedule, track warranty info, and alert you to issues like phased-out refrigerants.
          </p>

          {showScanner ? (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, margin: 0 }}>Scan Equipment Label</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowScanner(false)}>Back to list</button>
              </div>
              <EquipmentScanner
                onScanComplete={handleScannerComplete}
                onClose={() => setShowScanner(false)}
              />
            </div>
          ) : (
            <>
              {/* Scanned items list */}
              {equipmentList.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal, marginBottom: 12 }}>
                    {equipmentList.length} item{equipmentList.length !== 1 ? 's' : ''} scanned
                  </p>
                  {equipmentList.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: '#f8f8f6',
                        borderRadius: 10,
                        marginBottom: 8,
                        borderLeft: `3px solid ${Colors.sage}`,
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>{item.name}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: Colors.medGray }}>
                          {item.equipment_subtype || item.category}{item.make ? ` · ${item.make}` : ''}
                        </p>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveEquipment(i)}
                        style={{ fontSize: 12 }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Scan another button */}
              <button
                className="btn btn-primary"
                onClick={() => setShowScanner(true)}
                style={{ width: '100%', marginBottom: 24, padding: '14px 0', fontSize: 15 }}
              >
                {equipmentList.length > 0 ? '+ Scan Another Label' : 'Scan Equipment Label'}
              </button>

              {/* Equipment suggestion checklist */}
              <div style={{
                backgroundColor: '#faf9f7',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal, marginBottom: 4 }}>
                  {equipmentList.length > 0 ? 'What else can you scan?' : 'What should I scan?'}
                </p>
                <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 16, lineHeight: 1.5 }}>
                  Look for stickers or nameplates on these common items. Each scan gives Canopy more data to work with.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {SCAN_SUGGESTIONS.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}
                    >
                      <span style={{ fontSize: 18, lineHeight: '24px', flexShrink: 0 }}>{item.icon}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: Colors.charcoal }}>{item.label}</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: Colors.medGray }}>{item.hint}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual entry toggle */}
              <details style={{ marginBottom: 24 }}>
                <summary style={{ fontSize: 13, color: Colors.copper, cursor: 'pointer', fontWeight: 500, marginBottom: 12 }}>
                  Or add equipment manually
                </summary>
                <div style={{ paddingTop: 12 }}>
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
                  <button className="btn btn-secondary" onClick={handleAddEquipment} style={{ width: '100%' }}>
                    + Add Manually
                  </button>
                </div>
              </details>

              {/* Inspection report upload (optional) */}
              <details style={{ marginBottom: 24 }}>
                <summary style={{ fontSize: 13, color: Colors.copper, cursor: 'pointer', fontWeight: 500, marginBottom: 12 }}>
                  Have a home inspection report?
                </summary>
                <div style={{ paddingTop: 12 }}>
                  <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 16, lineHeight: 1.5 }}>
                    Upload your inspection report and Canopy will extract maintenance items and add them to your plan automatically.
                  </p>
                  <InspectionUploader
                    onTasksCreated={(count) => {
                      // Just show confirmation — tasks are saved by the component
                    }}
                  />
                </div>
              </details>
            </>
          )}

          <div className="flex gap-sm mt-lg">
            <button className="btn btn-ghost" onClick={() => setStep(2)} disabled={saving || generatingTasks}>Back</button>
            <button className="btn btn-primary" onClick={handleFinish} disabled={saving || generatingTasks} style={{ flex: 1 }}>
              {generatingTasks ? 'Generating your plan...' : saving ? 'Finishing...' : equipmentList.length > 0 ? "Done — Build My Plan" : "Skip — I'll Add Later"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12, textAlign: 'center' }}>
            You can always scan more equipment later from the Equipment tab.
          </p>
        </div>
      )}

      {/* Step 5: Completion / Welcome Screen */}
      {step === 4 && (
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
