// ═══════════════════════════════════════════════════════════════
// Canopy — Inspection Service Layer
// ═══════════════════════════════════════════════════════════════

import { supabase } from '@/services/supabase';
import type {
  InspectionChecklistTemplate,
  VisitInspection,
  VisitInspectionItem,
  VisitPhoto,
  VisitSummaryData,
  ChecklistItemStatus,
  OverallCondition,
  InspectionPhoto,
} from '@/types/inspection';

// ─── Template Functions ───

export async function getChecklistTemplates(category?: string): Promise<InspectionChecklistTemplate[]> {
  let query = supabase
    .from('inspection_checklist_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── Inspection Generation ───

/**
 * Auto-generates inspections for a visit based on the home's equipment.
 * Called when a provider starts a visit.
 * Creates one inspection per equipment piece (matched by category) + a General Home inspection.
 */
export async function generateInspectionsForVisit(
  visitId: string,
  homeId: string
): Promise<VisitInspection[]> {
  // 1. Fetch equipment for this home
  const { data: equipment, error: eqErr } = await supabase
    .from('equipment')
    .select('id, name, category, brand, model_number')
    .eq('home_id', homeId);
  if (eqErr) throw eqErr;

  // 2. Fetch all active templates
  const { data: templates, error: tplErr } = await supabase
    .from('inspection_checklist_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (tplErr) throw tplErr;

  const templateMap = new Map<string, InspectionChecklistTemplate>();
  (templates || []).forEach(t => templateMap.set(t.category, t));

  const inspectionsToCreate: Array<Omit<VisitInspection, 'id' | 'created_at' | 'updated_at'>> = [];

  // 3. Create an inspection per equipment piece
  const usedCategories = new Set<string>();
  for (const eq of (equipment || [])) {
    const template = templateMap.get(eq.category);
    if (!template) continue;

    // Skip duplicate categories (one inspection per category is enough)
    if (usedCategories.has(eq.category)) continue;
    usedCategories.add(eq.category);

    inspectionsToCreate.push({
      visit_id: visitId,
      equipment_id: eq.id,
      template_id: template.id,
      checklist_name: template.name,
      equipment_name: [eq.brand, eq.name].filter(Boolean).join(' ') || eq.category,
      equipment_category: eq.category,
      status: 'pending',
    });
  }

  // 4. Always add General Home inspection
  const generalTemplate = templateMap.get('general_home');
  if (generalTemplate) {
    inspectionsToCreate.push({
      visit_id: visitId,
      template_id: generalTemplate.id,
      checklist_name: generalTemplate.name,
      equipment_name: 'General Home',
      equipment_category: 'general_home',
      status: 'pending',
    });
  }

  if (inspectionsToCreate.length === 0) return [];

  // 5. Insert inspections
  const { data: inspections, error: insErr } = await supabase
    .from('visit_inspections')
    .insert(inspectionsToCreate)
    .select();
  if (insErr) throw insErr;

  // 6. Create checklist items for each inspection
  const itemsToCreate: Array<Omit<VisitInspectionItem, 'id' | 'created_at' | 'updated_at'>> = [];

  for (const inspection of (inspections || [])) {
    const template = (templates || []).find(t => t.id === inspection.template_id);
    if (!template?.items) continue;

    const templateItems = Array.isArray(template.items) ? template.items : [];
    templateItems.forEach((item: { id: string; label: string; description?: string }, index: number) => {
      itemsToCreate.push({
        inspection_id: inspection.id,
        item_key: item.id,
        label: item.label,
        description: item.description || '',
        status: 'pending',
        notes: '',
        photos: [],
        sort_order: index,
      });
    });
  }

  if (itemsToCreate.length > 0) {
    const { error: itemErr } = await supabase
      .from('visit_inspection_items')
      .insert(itemsToCreate);
    if (itemErr) throw itemErr;
  }

  return inspections || [];
}

// ─── Fetch Inspections ───

export async function getVisitInspections(visitId: string): Promise<VisitInspection[]> {
  const { data: inspections, error: insErr } = await supabase
    .from('visit_inspections')
    .select('*')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true });
  if (insErr) throw insErr;

  if (!inspections || inspections.length === 0) return [];

  // Fetch items for all inspections
  const inspectionIds = inspections.map(i => i.id);
  const { data: items, error: itemErr } = await supabase
    .from('visit_inspection_items')
    .select('*')
    .in('inspection_id', inspectionIds)
    .order('sort_order', { ascending: true });
  if (itemErr) throw itemErr;

  // Group items by inspection
  const itemsByInspection = new Map<string, VisitInspectionItem[]>();
  (items || []).forEach(item => {
    const list = itemsByInspection.get(item.inspection_id) || [];
    list.push(item);
    itemsByInspection.set(item.inspection_id, list);
  });

  return inspections.map(inspection => ({
    ...inspection,
    items: itemsByInspection.get(inspection.id) || [],
  }));
}

// ─── Update Checklist Item ───

export async function updateInspectionItemStatus(
  itemId: string,
  status: ChecklistItemStatus,
  notes?: string,
  photos?: InspectionPhoto[]
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (notes !== undefined) updates.notes = notes;
  if (photos !== undefined) updates.photos = photos;

  const { error } = await supabase
    .from('visit_inspection_items')
    .update(updates)
    .eq('id', itemId);
  if (error) throw error;
}

// ─── Complete Inspection ───

export async function completeInspection(
  inspectionId: string,
  overallCondition: OverallCondition,
  proNotes?: string
): Promise<void> {
  const { error } = await supabase
    .from('visit_inspections')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      overall_condition: overallCondition,
      pro_notes: proNotes || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', inspectionId);
  if (error) throw error;
}

// ─── Photo Upload ───

export async function uploadVisitPhoto(
  visitId: string,
  inspectionId?: string,
  file?: File
): Promise<string> {
  if (!file) throw new Error('No file provided');

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `visits/${visitId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('visit-photos')
    .upload(path, file, { contentType: file.type });
  if (uploadErr) throw uploadErr;

  const { data: urlData } = supabase.storage
    .from('visit-photos')
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  // Create DB record
  const { error: dbErr } = await supabase
    .from('visit_photos')
    .insert({
      visit_id: visitId,
      inspection_id: inspectionId || null,
      url: publicUrl,
      photo_type: 'general',
      taken_at: new Date().toISOString(),
    });
  if (dbErr) throw dbErr;

  return publicUrl;
}

// ─── AI Summary Data ───

/**
 * Fetches everything needed for AI visit summary generation.
 * Used by the generate-visit-summary edge function.
 */
export async function getVisitSummaryData(visitId: string): Promise<VisitSummaryData> {
  // Visit + provider
  const { data: visit, error: vErr } = await supabase
    .from('pro_monthly_visits')
    .select('*, provider:pro_providers(business_name, contact_name)')
    .eq('id', visitId)
    .single();
  if (vErr || !visit) throw vErr || new Error('Visit not found');

  // Home
  const { data: home, error: hErr } = await supabase
    .from('homes')
    .select('address, city, state, year_built, square_footage')
    .eq('id', visit.home_id)
    .single();
  if (hErr || !home) throw hErr || new Error('Home not found');

  // Equipment
  const { data: equipment, error: eErr } = await supabase
    .from('equipment')
    .select('id, name, category, brand, model_number, install_date, condition')
    .eq('home_id', visit.home_id);
  if (eErr) throw eErr;

  // Inspections with items
  const inspections = await getVisitInspections(visitId);

  // Photos
  const { data: photos, error: pErr } = await supabase
    .from('visit_photos')
    .select('*')
    .eq('visit_id', visitId);
  if (pErr) throw pErr;

  return {
    visit,
    home,
    equipment: equipment || [],
    inspections,
    photos: photos || [],
    provider: visit.provider || { business_name: 'Canopy', contact_name: 'Tech' },
  };
}
