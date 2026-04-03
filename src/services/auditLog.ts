import { supabase } from './supabase';

export async function logAdminAction(
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, any> = {},
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}
