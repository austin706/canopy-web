// ===============================================================
// Subscription Tier Gating (shared logic with mobile)
// ===============================================================
import type { SubscriptionTier } from '@/types';
import type { PlanInfo } from '@/constants/pricing';
export { PLANS, PRICING, formatPrice, getEffectiveMonthly, getStripeSavings, ANNUAL_DISCOUNT_PERCENT } from '@/constants/pricing';

export type Feature =
  | 'basic_calendar' | 'unlimited_equipment' | 'personalized_scheduling'
  | 'smart_recurrence' | 'weather_alerts' | 'document_vault' | 'secure_notes'
  | 'maintenance_history_export' | 'seasonal_recommendations'
  | 'pro_service_requests' | 'pro_visit_scheduling' | 'filter_change_service'
  | 'gutter_cleaning_service' | 'extended_pro_visits' | 'pool_service'
  | 'deck_service' | 'lawn_service' | 'pest_control' | 'priority_support'
  | 'ai_task_generation' | 'weather_action_items' | 'custom_tasks'
  | 'pro_service_scheduler' | 'full_property_concierge'
  | 'ai_photo_scan' | 'ai_chat' | 'ai_text_lookup';

export type AiFeature = 'ai_photo_scan' | 'ai_chat' | 'ai_text_lookup';

export const TIER_FEATURES: Record<SubscriptionTier, Feature[]> = {
  free: ['basic_calendar','ai_photo_scan','ai_chat','ai_text_lookup'],
  home: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','secure_notes','maintenance_history_export','seasonal_recommendations','ai_task_generation','custom_tasks','ai_photo_scan','ai_chat','ai_text_lookup'],
  pro: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','secure_notes','maintenance_history_export','seasonal_recommendations','ai_task_generation','custom_tasks','pro_service_requests','pro_visit_scheduling','pro_service_scheduler','filter_change_service','gutter_cleaning_service','ai_photo_scan','ai_chat','ai_text_lookup'],
  pro_plus: ['basic_calendar','unlimited_equipment','personalized_scheduling','smart_recurrence','weather_alerts','weather_action_items','document_vault','secure_notes','maintenance_history_export','seasonal_recommendations','ai_task_generation','custom_tasks','pro_service_requests','pro_visit_scheduling','pro_service_scheduler','filter_change_service','gutter_cleaning_service','extended_pro_visits','pool_service','deck_service','lawn_service','pest_control','priority_support','full_property_concierge','ai_photo_scan','ai_chat','ai_text_lookup'],
};

// AI feature monthly usage limits per tier (null = unlimited)
// photo_scan for free tier uses lifetime limit, not monthly
export const AI_LIMITS: Record<SubscriptionTier, Record<AiFeature, number | null>> = {
  free: {
    ai_photo_scan: 1,    // 1 lifetime (enforced separately)
    ai_chat: 15,          // 15 messages/month
    ai_text_lookup: 5,    // 5 lookups/month
  },
  home: {
    ai_photo_scan: null,  // unlimited
    ai_chat: null,
    ai_text_lookup: null,
  },
  pro: {
    ai_photo_scan: null,
    ai_chat: null,
    ai_text_lookup: null,
  },
  pro_plus: {
    ai_photo_scan: null,
    ai_chat: null,
    ai_text_lookup: null,
  },
};

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

/**
 * Get the monthly usage limit for an AI feature on a given tier.
 * Returns null for unlimited. For free-tier photo scans, 1 = lifetime limit.
 */
export function getAiLimit(
  tier: SubscriptionTier | undefined | null,
  feature: AiFeature,
): number | null {
  const t = tier || 'free';
  return AI_LIMITS[t][feature];
}

/**
 * Map AI feature names to their corresponding column in user_ai_usage table.
 */
export const AI_USAGE_COLUMN: Record<AiFeature, string> = {
  ai_photo_scan: 'photo_scan_count',
  ai_chat: 'chat_count',
  ai_text_lookup: 'text_lookup_count',
};

// --- Service Area Gating (database-driven, 5-digit ZIP codes) ---
import { supabase } from '@/services/supabase';

// Cache of active service area ZIP codes — loaded once, refreshed on demand
let _serviceAreaCache: Set<string> | null = null;
let _serviceAreaCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function loadServiceAreas(): Promise<Set<string>> {
  const now = Date.now();
  if (_serviceAreaCache && now - _serviceAreaCacheTime < CACHE_TTL_MS) {
    return _serviceAreaCache;
  }

  try {
    const { data, error } = await supabase
      .from('service_areas')
      .select('zip_code')
      .eq('is_active', true);

    if (error) throw error;

    _serviceAreaCache = new Set((data || []).map(row => row.zip_code));
    _serviceAreaCacheTime = now;
  } catch (err) {
    console.error('Failed to load service areas:', err);
    // If cache exists but is stale, keep using it rather than failing
    if (_serviceAreaCache) return _serviceAreaCache;
    _serviceAreaCache = new Set();
    _serviceAreaCacheTime = now;
  }

  return _serviceAreaCache;
}

export function invalidateServiceAreaCache(): void {
  _serviceAreaCache = null;
  _serviceAreaCacheTime = 0;
}

// Synchronous check using cached data — returns false if cache not loaded yet
export function isProAvailableInArea(
  _state?: string | null,
  zip?: string | null,
): boolean {
  if (!zip) return true; // No ZIP provided, don't block
  const trimmed = zip.trim().substring(0, 5);
  if (trimmed.length < 5) return true; // Incomplete ZIP, don't block
  if (!_serviceAreaCache || _serviceAreaCache.size === 0) return false; // Cache not loaded yet — don't show Pro as available
  return _serviceAreaCache.has(trimmed);
}

// Async check that ensures cache is loaded first
export async function checkProAvailability(
  _state?: string | null,
  zip?: string | null,
): Promise<boolean> {
  if (!zip) return true;
  const trimmed = zip.trim().substring(0, 5);
  if (trimmed.length < 5) return true;
  const areas = await loadServiceAreas();
  if (areas.size === 0) return true; // No areas configured = available everywhere
  return areas.has(trimmed);
}

export function getNextTier(tier: SubscriptionTier | undefined | null): SubscriptionTier | null {
  const order: SubscriptionTier[] = ['free', 'home', 'pro', 'pro_plus'];
  const idx = order.indexOf(tier || 'free');
  return idx < order.length - 1 ? order[idx + 1] : null;
}
