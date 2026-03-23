// ===============================================================
// Subscription Tier Gating (shared logic with mobile)
// ===============================================================
import type { SubscriptionTier } from '@/types';

export type Feature =
  | 'basic_calendar' | 'unlimited_equipment' | 'personalized_scheduling'
  | 'smart_recurrence' | 'weather_alerts' | 'document_vault' | 'secure_notes'
  | 'maintenance_history_export' | 'seasonal_recommendations'
  | 'pro_service_requests' | 'pro_visit_scheduling' | 'filter_change_service'
  | 'gutter_cleaning_service' | 'extended_pro_visits' | 'pool_service'
  | 'deck_service' | 'lawn_service' | 'pest_control' | 'priority_support'
  | 'ai_task_generation' | 'weather_action_items' | 'custom_tasks'
  | 'pro_service_scheduler' | 'full_property_concierge';

export const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  free: ['basic_calendar'],
  home: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','secure_notes','maintenance_history_export','seasonal_recommendations','ai_task_generation','custom_tasks'],
  pro: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','secure_notes','maintenance_history_export','seasonal_recommendations','ai_task_generation','custom_tasks','pro_service_requests','pro_visit_scheduling','pro_service_scheduler','filter_change_service','gutter_cleaning_service'],
  pro_plus: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','secure_notes','maintenance_history_export','seasonal_recommendations','ai_task_generation','custom_tasks','pro_service_requests','pro_visit_scheduling','pro_service_scheduler','filter_change_service','gutter_cleaning_service','extended_pro_visits','pool_service','deck_service','lawn_service','pest_control','priority_support','full_property_concierge'],
};

export const PLANS = [
  { id: 'free', name: 'Free', price: 0, period: '/month', value: 'free' as SubscriptionTier, features: ['Basic calendar','5 equipment slots','Generic checklists'] },
  { id: 'home', name: 'Home Plan', price: 6.99, period: '/month', value: 'home' as SubscriptionTier, features: ['All 37 AI-powered tasks','Unlimited equipment','Personalized checklists','Weather alerts','Lawn & Pool & Deck care','Secure notes vault'] },
  { id: 'pro', name: 'Home Pro', price: 149, period: '/month', value: 'pro' as SubscriptionTier, features: ['Everything in Home Plan','Monthly pro visit','Filter changes','Gutter cleaning','Pro service scheduler','Pro support'] },
  { id: 'pro_plus', name: 'Home Pro+', price: null as any, period: '', value: 'pro_plus' as SubscriptionTier, inquireForPricing: true, features: ['Full property concierge','Management of all home systems','Pest control included','Extended pro visits','Pool, deck & lawn service','Priority support'] },
];

export function canAccess(tier: SubscriptionTier | undefined | null, feature: Feature): boolean {
  if (!tier) return TIER_FEATURES['free'].includes(feature);
  return TIER_FEATURES[tier].includes(feature);
}

export function getEquipmentLimit(tier: SubscriptionTier | undefined | null): number | null {
  return (!tier || tier === 'free') ? 5 : null;
}

export function getTaskLimit(tier: SubscriptionTier | undefined | null): number | null {
  return (!tier || tier === 'free') ? 3 : null;
}

export function isPremium(tier: SubscriptionTier | undefined | null): boolean {
  return tier === 'home' || tier === 'pro' || tier === 'pro_plus';
}

export function isProOrHigher(tier: SubscriptionTier | undefined | null): boolean {
  return tier === 'pro' || tier === 'pro_plus';
}

// --- Service Area Gating ---
// Pro services are only available in these geographic areas
const PRO_SERVICE_AREAS = {
  states: ['FL', 'OK'],
  zipPrefixes: [
    // Florida: 320-349
    ...Array.from({ length: 30 }, (_, i) => String(320 + i)),
    // Oklahoma: 730-749
    ...Array.from({ length: 20 }, (_, i) => String(730 + i)),
  ],
};

export function isProAvailableInArea(
  _state?: string | null,
  zip?: string | null,
): boolean {
  if (PRO_SERVICE_AREAS.zipPrefixes.length === 0) return true;
  if (!zip) return true;
  const prefix = zip.trim().substring(0, 3);
  return PRO_SERVICE_AREAS.zipPrefixes.includes(prefix);
}

export function getNextTier(tier: SubscriptionTier | undefined | null): SubscriptionTier | null {
  const order: SubscriptionTier[] = ['free', 'home', 'pro', 'pro_plus'];
  const idx = order.indexOf(tier || 'free');
  return idx < order.length - 1 ? order[idx + 1] : null;
}
