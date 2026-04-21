// ═══════════════════════════════════════════════════════════════
// FirstVisitOrientationCard — DD-9
// ═══════════════════════════════════════════════════════════════
// Dashboard card surfaced to brand-new Pro customers after upgrade,
// until their first `pro_monthly_visits` row has a `completed_at`.
// Three stacked sub-cards:
//   (a) "Who's coming"  — assigned pro's photo + bio (placeholder if
//       no provider assigned yet)
//   (b) "What to expect" — 4-bullet checklist
//   (c) "Day-of SMS"    — toggle writing `profiles.visit_sms_opt_in`
//
// Visibility gates:
//   • user.subscription_tier in ('pro','pro_plus','pro_2pack')
//   • there is a `pro_monthly_visits` row for this homeowner where
//     `is_first_visit = true` AND `completed_at IS NULL`
// Auto-dismisses the moment the first visit is completed.
// ───────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, FontWeight, BorderRadius, Spacing } from '@/constants/theme';
import { track } from '@/utils/analytics';

interface FirstVisit {
  id: string;
  status: string;
  proposed_date: string | null;
  confirmed_date: string | null;
  pro_provider_id: string | null;
  completed_at: string | null;
}

interface ProProviderInfo {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

const PRO_TIERS = new Set(['pro', 'pro_plus', 'pro_2pack']);

const EXPECT_BULLETS: string[] = [
  'Walkthrough of HVAC, plumbing, water heater, and safety sensors (~45 min).',
  'Photos of everything inspected — so your Home Token stays current.',
  'AI-generated summary emailed within 24 hours with priorities ranked.',
  'Recommended tasks auto-added to your Canopy calendar; nothing pressure-sold.',
];

interface Props {
  isMobile?: boolean;
}

/**
 * When `isMobile` is not explicitly passed, the grid auto-wraps via
 * `repeat(auto-fit, minmax(260px, 1fr))` so the layout stays responsive
 * on any screen size without a JS-side width check.
 */
export default function FirstVisitOrientationCard({ isMobile }: Props) {
  const { user } = useStore();
  const [visit, setVisit] = useState<FirstVisit | null>(null);
  const [provider, setProvider] = useState<ProProviderInfo | null>(null);
  const [optIn, setOptIn] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const tier = user?.subscription_tier ?? 'free';
  const isPro = PRO_TIERS.has(tier);

  // Load the current profile flag + first-visit row
  useEffect(() => {
    let cancelled = false;
    if (!user?.id || !isPro) {
      setLoaded(true);
      return;
    }

    (async () => {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('visit_sms_opt_in')
        .eq('id', user.id)
        .maybeSingle();

      const { data: visitRow } = await supabase
        .from('pro_monthly_visits')
        .select('id, status, proposed_date, confirmed_date, pro_provider_id, completed_at')
        .eq('homeowner_id', user.id)
        .eq('is_first_visit', true)
        .is('completed_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      setOptIn(Boolean(profileRow?.visit_sms_opt_in));
      setVisit((visitRow as FirstVisit) ?? null);

      if (visitRow?.pro_provider_id) {
        const { data: pp } = await supabase
          .from('pro_providers')
          .select('id, business_name, contact_name, bio, user_id')
          .eq('id', visitRow.pro_provider_id)
          .maybeSingle();
        if (!cancelled && pp) {
          let avatarUrl: string | null = null;
          if (pp.user_id) {
            const { data: pro } = await supabase
              .from('profiles')
              .select('avatar_url')
              .eq('id', pp.user_id)
              .maybeSingle();
            avatarUrl = pro?.avatar_url ?? null;
          }
          setProvider({
            id: pp.id,
            business_name: pp.business_name,
            contact_name: pp.contact_name,
            bio: pp.bio,
            avatar_url: avatarUrl,
          });
        }
      }
      setLoaded(true);

      if (visitRow) {
        track('dashboard_first_visit_orientation_view', {
          has_provider: Boolean(visitRow.pro_provider_id),
          status: visitRow.status,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isPro]);

  if (!loaded || !isPro || !visit) return null;

  const scheduledDate = visit.confirmed_date ?? visit.proposed_date;
  const scheduledLabel = scheduledDate
    ? new Date(scheduledDate + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : 'Date pending — we\u2019ll propose one soon';

  async function handleToggleSms(next: boolean) {
    if (!user?.id || saving) return;
    setSaving(true);
    const previous = optIn;
    setOptIn(next);
    const { error } = await supabase
      .from('profiles')
      .update({ visit_sms_opt_in: next })
      .eq('id', user.id);
    if (error) {
      setOptIn(previous);
      track('dashboard_first_visit_sms_toggle_error', { error: error.message });
    } else {
      track('dashboard_first_visit_sms_toggle', { opt_in: next });
    }
    setSaving(false);
  }

  const padding = isMobile ? Spacing.md : Spacing.lg;
  const gridColumns = isMobile
    ? '1fr'
    : 'repeat(auto-fit, minmax(260px, 1fr))';

  return (
    <section
      aria-labelledby="first-visit-orientation-heading"
      style={{
        background: Colors.white,
        border: `1px solid ${Colors.lightGray}`,
        borderRadius: BorderRadius.lg,
        padding,
        marginBottom: Spacing.lg,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <header style={{ marginBottom: Spacing.md }}>
        <h2
          id="first-visit-orientation-heading"
          style={{
            margin: 0,
            fontSize: isMobile ? 18 : 20,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
          }}
        >
          Getting ready for your first Canopy visit
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: Colors.medGray }}>
          Scheduled for <strong>{scheduledLabel}</strong>. Here\u2019s what to expect.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          gap: Spacing.md,
        }}
      >
        {/* (a) Who's coming */}
        <article
          style={{
            background: Colors.warmWhite,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: BorderRadius.md,
            padding: Spacing.md,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.sageDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Who\u2019s coming
          </div>
          {provider ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                aria-hidden="true"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: BorderRadius.full,
                  background: provider.avatar_url ? `center/cover url(${provider.avatar_url}) no-repeat` : Colors.sage,
                  color: Colors.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  flexShrink: 0,
                }}
              >
                {!provider.avatar_url && (provider.contact_name ?? provider.business_name ?? 'P').trim().charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>
                  {provider.contact_name ?? provider.business_name ?? 'Your Canopy pro'}
                </div>
                {provider.business_name && provider.contact_name && (
                  <div style={{ fontSize: 12, color: Colors.medGray }}>{provider.business_name}</div>
                )}
                {provider.bio && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: Colors.charcoal, lineHeight: 1.4 }}>
                    {provider.bio}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: Colors.medGray, lineHeight: 1.45 }}>
              We\u2019ll match you with a Canopy-certified pro shortly and introduce them here.
            </p>
          )}
        </article>

        {/* (b) What to expect */}
        <article
          style={{
            background: Colors.warmWhite,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: BorderRadius.md,
            padding: Spacing.md,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.sageDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            What to expect
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: Colors.charcoal }}>
            {EXPECT_BULLETS.map((line) => (
              <li key={line} style={{ fontSize: 13, marginBottom: 6, lineHeight: 1.4 }}>
                {line}
              </li>
            ))}
          </ul>
        </article>

        {/* (c) Day-of SMS */}
        <article
          style={{
            background: Colors.warmWhite,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: BorderRadius.md,
            padding: Spacing.md,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: FontWeight.semibold, color: Colors.sageDark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Day-of text
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: Colors.charcoal, lineHeight: 1.4 }}>
              Want a text the morning of your visit with your pro\u2019s ETA?
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: saving ? 'wait' : 'pointer', fontSize: 13, color: Colors.charcoal }}>
            <input
              type="checkbox"
              checked={optIn}
              disabled={saving}
              onChange={(e) => void handleToggleSms(e.target.checked)}
              aria-label="Enable day-of visit SMS"
              style={{ width: 18, height: 18, accentColor: Colors.sage }}
            />
            <span>{optIn ? 'We\u2019ll text you the morning of.' : 'Enable ETA SMS'}</span>
          </label>
        </article>
      </div>
    </section>
  );
}
