// ===============================================================
// Canopy Web — Type Definitions (shared with mobile)
// ===============================================================

export type SubscriptionTier = 'free' | 'home' | 'pro' | 'pro_plus';

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
  created_at: string;
  role?: 'user' | 'agent' | 'admin' | 'pro_provider';
}

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
  service_area_miles: number;
  max_jobs_per_day: number;
  is_available: boolean;
  schedule?: any;
  rating?: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface Home {
  id: string;
  user_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
  year_built?: number;
  square_footage?: number;
  lot_size_sqft?: number;
  stories: number;
  bedrooms: number;
  bathrooms: number;
  garage_spaces: number;
  foundation_type?: 'slab' | 'crawlspace' | 'basement' | 'pier';
  roof_type?: 'asphalt_shingle' | 'metal' | 'tile' | 'slate' | 'flat' | 'wood_shake';
  roof_age_years?: number;
  siding_type?: 'brick' | 'vinyl' | 'wood' | 'stucco' | 'fiber_cement' | 'stone';
  heating_type?: 'forced_air' | 'heat_pump' | 'radiant' | 'boiler' | 'baseboard';
  cooling_type?: 'central_ac' | 'heat_pump' | 'window_units' | 'mini_split' | 'none';
  water_source?: 'municipal' | 'well';
  sewer_type?: 'municipal' | 'septic';
  lawn_type?: 'bermuda' | 'fescue' | 'zoysia' | 'st_augustine' | 'bluegrass' | 'buffalo' | 'mixed' | 'none';
  has_pool: boolean;
  has_deck: boolean;
  has_sprinkler_system: boolean;
  has_fireplace: boolean;
  fireplace_type?: 'wood_burning' | 'gas_starter' | 'gas';
  hose_bib_locations?: string;
  number_of_hvac_filters?: number;
  photo_url?: string;
  climate_zone?: string;
  usda_zone?: string;

  // Infrastructure locations
  main_breaker_location?: string;
  sub_panel_locations?: string;
  water_shutoff_location?: string;
  gas_meter_location?: string;
  water_meter_location?: string;

  created_at: string;
}

export type EquipmentCategory =
  | 'hvac' | 'water_heater' | 'roof' | 'plumbing'
  | 'electrical' | 'appliance' | 'outdoor' | 'safety'
  | 'pool' | 'garage' | 'filter' | 'pest_control';

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

  created_at: string;
  updated_at: string;
}

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'upcoming' | 'due' | 'overdue' | 'completed' | 'skipped';
export type TaskFrequency = 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'as_needed';

export interface MaintenanceTask {
  id: string;
  home_id: string;
  equipment_id?: string;
  title: string;
  description: string;
  instructions?: string[];
  category: EquipmentCategory | 'general' | 'lawn' | 'pool' | 'deck' | 'seasonal' | 'pest_control';
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

  // Custom task support
  is_custom?: boolean;
  created_by_user?: boolean;
  template_id?: string;

  // Pro service scheduler fields
  service_purpose?: string;
  items_to_have_on_hand?: string[];
  pro_provider_id?: string;
  scheduled_time?: string;
  reminder_days_before?: number;

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
  type: 'freeze' | 'wind' | 'hail' | 'heat' | 'storm' | 'tornado' | 'flood';
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
  created_at: string;
}
