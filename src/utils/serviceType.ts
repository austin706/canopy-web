// ───────────────────────────────────────────────────────────────────
// serviceType.ts — user-facing labels + display metadata for the four
// service_type enum values on task_templates.
//
// 2026-05-18: introduced after an audit found "Canopy Visit" / "Canopy Pro"
// labels read like separate subscription tiers. The enum values are stable
// (migrating an enum is annoying) but the user-facing copy needed to be
// clarified.
// ───────────────────────────────────────────────────────────────────

export type ServiceType = 'diy' | 'canopy_visit' | 'canopy_pro' | 'licensed_pro';

export interface ServiceTypeMeta {
  /** Short user-facing label suitable for chips/badges */
  label: string;
  /** One-sentence explanation suitable for a banner on TaskDetail */
  banner: string;
  /** Hex color for accent + chip backgrounds */
  accent: string;
  /** Emoji or icon hint */
  icon: string;
}

const META: Record<ServiceType, ServiceTypeMeta> = {
  diy: {
    label: 'DIY-friendly',
    banner: "You can handle this yourself with the steps below. Prefer help? Request a Canopy visit or get a quote — we'll never make you do it alone.",
    accent: '#2E7D32', // sage-leaning green
    icon: '🛠️',
  },
  canopy_visit: {
    label: 'Included in your Pro visit',
    banner: 'Your Canopy Pro handles this during their bimonthly visit. The steps below are here so you can do it yourself between visits if you prefer.',
    accent: '#4A5D4A', // sage
    icon: '🌿',
  },
  canopy_pro: {
    label: 'Canopy add-on service',
    banner: 'Canopy can handle this as an add-on visit or recurring service. The steps below cover the DIY path if you\'d rather do it yourself.',
    accent: '#C4844E', // copper
    icon: '⭐',
  },
  licensed_pro: {
    label: 'Licensed contractor needed',
    banner: 'This requires a licensed specialist for code, safety, or insurance reasons. We\'ll connect you with a vetted local pro and quote the work.',
    accent: '#A04040', // muted red
    icon: '🔒',
  },
};

export function getServiceTypeMeta(serviceType: string | null | undefined): ServiceTypeMeta {
  if (serviceType && (serviceType in META)) return META[serviceType as ServiceType];
  return META.diy; // safest default if the enum drifts or is null
}

export function getServiceTypeLabel(serviceType: string | null | undefined): string {
  return getServiceTypeMeta(serviceType).label;
}

/** Returns true when the task should show a prominent "Get a quote / request a visit"
 *  CTA. DIY tasks get a subtle link instead (handled separately). */
export function isProRecommendedTag(serviceType: string | null | undefined): boolean {
  return serviceType === 'canopy_pro' || serviceType === 'licensed_pro';
}
