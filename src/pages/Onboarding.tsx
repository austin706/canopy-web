import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import logger from '@/utils/logger';
import { upsertHome, upsertEquipment, updateProfile, createTasks, redeemGiftCode, supabase, createHomeJoinRequest, sendNotification, insertProInterest, getUserHomes } from '@/services/supabase';
import { verifyAddress, findExistingProperty } from '@/services/addressVerification';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { generateTasksForHome, generateEquipmentLifecycleAlerts } from '@/services/taskEngine';
import { PLANS, isProAvailableInArea, loadServiceAreas, getEquipmentLimit, getHomeLimit, isPremium } from '@/services/subscriptionGate';
import { requestConsultation } from '@/services/proPlus';
import { findProviderForZip } from '@/services/proEnrollment';
import { EQUIPMENT_LIFESPAN_DEFAULTS } from '@/constants/maintenance';
import { lookupByModelNumber } from '@/services/ai';
import { Colors } from '@/constants/theme';
import { CheckCircleIcon, CheckIcon } from '@/components/icons/Icons';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';
import { trackEvent } from '@/utils/analytics';
import EquipmentScanner from '@/components/EquipmentScanner';
import InspectionUploader from '@/components/InspectionUploader';
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
  { value: 'fireplace', label: 'Fireplace' },
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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// Load Stripe.js from CDN (cached after first load)
let stripePromise: Promise<any> | null = null;
function loadStripe(): Promise<any> {
  if (stripePromise) return stripePromise;
  stripePromise = new Promise((resolve, reject) => {
    if ((window as unknown as { Stripe?: any }).Stripe) {
      resolve(((window as unknown) as { Stripe: any }).Stripe(STRIPE_PUBLISHABLE_KEY));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.onload = () => resolve(((window as unknown) as { Stripe: any }).Stripe(STRIPE_PUBLISHABLE_KEY));
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });
  return stripePromise;
}

// Total onboarding steps (0-indexed): Welcome(0), Address(1), Systems(2), Plan(3), Equipment+Inspection(4), Ready(5), Done(6)
const STEP_WELCOME = 0;
const STEP_ADDRESS = 1;
const STEP_SYSTEMS = 2;
const STEP_PLAN = 3;
const STEP_EQUIPMENT = 4;
const STEP_READY = 5;
const STEP_DONE = 6;
const TOTAL_STEPS = 7;
const PROGRESS_STEPS = 5; // Steps shown in progress bar (Address, Systems, Plan, Equipment, Finish). H-4: Equipment scan + inspection upload restored as optional onboarding step.

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, home, setHome, addEquipment, customTemplates, setTasks } = useStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [generatingTasks, setGeneratingTasks] = useState(false);

  // Address claim state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showOwnHomeModal, setShowOwnHomeModal] = useState(false);
  const [claimInfo, setClaimInfo] = useState<{ homeId: string; ownerId: string } | null>(null);
  const [joinRequestSent, setJoinRequestSent] = useState(false);

  // Home limit gate state
  const [showHomeLimitModal, setShowHomeLimitModal] = useState(false);
  const [homeLimitReached, setHomeLimitReached] = useState<'upgrade' | 'contact' | null>(null);
  const [userHomeCount, setUserHomeCount] = useState(0);

  // Address verification state
  const [verifiedAddress, setVerifiedAddress] = useState<{
    normalizedAddress: string; city: string; state: string; zipCode: string;
    latitude?: number; longitude?: number; isValid: boolean;
  } | null>(null);
  const [showVerifiedConfirm, setShowVerifiedConfirm] = useState(false);
  // Google Places canonical identity — captured when the user picks a
  // suggestion from AddressAutocomplete. This is the primary dedup key.
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  // Detect "add property" mode — existing user coming back to add another home
  const isAddPropertyMode = !!(user?.onboarding_complete || home);

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
      // GA4: upgrade completed via Stripe redirect
      trackEvent('upgrade_complete', { plan, source: 'stripe_redirect', surface: 'onboarding' });
    }
  }, []);

  // GA4: emit an onboarding_step_complete event whenever the step advances.
  // Fires on mount with the starting step so we capture "step 0 viewed."
  useEffect(() => {
    trackEvent('onboarding_step_complete', { step, add_property_mode: isAddPropertyMode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Prevent back button from logging user out — push state on step changes
  // In add-property mode, allow back button to return to dashboard
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      if (step > STEP_ADDRESS || (step === STEP_ADDRESS && !isAddPropertyMode)) {
        setStep(s => s - 1);
        window.history.pushState(null, '', '/onboarding');
      } else if (isAddPropertyMode) {
        // Existing user hitting back on step 0 or 1 — let them leave
        navigate('/', { replace: true });
      } else {
        // New user at step 0 — stay on onboarding
        window.history.pushState(null, '', '/onboarding');
      }
    };

    window.history.pushState(null, '', '/onboarding');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [step, isAddPropertyMode, navigate]);

  // Step 1: Address
  const [addressForm, setAddressForm] = useState({
    address: '', city: '', state: '', zip_code: '',
    year_built: '', square_footage: '',
    stories: '1', bedrooms: '3', bathrooms: '2', garage_spaces: '0',
  });

  // Step 2: Home Systems
  const [systemsForm, setSystemsForm] = useState({
    foundation_type: '',
    roof_type: '', roof_install_year: '',
    heating_type: '', cooling_type: '',
    water_source: '', sewer_type: '', septic_type: '',
    lawn_type: 'none',
    has_pool: false, has_deck: false, has_sprinkler_system: false,
    has_fireplace: false, has_gutters: true, has_fountain: false,
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
    // Pool details tracking
    pool_type: 'in-ground',
    pool_lining: 'vinyl',
    has_hot_tub: false,
    pool_heating: 'none',
    pool_chemical_treatment: 'chlorine',
    has_pool_fencing: false,
    // Hose bib tracking
    hose_bib_count: '0',
    hose_bib_locations: '',
  });

  // Step 2b: User Preferences
  const [maintenanceDepth, setMaintenanceDepth] = useState<'simple' | 'standard' | 'comprehensive'>('standard');
  const [showCleaningTasks, setShowCleaningTasks] = useState(true);

  // Step 3: Plan Selection
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>('free');
  const [agentCode, setAgentCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [planMessage, setPlanMessage] = useState('');
  const [planMessageType, setPlanMessageType] = useState<'success' | 'error'>('success');

  // C11: Inline error banner (replaces alert() calls throughout onboarding)
  const [inlineError, setInlineError] = useState<string | null>(null);
  const inlineErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineErrorRef = useRef<HTMLDivElement>(null);
  const showInlineError = (msg: string) => {
    setInlineError(msg);
    if (inlineErrorTimer.current) clearTimeout(inlineErrorTimer.current);
    // Auto-clear after 8 seconds so errors don't linger across steps
    inlineErrorTimer.current = setTimeout(() => setInlineError(null), 8000);
    // Scroll the banner into view so the user actually sees it
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  // Focus error banner when it appears (accessibility)
  useEffect(() => {
    if (inlineError && inlineErrorRef.current) {
      inlineErrorRef.current.focus();
    }
  }, [inlineError]);
  // Clear the banner when the user changes steps
  useEffect(() => {
    setInlineError(null);
    if (inlineErrorTimer.current) {
      clearTimeout(inlineErrorTimer.current);
      inlineErrorTimer.current = null;
    }
  }, [step]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [requestingProPlus, setRequestingProPlus] = useState(false);
  const [notifyMeSubmitted, setNotifyMeSubmitted] = useState<Record<string, boolean>>({});
  const [notifyMeLoading, setNotifyMeLoading] = useState<string | null>(null);

  const handleNotifyMe = async (tierInterest: 'pro' | 'pro_plus') => {
    if (!user) return;
    setNotifyMeLoading(tierInterest);
    try {
      const home = useStore.getState().home;
      await insertProInterest({
        email: user.email,
        zip_code: home?.zip_code || addressForm.zip_code || null,
        user_id: user.id,
        state: home?.state || addressForm.state || null,
        city: home?.city || addressForm.city || null,
        full_name: user.full_name || null,
        tier_interest: tierInterest,
      });
      setNotifyMeSubmitted(prev => ({ ...prev, [tierInterest]: true }));
    } catch (e: any) {
      // If duplicate, still show success
      if (e.code === '23505' || e.message?.includes('duplicate')) {
        setNotifyMeSubmitted(prev => ({ ...prev, [tierInterest]: true }));
      } else {
        setPlanMessage('Could not save your interest — please try again.');
        setPlanMessageType('error');
        setTimeout(() => setPlanMessage(''), 5000);
      }
    } finally {
      setNotifyMeLoading(null);
    }
  };

  // Embedded checkout state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const checkoutInstanceRef = useRef<any>(null);

  const closeCheckoutModal = useCallback(() => {
    if (checkoutInstanceRef.current) {
      checkoutInstanceRef.current.destroy();
      checkoutInstanceRef.current = null;
    }
    setShowCheckoutModal(false);
    setCheckoutPlan(null);
    setCheckoutLoading(false);
  }, []);

  // Handle Pro+ consultation request
  const handleProPlusRequest = async () => {
    if (!user) {
      setPlanMessage('Please sign in before requesting Pro+.');
      setPlanMessageType('error');
      setTimeout(() => setPlanMessage(''), 5000);
      return;
    }
    setRequestingProPlus(true);
    try {
      const home = useStore.getState().home;
      if (!home?.id) {
        setPlanMessage('Please complete your home profile before requesting Pro+.');
        setPlanMessageType('error');
        setTimeout(() => setPlanMessage(''), 5000);
        return;
      }
      const provider = await findProviderForZip(home.zip_code || '');
      if (!provider) {
        // No provider matched — still submit the request to admins via notification
        // and let them know we'll follow up
        const { sendNotification } = await import('@/services/supabase');
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
        if (admins) {
          for (const admin of admins) {
            sendNotification({
              user_id: admin.id,
              title: 'New Pro+ Consultation Interest',
              body: `${user.full_name || user.email} at ${home.address || 'their home'}, ${home.city || ''} ${home.state || ''} ${home.zip_code || ''} is interested in Pro+ but no provider is matched to their area yet.`,
              category: 'pro_plus',
              action_url: '/admin/users',
            }).catch((err) => {
              logger.warn('Failed to send Pro+ notification:', err?.message);
            });
          }
        }
        setPlanMessage('Consultation request submitted! Our team will reach out to discuss Pro+ options for your area.');
        setPlanMessageType('success');
        setTimeout(() => setPlanMessage(''), 8000);
        return;
      }
      await requestConsultation(home.id, provider.id);
      setPlanMessage('Consultation requested! Your Canopy pro will reach out to schedule an in-home assessment.');
      setPlanMessageType('success');
      setTimeout(() => setPlanMessage(''), 8000);
    } catch (e: any) {
      if (e.message?.includes('duplicate') || e.code === '23505') {
        setPlanMessage('You already have a Pro+ consultation request. You\'ll be contacted soon!');
        setPlanMessageType('success');
      } else {
        setPlanMessage(e.message || 'Failed to request consultation');
        setPlanMessageType('error');
      }
      setTimeout(() => setPlanMessage(''), 5000);
    } finally {
      setRequestingProPlus(false);
    }
  };

  // Step 4: Equipment
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [equipmentForm, setEquipmentForm] = useState<Equipment>({
    name: '', category: 'hvac', make: '', model: '', serial_number: '',
  });
  const [showScanner, setShowScanner] = useState(false);
  const [lookingUpModel, setLookingUpModel] = useState(false);

  // Phase E — skip-for-now flags for deep home fields (deferred to SetupChecklist)
  const [skipFireplaceDetails, setSkipFireplaceDetails] = useState(false);
  const [skipFilterDetails, setSkipFilterDetails] = useState(false);
  const [skipPoolDetails, setSkipPoolDetails] = useState(false);
  const [skipAllSystemsDetails, setSkipAllSystemsDetails] = useState(false);
  // H-4: Equipment scan + inspection upload optional step
  const [skipEquipmentScanning, setSkipEquipmentScanning] = useState(false);

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

  /** Step 1a: Verify address and show confirmation if USPS standardized it */
  const handleAddressSubmit = async () => {
    if (!user || !addressForm.address || !addressForm.city || !addressForm.state || !addressForm.zip_code) {
      showInlineError('Please fill in address, city, state, and zip code.');
      return;
    }
    setSaving(true);
    try {
      // Verify & standardize address (USPS + geocoding)
      let verified;
      try {
        verified = await verifyAddress(
          addressForm.address, addressForm.city, addressForm.state, addressForm.zip_code
        );
      } catch (err) {
        console.warn('Address verification failed:', err);
        verified = null;
      }

      // If USPS returned a different standardized address, show confirmation
      if (verified && verified.normalizedAddress) {
        const rawUpper = addressForm.address.trim().toUpperCase().replace(/[.,]/g, '');
        const normalizedDiffers = verified.normalizedAddress !== rawUpper
          || verified.city.toUpperCase() !== addressForm.city.trim().toUpperCase()
          || verified.zipCode !== addressForm.zip_code.trim();

        if (normalizedDiffers) {
          // Show the standardized address to the user for confirmation
          setVerifiedAddress(verified);
          setShowVerifiedConfirm(true);
          setSaving(false);
          return;
        }
      }

      // No difference or no verification — proceed directly
      await saveAddressAndCheckDuplicates(verified);
    } finally {
      setSaving(false);
    }
  };

  /** Accept USPS-standardized address — update form fields and proceed */
  const handleAcceptVerifiedAddress = async () => {
    if (!verifiedAddress) return;
    // Update form with standardized values
    setAddressForm(prev => ({
      ...prev,
      address: verifiedAddress.normalizedAddress,
      city: verifiedAddress.city,
      state: verifiedAddress.state,
      zip_code: verifiedAddress.zipCode,
    }));
    setShowVerifiedConfirm(false);
    setSaving(true);
    try {
      await saveAddressAndCheckDuplicates(verifiedAddress);
    } finally {
      setSaving(false);
    }
  };

  /** Keep original address the user typed */
  const handleKeepOriginalAddress = async () => {
    setShowVerifiedConfirm(false);
    setSaving(true);
    try {
      // Still use the verified data for lat/lng and duplicate check, but keep raw address text
      await saveAddressAndCheckDuplicates(verifiedAddress);
    } finally {
      setSaving(false);
    }
  };

  /** Shared: build homeData, check for duplicates, save */
  const saveAddressAndCheckDuplicates = async (verified: typeof verifiedAddress) => {
    if (!user) return;
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
      // Store verified data when available
      ...(verified?.normalizedAddress && { normalized_address: verified.normalizedAddress }),
      ...(verified?.zipCode && verified.zipCode.includes('-') && { zip_plus4: verified.zipCode }),
      ...(verified?.latitude && { latitude: verified.latitude }),
      ...(verified?.longitude && { longitude: verified.longitude }),
      // Canonical identity key — Google Places ID, captured in onPlaceSelected.
      // This is the primary dedup key; USPS normalized_address is secondary.
      ...(selectedPlaceId && { google_place_id: selectedPlaceId }),
    };

    // Check if this property already exists (either owned by this user or another)
    try {
      const match = await findExistingProperty(
        verified?.normalizedAddress || '',
        verified?.latitude,
        verified?.longitude,
        addressForm.address, addressForm.city, addressForm.state, addressForm.zip_code,
        user.id,
        selectedPlaceId || undefined,
      );
      if (match.found && match.homeId) {
        if (match.isOwnHome) {
          // Same user already has this address — block with friendly message
          setShowOwnHomeModal(true);
          return;
        }
        if (match.ownerId) {
          // Different user owns this address — offer join request
          setClaimInfo({ homeId: match.homeId, ownerId: match.ownerId });
          setShowClaimModal(true);
          return;
        }
      }
    } catch (err) {
      logger.error('Duplicate address check failed:', err);
      // Proceed — don't block onboarding, but log the error
    }

    // Check home limit if in "add property" mode
    if (isAddPropertyMode) {
      try {
        const userHomes = await getUserHomes(user.id);
        setUserHomeCount(userHomes.length);
        const homeLimit = getHomeLimit(user.subscription_tier);

        // If user has reached their home limit, show gate
        if (homeLimit && userHomes.length >= homeLimit) {
          if (homeLimit === 1) {
            // Single-home tier users should upgrade to 2-home plan
            setHomeLimitReached('upgrade');
          } else if (homeLimit === 2) {
            // 2-home tier users should contact support for 3+ homes
            setHomeLimitReached('contact');
          }
          setShowHomeLimitModal(true);
          return;
        }
      } catch (err) {
        logger.error('Failed to check home limit:', err);
        // Proceed anyway — don't block onboarding
      }
    }

    try {
      const saved = await upsertHome(homeData);
      setHome(saved);
    } catch {
      setHome(homeData);
    }
    setStep(2);
  };

  /** User chose to request to join the existing home */
  const handleJoinRequest = async () => {
    if (!user || !claimInfo) return;
    setSaving(true);
    try {
      await createHomeJoinRequest(claimInfo.homeId, user.id, claimInfo.ownerId,
        `${user.full_name || user.email} would like to join your home on Canopy.`
      );
      setJoinRequestSent(true);
    } catch (err: any) {
      showInlineError(err?.message || 'Failed to send join request. Please try again.');
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
      // Phase E: if user skipped fireplace details, leave blank and SetupChecklist will prompt later
      const primaryFireplaceType = systemsForm.has_fireplace && !skipFireplaceDetails
        ? systemsForm.fireplaces[0]?.type || ''
        : '';

      const updatedHome: any = {
        ...home,
        foundation_type: systemsForm.foundation_type || null,
        roof_type: systemsForm.roof_type || null,
        roof_install_year: systemsForm.roof_install_year ? parseInt(systemsForm.roof_install_year) : null,
        heating_type: systemsForm.heating_type || null,
        cooling_type: systemsForm.cooling_type || null,
        water_source: systemsForm.water_source || null,
        sewer_type: systemsForm.sewer_type || null,
        septic_type: systemsForm.sewer_type === 'septic' ? (systemsForm.septic_type || null) : null,
        lawn_type: systemsForm.lawn_type || null,
        has_pool: systemsForm.has_pool,
        has_deck: systemsForm.has_deck,
        has_sprinkler_system: systemsForm.has_sprinkler_system,
        has_fireplace: systemsForm.has_fireplace,
        fireplace_type: primaryFireplaceType || null,
        fireplace_count: systemsForm.has_fireplace && !skipFireplaceDetails ? (parseInt(systemsForm.fireplace_count) || 1) : null,
        fireplace_details: systemsForm.has_fireplace && !skipFireplaceDetails ? systemsForm.fireplaces : null,
        has_gutters: systemsForm.has_gutters,
        has_fire_extinguisher: systemsForm.has_fire_extinguisher,
        has_water_softener: systemsForm.has_water_softener,
        has_sump_pump: systemsForm.has_sump_pump,
        has_storm_shelter: systemsForm.has_storm_shelter,
        countertop_type: systemsForm.countertop_type || null,
        number_of_hvac_filters: skipFilterDetails ? null : (parseInt(systemsForm.number_of_hvac_filters) || null),
        hvac_filter_size: skipFilterDetails ? null : (systemsForm.filters.map(f => f.size).filter(Boolean).join(', ') || null),
        hvac_filter_returns: skipFilterDetails ? null : (systemsForm.filters.filter(f => f.size).length > 0 ? systemsForm.filters : null),
        // Pool details — only save if has_pool && !skipPoolDetails
        pool_type: systemsForm.has_pool && !skipPoolDetails ? (systemsForm.pool_chemical_treatment || null) : null,
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

  const effectiveTier = (user?.subscription_tier && user.subscription_tier !== 'free') ? user.subscription_tier : selectedPlan;
  const equipmentLimit = getEquipmentLimit(effectiveTier);
  const atEquipmentLimit = equipmentLimit !== null && equipmentList.length >= equipmentLimit;
  const canUseAiScan = isPremium(effectiveTier);

  const handleAddEquipment = () => {
    if (!equipmentForm.name) { showInlineError('Please enter an equipment name.'); return; }
    if (atEquipmentLimit) {
      showInlineError(`Free plan allows up to ${equipmentLimit} equipment items. Upgrade to Home or Pro for unlimited equipment.`);
      return;
    }
    setEquipmentList([...equipmentList, { ...equipmentForm }]);
    setEquipmentForm({ name: '', category: 'hvac', make: '', model: '', serial_number: '' });
  };

  const handleModelLookup = async () => {
    if (!equipmentForm.model?.trim() && !equipmentForm.serial_number?.trim()) {
      showInlineError('Please enter a model number or serial number to look up.');
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
      showInlineError('Could not identify this model automatically. You can still enter details manually.');
    } finally {
      setLookingUpModel(false);
    }
  };

  const handleRemoveEquipment = (index: number) => {
    setEquipmentList(equipmentList.filter((_, i) => i !== index));
  };

  const handleScannerComplete = (scannedData: any) => {
    if (atEquipmentLimit) {
      showInlineError(`Free plan allows up to ${equipmentLimit} equipment items. Upgrade to Home or Pro for unlimited equipment.`);
      setShowScanner(false);
      return;
    }
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

      // Generate maintenance tasks with user preferences
      setGeneratingTasks(true);
      try {
        const { tasks: existingTasks } = useStore.getState();
        const userPreferences = {
          maintenance_depth: maintenanceDepth,
          show_cleaning_tasks: showCleaningTasks,
          home_detail_depth: 'detailed' as const,
          task_category_overrides: {},
          show_pro_tasks: true,
          task_reminder_days_before: 3,
          weather_alerts_enabled: true,
        };
        const generatedTasks = generateTasksForHome(home, allEquipment, existingTasks, [], userPreferences, customTemplates);
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
        logger.error('Error generating tasks:', error);
      } finally {
        setGeneratingTasks(false);
      }

      // Mark onboarding complete and save user preferences
      try {
        await updateProfile(user.id, {
          onboarding_complete: true,
          user_preferences: {
            maintenance_depth: maintenanceDepth,
            show_cleaning_tasks: showCleaningTasks,
            home_detail_depth: 'detailed',
            task_category_overrides: {},
            show_pro_tasks: true,
            task_reminder_days_before: 3,
            weather_alerts_enabled: true,
          },
        });
      } catch {}

      // Send welcome notification (for all tiers)
      const tier = user.subscription_tier || selectedPlan || 'free';
      const tierLabel = tier === 'pro_plus' ? 'Pro+' : tier === 'pro' ? 'Pro' : tier === 'home' ? 'Home' : 'Free';
      const welcomeBody = tier === 'free'
        ? 'Your home profile is set up! Canopy will help you stay on top of maintenance with personalized task reminders, equipment tracking, and seasonal checklists. Explore your dashboard to see what\'s coming up.'
        : tier === 'home'
        ? 'Your Home plan is active! You now have AI-powered maintenance tasks, unlimited equipment tracking, personalized checklists, and weather alerts. Check your dashboard to see your first tasks.'
        : tier === 'pro'
        ? 'Your Pro plan is active! You now have bimonthly professional visits, AI-powered tasks, and full equipment tracking. We\'ll reach out soon to schedule your first visit.'
        : 'Your Pro+ concierge plan is active! Your dedicated technician will be in touch shortly.';
      sendNotification({
        user_id: user.id,
        title: `Welcome to Canopy${tierLabel !== 'Free' ? ' ' + tierLabel : ''}!`,
        body: welcomeBody,
        category: 'onboarding',
        action_url: '/dashboard',
      }).catch((err) => {
        logger.warn('Failed to send welcome notification:', err?.message);
      });

      // Send branded welcome email (fire-and-forget)
      const totalTasks = useStore.getState().tasks?.length || 0;
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
        if (token && SUPABASE_URL) {
          fetch(`${SUPABASE_URL}/functions/v1/send-welcome-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              tier,
              equipment_count: allEquipment.length,
              task_count: totalTasks,
            }),
          }).catch((err) => {
            logger.warn('Failed to send welcome email:', err?.message);
          });
        }
      } catch {
        // Welcome email is non-blocking — don't fail onboarding
      }

      setStep(6);
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
    if (selectedPlan === 'free' || (user?.subscription_tier && user.subscription_tier !== 'free')) {
      setStep(4);
      return;
    }
    if (selectedPlan === 'home' || selectedPlan === 'pro') {
      try {
        setCheckoutLoading(true);
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token || !SUPABASE_URL) {
          setPlanMessage('Unable to start checkout — please try again.');
          setPlanMessageType('error');
          setTimeout(() => setPlanMessage(''), 5000);
          return;
        }

        // Fallback to redirect mode if no publishable key configured
        if (!STRIPE_PUBLISHABLE_KEY) {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              plan: selectedPlan,
              success_url: `${window.location.origin}/onboarding?step=${STEP_EQUIPMENT}&success=true&plan=${selectedPlan}`,
              cancel_url: `${window.location.origin}/onboarding?step=${STEP_PLAN}&canceled=true`,
            }),
          });
          const data = await res.json();
          if (res.ok && data.url) {
            window.location.replace(data.url);
            return;
          }
          setPlanMessage(data?.error || 'Checkout failed — please try again or continue with the Free plan.');
          setPlanMessageType('error');
          setTimeout(() => setPlanMessage(''), 5000);
          return;
        }

        // Embedded checkout mode
        setCheckoutPlan(selectedPlan);
        setShowCheckoutModal(true);

        const [stripe, authSession] = await Promise.all([
          loadStripe(),
          supabase.auth.getSession(),
        ]);
        const freshToken = authSession.data.session?.access_token || token;

        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${freshToken}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            plan: selectedPlan,
            ui_mode: 'embedded',
            return_url: `${window.location.origin}/onboarding?step=${STEP_EQUIPMENT}&success=true&plan=${selectedPlan}&session_id={CHECKOUT_SESSION_ID}`,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to create checkout session');

        // Mount embedded checkout
        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret: data.client_secret,
        });
        checkoutInstanceRef.current = checkout;

        // Wait for the modal DOM to be ready, then mount
        requestAnimationFrame(() => {
          if (checkoutRef.current) {
            checkout.mount(checkoutRef.current);
          }
        });

        setCheckoutLoading(false);
        return;
      } catch (e: any) {
        closeCheckoutModal();
        console.warn('Stripe checkout not available:', e);
        setPlanMessage(e.message || 'Checkout unavailable — please try again or continue with the Free plan.');
        setPlanMessageType('error');
        setTimeout(() => setPlanMessage(''), 5000);
        return;
      } finally {
        if (!showCheckoutModal) setCheckoutLoading(false);
      }
    }
    // Pro+ or unknown plan — proceed (Pro+ is inquiry-based)
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
  const showProgress = step >= STEP_ADDRESS && step <= STEP_EQUIPMENT;

  return (
    <SectionErrorBoundary sectionName="Onboarding">
      <div className="page" style={{ maxWidth: 600, margin: '0 auto', paddingTop: 40, paddingBottom: 60 }}>
      {/* Progress Bar — only visible during steps 1-4 */}
      {showProgress && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {Array.from({ length: PROGRESS_STEPS }).map((_, i) => (
              <div
                key={`step-${i}`}
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

      {/* C11: Inline error banner (replaces alert() dialogs) */}
      {inlineError && (
        <div
          ref={inlineErrorRef}
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          style={{
            backgroundColor: 'var(--color-error-muted, #E539351A)',
            border: `1px solid var(--color-error)`,
            color: 'var(--color-error)',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            outline: 'none',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>⚠️</span>
          <span style={{ flex: 1 }}>{inlineError}</span>
          <button
            type="button"
            onClick={() => setInlineError(null)}
            aria-label="Dismiss error"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* ===== STEP 0: Welcome / What is Canopy ===== */}
      {step === STEP_WELCOME && (
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
            {isAddPropertyMode ? 'Add a Property' : 'Welcome to Canopy'}
          </h1>
          <p style={{ fontSize: 16, color: Colors.medGray, maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.6 }}>
            {isAddPropertyMode
              ? "Add another property to your Canopy account. We'll set up a personalized maintenance plan for it."
              : "Your home's maintenance co-pilot. We'll help you stay on top of everything your home needs — so nothing falls through the cracks."}
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
            maxWidth: 420, margin: '0 auto 32px', textAlign: 'left',
          }}>
            {VALUE_PROPS.map((prop) => (
              <div key={prop.title} style={{
                padding: 16, backgroundColor: 'var(--color-background)', borderRadius: 12,
                borderLeft: `3px solid ${Colors.sage}`,
              }}>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>{prop.icon}</span>
                <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 4px', color: Colors.charcoal }}>{prop.title}</p>
                <p style={{ fontSize: 12, color: Colors.medGray, margin: 0, lineHeight: 1.4 }}>{prop.desc}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 24, lineHeight: 1.5 }}>
            Setup takes about 3 minutes. We'll ask about your home, then generate your personalized maintenance plan. You can add equipment, inspections, and deeper details later from your dashboard.
          </p>

          <button
            className="btn btn-primary"
            style={{ padding: '14px 48px', fontSize: 16 }}
            onClick={() => setStep(1)}
          >
            {isAddPropertyMode ? 'Add Another Property' : "Let's Set Up Your Home"}
          </button>
          {isAddPropertyMode && (
            <button
              className="btn btn-ghost mt-sm"
              style={{ fontSize: 14, color: Colors.medGray }}
              onClick={() => navigate('/', { replace: true })}
            >
              Back to Dashboard
            </button>
          )}
        </div>
      )}

      {/* ===== STEP 1: Address ===== */}
      {step === STEP_ADDRESS && (
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Where is your home?</h2>
          <p style={{ color: Colors.medGray, marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
            We'll use this to tailor maintenance tasks to your climate and local conditions.
          </p>

          <div className="form-group">
            <label>Street Address *</label>
            <AddressAutocomplete
              value={addressForm.address}
              onChange={(v) => setAddressForm({ ...addressForm, address: v })}
              onPlaceSelected={(details) => {
                // Capture the canonical Place ID for dedup — this is the
                // primary identity key we'll store on the home record.
                if (details.placeId) setSelectedPlaceId(details.placeId);
                setAddressForm({
                  ...addressForm,
                  address: details.address || addressForm.address,
                  city: details.city || addressForm.city,
                  state: details.state || addressForm.state,
                  zip_code: (details.zipCode || addressForm.zip_code).split('-')[0],
                });
              }}
              placeholder="Start typing your address…"
            />
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
              <select className="form-input" value={addressForm.year_built}
                onChange={e => setAddressForm({ ...addressForm, year_built: e.target.value })}>
                <option value="">Select year...</option>
                {Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
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
            <button className="btn btn-ghost" onClick={() => isAddPropertyMode ? navigate('/', { replace: true }) : setStep(0)}>
              {isAddPropertyMode ? 'Cancel' : 'Back'}
            </button>
            <button className="btn btn-primary" onClick={handleAddressSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* ===== Home Limit Modal ===== */}
      {showHomeLimitModal && homeLimitReached && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, padding: 20,
        }}>
          <div style={{
            background: 'var(--color-card-background)', borderRadius: 16, padding: 32, maxWidth: 440, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 48 }}>🏠</span>
            </div>
            {homeLimitReached === 'upgrade' ? (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
                  Upgrade to Manage Multiple Homes
                </h3>
                <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
                  Your current plan includes 1 home. Upgrade to our Home 2-Pack ($11.99/mo) or Pro 2-Pack ($279/mo) to manage this property and your existing home.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => navigate('/subscription')}
                  >
                    View Plans
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%', fontSize: 13, color: Colors.medGray }}
                    onClick={() => {
                      setShowHomeLimitModal(false);
                      setHomeLimitReached(null);
                      navigate('/');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
                  Interested in 3+ Properties?
                </h3>
                <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
                  You've reached the limit for your current plan. We'd love to help you set up a custom plan for managing {userHomeCount + 1}+ properties.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => {
                      window.location.href = 'mailto:support@canopyhome.app?subject=Custom%20Multi-Property%20Plan&body=' +
                        encodeURIComponent(`Hi, I'm interested in managing multiple properties with Canopy. I currently have ${userHomeCount} home(s) and would like to add more. Can you help me set up a custom plan?`);
                    }}
                  >
                    Contact Support
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%', fontSize: 13, color: Colors.medGray }}
                    onClick={() => {
                      setShowHomeLimitModal(false);
                      setHomeLimitReached(null);
                      navigate('/');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Address Claim Modal ===== */}
      {showClaimModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, padding: 20,
        }}>
          <div style={{
            background: 'var(--color-card-background)', borderRadius: 16, padding: 32, maxWidth: 440, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            {joinRequestSent ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 48 }}>&#x2709;</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
                  Request Sent
                </h3>
                <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
                  The current homeowner has been notified. Once they approve your request,
                  this property will appear in your account. We'll send you an email when it's ready.
                </p>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => {
                    setShowClaimModal(false);
                    setJoinRequestSent(false);
                    setClaimInfo(null);
                    navigate('/');
                  }}
                >
                  Go to Dashboard
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 48 }}>&#x1F3E0;</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
                  This Property Is Already Claimed
                </h3>
                <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
                  An account has already been created for <strong>{addressForm.address}, {addressForm.city}, {addressForm.state} {addressForm.zip_code}</strong>.
                  You can request to be added to the home, or contact support if you think this is a mistake.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={handleJoinRequest}
                    disabled={saving}
                  >
                    {saving ? 'Sending...' : 'Request Access'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%', color: Colors.medGray }}
                    onClick={() => {
                      window.location.href = 'mailto:support@canopyhome.app?subject=Property%20Claim%20Dispute&body=' +
                        encodeURIComponent(`I'm trying to claim ${addressForm.address}, ${addressForm.city}, ${addressForm.state} ${addressForm.zip_code} but it shows as already claimed.`);
                    }}
                    disabled={saving}
                  >
                    Contact Support
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ width: '100%', fontSize: 13, color: Colors.medGray }}
                    onClick={() => {
                      setShowClaimModal(false);
                      setClaimInfo(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Own Home Duplicate Modal ===== */}
      {showOwnHomeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, padding: 20,
        }}>
          <div style={{
            background: 'var(--color-card-background)', borderRadius: 16, padding: 32, maxWidth: 440, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 48 }}>&#x2705;</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
              You Already Have This Home
            </h3>
            <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 24 }}>
              <strong>{addressForm.address}, {addressForm.city}</strong> is already in your account. You can view and manage it from your dashboard.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => { setShowOwnHomeModal(false); navigate('/'); }}
              >
                Go to Dashboard
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: '100%', fontSize: 13, color: Colors.medGray }}
                onClick={() => setShowOwnHomeModal(false)}
              >
                Enter a Different Address
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Verified Address Confirmation Modal ===== */}
      {showVerifiedConfirm && verifiedAddress && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999, padding: 20,
        }}>
          <div style={{
            background: 'var(--color-card-background)', borderRadius: 16, padding: 32, maxWidth: 440, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 36 }}>&#x2705;</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
              Address Verified
            </h3>
            <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, textAlign: 'center', marginBottom: 16 }}>
              We standardized your address using USPS. Would you like to use the corrected version?
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{
                padding: 14, backgroundColor: 'var(--color-success)15', borderRadius: 10,
                border: `1px solid ${Colors.sage}40`, marginBottom: 10,
              }}>
                <p style={{ fontSize: 11, color: Colors.sage, fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase' }}>USPS Standardized</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>
                  {verifiedAddress.normalizedAddress}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: Colors.charcoal }}>
                  {verifiedAddress.city}, {verifiedAddress.state} {verifiedAddress.zipCode}
                </p>
              </div>
              <div style={{
                padding: 14, backgroundColor: 'var(--color-input-background, #F5F0E8)', borderRadius: 10,
                border: `1px solid var(--color-light-gray)`,
              }}>
                <p style={{ fontSize: 11, color: Colors.medGray, fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase' }}>You entered</p>
                <p style={{ margin: 0, fontSize: 14, color: Colors.medGray }}>
                  {addressForm.address}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: Colors.medGray }}>
                  {addressForm.city}, {addressForm.state} {addressForm.zip_code}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleAcceptVerifiedAddress}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Use Standardized Address'}
              </button>
              <button
                className="btn btn-ghost"
                style={{ width: '100%', color: Colors.medGray }}
                onClick={handleKeepOriginalAddress}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Keep My Original'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP 2: Home Systems ===== */}
      {step === STEP_SYSTEMS && (
        <div className="card">
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>What systems does your home have?</h2>
              <p style={{ color: Colors.medGray, marginBottom: 0, fontSize: 14, lineHeight: 1.5 }}>
                This helps us generate the right maintenance tasks for your specific home.
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
              setSkipAllSystemsDetails(true);
              setSkipFireplaceDetails(true);
              setSkipFilterDetails(true);
              setSkipPoolDetails(true);
            }} style={{ whiteSpace: 'nowrap' }}>
              Skip details for now
            </button>
          </div>

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
              <label>Roof Install Year</label>
              <input className="form-input" type="number" value={systemsForm.roof_install_year}
                onChange={e => setSystemsForm({ ...systemsForm, roof_install_year: e.target.value })} />
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
                onChange={e => setSystemsForm({ ...systemsForm, sewer_type: e.target.value, septic_type: e.target.value === 'septic' ? systemsForm.septic_type : '' })}>
                <option value="">Select...</option>
                <option value="municipal">Municipal</option>
                <option value="septic">Septic</option>
              </select>
            </div>
          </div>

          {systemsForm.sewer_type === 'septic' && (
            <div className="form-group">
              <label>Septic System Type</label>
              <select className="form-select" value={systemsForm.septic_type}
                onChange={e => setSystemsForm({ ...systemsForm, septic_type: e.target.value })}>
                <option value="">Select...</option>
                <option value="aerobic">Aerobic (spray heads, chlorine tablets)</option>
                <option value="conventional">Conventional (lateral lines / drainfield)</option>
              </select>
              <p className="text-xs text-gray" style={{ marginTop: 4 }}>Aerobic systems have a pump, spray heads, and require quarterly inspections</p>
            </div>
          )}

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
            {(['has_pool', 'has_deck', 'has_sprinkler_system', 'has_fireplace', 'has_fountain', 'has_gutters', 'has_fire_extinguisher', 'has_water_softener', 'has_sump_pump', 'has_storm_shelter'] as const).map(key => (
              <label key={key} className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                <input type="checkbox" checked={systemsForm[key] as boolean}
                  onChange={e => setSystemsForm({ ...systemsForm, [key]: e.target.checked })} />
                <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{key.replace(/has_/, '').replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>

          {/* Per-fireplace details */}
          {systemsForm.has_fireplace && !skipFireplaceDetails && (
            <div style={{ backgroundColor: 'var(--color-background)', borderRadius: 12, padding: 16, marginTop: 16 }}>
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: Colors.charcoal }}>Fireplace details</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipFireplaceDetails(true)}>
                  Skip for now
                </button>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Number of Fireplaces</label>
                <input className="form-input" type="number" min="1" max="10"
                  value={systemsForm.fireplace_count}
                  onChange={e => updateFireplaceCount(e.target.value)} />
              </div>
              {systemsForm.fireplaces.map((fp, i) => (
                <div key={`fp-${i}`} className="form-group" style={{ marginBottom: i < systemsForm.fireplaces.length - 1 ? 8 : 0 }}>
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
          {systemsForm.has_fireplace && skipFireplaceDetails && (
            <div className="text-xs text-gray" style={{ marginTop: 8 }}>
              Fireplace details skipped — you'll finish from your dashboard.{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipFireplaceDetails(false)}>Undo</button>
            </div>
          )}

          {/* HVAC filter details — show if heating or cooling is set */}
          {(systemsForm.heating_type || systemsForm.cooling_type) && !skipFilterDetails && (
            <div style={{ backgroundColor: 'var(--color-background)', borderRadius: 12, padding: 16, marginTop: 16 }}>
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: Colors.charcoal }}>HVAC Filters</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipFilterDetails(true)}>
                  Skip for now
                </button>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Number of HVAC Filters/Returns</label>
                <input className="form-input" type="number" min="1" max="10"
                  value={systemsForm.number_of_hvac_filters}
                  onChange={e => updateFilterCount(e.target.value)} />
              </div>
              {systemsForm.filters.map((filter, i) => (
                <div key={`filter-${i}`} className="form-group" style={{ marginBottom: i < systemsForm.filters.length - 1 ? 8 : 0 }}>
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
          {(systemsForm.heating_type || systemsForm.cooling_type) && skipFilterDetails && (
            <div className="text-xs text-gray" style={{ marginTop: 8 }}>
              Filter sizes skipped — add them later from your dashboard.{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipFilterDetails(false)}>Undo</button>
            </div>
          )}

          {/* Pool details — show if has_pool is checked */}
          {systemsForm.has_pool && !skipPoolDetails && (
            <div style={{ backgroundColor: 'var(--color-background)', borderRadius: 12, padding: 16, marginTop: 16 }}>
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: Colors.charcoal }}>Pool details</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipPoolDetails(true)}>
                  Skip for now
                </button>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Pool Type</label>
                  <select className="form-select" value={systemsForm.pool_type}
                    onChange={e => setSystemsForm({ ...systemsForm, pool_type: e.target.value })}>
                    <option value="in-ground">In-ground</option>
                    <option value="above-ground">Above-ground</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Pool Lining</label>
                  <select className="form-select" value={systemsForm.pool_lining}
                    onChange={e => setSystemsForm({ ...systemsForm, pool_lining: e.target.value })}>
                    <option value="vinyl">Vinyl</option>
                    <option value="fiberglass">Fiberglass</option>
                    <option value="concrete">Concrete/Gunite</option>
                    <option value="plaster">Plaster</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <label className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                  <input type="checkbox" checked={systemsForm.has_hot_tub}
                    onChange={e => setSystemsForm({ ...systemsForm, has_hot_tub: e.target.checked })} />
                  <span style={{ fontSize: 14 }}>Has hot tub</span>
                </label>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Pool Heating</label>
                  <select className="form-select" value={systemsForm.pool_heating}
                    onChange={e => setSystemsForm({ ...systemsForm, pool_heating: e.target.value })}>
                    <option value="none">None</option>
                    <option value="gas">Gas</option>
                    <option value="electric">Electric</option>
                    <option value="solar">Solar</option>
                    <option value="heat_pump">Heat Pump</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Chemical Treatment</label>
                  <select className="form-select" value={systemsForm.pool_chemical_treatment}
                    onChange={e => setSystemsForm({ ...systemsForm, pool_chemical_treatment: e.target.value })}>
                    <option value="chlorine">Chlorine</option>
                    <option value="salt">Salt</option>
                    <option value="mineral">Mineral</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <label className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
                  <input type="checkbox" checked={systemsForm.has_pool_fencing}
                    onChange={e => setSystemsForm({ ...systemsForm, has_pool_fencing: e.target.checked })} />
                  <span style={{ fontSize: 14 }}>Has pool fencing</span>
                </label>
              </div>
            </div>
          )}
          {systemsForm.has_pool && skipPoolDetails && (
            <div className="text-xs text-gray" style={{ marginTop: 8 }}>
              Pool details skipped — you'll finish from your dashboard.{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipPoolDetails(false)}>Undo</button>
            </div>
          )}

          {/* Hose bibs */}
          <div style={{ backgroundColor: 'var(--color-background)', borderRadius: 12, padding: 16, marginTop: 16 }}>
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

          {/* Maintenance Preferences */}
          <div style={{ borderTop: `1px solid ${Colors.lightGray}`, marginTop: 24, paddingTop: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: Colors.charcoal }}>How much maintenance detail do you want?</h3>
            <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
              We'll customize your task list based on your preference. You can change this anytime in settings.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {[
                { value: 'simple' as const, title: 'Just the Essentials', desc: 'Focus on the most important maintenance tasks. Perfect if you\'re just getting started.' },
                { value: 'standard' as const, title: 'Recommended', desc: 'A complete maintenance plan tailored to your home. Our recommendation for most homeowners.', recommended: true },
                { value: 'comprehensive' as const, title: 'Everything', desc: 'Every possible maintenance task, including detailed cleaning and specialty items.' },
              ].map(option => (
                <div
                  key={option.value}
                  onClick={() => setMaintenanceDepth(option.value)}
                  style={{
                    border: `2px solid ${maintenanceDepth === option.value ? Colors.copper : Colors.lightGray}`,
                    borderRadius: 12, padding: 16,
                    backgroundColor: maintenanceDepth === option.value ? Colors.copperMuted : Colors.white,
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {option.recommended && (
                    <span style={{
                      position: 'absolute', top: -12, right: 16,
                      background: Colors.copper, color: Colors.white,
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                    }}>
                      Recommended
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: maintenanceDepth === option.value ? Colors.copper : Colors.charcoal, marginBottom: 4 }}>
                        {option.title}
                      </div>
                      <p style={{ fontSize: 13, color: Colors.medGray, margin: 0, lineHeight: 1.4 }}>
                        {option.desc}
                      </p>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 10, border: `2px solid ${maintenanceDepth === option.value ? Colors.copper : Colors.lightGray}`,
                      background: maintenanceDepth === option.value ? Colors.copper : 'transparent',
                      marginLeft: 12, marginTop: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {maintenanceDepth === option.value && (
                        <span style={{ color: Colors.white, fontSize: 12, fontWeight: 'bold' }}>✓</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '12px 0' }}>
              <input
                type="checkbox"
                checked={showCleaningTasks}
                onChange={e => setShowCleaningTasks(e.target.checked)}
              />
              <span style={{ fontSize: 14, color: Colors.charcoal, fontWeight: 500 }}>
                Show cleaning tasks (deep clean, pressure washing, etc.)
              </span>
            </label>
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
      {step === STEP_PLAN && (
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Choose your plan</h2>
          <p style={{ color: Colors.medGray, marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
            Start free or unlock the full Canopy experience. You can change your plan anytime.
          </p>

          {/* A2-5: Pre-flight service-area explainer. Pro / Pro+ are launched in Tulsa
               first; this is front-and-center so homeowners outside the area understand
               they can still use Free + Home and join the waitlist for Pro visits. */}
          <div
            style={{
              background: proAvailable ? `${Colors.sage}10` : `${Colors.copper}15`,
              borderLeft: `3px solid ${proAvailable ? Colors.sage : Colors.copper}`,
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 20,
              fontSize: 13,
              lineHeight: 1.5,
              color: Colors.charcoal,
            }}
          >
            {proAvailable ? (
              <>
                <strong>Good news — in-person Pro visits are available in your area.</strong>{' '}
                Free and Home plans are available everywhere. Pro and Pro+ include a Certified Pro maintenance
                visit every 2 months, which we currently run in and around Tulsa, OK.
              </>
            ) : (
              <>
                <strong>Pro visits aren't live in your area yet.</strong>{' '}
                You can still use the Free or Home plan — every digital feature works anywhere. Pro and Pro+
                include in-person Certified Pro visits, currently launching in Tulsa, OK. Tap <em>Notify Me</em>{' '}
                on those plans below to join the waitlist — we'll email you when we're live near you.
              </>
            )}
          </div>

          {planMessage && (
            <div style={{
              padding: '10px 16px', borderRadius: 8,
              background: planMessageType === 'success' ? 'var(--color-success)20' : 'var(--color-error)20',
              color: planMessageType === 'success' ? 'var(--color-success)' : 'var(--color-error)',
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
                  onClick={() => { if (!isLocked && plan.value) setSelectedPlan(plan.value); }}
                  style={{
                    border: `2px solid ${isSelected ? Colors.copper : 'transparent'}`,
                    borderRadius: 12, padding: 20,
                    backgroundColor: isSelected ? Colors.copperMuted : Colors.white,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.55 : 1,
                    position: 'relative', transition: 'all 0.2s ease',
                  }}
                >
                  {plan.value === 'home' && (
                    <span style={{
                      position: 'absolute', top: -10, right: 16,
                      background: Colors.copper, color: Colors.white,
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                    }}>
                      Most Popular
                    </span>
                  )}
                  {isLocked && (
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                      {plan.value && notifyMeSubmitted[plan.value] ? (
                        <span style={{ color: Colors.sage, fontWeight: 600 }}>
                          <CheckIcon size={12} color={Colors.sage} /> We'll notify you when this is available in your area!
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: Colors.medGray }}>Not available in your area yet</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleNotifyMe(plan.value as 'pro' | 'pro_plus'); }}
                            disabled={notifyMeLoading === plan.value}
                            style={{
                              background: 'none', border: `1px solid ${Colors.copper}`, borderRadius: 6,
                              color: Colors.copper, fontSize: 11, fontWeight: 600, padding: '3px 10px',
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            {notifyMeLoading === plan.value ? 'Saving...' : 'Notify Me'}
                          </button>
                        </div>
                      )}
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
                        <CheckIcon size={14} color={Colors.white} />
                      </div>
                    )}
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0 0' }}>
                    {plan.features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
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
          <div style={{ background: 'var(--color-background)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
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
            {selectedPlan === 'pro_plus' ? (
              <button
                className="btn btn-secondary"
                onClick={handleProPlusRequest}
                disabled={requestingProPlus}
                style={{ flex: 1 }}
              >
                {requestingProPlus ? 'Requesting...' : 'Request Pro+ Consultation'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handlePlanCheckout} disabled={checkoutLoading}>
                {checkoutLoading ? 'Loading checkout...'
                  : selectedPlan === 'free' ? 'Continue with Free'
                  : `Continue with ${PLANS.find(p => p.value === selectedPlan)?.name}`}
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12 }}>
            You can always change your plan later from Settings.
          </p>
        </div>
      )}

      {/* ===== STEP 4: Equipment Scan + Inspection Upload (Optional) — H-4 ===== */}
      {step === STEP_EQUIPMENT && (
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Help us tailor your plan (optional)</h2>
          <p style={{ color: Colors.medGray, marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            Scan equipment labels or upload an inspection report to get more personalized maintenance suggestions. You can do this now or skip and add them later from your dashboard.
          </p>

          {/* Equipment Scanner + Inspection Uploader */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Equipment Scanner */}
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Scan Equipment Labels</p>
              <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
                Photograph your HVAC, water heater, and other equipment to track warranties and maintenance schedules.
              </p>
              {showScanner ? (
                <SectionErrorBoundary>
                  <EquipmentScanner
                    onScanComplete={(data) => {
                      if (data.make && data.model) {
                        setEquipmentForm(prev => ({
                          ...prev,
                          make: data.make,
                          model: data.model,
                          category: data.category,
                          equipment_subtype: data.equipment_subtype,
                        }));
                        setShowScanner(false);
                      }
                    }}
                    onClose={() => setShowScanner(false)}
                  />
                </SectionErrorBoundary>
              ) : (
                <button
                  className="btn btn-outline"
                  onClick={() => setShowScanner(true)}
                  style={{ width: '100%' }}
                >
                  📸 Start Scanning
                </button>
              )}
            </div>

            {/* Inspection Uploader */}
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Upload Inspection Report</p>
              <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
                Upload your home inspection report so we can extract issues and generate a prioritized punch list.
              </p>
              <SectionErrorBoundary>
                <InspectionUploader
                  onTasksCreated={(count) => {
                    // Tasks created from inspection; they will be visible on dashboard
                  }}
                />
              </SectionErrorBoundary>
            </div>
          </div>

          {/* A2-3: explicit Skip-for-now block so homeowners don't feel trapped on this step. */}
          <div
            style={{
              marginTop: 8,
              marginBottom: 16,
              padding: '12px 14px',
              background: 'var(--color-cream)',
              borderRadius: 10,
              border: `1px dashed ${Colors.medGray}40`,
              fontSize: 13,
              color: Colors.charcoal,
              lineHeight: 1.5,
            }}
          >
            <strong>No equipment info handy?</strong> That's fine — Canopy works without it. You'll still get a full
            maintenance plan based on your home's square footage, roof type, HVAC, and climate. You can scan equipment
            anytime from the Equipment tab.
          </div>

          {/* Nav buttons */}
          <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setStep(3)} disabled={saving || generatingTasks}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(5)} disabled={saving || generatingTasks} style={{ flex: 1, minWidth: 160 }}>
              {skipEquipmentScanning ? 'Continue' : 'Continue to Next'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => { setSkipEquipmentScanning(true); setStep(5); }}
              style={{ fontSize: 13 }}
              disabled={saving || generatingTasks}
            >
              Skip — add equipment later
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 5: Ready to Build Your Plan ===== */}
      {step === STEP_READY && (
        <div className="card">
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>You're all set!</h2>
          <p style={{ color: Colors.medGray, marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            We have everything we need to build your personalized maintenance plan. Click below to generate your tasks — it takes just a few seconds.
          </p>

          {/* Pro/Pro+ checkout success messaging — H-7 */}
          {(selectedPlan === 'pro' || user?.subscription_tier === 'pro') && (
            <div style={{
              backgroundColor: Colors.copperMuted,
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              borderLeft: `4px solid ${Colors.copper}`,
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal, marginBottom: 12 }}>
                ✓ Your first home visit
              </p>
              <p style={{ fontSize: 13, color: Colors.charcoal, marginBottom: 8, lineHeight: 1.5 }}>
                We'll email you within 24 hours to schedule your first professional consultation. Our team will walk through your home and create a customized maintenance plan specifically for your property.
              </p>
              <p style={{ fontSize: 13, color: Colors.medGray, lineHeight: 1.5, margin: 0 }}>
                Watch for an email from our scheduling team with available times in your area.
              </p>
            </div>
          )}

          <div style={{
            backgroundColor: 'var(--color-background)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal, marginBottom: 12 }}>
              What happens next:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '🧠', label: 'Canopy generates your custom task list from your home profile' },
                { icon: '📋', label: 'You\'ll land on your dashboard with a "Finish Setting Up" checklist' },
                { icon: '📸', label: 'Scan equipment labels any time from the Equipment tab (optional but recommended)' },
                { icon: '📄', label: 'Upload your inspection report any time for extra task suggestions' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 18, lineHeight: '22px', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: Colors.charcoal, lineHeight: 1.5 }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scan equipment + inspection upload moved to post-onboarding SetupChecklist (Phase E, 2026-04-09) */}

          <div className="flex gap-sm mt-lg">
            <button className="btn btn-ghost" onClick={() => setStep(4)} disabled={saving || generatingTasks}>Back</button>
            <button className="btn btn-primary" onClick={handleFinish} disabled={saving || generatingTasks} style={{ flex: 1 }}>
              {generatingTasks ? 'Generating your plan...' : saving ? 'Finishing...' : 'Build My Plan'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12, textAlign: 'center' }}>
            You'll finish setup from your dashboard — no rush.
          </p>
        </div>
      )}

      {/* ===== STEP 6: Personalized Welcome ===== */}
      {step === STEP_DONE && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: `linear-gradient(135deg, ${Colors.sage}30, ${Colors.copper}20)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', border: `3px solid ${Colors.sage}`,
          }}>
            <CheckCircleIcon size={48} color={Colors.sage} />
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{isAddPropertyMode ? 'Property Added!' : 'Welcome to Canopy!'}</h2>
          <p style={{ fontSize: 16, color: Colors.medGray, maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.6 }}>
            {isAddPropertyMode ? 'Your new property is set up and ready to go.' : 'Your personalized home maintenance plan is ready.'}
            {equipmentList.length > 0 && ` We've set up ${equipmentList.length} equipment item${equipmentList.length !== 1 ? 's' : ''} and generated maintenance tasks based on your home profile.`}
            {equipmentList.length === 0 && ' Head to the Equipment tab anytime to scan labels and get tailored maintenance reminders.'}
          </p>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, maxWidth: 420, margin: '0 auto 32px' }}>
            {[
              { label: 'Equipment', value: equipmentList.length, icon: '🔧' },
              { label: 'Systems', value: Object.entries(systemsForm).filter(([k, v]) => k.startsWith('has_') && v === true).length, icon: '🏠' },
              { label: 'Plan', value: PLANS.find(p => p.value === (user?.subscription_tier || selectedPlan))?.name || 'Free', icon: '⭐' },
            ].map((card) => (
              <div key={card.label} style={{
                padding: 16, backgroundColor: 'var(--color-background)', borderRadius: 12, textAlign: 'center',
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
                <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
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

      {/* Stripe Embedded Checkout Modal */}
      {showCheckoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeCheckoutModal(); }}
        >
          <div style={{
            background: 'var(--color-card-background)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${Colors.lightGray}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: Colors.charcoal }}>
                  Upgrade to {PLANS.find(p => p.value === checkoutPlan)?.name || checkoutPlan}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: Colors.medGray }}>
                  Secure checkout powered by Stripe
                </p>
              </div>
              <button
                onClick={closeCheckoutModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: Colors.medGray,
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
                aria-label="Close checkout"
              >
                &times;
              </button>
            </div>

            {/* Stripe embedded checkout mounts here */}
            <div ref={checkoutRef} style={{ minHeight: 300 }}>
              {checkoutLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
                  <div className="spinner" style={{ marginBottom: 16 }} />
                  <p style={{ fontSize: 14, color: Colors.medGray, margin: 0 }}>Loading secure checkout...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </SectionErrorBoundary>
  );
}
