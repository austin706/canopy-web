// ===============================================================
// Canopy — Home Sale Prep Checklist Constants
// ===============================================================

export interface SalePrepItem {
  id: string;
  label: string;
  description: string;
  category: SalePrepCategory;
  estimatedCost?: string;
  diy: boolean;
}

export type SalePrepCategory = 'exterior' | 'interior' | 'systems' | 'documentation' | 'staging';

export const SALE_PREP_CATEGORIES: { id: SalePrepCategory; label: string; icon: string }[] = [
  { id: 'exterior', label: 'Exterior & Curb Appeal', icon: '🏡' },
  { id: 'interior', label: 'Interior Prep', icon: '🏠' },
  { id: 'systems', label: 'Systems & Maintenance', icon: '🔧' },
  { id: 'documentation', label: 'Documentation', icon: '📄' },
  { id: 'staging', label: 'Staging & Presentation', icon: '✨' },
];

export const SALE_PREP_ITEMS: SalePrepItem[] = [
  // Exterior
  { id: 'ext_powerwash', label: 'Power wash exterior, driveway & walkways', description: 'Remove dirt, mildew, and stains from siding, concrete, and brick surfaces.', category: 'exterior', estimatedCost: '$200–$500', diy: true },
  { id: 'ext_landscape', label: 'Refresh landscaping & mulch beds', description: 'Trim bushes, edge beds, add fresh mulch, and plant seasonal flowers.', category: 'exterior', estimatedCost: '$100–$400', diy: true },
  { id: 'ext_lawn', label: 'Get lawn in top shape', description: 'Mow, edge, fertilize, and address bare spots. Consider professional treatment.', category: 'exterior', estimatedCost: '$50–$200', diy: true },
  { id: 'ext_paint_touch', label: 'Touch up exterior paint & trim', description: 'Fix peeling paint, touch up trim, shutters, and front door.', category: 'exterior', estimatedCost: '$100–$300', diy: true },
  { id: 'ext_gutters', label: 'Clean gutters & downspouts', description: 'Remove debris and ensure proper drainage away from foundation.', category: 'exterior', estimatedCost: '$100–$250', diy: true },
  { id: 'ext_roof_inspect', label: 'Inspect roof for visible damage', description: 'Check for missing shingles, flashing issues, or visible wear.', category: 'exterior', estimatedCost: '$0–$300', diy: false },
  { id: 'ext_front_door', label: 'Refresh front door & hardware', description: 'Paint or stain front door, polish or replace hardware and house numbers.', category: 'exterior', estimatedCost: '$50–$200', diy: true },
  { id: 'ext_lighting', label: 'Update exterior lighting', description: 'Replace burned-out bulbs, clean fixtures, consider adding path lighting.', category: 'exterior', estimatedCost: '$30–$150', diy: true },

  // Interior
  { id: 'int_declutter', label: 'Declutter every room', description: 'Remove personal items, excess furniture, and clear countertops. Less is more.', category: 'interior', diy: true },
  { id: 'int_deep_clean', label: 'Deep clean entire home', description: 'Scrub bathrooms, kitchen, floors, windows, and baseboards. Consider professional cleaning.', category: 'interior', estimatedCost: '$200–$500', diy: true },
  { id: 'int_paint_neutral', label: 'Paint walls in neutral tones', description: 'Fresh neutral paint (white, beige, light gray) makes rooms feel larger and newer.', category: 'interior', estimatedCost: '$200–$800', diy: true },
  { id: 'int_carpet', label: 'Clean or replace carpets', description: 'Professional carpet cleaning or replacement if heavily worn or stained.', category: 'interior', estimatedCost: '$150–$2000', diy: false },
  { id: 'int_fixtures', label: 'Update dated light fixtures', description: 'Replace builder-grade or outdated fixtures with modern options.', category: 'interior', estimatedCost: '$50–$500', diy: true },
  { id: 'int_hardware', label: 'Update cabinet hardware', description: 'Fresh knobs and pulls in kitchen and bathrooms make a big impact.', category: 'interior', estimatedCost: '$50–$200', diy: true },
  { id: 'int_caulk_grout', label: 'Re-caulk & re-grout bathrooms/kitchen', description: 'Fresh caulk around tubs, showers, and sinks. Re-grout discolored tile.', category: 'interior', estimatedCost: '$20–$100', diy: true },
  { id: 'int_minor_repairs', label: 'Fix minor repairs', description: 'Patch nail holes, fix sticky doors, tighten loose handles, replace cracked switch plates.', category: 'interior', estimatedCost: '$0–$100', diy: true },

  // Systems
  { id: 'sys_hvac_service', label: 'Service HVAC system', description: 'Professional tune-up, filter replacement, and cleaning. Get service report.', category: 'systems', estimatedCost: '$100–$200', diy: false },
  { id: 'sys_plumbing_check', label: 'Check for plumbing leaks', description: 'Inspect under sinks, around toilets, and water heater for drips or moisture.', category: 'systems', estimatedCost: '$0–$200', diy: true },
  { id: 'sys_electrical', label: 'Test all outlets & switches', description: 'Ensure all outlets work, GFCIs trip correctly, and no flickering lights.', category: 'systems', estimatedCost: '$0–$150', diy: true },
  { id: 'sys_water_heater', label: 'Flush water heater', description: 'Drain and flush sediment, check anode rod. Note age for disclosure.', category: 'systems', estimatedCost: '$0–$150', diy: true },
  { id: 'sys_smoke_co', label: 'Test smoke & CO detectors', description: 'Replace batteries, test all units, replace any older than 10 years.', category: 'systems', estimatedCost: '$20–$60', diy: true },
  { id: 'sys_garage_door', label: 'Service garage door & opener', description: 'Lubricate, test safety sensors, check springs and opener operation.', category: 'systems', estimatedCost: '$0–$150', diy: true },

  // Documentation
  { id: 'doc_maintenance_log', label: 'Compile maintenance history', description: 'Gather all maintenance logs, receipts, and service records from Canopy. Use the Home Report page to export a PDF.', category: 'documentation', diy: true },
  { id: 'doc_warranties', label: 'Organize warranty documents', description: 'Collect all active warranties for appliances, roof, HVAC, and other systems.', category: 'documentation', diy: true },
  { id: 'doc_permits', label: 'Gather permits & inspection reports', description: 'Collect building permits, inspection reports, and any renovation documentation.', category: 'documentation', diy: true },
  { id: 'doc_utility_bills', label: 'Prepare utility cost summary', description: 'Compile 12 months of utility bills to show buyers expected costs.', category: 'documentation', diy: true },
  { id: 'doc_hoa', label: 'Gather HOA documents (if applicable)', description: 'CC&Rs, bylaws, meeting minutes, fee schedule, and special assessments.', category: 'documentation', diy: true },
  { id: 'doc_disclosures', label: 'Prepare seller disclosures', description: 'Document known issues, past repairs, and any material facts about the property.', category: 'documentation', diy: true },

  // Staging
  { id: 'stg_furniture', label: 'Arrange furniture for flow', description: 'Create clear walking paths, define room purposes, and remove oversized pieces.', category: 'staging', diy: true },
  { id: 'stg_lighting', label: 'Maximize natural light', description: 'Open blinds, clean windows, add mirrors, and use bright bulbs.', category: 'staging', diy: true },
  { id: 'stg_bathroom', label: 'Stage bathrooms with fresh towels', description: 'White towels, new soap dispenser, small plant, and clear counters.', category: 'staging', estimatedCost: '$30–$80', diy: true },
  { id: 'stg_kitchen', label: 'Stage kitchen counters', description: 'Clear everything except 1-2 attractive items (cutting board, fruit bowl).', category: 'staging', diy: true },
  { id: 'stg_closets', label: 'Organize closets (buyers look!)', description: 'Remove half the contents, use matching hangers, and organize neatly.', category: 'staging', diy: true },
  { id: 'stg_curb_photo', label: 'Take listing-ready photos', description: 'Professional photography makes a huge difference. Budget for it.', category: 'staging', estimatedCost: '$150–$400', diy: false },
];
