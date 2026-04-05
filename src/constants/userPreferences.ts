// ============================================================
// Canopy — User Preference Labels & Onboarding Content
// ============================================================

export const MAINTENANCE_DEPTH_OPTIONS = [
  {
    id: 'simple' as const,
    label: 'Keep It Simple',
    description: 'Just the essentials — filters, detectors, seasonal prep, and the big stuff. About 20 tasks per year.',
    icon: 'leaf-outline',
  },
  {
    id: 'standard' as const,
    label: "I'm On It",
    description: 'The full recommended task set for your home — personalized by systems, season, and region. Most popular.',
    icon: 'checkmark-circle-outline',
    recommended: true,
  },
  {
    id: 'comprehensive' as const,
    label: 'I Want It All',
    description: 'Everything, including deep cleaning schedules, niche system tasks, and hardscape maintenance. Leave nothing to chance.',
    icon: 'shield-checkmark-outline',
  },
];

export const CLEANING_TOGGLE = {
  label: 'Include cleaning reminders?',
  description: 'Deep cleaning for kitchen, bathrooms, windows, carpet, and pressure washing. Turn off if you already have a cleaning service.',
};

export const HOME_DETAIL_DEPTH_OPTIONS = [
  {
    id: 'essentials' as const,
    label: 'Essentials',
    description: 'Address, size, roof, heating, cooling, and key features. Fast and simple.',
    icon: 'home-outline',
  },
  {
    id: 'detailed' as const,
    label: 'Detailed',
    description: 'Adds construction type, plumbing, electrical, insulation, and windows. Builds a stronger Home Token.',
    icon: 'construct-outline',
    recommended: true,
  },
  {
    id: 'everything' as const,
    label: 'Everything',
    description: 'Every field available — install years, R-values, drain materials, inverter types. For the detail-oriented homeowner.',
    icon: 'analytics-outline',
  },
];

export const TASK_CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  hvac: { label: 'HVAC & Air', icon: 'thermometer-outline' },
  water_heater: { label: 'Water Heater', icon: 'flame-outline' },
  roof: { label: 'Roof & Gutters', icon: 'home-outline' },
  plumbing: { label: 'Plumbing', icon: 'water-outline' },
  electrical: { label: 'Electrical', icon: 'flash-outline' },
  appliance: { label: 'Appliances', icon: 'settings-outline' },
  safety: { label: 'Safety', icon: 'shield-outline' },
  pool: { label: 'Pool', icon: 'water-outline' },
  garage: { label: 'Garage', icon: 'car-outline' },
  outdoor: { label: 'Outdoor', icon: 'leaf-outline' },
  lawn: { label: 'Lawn & Landscape', icon: 'flower-outline' },
  deck: { label: 'Deck & Patio', icon: 'grid-outline' },
  fireplace: { label: 'Fireplace & Chimney', icon: 'bonfire-outline' },
  sprinkler: { label: 'Irrigation', icon: 'rainy-outline' },
  seasonal: { label: 'Seasonal', icon: 'calendar-outline' },
  pest_control: { label: 'Pest Control', icon: 'bug-outline' },
  cleaning: { label: 'Cleaning', icon: 'sparkles-outline' },
  solar: { label: 'Solar & Energy', icon: 'sunny-outline' },
  generator: { label: 'Generator', icon: 'power-outline' },
  well: { label: 'Well System', icon: 'water-outline' },
  septic: { label: 'Septic System', icon: 'layers-outline' },
  hardscape: { label: 'Driveway & Hardscape', icon: 'cube-outline' },
};
