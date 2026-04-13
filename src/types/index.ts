// ===============================================================
// Canopy Web — Type Definitions (shared with mobile)
// ===============================================================

// Re-export inspection types
export type {
  InspectionStatus,
  ChecklistItemStatus,
  OverallCondition,
  PhotoType,
  ChecklistItemTemplate,
  InspectionChecklistTemplate,
  InspectionPhoto,
  VisitInspection,
  VisitInspectionItem,
  VisitPhoto,
  VisitWithInspections,
  VisitSummaryData,
} from './inspection';

export type SubscriptionTier = 'free' | 'home' | 'home_2' | 'pro' | 'pro_2' | 'pro_plus';

// ─── ENUM TYPES ───────────────────────────────────────────

export type RoofType =
  // Legacy (still accepted in DB for backward compat)
  | 'asphalt_shingle' | 'metal' | 'tile' | 'slate' | 'flat' | 'wood_shake'
  // Granular shingle types
  | '3_tab_shingle' | 'architectural_shingle' | 'premium_shingle' | 'composite_shingle'
  // Granular metal types
  | 'metal_standing_seam' | 'metal_corrugated'
  // Granular tile types
  | 'tile_clay' | 'tile_concrete'
  // Granular flat types
  | 'flat_epdm' | 'flat_tpo' | 'flat_buildup'
  // Other
  | 'copper' | 'other';

export type FoundationType = 'slab' | 'crawlspace' | 'basement' | 'pier_and_beam';

export type SidingType = 'brick' | 'vinyl' | 'wood' | 'stucco' | 'fiber_cement' | 'stone';

export type HeatingType = 'forced_air' | 'heat_pump' | 'radiant' | 'boiler' | 'baseboard';

export type CoolingType = 'central_ac' | 'heat_pump' | 'window_units' | 'mini_split' | 'none';

export type SepticType = 'aerobic' | 'anaerobic' | 'mound' | 'chamber';

export type SepticDrainfieldType = 'conventional' | 'chamber' | 'mound' | 'drip' | 'sand_filter';

export type ConstructionType = 'wood_frame' | 'steel_frame' | 'concrete_block' | 'icf' | 'sip' | 'log' | 'brick_masonry' | 'adobe' | 'rammed_earth' | 'other';

export type FrameSize = '2x4' | '2x6' | '2x8' | 'unknown';

export type StoriesType = 'single' | 'two_story' | 'split_level' | 'tri_level' | 'raised_ranch' | 'other';

export type WindowFrameMaterial = 'vinyl' | 'wood' | 'aluminum' | 'fiberglass' | 'composite' | 'clad_wood' | 'unknown';

export type WindowGlazing = 'single_pane' | 'double_pane' | 'triple_pane' | 'unknown';

export type ExteriorDoorMaterial = 'wood' | 'fiberglass' | 'steel' | 'vinyl' | 'glass' | 'unknown';

export type PlumbingSupplyType = 'copper' | 'pex' | 'cpvc' | 'galvanized' | 'polybutylene' | 'mixed' | 'unknown';

export type PlumbingDrainType = 'pvc' | 'abs' | 'cast_iron' | 'galvanized' | 'clay' | 'mixed' | 'unknown';

export type WaterFiltrationType = 'whole_house' | 'reverse_osmosis' | 'under_sink' | 'uv' | 'water_softener_combo' | 'other';

export type ElectricalWiringType = 'copper' | 'aluminum' | 'knob_and_tube' | 'mixed' | 'unknown';

export type InsulationType = 'fiberglass_batt' | 'blown_cellulose' | 'spray_foam_open' | 'spray_foam_closed' | 'mineral_wool' | 'rigid_foam' | 'none' | 'unknown';

export type DuctworkType = 'sheet_metal' | 'flex' | 'fiberglass_board' | 'mixed' | 'none';

export type FlooringType = 'hardwood' | 'engineered_wood' | 'laminate' | 'tile' | 'vinyl_plank' | 'carpet' | 'concrete' | 'stone' | 'bamboo' | 'mixed';

export type InteriorWallType = 'drywall' | 'plaster' | 'wood_panel' | 'concrete' | 'other';

export type CeilingType = 'flat_drywall' | 'textured' | 'popcorn' | 'coffered' | 'beadboard' | 'exposed_beam' | 'other';

export type DrivewayMaterial = 'concrete' | 'asphalt' | 'gravel' | 'pavers' | 'brick' | 'dirt' | 'none';

export type PatioMaterial = 'concrete' | 'pavers' | 'brick' | 'stone' | 'stamped_concrete' | 'other';

export type FenceType = 'wood' | 'vinyl' | 'chain_link' | 'wrought_iron' | 'aluminum' | 'composite' | 'split_rail' | 'none';

export type WellPumpType = 'submersible' | 'jet' | 'hand' | 'unknown';

export type SolarInverterType = 'string' | 'micro' | 'hybrid' | 'unknown';

export type EVChargerLevel = 'level_1' | 'level_2' | 'dc_fast';

export type GeneratorType = 'standby_natural_gas' | 'standby_propane' | 'standby_diesel' | 'portable';

export type LawnType = 'bermuda' | 'fescue' | 'zoysia' | 'st_augustine' | 'bluegrass' | 'buffalo' | 'mixed' | 'none';

export type CountertopType = 'granite' | 'marble' | 'quartz' | 'butcher_block' | 'laminate' | 'tile' | 'concrete' | 'stainless_steel';

export type FireplaceType = 'wood_burning' | 'gas_starter' | 'gas' | 'electric';

export type HvacReturnLocation = 'ceiling' | 'wall' | 'floor' | 'furnace' | 'multiple';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  agent_id?: string;
  subscription_tier: SubscriptionTier;
  subscription_expires_at?: string;
  onboarding_complete: boolean;
  email_confirmed?: boolean;
  /** Persisted state for the Set Up Your Home dashboard checklist. */
  setup_checklist_state?: SetupChecklistState;
  /** Secret token for iCal feed subscription URL. Rotatable. */
  calendar_token?: string;
  user_preferences?: UserPreferences;
  created_at: string;
  role?: 'user' | 'agent' | 'admin' | 'pro_provider';
}

/**
 * Dashboard Set Up Your Home checklist state. Each step is a boolean
 * indicating completion. The checklist can be dismissed as a whole
 * via `dismissed: true` which hides it until manually re-opened.
 */
export interface SetupChecklistState {
  equipment_scanned: boolean;
  inspection_uploaded: boolean;
  roof_year_added: boolean;
  fireplace_details: boolean;
  pool_details: boolean;
  filter_sizes: boolean;
  invited_partner: boolean;
  connected_agent: boolean;
  phone_added: boolean;
  dismissed: boolean;
  dismissed_at: string | null;
}

/** Default setup checklist state for new profiles. */
export const DEFAULT_SETUP_CHECKLIST_STATE: SetupChecklistState = {
  equipment_scanned: false,
  inspection_uploaded: false,
  roof_year_added: false,
  fireplace_details: false,
  pool_details: false,
  filter_sizes: false,
  invited_partner: false,
  connected_agent: false,
  phone_added: false,
  dismissed: false,
  dismissed_at: null,
};

export interface ProProvider {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  license_number?: string;
  insurance_info?: string;
  bio?: string;
  years_experience?: number;
  service_categories: string[];
  service_area_miles: number; // legacy
  service_area_zips?: string[];
  max_jobs_per_day: number;
  is_available: boolean;
  schedule?: Record<string, boolean[]>;
  rating?: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
  // Provider type distinction (migration 027)
  provider_type: 'canopy_technician' | 'partner_pro';
  // Canopy Technician fields
  employee_id?: string;
  hire_date?: string;
  certification_level?: 'trainee' | 'standard' | 'senior' | 'lead';
  training_completed_at?: string;
  assigned_zones?: string[];
  max_daily_visits?: number;
  specializations?: string[];
  // Partner Pro fields
  commission_rate?: number;
  contract_type?: 'per_job' | 'retainer' | 'hybrid';
  payment_terms?: 'net_15' | 'net_30' | 'net_45' | 'on_completion';
  background_check_status?: 'pending' | 'passed' | 'failed' | 'expired';
  background_check_date?: string;
  partner_since?: string;
}

/**
 * Home represents a property managed in Canopy.
 *
 * NOTE (L-13): This TypeScript interface defines 97+ fields, but the Postgres
 * schema currently has approximately 60 columns. On save operations (upsertHome),
 * any fields present in the interface but not in the schema are silently dropped.
 * This is a known gap being addressed in an ongoing schema migration effort.
 * See: Product/schema-migrations for pending column additions.
 */
export interface Home {
  id: string;
  user_id: string;

  // ─── CORE ADDRESS & IDENTIFICATION ───
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
  normalized_address?: string;
  /** Google Places canonical identity — primary dedup key for this property. */
  google_place_id?: string;
  zip_plus4?: string;
  photo_url?: string;

  // ─── PROPERTY BASICS ───
  year_built?: number;
  year_renovated?: number;
  square_footage?: number;
  lot_size_sqft?: number;
  stories: number;
  stories_type?: StoriesType;
  bedrooms: number;
  bathrooms: number;
  garage_spaces: number;

  // ─── STRUCTURE & FRAMING ───
  construction_type?: ConstructionType;
  frame_size?: FrameSize;
  foundation_type?: FoundationType;
  basement_finished_pct?: number;
  has_basement_waterproofing?: boolean;
  has_vapor_barrier?: boolean;
  has_french_drain?: boolean;

  // ─── ROOF ───
  roof_type?: RoofType;
  roof_install_year?: number;
  /** @deprecated Use roof_install_year instead. Kept for backward compat. */
  roof_age_years?: number;

  // ─── EXTERIOR ENVELOPE ───
  siding_type?: SidingType;
  siding_install_year?: number;
  exterior_paint_year?: number;
  window_frame_material?: WindowFrameMaterial;
  window_glazing?: WindowGlazing;
  window_install_year?: number;
  exterior_door_material?: ExteriorDoorMaterial;
  has_storm_windows?: boolean;
  has_storm_doors?: boolean;

  // ─── MECHANICAL SYSTEMS ───
  heating_type?: HeatingType;
  cooling_type?: CoolingType;
  gas_service?: boolean;

  // ─── HVAC DETAILS ───
  number_of_hvac_filters?: number;
  /** @deprecated (M-14) Deprecated — Use hvac_filter_returns[] instead. First entry's size is mirrored for back-compat. Maintained for legacy UI compatibility only. New features should use hvac_filter_returns[]. */
  hvac_filter_size?: string;
  /** Array of return vents: [{size, location}]. Drives per-filter reminders. */
  hvac_filter_returns?: Array<{ size: string; location?: string }>;
  hvac_return_location?: HvacReturnLocation;
  ductwork_type?: DuctworkType;
  ductwork_insulated?: boolean;
  has_whole_house_fan?: boolean;
  has_attic_fan?: boolean;
  has_whole_house_humidifier?: boolean;
  has_whole_house_dehumidifier?: boolean;
  has_air_purifier?: boolean;
  has_erv_hrv?: boolean;

  // ─── PLUMBING ───
  water_source?: 'municipal' | 'well';
  sewer_type?: 'municipal' | 'septic';
  plumbing_supply_type?: PlumbingSupplyType;
  plumbing_supply_install_year?: number;
  plumbing_drain_type?: PlumbingDrainType;
  plumbing_drain_install_year?: number;
  has_water_filtration?: boolean;
  water_filtration_type?: WaterFiltrationType;
  has_recirculation_pump?: boolean;
  has_expansion_tank?: boolean;

  // ─── ELECTRICAL ───
  electrical_panel_amps?: number;
  electrical_wiring_type?: ElectricalWiringType;
  electrical_panel_brand?: string;
  electrical_panel_year?: number;
  has_whole_house_surge_protector?: boolean;
  has_gfci_outlets?: boolean;
  has_afci_breakers?: boolean;

  // ─── INSULATION & ENVELOPE ───
  insulation_wall_type?: InsulationType;
  insulation_attic_type?: InsulationType;
  insulation_attic_depth_inches?: number;
  insulation_r_value_walls?: number;
  insulation_r_value_attic?: number;
  has_house_wrap?: boolean;

  // ─── INTERIOR FINISHES ───
  primary_flooring?: FlooringType;
  flooring_install_year?: number;
  interior_wall_type?: InteriorWallType;
  ceiling_type?: CeilingType;
  ceiling_height_ft?: number;
  countertop_type?: CountertopType;

  // ─── SEPTIC (when sewer_type = 'septic') ───
  septic_type?: SepticType;
  septic_tank_size_gallons?: number;
  septic_install_year?: number;
  septic_last_pumped?: string;
  septic_last_inspected?: string;
  septic_drainfield_type?: SepticDrainfieldType;

  // ─── WELL (when water_source = 'well') ───
  well_depth_ft?: number;
  well_pump_type?: WellPumpType;
  well_pump_install_year?: number;
  well_pressure_tank_install_year?: number;
  well_last_tested?: string;

  // ─── EXTERIOR & LANDSCAPING ───
  lawn_type?: LawnType;
  has_pool: boolean;
  /** Chemical treatment type — drives pool task branching */
  pool_type?: 'chlorine' | 'salt' | 'mineral' | 'none';
  has_deck: boolean;
  has_sprinkler_system: boolean;
  has_patio?: boolean;
  patio_material?: PatioMaterial;
  driveway_material?: DrivewayMaterial;
  driveway_install_year?: number;
  has_fence: boolean;
  fence_type?: FenceType;
  fence_install_year?: number;

  // ─── FEATURES & AMENITIES ───
  has_fireplace: boolean;
  fireplace_type?: FireplaceType;
  fireplace_count?: number;
  /** Per-fireplace detail entries. Drives one annual sweep task per fireplace. */
  fireplace_details?: Array<{
    type: 'wood_burning' | 'gas' | 'electric';
    location?: string;
    fuel?: 'wood' | 'natural_gas' | 'propane' | 'electric';
    last_swept_date?: string;
  }>;
  has_fountain?: boolean;
  has_gutters: boolean;
  has_fire_extinguisher: boolean;
  has_water_softener: boolean;
  has_sump_pump: boolean;
  has_storm_shelter: boolean;

  // ─── RENEWABLE ENERGY & MODERN SYSTEMS ───
  has_generator: boolean;
  generator_type?: GeneratorType;
  generator_capacity_kw?: number;
  generator_install_year?: number;
  has_solar_panels: boolean;
  solar_panel_count?: number;
  solar_install_year?: number;
  solar_inverter_type?: SolarInverterType;
  solar_capacity_kw?: number;
  has_ev_charger: boolean;
  ev_charger_level?: EVChargerLevel;
  ev_charger_install_year?: number;
  has_battery_storage?: boolean;
  battery_storage_install_year?: number;

  // ─── SAFETY & ENVIRONMENTAL ───
  has_radon_mitigation?: boolean;
  has_radon_test?: boolean;
  last_radon_level_pci?: number;
  has_security_system?: boolean;
  has_smart_home_hub?: boolean;
  known_asbestos?: boolean;
  known_lead_paint?: boolean;

  // ─── UTILITY LOCATIONS ───
  water_shutoff_location?: string;
  main_breaker_location?: string;
  gas_meter_location?: string;
  water_meter_location?: string;
  sub_panel_locations?: string;
  hose_bib_locations?: string;

  // ─── TRASH & RECYCLING SERVICE ───
  trash_provider?: string;
  trash_day?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  recycling_day?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  recycling_frequency?: 'weekly' | 'biweekly';
  yard_waste_day?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  yard_waste_seasonal?: boolean;  // true = only during growing season

  // ─── HOME TOKEN / VERIFICATION ───
  agent_attested_at?: string;
  agent_attestation_note?: string;
  record_completeness_score?: number;
  // Homeownership verification
  ownership_verified?: boolean;
  ownership_verification_status?: 'none' | 'pending' | 'verified' | 'rejected';
  ownership_verification_method?: 'document_upload' | 'title_company' | 'manual';
  ownership_verification_date?: string;
  ownership_verification_notes?: string;
  ownership_documents_url?: string;

  // ─── ENVIRONMENTAL ───
  climate_zone?: string;
  usda_zone?: string;

  // ─── ADDITIONAL STRUCTURES ───
  parent_home_id?: string;
  structure_type?: 'guest_house' | 'detached_garage' | 'workshop' | 'adu' | 'barn' | 'pool_house' | 'shed' | 'other';
  structure_label?: string;

  // ─── TIMESTAMPS ───
  created_at: string;
}

export type EquipmentCategory =
  | 'hvac'
  | 'water_heater'
  | 'roof'
  | 'plumbing'
  | 'electrical'
  | 'appliance'
  | 'outdoor'
  | 'safety'
  | 'pool'
  | 'garage'
  | 'filter'
  | 'pest_control'
  | 'solar'
  | 'ventilation'
  | 'water_treatment'
  | 'fireplace';

// ─── USER PREFERENCES ─────────────────────────────────────

export type MaintenanceDepth = 'simple' | 'standard' | 'comprehensive';
export type HomeDetailDepth = 'essentials' | 'detailed' | 'everything';

export type TaskCategoryKey =
  | 'hvac' | 'water_heater' | 'roof' | 'plumbing' | 'electrical'
  | 'appliance' | 'safety' | 'pool' | 'garage' | 'outdoor'
  | 'lawn' | 'deck' | 'fireplace' | 'sprinkler' | 'seasonal'
  | 'pest_control' | 'cleaning' | 'solar' | 'generator' | 'well'
  | 'septic' | 'hardscape';

export interface UserPreferences {
  /** Controls how many tasks are shown: simple (~20 core), standard (all relevant), comprehensive (everything + cleaning + niche) */
  maintenance_depth: MaintenanceDepth;

  /** Whether to show cleaning-category tasks (deep clean, window washing, pressure washing, carpet cleaning) */
  show_cleaning_tasks: boolean;

  /** Controls which home detail fields are shown in UI */
  home_detail_depth: HomeDetailDepth;

  /** Per-category overrides — user can hide/show individual categories regardless of maintenance_depth */
  task_category_overrides: Partial<Record<TaskCategoryKey, boolean>>;

  /** Whether to show tasks marked as pro_responsible (for users who don't have Pro tier) */
  show_pro_tasks: boolean;

  /** Days before due date to send task reminders */
  task_reminder_days_before: number;

  /** Whether weather-triggered alerts are enabled */
  weather_alerts_enabled: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  maintenance_depth: 'standard',
  show_cleaning_tasks: true,
  home_detail_depth: 'detailed',
  task_category_overrides: {},
  show_pro_tasks: true,
  task_reminder_days_before: 3,
  weather_alerts_enabled: true,
};

// ─── TASK VISIBILITY LOGIC ────────────────────────────────

export type TaskLevel = 'core' | 'standard' | 'comprehensive';

/**
 * Legacy hardcoded ID arrays — kept ONLY as fallback for any hardcoded
 * templates that don't come from the DB (and thus lack a task_level field).
 * The DB task_level column is the source of truth; these are used only when
 * task_level is undefined (i.e., for hardcoded-only templates).
 */
const LEGACY_CORE_TASK_IDS: string[] = [
  'hvac-filter-change', 'hvac-spring-tuneup', 'hvac-fall-furnace',
  'smoke-co-test', 'fire-extinguisher-check', 'water-heater-flush',
  'gutter-clean-spring', 'gutter-clean-fall', 'roof-inspection',
  'check-for-leaks', 'winterize-hose-bibs', 'spring-exterior-walkthrough',
  'fall-winterize', 'dryer-vent-clean', 'garage-door-maintenance',
  'gfci-outlet-test', 'water-heater-tpr-valve', 'foundation-inspection',
  'spring-lawn-care', 'fall-lawn-care',
];
const LEGACY_COMPREHENSIVE_TASK_IDS: string[] = [
  'window-washing-exterior', 'window-washing-interior', 'pressure-wash-exterior',
  'deep-clean-kitchen', 'deep-clean-bathroom', 'carpet-deep-clean',
  'garbage-bins-clean', 'air-duct-cleaning', 'humidifier-pad-replace',
  'air-purifier-filter', 'surge-protector-check', 'driveway-seal',
  'stone-countertop-seal', 'air-exchanger-clean', 'lightbulb-check', 'knife-sharpen',
];

/**
 * Determines if a task should be visible based on user preferences.
 * Uses the DB-driven task_level field as primary source of truth.
 * Falls back to legacy hardcoded ID lists for templates without task_level.
 */
export function isTaskVisible(
  taskId: string,
  taskCategory: string,
  prefs: UserPreferences,
  isProTask: boolean = false,
  taskLevel?: TaskLevel,
  isCleaning?: boolean,
): boolean {
  // Check per-category override first (highest priority)
  const categoryKey = taskCategory as TaskCategoryKey;
  if (prefs.task_category_overrides[categoryKey] === false) return false;
  if (prefs.task_category_overrides[categoryKey] === true) return true;

  // Check cleaning toggle — works on the is_cleaning flag, not category
  if (isCleaning && !prefs.show_cleaning_tasks) return false;

  // Check pro task visibility
  if (isProTask && !prefs.show_pro_tasks) return false;

  // Resolve the effective task level: prefer DB field, fall back to legacy ID matching
  const effectiveLevel: TaskLevel = taskLevel
    ?? (LEGACY_CORE_TASK_IDS.includes(taskId) ? 'core'
      : LEGACY_COMPREHENSIVE_TASK_IDS.includes(taskId) ? 'comprehensive'
      : 'standard');

  // Check maintenance depth against task level
  switch (prefs.maintenance_depth) {
    case 'simple':
      return effectiveLevel === 'core';
    case 'standard':
      return effectiveLevel !== 'comprehensive';
    case 'comprehensive':
      return true;
    default:
      return true;
  }
}

/**
 * Home detail field visibility groups.
 * Controls which fields are shown in the Home Details UI.
 */
export const HOME_DETAIL_FIELDS = {
  essentials: [
    'year_built', 'square_footage', 'stories', 'bedrooms', 'bathrooms', 'garage_spaces',
    'foundation_type', 'roof_type', 'roof_install_year', 'heating_type', 'cooling_type',
    'water_source', 'sewer_type', 'lawn_type',
    // Feature toggles
    'has_pool', 'has_deck', 'has_sprinkler_system', 'has_fireplace', 'has_fountain', 'has_gutters',
    'has_fire_extinguisher', 'has_water_softener', 'has_sump_pump', 'has_storm_shelter',
    'has_generator', 'has_solar_panels', 'has_ev_charger', 'has_fence',
  ],
  detailed: [
    // Everything in essentials PLUS:
    'siding_type', 'construction_type', 'frame_size',
    'countertop_type', 'primary_flooring',
    'plumbing_supply_type', 'electrical_wiring_type', 'electrical_panel_amps',
    'insulation_wall_type', 'insulation_attic_type',
    'window_frame_material', 'window_glazing',
    'ductwork_type', 'gas_service',
    'driveway_material', 'fence_type',
    'number_of_hvac_filters', 'hvac_filter_size',
    // Septic/well details
    'septic_type', 'septic_tank_size_gallons', 'septic_last_pumped',
    'well_pump_type', 'well_last_tested',
    // Solar/EV/Generator details
    'generator_type', 'solar_panel_count', 'ev_charger_level',
    // Safety
    'known_asbestos', 'known_lead_paint',
  ],
  everything: [
    // ALL fields — no filtering
    '*',
  ],
} as const;

export interface Equipment {
  id: string;
  home_id: string;
  category: EquipmentCategory;
  name: string;
  make?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  warranty_expiry?: string;
  expected_lifespan_years?: number;
  location_in_home?: string;
  notes?: string;
  photo_url?: string;
  label_photo_url?: string;

  // AI-detected subtype (e.g., "Evaporator Coil", "Gas Furnace", "Tankless Water Heater")
  equipment_subtype?: string;
  // Refrigerant type for HVAC (e.g., "R22", "R410A") — critical for phase-out tracking
  refrigerant_type?: string;

  filter_count?: number;
  filter_size?: string;
  tonnage?: number;
  seer_rating?: number;
  tank_size_gallons?: number;
  is_tankless?: boolean;
  fuel_type?: 'gas' | 'electric' | 'propane' | 'solar';
  hose_bib_location?: string;
  is_frost_free?: boolean;

  // Refrigerator/Freezer filter specific
  filter_type?: string;
  filter_model_number?: string;
  filter_replacement_interval_months?: number;

  // Garage door opener specific
  opener_type?: 'chain' | 'belt' | 'screw' | 'direct_drive' | 'jackshaft';
  remote_frequency?: string;
  has_battery_backup?: boolean;

  estimated_replacement_cost?: number;
  /** Where the replacement cost came from: 'pro_quote' = a Canopy Pro gave a real quote, 'homeowner' = user entered, 'estimate' = national average */
  replacement_quote_source?: 'estimate' | 'pro_quote' | 'homeowner';

  /**
   * Freeform technician-facing metadata populated by scan-equipment.
   * Examples: parts_diagram_url, refrigerant_charge_oz, service_bulletins,
   * common_failure_modes, recall_notices, access_notes.
   */
  tech_metadata?: Record<string, unknown>;

  created_at: string;
  updated_at: string;
}

/**
 * Per-equipment replaceable part (filter, belt, igniter, anode rod,
 * battery, etc.). Populated by scan-equipment and drives
 * per-consumable task generation.
 */
export interface EquipmentConsumable {
  id: string;
  equipment_id: string;
  home_id: string;
  consumable_type:
    | 'filter'
    | 'belt'
    | 'igniter'
    | 'anode_rod'
    | 'battery'
    | 'bulb'
    | 'blade'
    | 'gasket'
    | 'fuse'
    | 'other';
  name: string;
  part_number?: string;
  spec?: string;
  quantity: number;
  replacement_interval_months?: number;
  last_replaced_date?: string;
  next_due_date?: string;
  detected_by: 'scan' | 'manual' | 'tech';
  confidence?: number;
  notes?: string;
  purchase_url?: string;
  estimated_cost?: number;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'upcoming' | 'due' | 'overdue' | 'completed' | 'skipped';
export type TaskFrequency = 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'as_needed' | 'weekly' | 'biweekly' | 'seasonal' | 'semi_annual';
export type TaskSchedulingType = 'dynamic' | 'seasonal';

export interface MaintenanceTask {
  id: string;
  home_id: string;
  equipment_id?: string;
  template_id?: string; // M-10: tracks which template generated this task for dedup & analytics
  title: string;
  description: string;
  instructions?: string[];
  category: EquipmentCategory | 'general' | 'lawn' | 'pool' | 'deck' | 'seasonal' | 'pest_control' | 'fireplace';
  priority: TaskPriority;
  status: TaskStatus;
  frequency: TaskFrequency;
  due_date: string;
  completed_date?: string;
  completed_by?: string;
  completion_photo_url?: string;
  completion_notes?: string;
  estimated_minutes?: number;
  estimated_cost?: number;
  is_weather_triggered: boolean;
  applicable_months: number[];
  applicable_climate_zones?: string[];

  // Dynamic scheduling support
  scheduling_type?: TaskSchedulingType; // 'dynamic' = next due from completion, 'seasonal' = fixed months
  interval_days?: number; // for dynamic tasks: days until next occurrence after completion

  // Custom task support
  is_custom?: boolean;
  created_by_user?: boolean;

  // Pro service scheduler fields
  service_purpose?: string;
  items_to_have_on_hand?: string[];
  pro_provider_id?: string;
  scheduled_time?: string;
  reminder_days_before?: number;

  /** Consumable-generated tasks carry the affiliate/purchase link from the consumable */
  purchase_url?: string;
  /** ID of the consumable that generated this task (for equipment_keyed templates) */
  consumable_id?: string;

  /** Whether this is a cleaning/tidying task (for show/hide toggle) */
  is_cleaning?: boolean;

  created_at: string;
}

// ─── Secure Notes (Document Vault) ───
export interface SecureNote {
  id: string;
  home_id: string;
  title: string;
  content: string;
  category: 'alarm_code' | 'door_code' | 'gate_code' | 'wifi_password' | 'safe_combination' | 'utility_account' | 'other';
  created_at: string;
  updated_at: string;
}

// ─── Pro Service Appointment ───
export interface ProServiceAppointment {
  id: string;
  home_id: string;
  task_id?: string;
  pro_provider_id?: string;
  title: string;
  description: string;
  service_purpose: string;
  items_to_have_on_hand: string[];
  scheduled_date: string;
  scheduled_time?: string;
  reminder_days_before: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  cost_estimate?: number;
  actual_cost?: number;
  created_at: string;
  updated_at: string;
}

export interface WeatherAlert {
  id: string;
  type: 'freeze' | 'wind' | 'hail' | 'heat' | 'storm' | 'tornado' | 'flood' | 'fire';
  severity: 'advisory' | 'watch' | 'warning';
  title: string;
  description: string;
  action_items: string[];
  start_time: string;
  end_time: string;
  source: string;
}

export interface WeatherData {
  temperature: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  wind_gust?: number;
  description: string;
  icon: string;
  high: number;
  low: number;
  alerts: WeatherAlert[];
  forecast: DayForecast[];
}

export interface DayForecast {
  date: string;
  high: number;
  low: number;
  description: string;
  icon: string;
  precipitation_chance: number;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  brokerage: string;
  photo_url?: string;
  logo_url?: string;
  accent_color?: string;
}

export interface MaintenanceLog {
  id: string;
  home_id: string;
  task_id?: string;
  title: string;
  description?: string;
  category: string;
  completed_date: string;
  completed_by: 'homeowner' | 'pro' | 'contractor';
  cost?: number;
  photos: string[];
  notes?: string;
  created_at: string;
}

export interface ProRequest {
  id: string;
  user_id: string;
  home_id: string;
  service_type: string;
  description: string;
  preferred_date?: string;
  status: 'pending' | 'matched' | 'scheduled' | 'completed';
  assigned_provider?: string;
  cost?: number;
  notes?: string;
  created_at: string;
}

export interface GiftCode {
  id: string;
  code: string;
  agent_id?: string;
  tier: SubscriptionTier;
  duration_months: number;
  redeemed_by?: string;
  redeemed_at?: string;
  expires_at?: string;
  client_email?: string;
  client_name?: string;
  delivery_method?: 'code' | 'direct';
  pending_home?: Partial<Home>;
  created_at: string;
}

// ─── Pro Monthly Visits ───
export type VisitStatus = 'proposed' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'forfeited' | 'no_show';

export interface ProMonthlyVisit {
  id: string;
  home_id: string;
  homeowner_id: string;
  pro_provider_id: string;
  visit_month: string;
  visit_date?: string;
  proposed_date?: string;
  proposed_time_slot?: string;
  homeowner_confirmed_at?: string;
  confirmed_date?: string;
  confirmed_start_time?: string;
  confirmed_end_time?: string;
  status: VisitStatus;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  hours_before_cancellation?: number;
  same_month_rebookable?: boolean;
  selected_task_ids: string[];
  started_at?: string;
  completed_at?: string;
  time_spent_minutes?: number;
  max_minutes: number;
  pro_notes?: string;
  homeowner_notes?: string;
  photos: { url: string; caption?: string }[];
  ai_summary?: string;
  ai_summary_generated_at?: string;
  overall_condition?: string;
  summary_sent_at?: string;
  // Homeowner rating
  homeowner_rating?: number;
  homeowner_review?: string;
  rated_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  provider?: ProProvider;
}

export interface VisitAllocation {
  id: string;
  homeowner_id: string;
  visit_month: string;
  allocated_visits: number;
  used_visits: number;
  forfeited_visits: number;
  created_at: string;
}

// ─── Pro+ Concierge Subscriptions ───
export type ProPlusStatus = 'consultation_requested' | 'consultation_scheduled' | 'consultation_completed' | 'quote_pending' | 'quote_approved' | 'active' | 'paused' | 'cancelled';

export interface ProPlusSubscription {
  id: string;
  homeowner_id: string;
  home_id: string;
  pro_provider_id: string;
  consultation_requested_at?: string;
  consultation_scheduled_date?: string;
  consultation_completed_at?: string;
  consultation_notes?: string;
  quoted_monthly_rate?: number;
  quoted_at?: string;
  quote_valid_until?: string;
  homeowner_approved_at?: string;
  status: ProPlusStatus;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  current_monthly_rate?: number;
  coverage_notes?: string;
  scope_exclusions: string;
  started_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  provider?: ProProvider;
}

// ─── Quotes ───
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted';

export interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Quote {
  id: string;
  home_id: string;
  homeowner_id: string;
  pro_provider_id: string;
  quote_number: string;
  title: string;
  description?: string;
  service_type?: 'add_on' | 'one_off' | 'pro_plus_extra';
  status: QuoteStatus;
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  issued_date: string;
  valid_until?: string;
  sent_at?: string;
  homeowner_approved_at?: string;
  homeowner_rejected_at?: string;
  homeowner_notes?: string;
  pro_notes?: string;
  converted_to_invoice_id?: string;
  converted_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  provider?: ProProvider;
}

// ─── Invoices ───
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'pending_payment' | 'paid' | 'partial' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  home_id: string;
  homeowner_id: string;
  pro_provider_id: string;
  invoice_number: string;
  title: string;
  description?: string;
  source_type?: 'from_quote' | 'standalone' | 'subscription_adjustment';
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  issued_date: string;
  due_date: string;
  sent_at?: string;
  viewed_at?: string;
  amount_paid: number;
  stripe_payment_intent_id?: string;
  stripe_invoice_id?: string;
  paid_at?: string;
  pro_notes?: string;
  homeowner_notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  provider?: ProProvider;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  homeowner_id: string;
  amount: number;
  payment_method: 'stripe' | 'check' | 'ach' | 'cash' | 'other';
  stripe_charge_id?: string;
  transaction_reference?: string;
  paid_at: string;
  notes?: string;
  created_at: string;
}

// ─── Notifications ───

export type NotificationCategory = 'task' | 'weather' | 'equipment' | 'pro_visit' | 'pro_quote' | 'pro_invoice' | 'payment' | 'subscription' | 'general';

export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';

export type DigestFrequency = 'instant' | 'daily_summary' | 'weekly_summary';

export interface NotificationItem {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  read: boolean;
  action_url?: string;
  data?: Record<string, any>;
  created_at: string;
}

/** Per-category channel preferences */
export interface CategoryChannelPrefs {
  push: boolean;
  email: boolean;
  sms: boolean;
  in_app: boolean;
}

export interface NotificationPreferences {
  // ── Category channel controls ──
  home_maintenance: CategoryChannelPrefs;   // task reminders, due dates, completions
  weather_safety: CategoryChannelPrefs;     // severe weather, seasonal alerts
  equipment_lifecycle: CategoryChannelPrefs; // equipment aging, replacement reminders
  pro_services: CategoryChannelPrefs;       // visits, quotes, invoices (pro/pro+ only)
  account_billing: CategoryChannelPrefs;    // subscription, payments, receipts

  // ── Timing & frequency ──
  digest_frequency: DigestFrequency;
  reminder_lead_time: 'day_of' | '1_day_before' | '3_days_before' | '1_week_before';
  preferred_time: 'morning' | 'afternoon' | 'evening'; // 8 AM, 2 PM, 6 PM

  // ── Quiet hours ──
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;  // "22:00"
  quiet_hours_end: string;    // "07:00"

  // ── SMS & Timezone ──
  phone?: string;
  timezone: string;           // IANA timezone string, e.g. "America/Chicago"

  // ── Summary ──
  weekly_summary: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  home_maintenance: { push: true, email: true, sms: false, in_app: true },
  weather_safety: { push: true, email: false, sms: true, in_app: true },
  equipment_lifecycle: { push: false, email: true, sms: false, in_app: true },
  pro_services: { push: true, email: true, sms: false, in_app: true },
  account_billing: { push: false, email: true, sms: false, in_app: true },

  digest_frequency: 'instant',
  reminder_lead_time: '1_day_before',
  preferred_time: 'morning',

  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',

  phone: undefined,
  timezone: 'America/Chicago',

  weekly_summary: true,
};

// ─── Support Tickets ───

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  user_id?: string;
  status: SupportTicketStatus;
  resolved_at?: string;
  created_at: string;
}

// ─── Admin Audit Log ───

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  created_at: string;
}

// ─── Home Join Request ───

export interface HomeJoinRequest {
  id: string;
  home_id: string;
  requester_id: string;
  owner_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  message?: string | null;
  created_at: string;
  // Joined relations from getHomeJoinRequests query
  homes?: {
    address?: string;
    city?: string;
    state?: string;
  };
  requester?: {
    full_name?: string | null;
    email?: string | null;
  };
}

// ─── Pro Service Area ───

export interface ProServiceArea {
  provider_id: string;
  service_area_zips: string[];
  service_area_miles: number;
  service_categories: string[];
}

// ─── Admin Email Templates ───

export type EmailTemplateCategory = 'admin' | 'user_transactional' | 'user_automated';
export type EmailRecipientType = 'admin' | 'user' | 'pro_provider';

export interface AdminEmailTemplate {
  id: string;
  template_key: string;
  name: string;
  description?: string;
  subject: string;
  category: EmailTemplateCategory;
  enabled: boolean;
  recipient_type: EmailRecipientType;
  trigger_event: string;
  created_at: string;
  updated_at: string;
}
