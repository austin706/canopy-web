// ===============================================================
// Equipment Scan Guides & Checklists
// ===============================================================
import { supabase } from './supabaseClient';


// ─── Equipment Scan Guides ───

export interface EquipmentScanGuide {
  id: string;
  equipment_type: string;
  display_name: string;
  icon: string | null;
  category: string;
  nameplate_location: string;
  nameplate_description: string | null;
  photo_url: string | null;
  video_url: string | null;
  tips: string[];
  common_brands: string[];
  every_home_should_have: boolean;
  priority_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentChecklist {
  id: string;
  user_id: string;
  home_id: string;
  equipment_type: string;
  status: 'not_started' | 'scanned' | 'not_applicable' | 'skipped';
  equipment_id: string | null;
  created_at: string;
  updated_at: string;
}

export const getEquipmentScanGuides = async (): Promise<EquipmentScanGuide[]> => {
  const { data, error } = await supabase
    .from('equipment_scan_guides')
    .select('*')
    .eq('is_active', true)
    .order('priority_order', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getEssentialEquipmentGuides = async (): Promise<EquipmentScanGuide[]> => {
  const { data, error } = await supabase
    .from('equipment_scan_guides')
    .select('*')
    .eq('is_active', true)
    .eq('every_home_should_have', true)
    .order('priority_order', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const getEquipmentChecklist = async (homeId: string): Promise<EquipmentChecklist[]> => {
  const { data, error } = await supabase
    .from('equipment_checklist')
    .select('*')
    .eq('home_id', homeId);
  if (error) throw error;
  return data || [];
};

export const upsertEquipmentChecklist = async (item: { user_id: string; home_id: string; equipment_type: string; status: string; equipment_id?: string }) => {
  const { data, error } = await supabase
    .from('equipment_checklist')
    .upsert({
      ...item,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'home_id,equipment_type' })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateOnboardingStepStatus = async (
  providerId: string,
  stepId: string,
  status: 'pending' | 'in_progress' | 'completed' | 'skipped',
  notes?: string,
  score?: number
) => {
  const update: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'completed') {
    update.completed_at = new Date().toISOString();
  }
  if (notes !== undefined) update.notes = notes;
  if (score !== undefined) update.score = score;

  const { data, error } = await supabase
    .from('technician_onboarding')
    .update(update)
    .eq('provider_id', providerId)
    .eq('step_id', stepId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

