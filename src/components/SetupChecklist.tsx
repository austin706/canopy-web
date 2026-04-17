// ═══════════════════════════════════════════════════════════════
// SetupChecklist — onboarding-continuation card for the dashboard
// ═══════════════════════════════════════════════════════════════
//
// Renders the post-onboarding setup items that were intentionally
// deferred out of the initial 4-step wizard (Phase E). Items are
// auto-completed by deriving the state from live home / equipment /
// profile data and persisted to profiles.setup_checklist_state so the
// card stays dismissed once the user clicks "Hide".
//
// Auto-complete rules (mirror across mobile/web):
//   equipment_scanned    ← any Equipment row exists
//   inspection_uploaded  ← any Document of type='inspection' exists
//   roof_year_added      ← home.roof_install_year OR roof_age_years set
//   fireplace_details    ← home.fireplace_details?.length > 0
//   pool_details         ← home.pool_type && pool_type !== 'none' OR detailed
//   filter_sizes         ← home.hvac_filter_returns?.length > 0
//   invited_partner      ← household_members.length > 1 (checked via prop)
//   connected_agent      ← user.agent_id set
//   phone_added          ← user.phone set
//
// A call site passes in the data it already has; this component
// re-derives and persists any newly-completed items via updateProfile.
//
// The card hides itself if:
//   - user.setup_checklist_state.dismissed === true
//   - OR all 9 items are completed (auto-dismissed, dismissed_at set)

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { updateProfile } from '@/services/supabase';
import { DEFAULT_SETUP_CHECKLIST_STATE, type SetupChecklistState, type Home, type Equipment } from '@/types';

interface Props {
  home: Home | null;
  equipment: Equipment[];
  inspectionCount: number;
  householdMemberCount: number; // 1 = owner only
  homeAddOnCount?: number; // active add-on subscriptions — auto-completes explored_add_ons
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
  { key: 'equipment_scanned',   title: 'Scan your equipment',        description: 'Snap a photo of your HVAC, water heater, and other units so Canopy can tailor maintenance.', action: 'Scan now',      route: '/equipment' },
  { key: 'inspection_uploaded', title: 'Upload your inspection',     description: 'We\'ll pull out issues and generate a punch-list of follow-ups.', action: 'Upload',        route: '/home-report' },
  { key: 'roof_year_added',     title: 'Add your roof install year', description: 'Drives replacement reminders and insurance alerts.', action: 'Add year',      route: '/home' },
  { key: 'fireplace_details',   title: 'Fireplace details',          description: 'Type, fuel, and last-swept date for each fireplace.', action: 'Fill in',       route: '/home' },
  { key: 'pool_details',        title: 'Pool details',               description: 'Chlorine, salt, or mineral — we\'ll schedule the right chemistry.', action: 'Fill in',       route: '/home' },
  { key: 'filter_sizes',        title: 'HVAC filter sizes',          description: 'List every return so we know which filters to remind you about.', action: 'Add returns',   route: '/home' },
  { key: 'invited_partner',     title: 'Invite a household member',  description: 'Share tasks and documents with your spouse or co-owner.', action: 'Invite',        route: '/home' },
  { key: 'connected_agent',     title: 'Link your real-estate agent', description: 'Gift codes, referrals, and transfer-ready reports.', action: 'Link agent',    route: '/profile' },
  { key: 'phone_added',         title: 'Add your phone number',      description: 'For SMS reminders and service-appointment coordination.', action: 'Add phone',     route: '/profile' },
  { key: 'explored_add_ons',    title: 'Explore add-on services',    description: 'Pest, lawn, pool, septic, cleaning — managed from your Canopy plan.', action: 'Explore',       route: '/add-ons' },
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

export default function SetupChecklist({ home, equipment, inspectionCount, householdMemberCount, homeAddOnCount = 0 }: Props) {
  const navigate = useNavigate();
  const { user, setUser } = useStore();
  const [persisting, setPersisting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const baseState: SetupChecklistState = user?.setup_checklist_state ?? DEFAULT_SETUP_CHECKLIST_STATE;

  const derived = useMemo(
    () => deriveState(baseState, home, equipment, inspectionCount, householdMemberCount, user?.phone, user?.agent_id, homeAddOnCount),
    [baseState, home, equipment, inspectionCount, householdMemberCount, user?.phone, user?.agent_id, homeAddOnCount],
  );

  const completedCount = ITEMS.filter((i) => derived[i.key]).length;
  const total = ITEMS.length;
  const allDone = completedCount === total;
  const hasIncompleteItems = completedCount < total;

  // Persist newly-derived completions + auto-dismiss when all done
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived.equipment_scanned, derived.inspection_uploaded, derived.roof_year_added, derived.fireplace_details, derived.pool_details, derived.filter_sizes, derived.invited_partner, derived.connected_agent, derived.phone_added, derived.explored_add_ons]);

  const handleMinimize = async () => {
    if (!user) return;
    const next: SetupChecklistState = {
      ...derived,
      dismissed: true,
      dismissed_at: new Date().toISOString(),
    };
    setPersisting(true);
    try {
      await updateProfile(user.id, { setup_checklist_state: next });
      setUser({ ...user, setup_checklist_state: next });
    } finally { setPersisting(false); }
  };

  if (!user) return null;

  // If the user dismissed but still has incomplete items, render a compact pill
  // so they can always re-open the checklist. (Fixes feedback_setup_checklist_ux:
  // previously dismiss was one-way, hiding unfinished setup with no recovery.)
  if (baseState.dismissed) {
    if (allDone) return null;
    return (
      <button
        className="card mb-lg"
        onClick={async () => {
          if (!user) return;
          const next: SetupChecklistState = { ...derived, dismissed: false, dismissed_at: null };
          setPersisting(true);
          try {
            await updateProfile(user.id, { setup_checklist_state: next });
            setUser({ ...user, setup_checklist_state: next });
            setIsExpanded(true);
          } finally {
            setPersisting(false);
          }
        }}
        disabled={persisting}
        aria-label="Re-open setup checklist"
        style={{
          width: '100%',
          background: 'var(--color-cream, #faf7f1)',
          border: '1px dashed var(--color-primary)40',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: 'var(--color-primary)20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-primary)',
          }}
        >
          ✓
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
            Setup: {completedCount}/{total} complete
          </p>
          <p className="text-xs text-gray" style={{ margin: 0 }}>
            Tap to finish setting up your home.
          </p>
        </div>
        <span style={{ fontSize: 16, color: 'var(--color-text-secondary)' }}>▸</span>
      </button>
    );
  }

  return (
    <div className="card mb-lg" style={{ border: '1px solid var(--color-primary)30' }}>
      {/* Collapsed Progress Bar View */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
          }}
          aria-label="Expand setup checklist"
        >
          <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p className="text-sm fw-600" style={{ margin: 0, marginBottom: 6, color: 'var(--color-text-secondary)' }}>Setup Progress</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ height: 6, background: 'var(--light-gray)', borderRadius: 3, overflow: 'hidden', flex: 1 }}>
                  <div style={{ height: '100%', width: `${(completedCount / total) * 100}%`, background: 'var(--color-primary)', transition: 'width .3s' }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: '3ch' }}>{completedCount}/{total}</span>
              </div>
            </div>
            <span style={{ fontSize: 18, color: 'var(--color-text-secondary)' }}>▸</span>
          </div>
        </button>
      ) : (
        <>
          {/* Expanded View */}
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: 12,
            }}
            aria-label="Collapse setup checklist"
          >
            <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>Finish setting up your home</h3>
                <p className="text-xs text-gray" style={{ margin: 0 }}>
                  {completedCount} of {total} complete — these help Canopy give you the right reminders.
                </p>
              </div>
              <span style={{ fontSize: 18, color: 'var(--color-text-secondary)', flexShrink: 0, paddingTop: 2 }}>▾</span>
            </div>
          </button>

          {/* Progress bar */}
          <div style={{ height: 4, background: 'var(--light-gray)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${(completedCount / total) * 100}%`, background: 'var(--color-primary)', transition: 'width .3s' }} />
          </div>

          <div className="flex-col" style={{ gap: 8 }}>
            {ITEMS.map((item) => {
              const done = derived[item.key];
              return (
                <div
                  key={item.key}
                  className="flex"
                  style={{
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: done ? 'var(--light-gray)' : 'transparent',
                    opacity: done ? 0.6 : 1,
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
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(item.route)}
                      style={{ marginLeft: 8, flexShrink: 0 }}
                    >
                      {item.action}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Minimize button */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--light-gray)' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleMinimize}
              disabled={persisting}
              style={{ fontSize: 12 }}
            >
              Hide for now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
