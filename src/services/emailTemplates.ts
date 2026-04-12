import { supabase } from '@/services/supabase';

export interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string;
  subject: string;
  category: 'admin' | 'user_transactional' | 'user_automated';
  enabled: boolean;
  recipient_type: 'admin' | 'user' | 'pro_provider';
  trigger_event: string;
  body_html: string | null;
  body_text: string | null;
  variables: string[];
  created_at: string;
  updated_at: string;
}

// Helper to extract {{variable}} names from a string
function extractVariables(str: string): string[] {
  const matches = str.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}

// Default templates — these define the system's email capabilities
export const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
  // Admin Notification Emails
  {
    template_key: 'admin_new_signup',
    name: 'New User Signup',
    description: 'Notifies admins when a new user creates an account',
    subject: '🏠 New Canopy User: {{user_name}}',
    category: 'admin',
    enabled: true,
    recipient_type: 'admin',
    trigger_event: 'user.signup',
    body_html: null,
    body_text: null,
    variables: ['user_name'],
  },
  {
    template_key: 'admin_new_subscription',
    name: 'New Subscription',
    description: 'Notifies admins when a user upgrades their subscription',
    subject: '💰 New {{tier}} Subscription: {{user_name}}',
    category: 'admin',
    enabled: true,
    recipient_type: 'admin',
    trigger_event: 'subscription.upgraded',
    body_html: null,
    body_text: null,
    variables: ['tier', 'user_name'],
  },
  {
    template_key: 'admin_new_pro_request',
    name: 'New Pro Service Request',
    description: 'Notifies admins when a homeowner requests pro services',
    subject: '🔧 New Pro Request: {{service_type}} from {{user_name}}',
    category: 'admin',
    enabled: true,
    recipient_type: 'admin',
    trigger_event: 'pro_request.created',
    body_html: null,
    body_text: null,
    variables: ['service_type', 'user_name'],
  },
  {
    template_key: 'admin_payment_received',
    name: 'Payment Received',
    description: 'Notifies admins when an invoice payment is completed',
    subject: '✅ Payment Received: ${{amount}} from {{user_name}}',
    category: 'admin',
    enabled: true,
    recipient_type: 'admin',
    trigger_event: 'payment.completed',
    body_html: null,
    body_text: null,
    variables: ['amount', 'user_name'],
  },
  {
    template_key: 'admin_new_quote_request',
    name: 'New Add-On Quote Request',
    description: 'Notifies admins when a homeowner requests an add-on service quote',
    subject: '📋 New Quote Request: {{service_title}} from {{user_name}}',
    category: 'admin',
    enabled: true,
    recipient_type: 'admin',
    trigger_event: 'quote.requested',
    body_html: null,
    body_text: null,
    variables: ['service_title', 'user_name'],
  },
  {
    template_key: 'admin_user_feedback',
    name: 'User Feedback / Rating',
    description: 'Notifies admins when a homeowner submits a visit rating',
    subject: '⭐ Visit Rating: {{rating}}/5 from {{user_name}}',
    category: 'admin',
    enabled: true,
    recipient_type: 'admin',
    trigger_event: 'visit.rated',
    body_html: null,
    body_text: null,
    variables: ['rating', 'user_name'],
  },

  // User Transactional Emails
  {
    template_key: 'user_welcome',
    name: 'Welcome Email',
    description: 'Sent immediately after account creation with onboarding tips',
    subject: 'Welcome to Canopy, {{user_name}}! 🏠',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'user.signup',
    body_html: null,
    body_text: null,
    variables: ['user_name'],
  },
  {
    template_key: 'user_subscription_confirmed',
    name: 'Subscription Confirmed',
    description: 'Confirmation email after upgrading subscription',
    subject: 'Your {{tier}} plan is active — here\'s what you can do',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'subscription.upgraded',
    body_html: null,
    body_text: null,
    variables: ['tier'],
  },
  {
    template_key: 'user_visit_scheduled',
    name: 'Visit Scheduled',
    description: 'Confirmation when a pro visit is confirmed',
    subject: 'Your Pro Visit is confirmed for {{visit_date}}',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'visit.confirmed',
    body_html: null,
    body_text: null,
    variables: ['visit_date'],
  },
  {
    template_key: 'user_visit_completed',
    name: 'Visit Completed',
    description: 'Summary email after a pro visit is completed',
    subject: 'Your Pro Visit summary is ready',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'visit.completed',
    body_html: null,
    body_text: null,
    variables: [],
  },
  {
    template_key: 'user_quote_ready',
    name: 'Quote Ready',
    description: 'Notification when a quote is ready for review',
    subject: 'Your quote for {{service_title}} is ready — ${{amount}}',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'quote.sent',
    body_html: null,
    body_text: null,
    variables: ['service_title', 'amount'],
  },
  {
    template_key: 'user_invoice_sent',
    name: 'Invoice Sent',
    description: 'Notification when an invoice is ready for payment',
    subject: 'Invoice {{invoice_number}}: ${{amount}} due {{due_date}}',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'invoice.sent',
    body_html: null,
    body_text: null,
    variables: ['invoice_number', 'amount', 'due_date'],
  },
  {
    template_key: 'user_payment_confirmed',
    name: 'Payment Confirmed',
    description: 'Receipt after successful payment',
    subject: 'Payment confirmed — ${{amount}} for {{service_title}}',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'payment.completed',
    body_html: null,
    body_text: null,
    variables: ['amount', 'service_title'],
  },

  // User Automated Emails
  {
    template_key: 'user_upcoming_tasks',
    name: 'Upcoming Tasks Reminder',
    description: 'Weekly digest of upcoming maintenance tasks due in the next 7 days',
    subject: 'You have {{task_count}} tasks due this week',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'cron.weekly_tasks',
    body_html: null,
    body_text: null,
    variables: ['task_count'],
  },
  {
    template_key: 'user_overdue_tasks',
    name: 'Overdue Tasks Alert',
    description: 'Alert when tasks are overdue by more than 3 days',
    subject: '⚠️ {{overdue_count}} overdue tasks need your attention',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'cron.overdue_check',
    body_html: null,
    body_text: null,
    variables: ['overdue_count'],
  },
  {
    template_key: 'user_visit_reminder',
    name: 'Upcoming Visit Reminder',
    description: 'Reminder 48 hours before a scheduled pro visit',
    subject: 'Reminder: Pro visit in 2 days — here\'s how to prepare',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'cron.visit_reminder',
    body_html: null,
    body_text: null,
    variables: [],
  },
  {
    template_key: 'user_monthly_summary',
    name: 'Monthly Home Health Summary',
    description: 'Monthly recap of completed tasks, equipment status, and upcoming maintenance',
    subject: '📊 Your {{month}} Home Health Summary',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'cron.monthly_summary',
    body_html: null,
    body_text: null,
    variables: ['month'],
  },
  {
    template_key: 'user_seasonal_prep',
    name: 'Seasonal Prep Reminder',
    description: 'Seasonal checklist reminder at the start of each season',
    subject: '🍂 {{season}} is here — your seasonal maintenance checklist',
    category: 'user_automated',
    enabled: false,
    recipient_type: 'user',
    trigger_event: 'cron.seasonal',
    body_html: null,
    body_text: null,
    variables: ['season'],
  },

  // Drip Email Series (Welcome)
  {
    template_key: 'drip_welcome',
    name: 'Drip: Day 0 — Welcome',
    description: 'Immediate welcome email with quick-start guide after signup',
    subject: 'Welcome to Canopy, {{user_name}}! Here\'s your quick-start guide 🏠',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'drip.day_0',
    body_html: null,
    body_text: null,
    variables: ['user_name'],
  },
  {
    template_key: 'drip_feature_discovery',
    name: 'Drip: Day 3 — Feature Discovery',
    description: 'Introduces equipment scanning and AI assistant features',
    subject: 'Did you know Canopy can scan your equipment? 📸',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'drip.day_3',
    body_html: null,
    body_text: null,
    variables: [],
  },
  {
    template_key: 'drip_value_reveal',
    name: 'Drip: Day 7 — Value Reveal',
    description: 'Shows what Home plan unlocks with feature comparison',
    subject: 'You\'ve been using Canopy for a week — here\'s what you\'re missing',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'drip.day_7',
    body_html: null,
    body_text: null,
    variables: [],
  },
  {
    template_key: 'drip_social_proof',
    name: 'Drip: Day 14 — Social Proof',
    description: 'Testimonial + upgrade CTA after 2 weeks of use',
    subject: 'Homeowners like you are upgrading — here\'s why',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'drip.day_14',
    body_html: null,
    body_text: null,
    variables: [],
  },

  // Monthly Summary (upgrade-focused for free users)
  {
    template_key: 'user_monthly_upgrade_summary',
    name: 'Monthly Summary (Free Users)',
    description: 'Personalized monthly stats with upgrade nudge for free-tier users',
    subject: '📊 Your {{month}} Canopy recap — see what you could unlock',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'cron.monthly_free_summary',
    body_html: null,
    body_text: null,
    variables: ['month'],
  },

  // Upgrade Success
  {
    template_key: 'user_upgrade_success',
    name: 'Upgrade Success',
    description: 'Congratulations email highlighting newly unlocked features after upgrading',
    subject: '🎉 Welcome to {{tier}} — here\'s everything you just unlocked',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'subscription.upgraded',
    body_html: null,
    body_text: null,
    variables: ['tier'],
  },

  // Pro Provider Emails
  {
    template_key: 'pro_new_service_request',
    name: 'New Service Request from Homeowner',
    description: 'Sent to provider when matched with a homeowner service request',
    subject: 'New Service Request from {{homeowner_name}}',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'pro_provider',
    trigger_event: 'service_request.matched',
    body_html: null,
    body_text: null,
    variables: ['homeowner_name', 'service_type', 'address'],
  },
  {
    template_key: 'user_provider_matched',
    name: 'We Found a Provider for You!',
    description: 'Sent to homeowner when matched with a pro provider',
    subject: 'We Found a Provider for You!',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'service_request.matched',
    body_html: null,
    body_text: null,
    variables: ['provider_name', 'service_type'],
  },
  {
    template_key: 'admin_unmatchable_request',
    name: 'Unmatchable Service Request',
    description: 'Notifies admins when no provider found for a service request',
    subject: 'Unmatchable Service Request',
    category: 'admin',
    enabled: true,
    recipient_type: 'admin',
    trigger_event: 'service_request.unmatched',
    body_html: null,
    body_text: null,
    variables: ['service_type', 'address'],
  },

  // Support Emails
  {
    template_key: 'user_support_received',
    name: 'Support Request Received',
    description: 'Confirmation when a user submits a support request',
    subject: 'We Received Your Support Request',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'support.received',
    body_html: null,
    body_text: null,
    variables: ['user_name'],
  },
  {
    template_key: 'user_pro_application_received',
    name: 'Pro Application Received',
    description: 'Confirmation email sent to a pro applicant after submitting application',
    subject: 'Thank You for Applying to Canopy Home',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'pro_provider',
    trigger_event: 'application.submitted',
    body_html: null,
    body_text: null,
    variables: ['applicant_name'],
  },
  {
    template_key: 'pro_application_approved',
    name: 'Pro Application Approved',
    description: 'Sent to pro when application is approved',
    subject: 'Welcome to Canopy Home Provider Network',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'pro_provider',
    trigger_event: 'application.approved',
    body_html: null,
    body_text: null,
    variables: ['provider_name'],
  },

  // Visit Lifecycle Emails
  {
    template_key: 'user_visit_48hr_reminder',
    name: 'Visit 48-Hour Reminder',
    description: 'Reminder email 48 hours before a scheduled home visit',
    subject: 'Your Home Inspection is in 48 Hours',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'cron.visit_48hr',
    body_html: null,
    body_text: null,
    variables: ['provider_name', 'visit_date'],
  },
  {
    template_key: 'user_visit_followup',
    name: 'Visit Followup',
    description: 'Followup email sent after a home visit is completed',
    subject: 'Thank You for Your Home Inspection',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'visit.completed',
    body_html: null,
    body_text: null,
    variables: ['provider_name'],
  },
  {
    template_key: 'admin_daily_visit_summary',
    name: 'Daily Visit Summary',
    description: 'Daily digest of visit activity sent to admin',
    subject: 'Daily Visit Summary',
    category: 'admin',
    enabled: true,
    recipient_type: 'admin',
    trigger_event: 'cron.daily_visits',
    body_html: null,
    body_text: null,
    variables: ['date', 'total_visits', 'completed', 'forfeited'],
  },
  {
    template_key: 'user_subscription_expiring',
    name: 'Subscription Expiring Soon',
    description: 'Renewal reminder sent when subscription expires in 3 days',
    subject: 'Your Subscription Expires in 3 Days',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'cron.subscription_expiry',
    body_html: null,
    body_text: null,
    variables: ['user_name', 'tier', 'expiry_date'],
  },
  {
    template_key: 'user_warranty_expiring',
    name: 'Warranty Expiring Soon',
    description: 'Alert sent 30 days before equipment warranty expires',
    subject: 'Warranty Expiring Soon',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'cron.warranty_expiry',
    body_html: null,
    body_text: null,
    variables: ['equipment_name', 'expiry_date'],
  },
  {
    template_key: 'user_visit_summary_ready',
    name: 'Visit Summary Ready',
    description: 'Notification sent when a visit summary report has been generated',
    subject: 'Your Home Visit Summary is Ready',
    category: 'user_transactional',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'visit.summary_generated',
    body_html: null,
    body_text: null,
    variables: ['user_name', 'visit_date'],
  },

  // Agent Drip Campaign
  {
    template_key: 'agent_drip_welcome',
    name: 'Agent Drip: Day 0 — Welcome',
    description: 'Welcome email for new agents with gift code purchasing guide',
    subject: 'Welcome to Canopy, {{agent_name}}! Here\'s how to get started',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'agent_drip.day_0',
    body_html: null,
    body_text: null,
    variables: ['agent_name', 'brokerage'],
  },
  {
    template_key: 'agent_drip_qr',
    name: 'Agent Drip: Day 3 — QR Codes',
    description: 'How to use your permanent QR code to hand off gift codes to clients',
    subject: 'Your Personal QR Code is Ready — Share Canopy in Seconds',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'agent_drip.day_3',
    body_html: null,
    body_text: null,
    variables: ['agent_name', 'slug'],
  },
  {
    template_key: 'agent_drip_portal',
    name: 'Agent Drip: Day 7 — Portal Features',
    description: 'Full walkthrough of agent portal features: clients, analytics, notifications',
    subject: 'Your Agent Portal Has More Than You Think',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'agent_drip.day_7',
    body_html: null,
    body_text: null,
    variables: ['agent_name'],
  },
  {
    template_key: 'agent_drip_token',
    name: 'Agent Drip: Day 14 — Home Token',
    description: 'How to attest a Home Token at listing to boost client resale value',
    subject: 'Help Your Clients\' Homes Sell for More — Home Token',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'agent_drip.day_14',
    body_html: null,
    body_text: null,
    variables: ['agent_name'],
  },
  {
    template_key: 'agent_drip_pros',
    name: 'Agent Drip: Day 21 — Certified Pros',
    description: 'How Certified Pros benefit your clients with bimonthly visits',
    subject: 'Your Clients Deserve Certified Home Maintenance',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'agent_drip.day_21',
    body_html: null,
    body_text: null,
    variables: ['agent_name'],
  },
  {
    template_key: 'agent_drip_social_proof',
    name: 'Agent Drip: Day 30 — Social Proof',
    description: 'Case study and social proof showing agent engagement results',
    subject: 'Agents Using Canopy See More Repeat Business',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'agent_drip.day_30',
    body_html: null,
    body_text: null,
    variables: ['agent_name'],
  },
  {
    template_key: 'agent_reengagement',
    name: 'Agent Re-engagement',
    description: 'Nudge email for agents inactive 30+ days with their stats',
    subject: 'We Miss You, {{agent_name}} — Here\'s What You\'ve Built So Far',
    category: 'user_automated',
    enabled: true,
    recipient_type: 'user',
    trigger_event: 'agent.inactive_30d',
    body_html: null,
    body_text: null,
    variables: ['agent_name', 'codes_created', 'codes_redeemed', 'homes_managed'],
  },
];

// Fetch all email templates from DB
export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('category', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Update a template's settings
export async function updateEmailTemplate(
  templateId: string,
  updates: Partial<Pick<EmailTemplate, 'enabled' | 'subject' | 'body_html' | 'body_text'>>
): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', templateId);
  if (error) throw error;
}

// Seed default templates (if table is empty)
export async function seedEmailTemplates(): Promise<void> {
  const existing = await getEmailTemplates();
  if (existing.length > 0) return; // Already seeded

  const toInsert = DEFAULT_TEMPLATES.map(t => ({
    ...t,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('email_templates')
    .insert(toInsert);
  if (error) throw error;
}

/**
 * Helper: call send-notifications edge function via raw fetch.
 * supabase.functions.invoke() has a CORS issue where the POST never reaches the
 * edge function after the OPTIONS preflight. Raw fetch with explicit headers works.
 */
async function invokeNotificationsFn(payload: Record<string, any>): Promise<void> {
  const session = (await supabase.auth.getSession()).data.session;
  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notifications`;
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Edge function returned ${res.status}`);
  }
}

// Send a test email for a template
export async function sendTestEmail(templateKey: string, recipientEmail: string): Promise<void> {
  await invokeNotificationsFn({
    type: 'test_email',
    template_key: templateKey,
    recipient_email: recipientEmail,
  });
}

// Trigger an admin notification
export async function sendAdminNotification(
  templateKey: string,
  variables: Record<string, string>
): Promise<void> {
  await invokeNotificationsFn({
    type: 'admin_email',
    template_key: templateKey,
    variables,
  });
}
