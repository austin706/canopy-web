/**
 * Canopy GA4 analytics wrapper — TYPED event taxonomy.
 *
 * See `Product/CANOPY_GA4_EVENTS.md` for the canonical spec.
 * Mobile sibling lives at `Canopy-App/utils/analytics.ts` and MUST stay in sync.
 *
 * Rules (enforced by wrapper, not by call sites):
 * 1. Consent-gated — no event fires until `canopy_cookie_consent === 'accepted'`.
 * 2. Silent no-op if `VITE_GA_MEASUREMENT_ID` is unset.
 * 3. Never throws — network errors are swallowed.
 * 4. Auto-injects `platform: 'web'` on every event.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Shared enum types (kept in sync with mobile) ────────────────────────────
export type Plan = 'free' | 'home' | 'pro' | 'pro_plus';
export type AddonCategory = 'pest' | 'lawn' | 'pool' | 'septic' | 'cleaning';
export type UpgradeSurface =
  | 'landing'
  | 'subscription'
  | 'onboarding'
  | 'dashboard_nudge'
  | 'settings'
  | 'signup_success';
export type DashboardCard =
  | 'equipment'
  | 'setup'
  | 'vault'
  | 'addons'
  | 'recalls'
  | 'members'
  | 'health'
  | 'token';
export type SignupMethod = 'email' | 'google' | 'apple';
export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

// ─── Event schema (types map, MUST match CANOPY_GA4_EVENTS.md) ───────────────
export interface EventParams {
  // Landing
  landing_view: {
    variant?: string;
    utm_source?: string;
    utm_campaign?: string;
    utm_medium?: string;
  };
  landing_hero_cta_click: { cta_label: string; variant?: string };
  landing_hero_variant_assigned: { variant: 'outcome_promise' | 'certainty_loop' };
  landing_hero_view: { variant: 'outcome_promise' | 'certainty_loop' };
  landing_zip_check: { zip: string; result: 'covered' | 'coming_soon' | 'free_only' };
  landing_zip_waitlist_submit: { zip: string; email_provided: boolean };
  landing_addon_card_click: { category: AddonCategory };
  landing_persona_card_click: { persona: 'new_owner' | 'established' | 'selling_soon' | 'investor'; destination: string };
  landing_scroll_depth: { percentage: 25 | 50 | 75 | 100 };
  landing_pricing_plan_click: { plan: Plan };
  landing_faq_expand: { question_id: string };
  cta_click: { location: string; destination: string; page: string };

  // Signup funnel
  signup_view: { referral_code?: string };
  signup_method_selected: { method: SignupMethod };
  sign_up: { method: SignupMethod };
  signup_tos_checked: Record<string, never>;
  signup_error: { error_code: string };
  signup_success_view: Record<string, never>;
  signup_success_upgrade_click: { plan?: Plan };
  signup_success_continue_free: Record<string, never>;
  referral_signup_landed: { code: string };
  referral_signup_completed: { code: string };

  // Onboarding
  onboarding_start: { entry_point: 'signup' | 'add_property' | 'agent_link' };
  onboarding_step_view: { step: OnboardingStep; step_name: string };
  onboarding_step_complete: {
    step: OnboardingStep;
    step_name?: string;
    add_property_mode: boolean;
    time_on_step_ms?: number;
  };
  onboarding_skip_click: { step: number; skip_type: 'fireplace' | 'filter' | 'detail' };
  onboarding_back_click: { step: number };
  onboarding_complete: { total_time_ms: number; plan: Plan };
  onboarding_abandon: { step: number };
  address_lookup_success: Record<string, never>;
  address_lookup_fail: { reason: string };

  // Dashboard
  dashboard_view: { tier: Plan; has_home: boolean };
  dashboard_next_action_view: { action_type: string; priority_score: number };
  dashboard_next_action_click: { action_type: string };
  dashboard_card_expand: { card: DashboardCard };
  dashboard_card_collapse: { card: DashboardCard };
  dashboard_health_click: { score?: number };
  dashboard_token_click: Record<string, never>;
  dashboard_addon_nudge_click: { category: AddonCategory };
  dashboard_addon_nudge_dismiss: { category: AddonCategory; dismiss_count: number };
  dashboard_setup_checklist_open: { progress_pct: number };
  dashboard_setup_checklist_complete: Record<string, never>;
  dashboard_setup_task_click: { task_id: string };
  dashboard_selling_soon_banner_click: Record<string, never>;
  dashboard_selling_soon_banner_dismiss: Record<string, never>;
  dashboard_refresh_plan_click: Record<string, never>;
  dashboard_empty_state_cta_click: { cta: 'scan_equipment' | 'add_task' };

  // Tasks
  task_create_view: Record<string, never>;
  task_create_submit: {
    category: string;
    priority: 'low' | 'medium' | 'high';
    frequency: string;
    has_photos: boolean;
  };
  task_complete: { task_id: string; category: string; overdue_days: number };
  task_reschedule: { task_id: string; delta_days: number };
  task_delete: { task_id: string };
  task_photo_attach: { count: number };
  first_task_complete: { task_id?: string; category?: string; has_photo?: boolean };

  // Equipment
  equipment_scan_start: Record<string, never>;
  equipment_scan_capture: Record<string, never>;
  equipment_scan_success: { detected_type: string; confidence: number };
  equipment_scan_failure: { reason: string };
  equipment_add_manual: { category: string };
  equipment_edit: { equipment_id: string };

  // Commerce
  pricing_view: { surface: UpgradeSurface };
  upgrade_click: { plan: Plan; from_tier: Plan; surface: UpgradeSurface };
  upgrade_checkout_start: { plan: Plan; provider: 'stripe' | 'revenuecat' };
  upgrade_checkout_cancel: { plan: Plan };
  upgrade_complete: {
    plan: Plan;
    source: 'stripe_redirect' | 'revenuecat_callback' | 'gift_redeem';
    surface: UpgradeSurface;
  };
  upgrade_downgrade_click: { from_plan: Plan; to_plan: Plan };
  addon_quote_request: { category: AddonCategory };
  addon_quote_submit: { category: AddonCategory; property_type?: string };
  addon_book_click: { category: AddonCategory };

  // Home token + transfer
  home_token_view: Record<string, never>;
  home_token_copy: Record<string, never>;
  home_qr_downloaded: Record<string, never>;
  home_qr_printed: Record<string, never>;
  home_qr_link_copied: Record<string, never>;
  home_transfer_initiate: Record<string, never>;
  home_transfer_complete: Record<string, never>;
  home_transfer_cancel: Record<string, never>;

  // Health score (DD-3)
  health_score_view: { score: number; tier: Plan };
  health_score_info_open: Record<string, never>;
  health_score_improve_click: { source: 'info_popover' | 'header_link' };
  health_score_action_click: { action_id: string };

  // Vault
  vault_open: Record<string, never>;
  vault_pin_set: Record<string, never>;
  vault_pin_enter_success: Record<string, never>;
  vault_pin_enter_fail: { attempt_count: number };
  vault_doc_upload: { doc_type: string };
  vault_doc_download: { doc_id: string };

  // Referral
  referral_link_copied: Record<string, never>;
  referral_share_click: { method: 'native' | 'sms' | 'email' | 'twitter' };

  // Agent portal
  agent_link_redeem: { code: string };
  agent_client_view: { client_id: string };

  // Sale prep
  sale_prep_preview_view: Record<string, never>;
  sale_prep_view: Record<string, never>;
  sale_prep_action_complete: { action_id: string };

  // Testimonials (DL-7)
  landing_testimonials_view: { card_count: number; has_real: boolean };
  testimonial_submit_view: { source: 'email' | 'direct' | 'profile' };
  testimonial_submit_success: { rating: number; chip_count: number };
  testimonial_submit_error: { reason: string };
  testimonial_admin_approve: { testimonial_id: string; rating: number };
  testimonial_admin_reject: { testimonial_id: string; reason?: string };

  // First-visit orientation card (DD-9)
  dashboard_first_visit_orientation_view: { has_provider: boolean; status: string };
  dashboard_first_visit_sms_toggle: { opt_in: boolean };
  dashboard_first_visit_sms_toggle_error: { error: string };

  // System / meta
  page_view: { page_path: string; page_title: string };
  error_boundary_hit: { component: string; error: string };
}

export type EventName = keyof EventParams;

// ─── User-properties schema ──────────────────────────────────────────────────
export interface UserProperties {
  tier?: Plan;
  has_home?: boolean;
  onboarding_complete?: boolean;
  zip_serviced?: boolean;
  role?: 'consumer' | 'pro' | 'agent' | 'admin';
}

// ─── Implementation ──────────────────────────────────────────────────────────
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let initialized = false;

/** Check if user has consented to cookie analytics. */
export function hasConsentForAnalytics(): boolean {
  const consent = localStorage.getItem('canopy_cookie_consent');
  return consent === 'accepted';
}

/** Load the GA4 gtag.js script and configure the measurement ID. */
export function initGA() {
  if (initialized || !GA_ID) return;
  if (!hasConsentForAnalytics()) return;
  initialized = true;

  const w = window as unknown as Record<string, any>;
  w.dataLayer = w.dataLayer || [];

  function gtag(...args: unknown[]) {
    w.dataLayer.push(args);
  }
  w.gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_ID, { send_page_view: false });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

function sendToGtag(name: string, params?: Record<string, unknown>) {
  if (!hasConsentForAnalytics()) return;
  const w = window as unknown as Record<string, any>;
  if (!GA_ID || typeof w.gtag !== 'function') return;
  const gtagFn = w.gtag as (...args: unknown[]) => void;
  gtagFn('event', name, { ...params, platform: 'web' });
}

// ─── Typed public API ────────────────────────────────────────────────────────

/**
 * Fire a typed analytics event.
 *
 * @example
 *   track('upgrade_click', { plan: 'home', from_tier: 'free', surface: 'landing' });
 */
export function track<K extends EventName>(
  name: K,
  ...args: EventParams[K] extends Record<string, never>
    ? [params?: EventParams[K]]
    : [params: EventParams[K]]
): void {
  const params = (args[0] ?? {}) as Record<string, unknown>;
  sendToGtag(name, params);
}

/**
 * Legacy untyped entry point — kept for non-schema events only.
 * Prefer `track(name, params)` with a typed event name.
 * @deprecated Migrate to `track<K>(name, params)` for type safety.
 */
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  sendToGtag(eventName, params);
}

/** Send a page_view event (call on every route change). */
export function trackPageView(path: string) {
  sendToGtag('page_view', {
    page_path: path,
    page_title: document.title,
  });
}

/** Set GA4 user properties — persisted across events in this session. */
export function setUserProperties(props: UserProperties) {
  if (!hasConsentForAnalytics()) return;
  const w = window as unknown as Record<string, any>;
  if (!GA_ID || typeof w.gtag !== 'function') return;
  const gtagFn = w.gtag as (...args: unknown[]) => void;
  gtagFn('set', 'user_properties', props);
}
