// ═══════════════════════════════════════════════════════════════
// SetupChecklist — persistent footer pill + expand modal (DD-4)
// ═══════════════════════════════════════════════════════════════
//
// Renders the post-onboarding setup items that were intentionally
// deferred out of the initial 4-step wizard (Phase E). Items are
// auto-completed by deriving the state from live home / equipment /
// profile data and persisted to profiles.setup_checklist_state.
//
// DD-4 changes (vs. the old inline-card version):
//   • Collapsed view is a compact ≤40px pill at the bottom of the
//     Dashboard (mounted last), not a full card at the top.
//   • Expanded view is a centered modal overlay (full task list).
//   • Once all items complete, fires a one-time success toast and
//     auto-dismisses. The `canopy.setupChecklist.toastShown.<userId>`
//     localStorage key guards against re-firing across reloads.
//   • Re-access after dismiss: Profile → Account → "Re-open setup
//     checklist" resets `dismissed=false`, which brings the pill back.
//
// Auto-complete rules (mirror across mobile/web):
//   equipment_scanned    ← any Equipment row exists
//   inspection_uploaded  ← any Document of type='inspection' exists
//   roof_year_added      ← home.roof_install_year OR roof_age_years set
//   fireplace_details    ← home.fireplace_details?.length > 0
//   pool_details         ← home.pool_type && pool_type !== 'none'
//   filter_sizes         ← home.hvac_filter_returns?.length > 0
//   invited_partner      ← household_members.length > 1
//   connected_agent      ← user.agent_id set
//   phone_added          ← user.phone set
//   explored_add_ons     ← active add-on subscription count > 0

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { updateProfile } from '@/services/supabase';
import { showToast } from '@/components/Toast';
import {
  DEFAULT_SETUP_CHECKLIST_STATE,
  type SetupChecklistState,
  type Home,
  type Equipment,
} from '@/types';

interface Props {
  home: Home | null;
  equipment: Equipment[];
  inspectionCount: number;
  householdMemberCount: number; // 1 = owner only
  homeAddOnCount?: number;
}

type ItemKey = Exclude<keyof SetupChecklistState, 'dismissed' | 'dismissed_at'>;

interface Item {
  key: ItemKey;
  title: string;
  description: string;
  action: string;
  route: string;
}

const ITEMS: Item[] = [
  { key: 'equipment_scanned',   title: 'Scan your equipment',         description: "Snap a photo of your HVAC, water heater, and other units so Canopy can tailor maintenance.", action: 'Scan now',    route: '/equipment' },
  { key: 'inspection_uploaded', title: 'Upload your inspection',      description: "We'll pull out issues and generate a punch-list of follow-ups.",                         action: 'Upload',      route: '/home-report' },
  { key: 'roof_year_added',     title: 'Add your roof install year',  description: 'Drives replacement reminders and insurance alerts.',                                     action: 'Add year',    route: '/home' },
  { key: 'fireplace_details',   title: 'Fireplace details',           description: 'Type, fuel, and last-swept date for each fireplace.',                                    action: 'Fill in',     route: '/home' },
  { key: 'pool_details',        title: 'Pool details',                description: "Chlorine, salt, or mineral — we'll schedule the right chemistry.",                       action: 'Fill in',     route: '/home' },
  { key: 'filter_sizes',        title: 'HVAC filter sizes',           description: 'List every return so we know which filters to remind you about.',                        action: 'Add returns', route: '/home' },
  { key: 'invited_partner',     title: 'Invite a household member',   description: 'Share tasks and documents with your spouse or co-owner.',                                 action: 'Invite',      route: '/home' },
  { key: 'connected_agent',     title: 'Link your real-estate agent', description: 'Gift codes, referrals, and transfer-ready reports.',                                     action: 'Link agent',  route: '/profile' },
  { key: 'phone_added',         title: 'Add your phone number',       description: 'For SMS reminders and service-appointment coordination.',                                action: 'Add phone',   route: '/profile' },
  { key: 'explored_add_ons',    title: 'Explore add-on services',     description: 'Pest, lawn, pool, septic, cleaning — managed from your Canopy plan.',                     action: 'Explore',     route: '/add-ons' },
];

function deriveState(
  base: SetupChecklistState,
  home: Home | null,
  equipment: Equipment[],
  inspectionCount: number,
  householdMemberCount: number,
  phone: string | null | undefined,
  agentId: string | null | undefined,
  homeAddOnCount: number,
): SetupChecklistState {
  return {
    ...base,
    equipment_scanned:   base.equipment_scanned   || equipment.length > 0,
    inspection_uploaded: base.inspection_uploaded || inspectionCount > 0,
    roof_year_added:     base.roof_year_added     || !!(home?.roof_install_year || home?.roof_age_years),
    fireplace_details:   base.fireplace_details   || (Array.isArray(home?.fireplace_details) && home!.fireplace_details!.length > 0),
    pool_details:        base.pool_details        || (!!home?.pool_type && home.pool_type !== 'none'),
    filter_sizes:        base.filter_sizes        || (Array.isArray(home?.hvac_filter_returns) && home!.hvac_filter_returns!.length > 0),
    invited_partner:     base.invited_partner     || householdMemberCount > 1,
    connected_agent:     base.connected_agent     || !!agentId,
    phone_added:         base.phone_added         || !!phone,
    explored_add_ons:    base.explored_add_ons    || homeAddOnCount > 0,
  };
}

const toastKey = (userId: string) => `canopy.setupChecklist.toastShown.${userId}`;

export default function SetupChecklist({ home, equipment, inspectionCount, householdMemberCount, homeAddOnCount = 0 }: Props) {
  const navigate = useNavigate();
  const { user, setUser } = useStore();
  const [persisting, setPersisting] = useState(false);
  const [open, setOpen] = useState(false);

  const baseState: SetupChecklistState = user?.setup_checklist_state ?? DEFAULT_SETUP_CHECKLIST_STATE;

  const derived = useMemo(
    () => deriveState(
      baseState,
      home,
      equipment,
      inspectionCount,
      householdMemberCount,
      user?.phone,
      user?.agent_id,
      homeAddOnCount,
    ),
    [baseState, home, equipment, inspectionCount, householdMemberCount, user?.phone, user?.agent_id, homeAddOnCount],
  );

  const completedCount = ITEMS.filter((i) => derived[i.key]).length;
  const total = ITEMS.length;
  const allDone = completedCount === total;
  const pct = Math.round((completedCount / total) * 100);

  // Persist any newly-derived completions + auto-dismiss when all done,
  // plus fire the one-time completion toast (localStorage-gated).
  useEffect(() => {
    if (!user) return;
    const needsPersist = ITEMS.some((i) => derived[i.key] !== baseState[i.key]);
    const needsAutoDismiss = allDone && !baseState.dismissed;
    if (!needsPersist && !needsAutoDismiss) return;

    const next: SetupChecklistState = {
      ...derived,
      dismissed: needsAutoDismiss || baseState.dismissed,
      dismissed_at: needsAutoDismiss ? new Date().toISOString() : baseState.dismissed_at,
    };
    setPersisting(true);
    updateProfile(user.id, { setup_checklist_state: next })
      .then(() => setUser({ ...user, setup_checklist_state: next }))
      .catch(() => { /* non-fatal — derived state still shown */ })
      .finally(() => setPersisting(false));

    if (allDone) {
      try {
        const key = toastKey(user.id);
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, new Date().toISOString());
          showToast({ message: '🎉 Home setup complete — every task, doc, and reminder is dialed in.' });
          setOpen(false);
        }
      } catch { /* storage disabled — skip toast guard */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    derived.equipment_scanned,
    derived.inspection_uploaded,
    derived.roof_year_added,
    derived.fireplace_details,
    derived.pool_details,
    derived.filter_sizes,
    derived.invited_partner,
    derived.connected_agent,
    derived.phone_added,
    derived.explored_add_ons,
  ]);

  // Close modal on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!user) return null;
  // Fully complete + dismissed → hide forever (until Profile re-opens it).
  if (allDone && baseState.dismissed) return null;
  // Dismissed but incomplete happens after Profile re-open clears it;
  // baseState.dismissed would be false in that path, so this guard only
  // covers the old "Hide for now" path, which we've removed. No-op.
  if (baseState.dismissed) return null;

  return (
    <>
      {/* ── Compact footer pill (always ≤ 40px tall) ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Setup checklist: ${completedCount} of ${total} complete. Click to view remaining items.`}
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          minHeight: 40,
          padding: '6px 14px',
          marginTop: 16,
          marginBottom: 16,
          background: 'var(--color-cream, #faf7f1)',
          border: '1px solid var(--color-primary)30',
          borderRadius: 999,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: 'var(--color-primary)20',
            color: 'var(--color-primary)',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {pct}%
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>
          Finish setting up your home
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500, marginLeft: 6 }}>
            · {completedCount}/{total}
          </span>
        </span>
        {/* Inline progress bar (micro-viz) */}
        <span
          aria-hidden
          style={{
            width: 80,
            height: 4,
            background: 'var(--light-gray)',
            borderRadius: 2,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              height: '100%',
              width: `${pct}%`,
              background: 'var(--color-primary)',
              transition: 'width .3s',
            }}
          />
        </span>
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 14, flexShrink: 0 }}>▸</span>
      </button>

      {/* ── Expanded modal ── */}
      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12,13,16,0.5)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Home setup checklist"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--color-card-background)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 20px 40px rgba(12,13,16,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <div>
                <h3 style={{ fontSize: 18, margin: 0 }}>Finish setting up your home</h3>
                <p className="text-xs text-gray" style={{ margin: '4px 0 0' }}>
                  {completedCount} of {total} complete — these help Canopy send the right reminders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close setup checklist"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, background: 'var(--light-gray)', borderRadius: 2, overflow: 'hidden', margin: '12px 0 16px' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', transition: 'width .3s' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ITEMS.map((item) => {
                const done = derived[item.key];
                return (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: done ? 'var(--light-gray)' : 'transparent',
                      opacity: done ? 0.65 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        border: done ? 'none' : '2px solid var(--color-primary)',
                        background: done ? 'var(--color-primary)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginRight: 12,
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                      aria-hidden
                    >
                      {done ? '✓' : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, textDecoration: done ? 'line-through' : 'none' }}>
                        {item.title}
                      </div>
                      {!done && (
                        <div className="text-xs text-gray" style={{ marginTop: 2 }}>{item.description}</div>
                      )}
                    </div>
                    {!done && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setOpen(false);
                          navigate(item.route);
                        }}
                        style={{ marginLeft: 8, flexShrink: 0 }}
                      >
                        {item.action}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-gray" style={{ margin: '16px 0 0' }}>
              Tip: you can always re-open this from Profile → Account.
            </p>

            {persisting && (
              <p className="text-xs text-gray" style={{ margin: '8px 0 0' }} aria-live="polite">Saving…</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
