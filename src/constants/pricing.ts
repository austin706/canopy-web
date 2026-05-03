// ═══════════════════════════════════════════════════════════════
// Canopy Pricing Configuration
// ═══════════════════════════════════════════════════════════════
//
// Central source of truth for subscription tier metadata.
// Used by both web and mobile apps.

import type { SubscriptionTier } from '@/types';

export type BillingInterval = 'monthly' | 'yearly';

export interface TierPricing {
  stripe: { monthly: number; yearly: number };
  iap: { monthly: number; yearly: number };
}

export interface PlanInfo {
  id: SubscriptionTier;
  name: string;
  shortName: string;
  features: string[];
  pricing: TierPricing;
  maxHomes: number;
  badge?: string;
  requiresProArea?: boolean;
  inquireForPricing?: boolean;
}

/**
 * Annual discount percentage (applied to Stripe prices).
 * Annual = monthly × 12 × (1 - discount).
 * IAP annual prices are set separately (Apple price tiers).
 */
export const ANNUAL_DISCOUNT_PERCENT = 10;

/**
 * Central pricing configuration.
 * Stripe prices are the "real" prices.
 * IAP prices are marked up to offset platform commissions.
 *
 * Net revenue comparison (Home tier, monthly):
 *   Stripe: $6.99 × 97.1% = $6.79/mo
 *   Apple:  $9.99 × 70%   = $6.99/mo  (after 30% cut)
 *   Google: $9.99 × 90%   = $8.99/mo  (after 10% cut)
 *
 * Annual pricing (10% discount):
 *   Home Stripe: $6.99 × 12 × 0.90 = $75.49/yr (~$6.29/mo)
 *   Home IAP:    $9.99 × 12 × 0.90 = $107.89/yr → Apple tier $109.99/yr
 *   Pro Stripe:  $149 × 12 × 0.90  = $1,609.20/yr
 *   Pro IAP:     $199.99 × 12 × 0.90 = $2,159.89/yr → Apple tier $2,199.99/yr
 */
// Home-only IAP rule (locked 2026-04-22): RC / Apple IAP / Google Play
// Billing only sell the Home tier (single + 2-pack). Pro is Stripe-only.
//
// 2026-04-29: pro_plus tier killed. The "Pro+ services" name is now the
// umbrella brand for the curated add-on bundle, sold per-add-on (not as
// a tier). See add_on_categories — Annual Certified Home Inspection
// ($149/yr base + $0.05/sqft) lives there.
export const PRICING: Record<Exclude<SubscriptionTier, 'free'>, TierPricing> = {
  home: {
    stripe: { monthly: 6.99, yearly: 75.49 },
    iap: { monthly: 9.99, yearly: 109.99 },
  },
  home_2: {
    stripe: { monthly: 11.99, yearly: 129.49 },
    iap: { monthly: 16.99, yearly: 183.49 },
  },
  pro: {
    stripe: { monthly: 149, yearly: 1609 },
    iap: { monthly: 0, yearly: 0 }, // Stripe-only (Home-only IAP rule)
  },
  pro_2: {
    stripe: { monthly: 279, yearly: 3018.60 },
    iap: { monthly: 0, yearly: 0 }, // Stripe-only (Home-only IAP rule)
  },
};

/**
 * Subscription tier metadata — canonical source for all plan info.
 * Each tier includes name, features, pricing, and platform-specific details.
 *
 * NOTE: PlanInfo objects include legacy properties (value, price, period) for
 * backwards compatibility with existing web app code.
 */
export const PLANS: Array<PlanInfo & { value?: SubscriptionTier; price?: number | null; period?: string }> = [
  {
    id: 'free',
    name: 'Free',
    shortName: 'Free',
    maxHomes: 1,
    features: [
      'Basic maintenance calendar',
      '3 equipment slots',
      'Generic checklists',
    ],
    pricing: { stripe: { monthly: 0, yearly: 0 }, iap: { monthly: 0, yearly: 0 } },
    // Legacy properties for web app backwards compatibility
    value: 'free' as SubscriptionTier,
    price: 0,
    period: '/month',
  },
  {
    id: 'home',
    name: 'Home Plan',
    shortName: 'Home',
    maxHomes: 1,
    badge: 'Most Popular',
    features: [
      'All 44 AI-powered tasks',
      'Unlimited equipment',
      'Personalized checklists',
      'Weather alerts & action items',
      'Secure notes vault',
      'Lawn & Pool & Deck care',
    ],
    pricing: PRICING.home,
    // Legacy properties for web app backwards compatibility
    value: 'home' as SubscriptionTier,
    price: 6.99,
    period: '/month',
  },
  {
    id: 'home_2',
    name: 'Home 2-Pack',
    shortName: 'Home 2-Pack',
    maxHomes: 2,
    features: [
      'All 44 AI-powered tasks per home',
      'Unlimited equipment per home',
      'Personalized checklists',
      'Weather alerts & action items',
      'Secure notes vault',
      'Lawn & Pool & Deck care',
      'Manage 2 homes',
    ],
    pricing: PRICING.home_2,
    // Legacy properties for web app backwards compatibility
    value: 'home_2' as SubscriptionTier,
    price: 11.99,
    period: '/month',
  },
  {
    id: 'pro',
    name: 'Home Pro',
    shortName: 'Pro',
    maxHomes: 1,
    requiresProArea: true,
    features: [
      'Everything in Home Plan',
      'Bimonthly 2-hr pro maintenance visit',
      'HVAC filters, water heater flush, gutter cleaning',
      'Safety testing, dryer vent, caulk & weatherseal',
      'Seasonal walkthrough & inspection report',
      'Pro service scheduler',
      'Add-on services available (HVAC, pest, cleaning & more)',
    ],
    pricing: PRICING.pro,
    // Legacy properties for web app backwards compatibility
    value: 'pro' as SubscriptionTier,
    price: 149,
    period: '/month',
  },
  {
    id: 'pro_2',
    name: 'Pro 2-Pack',
    shortName: 'Pro 2-Pack',
    maxHomes: 2,
    requiresProArea: true,
    features: [
      'Everything in Home Pro per home',
      'Bimonthly 2-hr pro maintenance visit per home',
      'HVAC filters, water heater flush, gutter cleaning',
      'Safety testing, dryer vent, caulk & weatherseal',
      'Seasonal walkthrough & inspection report',
      'Pro service scheduler',
      'Add-on services available (HVAC, pest, cleaning & more)',
      'Manage 2 homes',
    ],
    pricing: PRICING.pro_2,
    // Legacy properties for web app backwards compatibility
    value: 'pro_2' as SubscriptionTier,
    price: 279,
    period: '/month',
  },
  // 2026-04-29: Home Pro+ tier removed. Its features (add-on bundle,
  // certified inspection, deep services) are now sold à la carte under
  // the "Pro+ services" umbrella through add_on_categories.
];

/**
 * Format a price for display.
 * Returns "$6.99" or "$149" (drops .00 for round numbers).
 */
export function formatPrice(amount: number): string {
  if (amount === 0) return '$0';
  if (amount % 1 === 0) return `$${amount}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Get the effective monthly price for a billing interval.
 * For yearly, divides the annual price by 12.
 */
export function getEffectiveMonthly(
  tier: Exclude<SubscriptionTier, 'free'>,
  source: 'stripe' | 'iap',
  interval: BillingInterval
): number {
  const p = PRICING[tier][source];
  if (interval === 'yearly') return p.yearly / 12;
  return p.monthly;
}

/**
 * Get the savings percentage when choosing Stripe over IAP.
 */
export function getStripeSavings(
  tier: Exclude<SubscriptionTier, 'free'>,
  interval: BillingInterval = 'monthly'
): number {
  const p = PRICING[tier];
  const stripePrice = interval === 'yearly' ? p.stripe.yearly : p.stripe.monthly;
  const iapPrice = interval === 'yearly' ? p.iap.yearly : p.iap.monthly;
  if (!iapPrice || !stripePrice) return 0;
  return Math.round(((iapPrice - stripePrice) / iapPrice) * 100);
}

/**
 * Compatibility helper: Get plan by tier ID (for web app backwards compatibility).
 * The web app uses PLANS.find(p => p.id === tier) frequently.
 */
export function getPlanById(tierId: SubscriptionTier | string): PlanInfo | undefined {
  return PLANS.find(p => p.id === tierId);
}
