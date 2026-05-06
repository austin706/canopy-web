import { supabase } from '@/services/supabase';

export interface EquipmentHealthSnapshot {
  visitId: string;
  visitDate: string;
  condition: string; // 'good' | 'fair' | 'needs_attention' | 'critical'
  proNotes?: string;
  itemsPassed: number;
  itemsFailed: number;
  itemsAttention: number;
}

export interface EquipmentTrend {
  equipmentId: string;
  equipmentName: string;
  equipmentCategory: string;
  currentCondition: string;
  snapshots: EquipmentHealthSnapshot[];
  trendDirection: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high';
}

const CONDITION_SCORES: Record<string, number> = {
  good: 4,
  fair: 3,
  needs_attention: 2,
  critical: 1,
};

function calculateTrendDirection(snapshots: EquipmentHealthSnapshot[]): 'improving' | 'stable' | 'declining' {
  if (snapshots.length < 2) return 'stable';
  const recent = snapshots.slice(0, Math.min(3, snapshots.length));
  const older = snapshots.slice(Math.min(3, snapshots.length));
  if (older.length === 0) return 'stable';

  const recentAvg = recent.reduce((sum, s) => sum + (CONDITION_SCORES[s.condition] || 3), 0) / recent.length;
  const olderAvg = older.reduce((sum, s) => sum + (CONDITION_SCORES[s.condition] || 3), 0) / older.length;

  const diff = recentAvg - olderAvg;
  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

function calculateRiskLevel(trend: EquipmentHealthSnapshot[]): 'low' | 'medium' | 'high' {
  if (trend.length === 0) return 'low';
  const latest = trend[0];
  if (latest.condition === 'critical' || latest.itemsFailed > 2) return 'high';
  if (latest.condition === 'needs_attention' || latest.itemsFailed > 0 || latest.itemsAttention > 2) return 'medium';
  return 'low';
}

export async function getEquipmentTrends(homeId: string): Promise<EquipmentTrend[]> {
  // Get all completed visits for this home, ordered by date descending.
  // 2026-05-06: pro_monthly_visits has no `overall_condition` column —
  // condition lives per-inspection on visit_inspections (queried below).
  // The visit-level `pro_notes` was selected but never read either; dropped.
  const { data: visits, error: visitError } = await supabase
    .from('pro_monthly_visits')
    .select('id, completed_at')
    .eq('home_id', homeId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });
  if (visitError) throw visitError;
  if (!visits || visits.length === 0) return [];

  const visitIds = visits.map(v => v.id);

  // Get all inspections for these visits
  const { data: inspections, error: inspError } = await supabase
    .from('visit_inspections')
    .select('id, visit_id, equipment_id, equipment_name, equipment_category, overall_condition, pro_notes')
    .in('visit_id', visitIds);
  if (inspError) throw inspError;

  // Get inspection items
  const inspectionIds = (inspections || []).map(i => i.id);
  let items: any[] = [];
  if (inspectionIds.length > 0) {
    const { data: itemData, error: itemError } = await supabase
      .from('visit_inspection_items')
      .select('inspection_id, status')
      .in('inspection_id', inspectionIds);
    if (!itemError) items = itemData || [];
  }

  // Group by equipment
  const equipmentMap = new Map<string, { name: string; category: string; snapshots: EquipmentHealthSnapshot[] }>();

  for (const inspection of (inspections || [])) {
    const key = inspection.equipment_id || inspection.equipment_name || inspection.id;
    if (!equipmentMap.has(key)) {
      equipmentMap.set(key, {
        name: inspection.equipment_name || 'Unknown Equipment',
        category: inspection.equipment_category || 'general',
        snapshots: [],
      });
    }

    const visit = visits.find(v => v.id === inspection.visit_id);
    const inspItems = items.filter(i => i.inspection_id === inspection.id);

    equipmentMap.get(key)!.snapshots.push({
      visitId: inspection.visit_id,
      visitDate: visit?.completed_at || '',
      condition: inspection.overall_condition || 'fair',
      proNotes: inspection.pro_notes,
      itemsPassed: inspItems.filter(i => i.status === 'pass').length,
      itemsFailed: inspItems.filter(i => i.status === 'fail').length,
      itemsAttention: inspItems.filter(i => i.status === 'needs_attention').length,
    });
  }

  // Build trends
  const trends: EquipmentTrend[] = [];
  for (const [eqId, data] of equipmentMap) {
    // Sort snapshots by date descending
    data.snapshots.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

    trends.push({
      equipmentId: eqId,
      equipmentName: data.name,
      equipmentCategory: data.category,
      currentCondition: data.snapshots[0]?.condition || 'fair',
      snapshots: data.snapshots,
      trendDirection: calculateTrendDirection(data.snapshots),
      riskLevel: calculateRiskLevel(data.snapshots),
    });
  }

  // Sort: high risk first, then declining
  trends.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    const rDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    if (rDiff !== 0) return rDiff;
    const trendOrder = { declining: 0, stable: 1, improving: 2 };
    return trendOrder[a.trendDirection] - trendOrder[b.trendDirection];
  });

  return trends;
}
