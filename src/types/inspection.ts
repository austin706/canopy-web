// ═══════════════════════════════════════════════════════════════
// Canopy — Inspection & Checklist Type Definitions
// ═══════════════════════════════════════════════════════════════

import type { ProMonthlyVisit } from './index';

// ─── Status Enums ───

export type InspectionStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ChecklistItemStatus = 'pass' | 'needs_attention' | 'fail' | 'na' | 'pending';
export type OverallCondition = 'good' | 'fair' | 'needs_attention' | 'critical';
export type PhotoType = 'general' | 'before' | 'after' | 'issue' | 'equipment';

// ─── Checklist Templates ───

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  description: string;
  category: string;
}

export interface InspectionChecklistTemplate {
  id: string;
  category: string;
  name: string;
  description?: string;
  items: ChecklistItemTemplate[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Visit Inspections ───

export interface InspectionPhoto {
  url: string;
  caption?: string;
  taken_at?: string;
}

export interface VisitInspectionItem {
  id: string;
  inspection_id: string;
  item_key: string;
  label: string;
  description?: string;
  status: ChecklistItemStatus;
  notes?: string;
  photos: InspectionPhoto[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VisitInspection {
  id: string;
  visit_id: string;
  equipment_id?: string;
  template_id?: string;
  checklist_name: string;
  equipment_name?: string;
  equipment_category?: string;
  status: InspectionStatus;
  started_at?: string;
  completed_at?: string;
  overall_condition?: OverallCondition;
  pro_notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  items?: VisitInspectionItem[];
}

export interface VisitPhoto {
  id: string;
  visit_id: string;
  inspection_id?: string;
  url: string;
  caption?: string;
  photo_type: PhotoType;
  taken_at: string;
  created_at: string;
}

// ─── Composed Types ───

export interface VisitWithInspections extends ProMonthlyVisit {
  inspections?: VisitInspection[];
  visit_photos?: VisitPhoto[];
  ai_summary?: string;
  ai_summary_generated_at?: string;
}

export interface VisitSummaryData {
  visit: ProMonthlyVisit;
  home: {
    address: string;
    city: string;
    state: string;
    year_built?: number;
    square_footage?: number;
  };
  equipment: Array<{
    id: string;
    name: string;
    category: string;
    brand?: string;
    model_number?: string;
    install_date?: string;
    condition?: string;
  }>;
  inspections: VisitInspection[];
  photos: VisitPhoto[];
  provider: {
    business_name: string;
    contact_name: string;
  };
}
