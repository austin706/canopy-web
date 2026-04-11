// ===============================================================
// Pro Advanced (Service Areas, Provider Services, Technician Onboarding)
// ===============================================================
import { supabase } from './supabaseClient';



export interface ServiceAreaService {
  id: string;
  service_area_id: string;
  service_key: string;
  service_label: string;
  category: string;
  is_active: boolean;
  base_price_cents: number | null;
  estimated_minutes: number | null;
  requires_pro_plus: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const getServiceAreaServices = async (serviceAreaId: string, includeInactive = false): Promise<ServiceAreaService[]> => {
  let query = supabase
    .from('service_area_services')
    .select('*')
    .eq('service_area_id', serviceAreaId)
    .order('sort_order', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const upsertServiceAreaService = async (item: Partial<ServiceAreaService> & { service_area_id: string; service_key: string; service_label: string; category: string }) => {
  const { data, error } = await supabase
    .from('service_area_services')
    .upsert({
      ...item,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'service_area_id,service_key' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteServiceAreaService = async (id: string) => {
  const { error } = await supabase
    .from('service_area_services')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ─── Provider Services (Capabilities) ───

export interface ProviderService {
  id: string;
  provider_id: string;
  service_key: string;
  proficiency: 'basic' | 'standard' | 'expert';
  is_active: boolean;
  certified_at: string | null;
  notes: string | null;
  created_at: string;
}

export const getProviderServices = async (providerId: string): Promise<ProviderService[]> => {
  const { data, error } = await supabase
    .from('provider_services')
    .select('*')
    .eq('provider_id', providerId)
    .eq('is_active', true);
  if (error) throw error;
  return data || [];
};

export const upsertProviderService = async (item: Partial<ProviderService> & { provider_id: string; service_key: string }) => {
  const { data, error } = await supabase
    .from('provider_services')
    .upsert(item, { onConflict: 'provider_id,service_key' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteProviderService = async (id: string) => {
  const { error } = await supabase
    .from('provider_services')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// ─── Technician Onboarding ───

export interface TrainingMaterial {
  id: string;
  title: string;
  description: string | null;
  category: string;
  content_type: string;
  content_url: string | null;
  content_body: string | null;
  duration_minutes: number | null;
  required_for_level: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string | null;
  category: string;
  required: boolean;
  sort_order: number;
  estimated_minutes: number | null;
  training_material_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TechnicianOnboarding {
  id: string;
  provider_id: string;
  step_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  score: number | null;
  created_at: string;
  updated_at: string;
  step?: OnboardingStep;
}

export const getTrainingMaterials = async (category?: string): Promise<TrainingMaterial[]> => {
  let query = supabase
    .from('training_materials')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const upsertTrainingMaterial = async (item: Partial<TrainingMaterial> & { title: string; category: string; content_type: string }) => {
  const { data, error } = await supabase
    .from('training_materials')
    .upsert({ ...item, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getOnboardingSteps = async (): Promise<OnboardingStep[]> => {
  const { data, error } = await supabase
    .from('onboarding_steps')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getTechnicianOnboardingProgress = async (providerId: string): Promise<TechnicianOnboarding[]> => {
  const { data, error } = await supabase
    .from('technician_onboarding')
    .select('*, step:onboarding_steps(*)')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const initTechnicianOnboarding = async (providerId: string): Promise<void> => {
  const steps = await getOnboardingSteps();
  const records = steps.map(step => ({
    provider_id: providerId,
    step_id: step.id,
    status: 'pending' as const,
  }));
  if (records.length > 0) {
    const { error } = await supabase
      .from('technician_onboarding')
      .upsert(records, { onConflict: 'provider_id,step_id' });
    if (error) throw error;
  }
};
