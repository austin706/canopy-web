// ===============================================================
// Subscription Tier Gating (shared logic with mobile)
// ===============================================================
import type { SubscriptionTier } from '@/types';

export type Feature =
  | 'basic_calendar' | 'unlimited_equipment' | 'personalized_scheduling'
  | 'smart_recurrence' | 'weather_alerts' | 'document_vault'
  | 'maintenance_history_export' | 'seasonal_recommendations'
  | 'pro_service_requests' | 'pro_visit_scheduling' | 'filter_change_service'
  | 'gutter_cleaning_service' | 'extended_pro_visits' | 'pool_service'
  | 'deck_service' | 'lawn_service' | 'priority_support'
  | 'ai_task_generation' | 'weather_action_items';

export const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  free: ['basic_calendar'],
  home: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','maintenance_history_export','seasonal_recommendations','ai_task_generation'],
  pro: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','maintenance_history_export','seasonal_recommendations','ai_task_generation','pro_service_requests','pro_visit_scheduling','filter_change_service','gutter_cleaning_service'],
  pro_plus: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','maintenance_history_export','seasonal_recommendations','ai_task_generation','pro_service_requests','pro_visit_scheduling','filter_change_service','gutter_cleaning_service','extended_pro_visits','pool_service','deck_service','lawn_service','priority_support'],
};

export const PLANS = [
  { id: 'free', name: 'Free', price: 0, period: '/month', value: 'free' as SubscriptionTier, features: ['Basic calendar','5 equipment slots','Generic checklists'] },
  { id: 'home', name: 'Home Plan', price: 6.99, period: '/month', value: 'home' as SubscriptionTier, features: ['All 37 AI-powered tasks','Unlimited equipment','Personalized checklists','Weather alerts','Lawn & Pool & Deck care'] },
  { id: 'pro', name: 'Home + Pro', price: 149, period: '/month', value: 'pro' as SubscriptionTier, features: ['Everything in Home Plan','Monthly pro visit','Filter changes','Gutter cleaning','Pro support'] },
  { id: 'pro_plus', name: 'Home + Pro+', price: 179, period: '/month', value: 'pro_plus' as SubscriptionTier, features: ['Everything in Home + Pro','Extended pro visits','Pool service','Deck service','Lawn service','Priority support'] },
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
