// ===============================================================
// Canopy — Predictive Cost Forecasting
// ===============================================================
// IMPORTANT: All default costs are national averages for budgeting
// purposes only. Actual costs vary significantly by region, material,
// home size, and contractor. Pro provider quotes override estimates.
// ===============================================================
import type { Equipment } from '@/types';
import { EQUIPMENT_LIFESPAN_DEFAULTS } from '@/constants/maintenance';

// ── Home context for smarter estimates ──────────────────────────
export interface HomeContext {
  square_footage?: number;
  stories?: number;
  roof_type?: string;
  has_pool?: boolean;
}

// ── Cost range (low–high) for transparency ─────────────────────
interface CostRange {
  low: number;
  mid: number;
  high: number;
}

/**
 * Roof cost per square foot (of roof area) by material.
 * Roof area ≈ floor sqft / stories × 1.15 pitch factor (average).
 */
const ROOF_COST_PER_SQFT: Record<string, CostRange> = {
  asphalt_shingle: { low: 3.50, mid: 5.00, high: 7.00 },
  metal:           { low: 7.00, mid: 10.00, high: 14.00 },
  tile:            { low: 8.00, mid: 12.00, high: 18.00 },
  slate:           { low: 15.00, mid: 22.00, high: 30.00 },
  flat:            { low: 4.00, mid: 6.50, high: 9.00 },
  wood_shake:      { low: 6.00, mid: 9.00, high: 12.00 },
};

/** Estimate roof replacement cost from home data */
function estimateRoofCost(home?: HomeContext): CostRange {
  const sqft = home?.square_footage || 2000;
  const stories = home?.stories || 1;
  const roofArea = (sqft / stories) * 1.15; // approximate roof area with pitch
  const material = home?.roof_type || 'asphalt_shingle';
  const rates = ROOF_COST_PER_SQFT[material] || ROOF_COST_PER_SQFT.asphalt_shingle;
  return {
    low: Math.round(roofArea * rates.low),
    mid: Math.round(roofArea * rates.mid),
    high: Math.round(roofArea * rates.high),
  };
}

/**
 * HVAC cost scales with home size (tonnage).
 * Rule of thumb: ~1 ton per 500 sqft. Cost per ton varies by system type.
 */
const HVAC_COST_PER_TON: Record<string, CostRange> = {
  'central air conditioner': { low: 1000, mid: 1500, high: 2200 },
  'heat pump':               { low: 1200, mid: 1800, high: 2500 },
  'gas furnace':             { low: 800, mid: 1200, high: 1800 },
  'electric furnace':        { low: 600, mid: 1000, high: 1500 },
  'boiler':                  { low: 1200, mid: 1800, high: 2800 },
};

function estimateHVACCost(eq: Equipment, home?: HomeContext): CostRange | null {
  const subtype = eq.equipment_subtype?.toLowerCase() || '';
  const name = eq.name?.toLowerCase() || '';

  for (const key of Object.keys(HVAC_COST_PER_TON)) {
    if (subtype.includes(key) || name.includes(key)) {
      const rates = HVAC_COST_PER_TON[key];
      // Use equipment tonnage if known, otherwise estimate from home sqft
      const tons = eq.tonnage || Math.ceil((home?.square_footage || 2000) / 500);
      return {
        low: Math.round(tons * rates.low),
        mid: Math.round(tons * rates.mid),
        high: Math.round(tons * rates.high),
      };
    }
  }
  return null;
}

/** Gutter cost scales with roof perimeter (approximated from sqft) */
function estimateGutterCost(home?: HomeContext): CostRange {
  const sqft = home?.square_footage || 2000;
  const stories = home?.stories || 1;
  // Approximate perimeter from footprint (assume roughly square)
  const footprint = sqft / stories;
  const side = Math.sqrt(footprint);
  const perimeterFt = side * 4;
  // Gutters cost ~$6–$15/linear foot installed
  return {
    low: Math.round(perimeterFt * 6),
    mid: Math.round(perimeterFt * 10),
    high: Math.round(perimeterFt * 15),
  };
}

/** Default replacement cost estimates — flat national averages for items not scaling with home size */
const DEFAULT_REPLACEMENT_COSTS: Record<string, CostRange> = {
  // HVAC (smaller items that don't scale)
  'evaporator coil':      { low: 1200, mid: 2000, high: 3000 },
  'condenser unit':       { low: 2500, mid: 4000, high: 5500 },
  'ac condenser':         { low: 2500, mid: 4000, high: 5500 },
  'mini split':           { low: 2000, mid: 3500, high: 5000 },
  'ductless mini split':  { low: 2000, mid: 3500, high: 5000 },
  'air handler':          { low: 1500, mid: 2500, high: 3500 },
  'thermostat':           { low: 100, mid: 250, high: 500 },
  'humidifier':           { low: 300, mid: 600, high: 1000 },
  'dehumidifier':         { low: 200, mid: 400, high: 700 },
  // Water Heaters
  'tank water heater':       { low: 900, mid: 1500, high: 2200 },
  'tankless water heater':   { low: 1800, mid: 3000, high: 4500 },
  'gas water heater':        { low: 900, mid: 1500, high: 2200 },
  'electric water heater':   { low: 700, mid: 1200, high: 1800 },
  'heat pump water heater':  { low: 1500, mid: 2500, high: 3800 },
  // Appliances
  'refrigerator':     { low: 1000, mid: 1800, high: 3000 },
  'dishwasher':       { low: 400, mid: 800, high: 1400 },
  'washing machine':  { low: 500, mid: 900, high: 1500 },
  'dryer':            { low: 400, mid: 800, high: 1400 },
  'oven':             { low: 800, mid: 1500, high: 2500 },
  'range':            { low: 800, mid: 1500, high: 2500 },
  'microwave':        { low: 150, mid: 350, high: 600 },
  'garbage disposal': { low: 150, mid: 300, high: 500 },
  'range hood':       { low: 200, mid: 400, high: 800 },
  // Outdoor
  'garage door opener': { low: 250, mid: 400, high: 650 },
  'sprinkler system':   { low: 1800, mid: 3000, high: 5000 },
  'sump pump':          { low: 350, mid: 600, high: 1000 },
  'water softener':     { low: 800, mid: 1500, high: 2500 },
  // Pool
  'pool pump':   { low: 500, mid: 800, high: 1400 },
  'pool heater': { low: 1800, mid: 3000, high: 4500 },
  'pool filter': { low: 300, mid: 500, high: 900 },
};

/** Fallback ranges by equipment category */
const CATEGORY_FALLBACK_COSTS: Record<string, CostRange> = {
  hvac:         { low: 2500, mid: 4000, high: 6000 },
  water_heater: { low: 900, mid: 1500, high: 2500 },
  appliance:    { low: 500, mid: 1000, high: 2000 },
  roof:         { low: 7000, mid: 10000, high: 15000 },
  plumbing:     { low: 500, mid: 1000, high: 2000 },
  electrical:   { low: 400, mid: 800, high: 1500 },
  outdoor:      { low: 800, mid: 1500, high: 3000 },
  safety:       { low: 100, mid: 200, high: 400 },
  pool:         { low: 500, mid: 1000, high: 2000 },
  garage:       { low: 250, mid: 500, high: 900 },
};

// ── Public types ────────────────────────────────────────────────

export interface CostForecastItem {
  equipment: Equipment;
  ageYears: number;
  lifespanYears: number;
  remainingYears: number;
  percentUsed: number; // 0–100+
  estimatedCost: number;       // mid-range estimate or pro quote
  costRange: CostRange | null; // null when using a pro quote (exact figure)
  isProQuote: boolean;         // true if cost came from a pro provider
  urgency: 'replace_now' | 'replace_soon' | 'plan_ahead' | 'good';
  forecastYear: number;        // Year replacement is expected
}

export interface CostForecastSummary {
  items: CostForecastItem[];
  totalNextYear: number;
  totalNext3Years: number;
  totalNext5Years: number;
  totalNext10Years: number;
  urgentCount: number;
  hasProQuotes: boolean; // true if any item has a real pro quote
}

export const FORECAST_DISCLAIMER =
  'Estimates are based on national averages and general equipment lifespans for budgeting purposes only. ' +
  'Actual replacement costs vary by region, materials, home size, and contractor. ' +
  'Items marked with a pro quote reflect pricing from a Canopy Certified Pro.';

// ── Cost calculation ────────────────────────────────────────────

/** Get the estimated replacement cost for a piece of equipment, considering home context */
function getReplacementCost(
  eq: Equipment,
  home?: HomeContext
): { cost: number; range: CostRange | null; isProQuote: boolean } {
  // 1. Pro quote or homeowner-entered cost takes absolute priority
  if (eq.estimated_replacement_cost && (eq.replacement_quote_source === 'pro_quote' || eq.replacement_quote_source === 'homeowner')) {
    return { cost: eq.estimated_replacement_cost, range: null, isProQuote: eq.replacement_quote_source === 'pro_quote' };
  }

  // 2. If user set a cost themselves (no source tag), still use it but treat as estimate
  if (eq.estimated_replacement_cost) {
    return { cost: eq.estimated_replacement_cost, range: null, isProQuote: false };
  }

  const subtype = eq.equipment_subtype?.toLowerCase() || '';
  const name = eq.name?.toLowerCase() || '';

  // 3. Roof — scales with home size & material
  if (eq.category === 'roof' && (subtype.includes('roof') || name.includes('roof') || !subtype)) {
    const range = estimateRoofCost(home);
    return { cost: range.mid, range, isProQuote: false };
  }

  // 4. Gutters — scale with perimeter
  if (subtype.includes('gutter') || name.includes('gutter')) {
    const range = estimateGutterCost(home);
    return { cost: range.mid, range, isProQuote: false };
  }

  // 5. HVAC systems that scale with tonnage/home size
  const hvacRange = estimateHVACCost(eq, home);
  if (hvacRange) {
    return { cost: hvacRange.mid, range: hvacRange, isProQuote: false };
  }

  // 6. Flat national-average lookup by subtype/name
  for (const key of Object.keys(DEFAULT_REPLACEMENT_COSTS)) {
    if (subtype.includes(key) || name.includes(key)) {
      const range = DEFAULT_REPLACEMENT_COSTS[key];
      return { cost: range.mid, range, isProQuote: false };
    }
  }

  // 7. Category fallback
  const range = CATEGORY_FALLBACK_COSTS[eq.category] || { low: 500, mid: 1000, high: 2000 };
  return { cost: range.mid, range, isProQuote: false };
}

/** Get the expected lifespan in years for equipment */
function getLifespan(eq: Equipment): number {
  if (eq.expected_lifespan_years) return eq.expected_lifespan_years;

  const subtype = eq.equipment_subtype?.toLowerCase() || '';
  const name = eq.name?.toLowerCase() || '';

  for (const key of Object.keys(EQUIPMENT_LIFESPAN_DEFAULTS)) {
    if (subtype.includes(key) || name.includes(key)) {
      return EQUIPMENT_LIFESPAN_DEFAULTS[key];
    }
  }

  const categoryDefaults: Record<string, number> = {
    hvac: 15, water_heater: 12, appliance: 12, roof: 25,
    plumbing: 15, electrical: 20, outdoor: 12, safety: 10, pool: 10, garage: 15,
  };
  return categoryDefaults[eq.category] || 15;
}

// ── Main forecast generator ─────────────────────────────────────

/** Generate a cost forecast for all equipment, using home context for smarter estimates */
export function generateCostForecast(equipment: Equipment[], home?: HomeContext): CostForecastSummary {
  const now = new Date();
  const currentYear = now.getFullYear();

  const items: CostForecastItem[] = equipment
    .filter(eq => eq.install_date)
    .map(eq => {
      const installDate = new Date(eq.install_date!);
      const ageYears = Math.max(0, (now.getTime() - installDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      const lifespanYears = getLifespan(eq);
      const remainingYears = Math.max(0, lifespanYears - ageYears);
      const percentUsed = Math.round((ageYears / lifespanYears) * 100);
      const { cost, range, isProQuote } = getReplacementCost(eq, home);
      const forecastYear = currentYear + Math.ceil(remainingYears);

      let urgency: CostForecastItem['urgency'];
      if (remainingYears <= 0) urgency = 'replace_now';
      else if (remainingYears <= 2) urgency = 'replace_soon';
      else if (remainingYears <= 5) urgency = 'plan_ahead';
      else urgency = 'good';

      return {
        equipment: eq,
        ageYears: Math.round(ageYears * 10) / 10,
        lifespanYears,
        remainingYears: Math.round(remainingYears * 10) / 10,
        percentUsed,
        estimatedCost: cost,
        costRange: range,
        isProQuote,
        urgency,
        forecastYear,
      };
    })
    .sort((a, b) => a.remainingYears - b.remainingYears);

  const totalNextYear = items.filter(i => i.forecastYear <= currentYear + 1).reduce((sum, i) => sum + i.estimatedCost, 0);
  const totalNext3Years = items.filter(i => i.forecastYear <= currentYear + 3).reduce((sum, i) => sum + i.estimatedCost, 0);
  const totalNext5Years = items.filter(i => i.forecastYear <= currentYear + 5).reduce((sum, i) => sum + i.estimatedCost, 0);
  const totalNext10Years = items.filter(i => i.forecastYear <= currentYear + 10).reduce((sum, i) => sum + i.estimatedCost, 0);
  const urgentCount = items.filter(i => i.urgency === 'replace_now' || i.urgency === 'replace_soon').length;
  const hasProQuotes = items.some(i => i.isProQuote);

  return { items, totalNextYear, totalNext3Years, totalNext5Years, totalNext10Years, urgentCount, hasProQuotes };
}
