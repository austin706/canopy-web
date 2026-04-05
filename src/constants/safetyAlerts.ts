// ============================================================
// Canopy — Safety Alert Definitions
// Triggered when home details contain known hazard conditions
// ============================================================

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface SafetyAlert {
  id: string;
  field: string;
  condition: (home: any) => boolean;
  level: AlertLevel;
  title: string;
  message: string;
}

export const SAFETY_ALERTS: SafetyAlert[] = [
  {
    id: 'knob-and-tube',
    field: 'electrical_wiring_type',
    condition: (h) => h.electrical_wiring_type === 'knob_and_tube',
    level: 'critical',
    title: 'Knob-and-Tube Wiring Detected',
    message: 'Knob-and-tube wiring is a fire hazard. Many insurers will not cover homes with this wiring. Consult a licensed electrician about rewiring.',
  },
  {
    id: 'aluminum-wiring',
    field: 'electrical_wiring_type',
    condition: (h) => h.electrical_wiring_type === 'aluminum',
    level: 'warning',
    title: 'Aluminum Wiring Present',
    message: 'Aluminum wiring (common 1965–1973) has elevated fire risk at connections. Have all connections inspected and consider COPALUM or AlumiConn repairs.',
  },
  {
    id: 'federal-pacific-panel',
    field: 'electrical_panel_brand',
    condition: (h) => h.electrical_panel_brand && /(federal pacific|fpe|zinsco|sylvania zinsco)/i.test(h.electrical_panel_brand),
    level: 'critical',
    title: 'Hazardous Electrical Panel',
    message: 'Federal Pacific / Zinsco panels have known safety defects — breakers may fail to trip during overloads. Replacement is strongly recommended.',
  },
  {
    id: 'polybutylene-pipes',
    field: 'plumbing_supply_type',
    condition: (h) => h.plumbing_supply_type === 'polybutylene',
    level: 'warning',
    title: 'Polybutylene Plumbing Detected',
    message: 'Polybutylene pipes (1978–1995) are prone to brittle failure without warning. Consult a plumber about a replacement plan. Some insurers may not cover polybutylene.',
  },
  {
    id: 'asbestos-known',
    field: 'known_asbestos',
    condition: (h) => h.known_asbestos === true,
    level: 'warning',
    title: 'Asbestos Present',
    message: 'Do not disturb asbestos-containing materials. Professional abatement is required before any renovation or demolition in affected areas.',
  },
  {
    id: 'lead-paint-known',
    field: 'known_lead_paint',
    condition: (h) => h.known_lead_paint === true,
    level: 'warning',
    title: 'Lead Paint Present',
    message: 'Keep painted surfaces intact and in good condition. Professional lead-safe practices are required for any scraping, sanding, or renovation. Critical if children under 6 are present.',
  },
  {
    id: '60-amp-service',
    field: 'electrical_panel_amps',
    condition: (h) => h.electrical_panel_amps === 60,
    level: 'info',
    title: '60-Amp Electrical Service',
    message: '60-amp service is undersized for most modern homes. Consider upgrading to 200-amp, especially if you plan to add EV charging, heat pumps, or major appliances.',
  },
  {
    id: 'high-radon',
    field: 'last_radon_level_pci',
    condition: (h) => h.last_radon_level_pci && h.last_radon_level_pci >= 4,
    level: 'warning',
    title: 'Elevated Radon Level',
    message: 'Radon level is at or above the EPA action level of 4 pCi/L. Install or verify a radon mitigation system. Retest after mitigation to confirm reduction.',
  },
  {
    id: 'galvanized-supply',
    field: 'plumbing_supply_type',
    condition: (h) => h.plumbing_supply_type === 'galvanized',
    level: 'info',
    title: 'Galvanized Supply Pipes',
    message: 'Galvanized steel pipes corrode from the inside and have a 20–50 year lifespan. If your home was built before 1960, consider having a plumber assess pipe condition and plan for replacement.',
  },
  {
    id: 'popcorn-ceiling-asbestos',
    field: 'ceiling_type',
    condition: (h) => h.ceiling_type === 'popcorn' && h.year_built && h.year_built < 1980,
    level: 'info',
    title: 'Popcorn Ceiling May Contain Asbestos',
    message: 'Popcorn/acoustic ceilings installed before 1980 may contain asbestos. Have a sample professionally tested before any removal or renovation.',
  },
  {
    id: 'cast-iron-drains',
    field: 'plumbing_drain_type',
    condition: (h) => h.plumbing_drain_type === 'cast_iron' && h.year_built && h.year_built < 1975,
    level: 'info',
    title: 'Aging Cast Iron Drain Pipes',
    message: 'Cast iron drain pipes from before 1975 may be nearing the end of their lifespan (50–75 years). Consider a camera inspection to assess interior condition.',
  },
];

/**
 * Returns all active safety alerts for a given home.
 */
export function getActiveAlerts(home: any): SafetyAlert[] {
  return SAFETY_ALERTS.filter(alert => alert.condition(home));
}
