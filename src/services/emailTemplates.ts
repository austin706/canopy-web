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
  created_at: string;
  updated_at: string;
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
  updates: Partial<Pick<EmailTemplate, 'enabled' | 'subject'>>
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
