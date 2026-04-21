// ═══════════════════════════════════════════════════════════════
// AdminTestimonials — /admin/testimonials (DL-7)
// ═══════════════════════════════════════════════════════════════
// Moderation queue for DL-7 customer testimonials. Admins can:
//   • See pending, approved, and rejected rows
//   • Approve (publishes on Landing)
//   • Reject (with optional reason)
//   • Un-approve → back to pending
//   • Filter by status
//
// RLS `testimonials_admin_all` allows full read/write for admins.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { Colors, FontWeight, BorderRadius, Spacing } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';
import { showToast } from '@/components/Toast';
import { track } from '@/utils/analytics';

type Status = 'pending' | 'approved' | 'rejected';

interface Testimonial {
  id: string;
  user_id: string | null;
  home_id: string | null;
  first_name: string;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  quote: string;
  rating: number;
  category_chips: string[] | null;
  status: Status;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  source: string;
  submitted_at: string;
}

const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  pending: { bg: '#FFF4E5', text: '#C4844E' },
  approved: { bg: '#EAF2E6', text: '#558B2F' },
  rejected: { bg: '#FDECEA', text: '#C62828' },
};

export default function AdminTestimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Status>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('testimonials')
      .select(
        'id, user_id, home_id, first_name, neighborhood, city, state, quote, rating, category_chips, status, approved_at, approved_by, rejection_reason, source, submitted_at',
      )
      .order('submitted_at', { ascending: false });

    const { data, error } = filter === 'all' ? await query : await query.eq('status', filter);
    if (error) {
      showToast({ message: `Failed to load testimonials: ${error.message}` });
      setItems([]);
    } else {
      setItems((data ?? []) as Testimonial[]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(t: Testimonial) {
    setBusyId(t.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('testimonials')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user?.id ?? null,
          rejection_reason: null,
        })
        .eq('id', t.id);
      if (error) throw error;
      await logAdminAction('approve_testimonial', 'testimonial', t.id, { rating: t.rating });
      track('testimonial_admin_approve', { testimonial_id: t.id, rating: t.rating });
      showToast({ message: 'Testimonial approved — now live on Landing.' });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast({ message: `Approve failed: ${msg}` });
    } finally {
      setBusyId(null);
    }
  }

  async function reject(t: Testimonial) {
    const reason = window.prompt('Rejection reason (optional — shown only in audit log):') ?? '';
    setBusyId(t.id);
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({
          status: 'rejected',
          approved_at: null,
          approved_by: null,
          rejection_reason: reason.trim() || null,
        })
        .eq('id', t.id);
      if (error) throw error;
      await logAdminAction('reject_testimonial', 'testimonial', t.id, { reason });
      track('testimonial_admin_reject', { testimonial_id: t.id, reason: reason || undefined });
      showToast({ message: 'Testimonial rejected.' });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast({ message: `Reject failed: ${msg}` });
    } finally {
      setBusyId(null);
    }
  }

  async function unpublish(t: Testimonial) {
    if (!window.confirm('Un-publish this testimonial? It will return to pending.')) return;
    setBusyId(t.id);
    try {
      const { error } = await supabase
        .from('testimonials')
        .update({ status: 'pending', approved_at: null, approved_by: null })
        .eq('id', t.id);
      if (error) throw error;
      await logAdminAction('unpublish_testimonial', 'testimonial', t.id, {});
      showToast({ message: 'Testimonial returned to pending.' });
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast({ message: `Un-publish failed: ${msg}` });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <PageSkeleton />;

  return (
    <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: 0 }}>
          Testimonials
        </h1>
        <p style={{ fontSize: 14, color: Colors.medGray, margin: '6px 0 0' }}>
          Moderate customer testimonials from <code>/testimonial/submit</code> and the nightly
          solicitation flow. Approved rows publish on Landing automatically.
        </p>
      </header>

      <div style={{ display: 'flex', gap: Spacing.sm, marginBottom: Spacing.lg }} role="tablist" aria-label="Status filter">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? Colors.sage : Colors.white,
              color: filter === f ? Colors.white : Colors.charcoal,
              border: `1px solid ${filter === f ? Colors.sageDark : Colors.lightGray}`,
              padding: '8px 16px',
              borderRadius: BorderRadius.md,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: FontWeight.semibold,
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            background: Colors.warmWhite,
            border: `1px dashed ${Colors.lightGray}`,
            borderRadius: BorderRadius.md,
            padding: 32,
            textAlign: 'center',
            color: Colors.medGray,
          }}
        >
          No testimonials in this view.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: Spacing.md }}>
          {items.map((t) => {
            const statusColors = STATUS_COLORS[t.status];
            return (
              <article
                key={t.id}
                style={{
                  background: Colors.white,
                  border: `1px solid ${Colors.lightGray}`,
                  borderRadius: BorderRadius.md,
                  padding: 18,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: Spacing.md,
                  alignItems: 'start',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: statusColors.bg,
                        color: statusColors.text,
                        padding: '2px 10px',
                        borderRadius: BorderRadius.full,
                        fontSize: 11,
                        fontWeight: FontWeight.semibold,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {t.status}
                    </span>
                    <span style={{ color: Colors.copper, fontSize: 14 }}>
                      {'★'.repeat(Math.min(5, Math.max(0, t.rating)))}
                      <span style={{ color: Colors.lightGray }}>
                        {'★'.repeat(5 - Math.min(5, Math.max(0, t.rating)))}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, color: Colors.medGray }}>
                      {t.source}
                    </span>
                    <span style={{ fontSize: 12, color: Colors.medGray }}>
                      {new Date(t.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                  <blockquote
                    style={{
                      fontSize: 15,
                      color: Colors.charcoal,
                      margin: '0 0 10px 0',
                      lineHeight: 1.55,
                      fontStyle: 'italic',
                    }}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div style={{ fontSize: 13, color: Colors.medGray }}>
                    <strong style={{ color: Colors.charcoal }}>{t.first_name}</strong>
                    {t.neighborhood ? ` · ${t.neighborhood}` : ''}
                    {t.city ? ` · ${t.city}` : ''}
                  </div>
                  {t.category_chips && t.category_chips.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {t.category_chips.map((c) => (
                        <span
                          key={c}
                          style={{
                            fontSize: 11,
                            color: Colors.sageDark,
                            background: Colors.warmWhite,
                            border: `1px solid ${Colors.lightGray}`,
                            borderRadius: BorderRadius.full,
                            padding: '2px 8px',
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {t.rejection_reason && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color: Colors.medGray,
                        fontStyle: 'italic',
                      }}
                    >
                      Rejection reason: {t.rejection_reason}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 130 }}>
                  {t.status !== 'approved' && (
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => approve(t)}
                      style={{
                        background: Colors.sage,
                        color: Colors.white,
                        border: 'none',
                        padding: '8px 14px',
                        borderRadius: BorderRadius.md,
                        fontSize: 13,
                        fontWeight: FontWeight.semibold,
                        cursor: busyId === t.id ? 'wait' : 'pointer',
                      }}
                    >
                      Approve
                    </button>
                  )}
                  {t.status === 'approved' && (
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => unpublish(t)}
                      style={{
                        background: Colors.white,
                        color: Colors.charcoal,
                        border: `1px solid ${Colors.lightGray}`,
                        padding: '8px 14px',
                        borderRadius: BorderRadius.md,
                        fontSize: 13,
                        fontWeight: FontWeight.semibold,
                        cursor: busyId === t.id ? 'wait' : 'pointer',
                      }}
                    >
                      Un-publish
                    </button>
                  )}
                  {t.status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => reject(t)}
                      style={{
                        background: Colors.white,
                        color: Colors.error,
                        border: `1px solid ${Colors.error}`,
                        padding: '8px 14px',
                        borderRadius: BorderRadius.md,
                        fontSize: 13,
                        fontWeight: FontWeight.semibold,
                        cursor: busyId === t.id ? 'wait' : 'pointer',
                      }}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
