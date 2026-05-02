import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import logger from '@/utils/logger';
import { canAccess, getTaskLimit, getHistoryDaysLimit, PLANS } from '@/services/subscriptionGate';
import { Colors, PriorityColors, StatusColors } from '@/constants/theme';
import DashboardChat from '@/components/DashboardChat';
import { quickCompleteTask, calculateHealthScore } from '@/services/utils';
import { sortTasksByHealthUrgency } from '@/services/taskOrdering';
import { ImageViewer } from '@/components/ImageViewer';
import { showToast } from '@/components/Toast';
import { getTasks, createTasks, getHomeJoinRequests, approveHomeJoinRequest, denyHomeJoinRequest, getNotifications, markNotificationRead, getExpiringWarranties } from '@/services/supabase';
import type { Warranty } from '@/types';
import { listStaleTemplateTasks, clearStaleTemplateTasks, type StaleTemplateTask } from '@/services/tasks';
import { fetchWeather } from '@/services/weather';
import { Skeleton } from '@/components/Skeleton';
import { generateTasksForHome, getDisplayStatus } from '@/services/taskEngine';
import { generateWeatherInsights } from '@/services/weatherInsights';
import { WeatherInsightCards } from '@/components/WeatherInsightCards';
import { geocodeAddress } from '@/services/geocoding';
import { upsertHome } from '@/services/supabase';
import { CanopyLogo, NavWeather, NavHome } from '@/components/icons/CanopyLogo';
import { generateCostForecast, FORECAST_DISCLAIMER } from '@/services/costForecast';
import PendingInvites from '@/components/PendingInvites';
import SetupChecklist from '@/components/SetupChecklist';
import FirstVisitOrientationCard from '@/components/FirstVisitOrientationCard';
import AddOnNudge, { nudgeAddOnFromTaskCategory } from '@/components/AddOnNudge';
import RecallAlertBanner from '@/components/RecallAlertBanner';
import ImproveRecommendationsBanner from '@/components/ImproveRecommendationsBanner';
import { getDocuments, getHomeMembers, supabase } from '@/services/supabase';
import type { MaintenanceTask, HomeJoinRequest } from '@/types';
import { trackEvent } from '@/utils/analytics';
import { TASK_TEMPLATES } from '@/constants/maintenance';
import { EmptyState } from '@/components/ui';
import { NextActionHero } from '@/components/NextActionHero';
import { DashboardHeroStrip } from '@/components/DashboardHeroStrip';

// DD-6 (Wave B): DEMO_TASKS were removed in favor of a proper EmptyState. If
// onboarding is incomplete the UI now surfaces a clear "finish setup" call to
// action instead of pretending to have data — which used to mislead users
// (Gatlin bug, onboarding loop). See Product/CANOPY_DESIGN_AUDIT.md §DD-6.

const DEMO_WEATHER = { temperature: 72, feels_like: 74, humidity: 55, wind_speed: 8, description: 'partly cloudy', icon: '02d', high: 78, low: 58, alerts: [], forecast: [] };

/** Quick lookup: template_id → service_type for badge rendering */
const SERVICE_TYPE_MAP = new Map(
  TASK_TEMPLATES.map(t => [t.id, t.service_type || 'diy'] as const)
);

const SERVICE_BADGE_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  visit: { label: 'Pro Visit', bg: Colors.sage + '20', color: Colors.sage },
  add_on: { label: 'Add-On', bg: Colors.copper + '20', color: Colors.copper },
  // diy tasks get no badge — they're the default
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, home, weather, tasks, equipment, consumables, customTemplates, maintenanceLogs, setWeather, setTasks } = useStore();
  const tier = user?.subscription_tier || 'free';
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [joinRequests, setJoinRequests] = useState<HomeJoinRequest[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  // Image viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Notification state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Upgrade banner state
  const [historyWarningDismissed, setHistoryWarningDismissed] = useState(false);

  // Home Health Alert banner state (Item 13). One active alert per home, newest
  // undismissed row from `home_health_alerts`.
  const [homeHealthAlert, setHomeHealthAlert] = useState<{
    id: string;
    alert_type: 'score_drop' | 'below_threshold' | 'high_overdue';
    current_score: number;
    previous_score: number | null;
    delta: number | null;
    overdue_count: number;
    reason: string | null;
    created_at: string;
  } | null>(null);
  const [homeHealthAlertDismissing, setHomeHealthAlertDismissing] = useState(false);

  // Expiring warranties banner
  const [expiringWarranties, setExpiringWarranties] = useState<Warranty[]>([]);
  const [warrantiesLoading, setWarrantiesLoading] = useState(false);

  // DD-7 — Session-scoped dismiss for the Selling-Soon banner. We deliberately
  // don't persist this to the profile: the banner is the primary Sale Prep
  // affordance for users who flipped `home.selling_soon`, so we show it again
  // on next login until they toggle the flag off or open Sale Prep.
  const sellingSoonBannerKey = home?.id ? `canopy.sellingSoonBanner.dismissed.${home.id}` : null;
  const [sellingSoonDismissed, setSellingSoonDismissed] = useState<boolean>(() => {
    try {
      return sellingSoonBannerKey
        ? sessionStorage.getItem(sellingSoonBannerKey) === '1'
        : false;
    } catch {
      return false;
    }
  });
  const dismissSellingSoonBanner = () => {
    try {
      if (sellingSoonBannerKey) sessionStorage.setItem(sellingSoonBannerKey, '1');
    } catch {
      // private mode — non-fatal, still set local state
    }
    setSellingSoonDismissed(true);
    trackEvent('dashboard_selling_soon_banner_dismiss', {});
  };

  // Load notifications
  useEffect(() => {
    if (!user?.id) return;
    const loadNotifications = async () => {
      try {
        setNotificationsLoading(true);
        const data = await getNotifications(user.id, 5);
        setNotifications(data || []);
      } catch (err) {
        console.warn('Failed to fetch notifications:', err);
      } finally {
        setNotificationsLoading(false);
      }
    };
    loadNotifications();
  }, [user?.id]);

  // Load pending home join requests
  useEffect(() => {
    if (user?.id) {
      getHomeJoinRequests(user.id).then(setJoinRequests).catch((err) => {
        logger.warn('Failed to fetch home join requests:', err?.message);
      });
    }
  }, [user?.id]);

  // Load active Home Health alert (Item 13). Picks the most recent undismissed
  // row; home-score-weekly emits new ones at most once per 10 days per type.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('home_health_alerts')
          .select('id,alert_type,current_score,previous_score,delta,overdue_count,reason,created_at')
          .eq('user_id', user.id)
          .is('dismissed_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          logger.warn('Failed to fetch home health alert:', error.message);
          return;
        }
        setHomeHealthAlert((data as typeof homeHealthAlert) || null);
      } catch (err) {
        logger.warn('Failed to fetch home health alert:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Load expiring warranties (60-day window)
  useEffect(() => {
    if (!home?.id) return;
    setWarrantiesLoading(true);
    getExpiringWarranties(home.id, 60)
      .then(setExpiringWarranties)
      .catch(err => {
        logger.warn('Failed to fetch expiring warranties:', err?.message);
      })
      .finally(() => setWarrantiesLoading(false));
  }, [home?.id]);

  // Load inspection-doc count + household member count for the SetupChecklist.
  const [inspectionCount, setInspectionCount] = useState(0);
  const [memberCount, setMemberCount] = useState(1);
  const [homeAddOnCount, setHomeAddOnCount] = useState(0);
  useEffect(() => {
    if (!home?.id) return;
    getDocuments(home.id)
      .then((docs) => setInspectionCount((docs || []).filter((d: any) => d.type === 'inspection').length))
      .catch((err) => {
        logger.warn('Failed to fetch documents:', err?.message);
      });
    getHomeMembers(home.id)
      .then((members) => setMemberCount(Math.max(1, (members || []).length)))
      .catch((err) => {
        logger.warn('Failed to fetch home members:', err?.message);
      });
    // Active add-on count drives auto-completion of the "Explore add-ons" checklist item.
    supabase
      .from('home_add_ons')
      .select('id', { count: 'exact', head: true })
      .eq('home_id', home.id)
      .in('status', ['active', 'paused', 'pending_quote', 'quoted'])
      .then(({ count, error }) => {
        if (error) { logger.warn('Failed to fetch home_add_ons count:', error.message); return; }
        setHomeAddOnCount(count ?? 0);
      });
  }, [home?.id]);

  // Redirect new users who haven't set up their home yet
  useEffect(() => {
    if (user && !user.onboarding_complete && !home) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, home, navigate]);

  // C-11 (migration 066): tasks whose underlying template was edited after generation.
  const [staleTasks, setStaleTasks] = useState<StaleTemplateTask[]>([]);
  const [staleRefreshing, setStaleRefreshing] = useState(false);

  // Fetch tasks on mount; auto-generate ONCE if home exists but no tasks in DB
  const [tasksInitialized, setTasksInitialized] = useState(false);
  useEffect(() => {
    const loadTasks = async () => {
      if (tasksInitialized || !home) {
        setTasksLoading(false);
        return;
      }
      setTasksInitialized(true);
      try {
        setTasksLoading(true);
        const data = await getTasks(home.id);
        if (data && data.length > 0) {
          setTasks(data);
        } else {
          // No tasks in DB — generate from home profile and persist
          // Pass empty array as existingTasks since DB confirmed empty
          const generated = generateTasksForHome(home, equipment, [], consumables || [], user?.user_preferences, customTemplates);
          if (generated.length > 0) {
            try {
              const saved = await createTasks(generated);
              setTasks(saved);
            } catch (saveErr) {
              // Persist failed — DO NOT show local-only state. Showing
              // unpersisted tasks creates web/mobile divergence (the bug
              // that hit Gatlin's profile in Apr 2026): web stores them in
              // zustand localStorage as phantoms while mobile stays empty,
              // so the same home renders a different health score on each
              // platform. Refetch from DB instead so both platforms agree
              // on whatever actually persisted, and surface the failure.
              console.error('Failed to persist generated tasks:', saveErr);
              try {
                const refetched = await getTasks(home.id);
                setTasks(refetched);
              } catch {
                setTasks([]);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch tasks:', err);
      } finally {
        setTasksLoading(false);
      }
    };
    loadTasks();
  }, [home?.id, tasksInitialized]);

  // C-11: pull stale-template-task list after home loads. Silently ignore errors —
  // this is a nicety, not a critical path.
  useEffect(() => {
    if (!home?.id) return;
    listStaleTemplateTasks(home.id)
      .then(setStaleTasks)
      .catch((err) => console.warn('listStaleTemplateTasks failed:', err));
  }, [home?.id, tasksInitialized]);

  const handleRefreshStaleTasks = async () => {
    if (!home || staleTasks.length === 0 || staleRefreshing) return;
    setStaleRefreshing(true);
    try {
      const staleIds = staleTasks.map((t) => t.task_id);
      await clearStaleTemplateTasks(staleIds);
      // Regenerate from templates against the tasks that remain.
      const remaining = tasks.filter((t) => !staleIds.includes(t.id));
      const generated = generateTasksForHome(
        home,
        equipment,
        remaining,
        consumables || [],
        user?.user_preferences,
        customTemplates,
      );
      // Only the newly-generated tasks need persisting (generateTasksForHome dedups).
      const toPersist = generated.filter((g) => !remaining.some((r) => r.id === g.id));
      if (toPersist.length > 0) {
        try {
          await createTasks(toPersist);
        } catch (persistErr) {
          console.warn('Failed to persist regenerated stale tasks:', persistErr);
        }
      }
      // Reload tasks + stale list.
      const fresh = await getTasks(home.id);
      setTasks(fresh || []);
      setStaleTasks([]);
      showToast({ message: `Refreshed ${staleIds.length} task${staleIds.length === 1 ? '' : 's'}` });
    } catch (err) {
      console.warn('handleRefreshStaleTasks failed:', err);
      showToast({ message: 'Could not refresh tasks — try again' });
    } finally {
      setStaleRefreshing(false);
    }
  };

  // Auto-geocode home address if lat/long are missing (needed for weather)
  useEffect(() => {
    const geocodeHome = async () => {
      if (home && !home.latitude && !home.longitude && home.address) {
        try {
          const fullAddress = `${home.address}, ${home.city || ''}, ${home.state || ''} ${home.zip_code || ''}`;
          const geo = await geocodeAddress(fullAddress);
          if (geo.latitude && geo.longitude) {
            const updatedHome = { ...home, latitude: geo.latitude, longitude: geo.longitude };
            await upsertHome(updatedHome);
            useStore.getState().setHome(updatedHome);
          }
        } catch (err) {
          console.warn('Auto-geocode failed:', err);
        }
      }
    };
    geocodeHome();
  }, [home?.id]);

  // P1-7 (2026-04-23): Weather fetch error boundary + clearer state machine.
  // Previously, if home had no coords (geocoding failed earlier) the user
  // saw nothing at all — no skeleton, no error, just a missing widget.
  // If the network request failed they saw "Unable to load weather data"
  // with no way to distinguish from "you're offline" or "rate limited."
  //
  // Now we surface three distinct states:
  //   - 'no_location': home isn't geocoded yet → user sees a hint they can
  //     fix (re-geocode the address).
  //   - 'fetch_failed': the API call threw → user sees a retry-friendly
  //     message with the underlying error class (network vs server).
  //   - 'no_access': the tier gate blocks weather → handled outside this
  //     useEffect by the existing canAccess() check on render.
  useEffect(() => {
    if (!home) return;
    if (!canAccess(tier, 'weather_alerts')) return;

    if (!home.latitude || !home.longitude) {
      // Home exists but isn't geocoded yet. The geocodeHome effect above
      // will retry on next mount; surface a friendly hint instead of
      // silently rendering nothing.
      setWeatherError('Add or refine your address to see local weather alerts.');
      setWeatherLoading(false);
      return;
    }

    const loadWeather = async () => {
      try {
        setWeatherLoading(true);
        setWeatherError(null);
        const weatherData = await fetchWeather(home.latitude!, home.longitude!);
        setWeather(weatherData);
      } catch (error) {
        logger.error('Failed to fetch weather:', error);
        // Distinguish offline / TypeError (network) from server-side errors so
        // the user sees an actionable message.
        const isNetwork = (error instanceof TypeError) || /fetch|network|offline/i.test(String(error));
        setWeatherError(isNetwork
          ? 'Weather is unavailable — check your connection and refresh.'
          : 'Weather service temporarily unavailable. We\'ll retry shortly.');
      } finally {
        setWeatherLoading(false);
      }
    };
    loadWeather();
  }, [home, tier, setWeather]);

  // Load and check history warning dismissal
  useEffect(() => {
    const dismissed = localStorage.getItem('history-warning-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (dismissedTime > weekAgo) {
        setHistoryWarningDismissed(true);
      }
    }
  }, []);

  const hasWeather = canAccess(tier, 'weather_alerts');
  const hasAI = canAccess(tier, 'ai_task_generation');
  const taskLimit = getTaskLimit(tier);
  const historyDaysLimit = getHistoryDaysLimit(tier);

  const isDemo = !user?.onboarding_complete && (!tasks || tasks.length === 0);
  // Task dedup (parity with mobile fix for IMG_7409 Clean Gutters duplicate).
  // Historical DB rows can contain duplicates with the same (title|month|year).
  // Keep the row with the "most progressed" status; tie-break on most recent created.
  const displayTasksRaw = useMemo(() => {
    // DD-6: demo-mode now shows an EmptyState instead of seeded tasks.
    if (isDemo) return [] as MaintenanceTask[];
    const statusRank: Record<string, number> = { completed: 3, scheduled: 2, snoozed: 1, skipped: 0 };
    const byKey = new Map<string, (typeof tasks)[number]>();
    for (const t of tasks) {
      const d = new Date(t.due_date);
      const key = `${t.title}|${d.getMonth() + 1}|${d.getFullYear()}`;
      const existing = byKey.get(key);
      if (!existing) { byKey.set(key, t); continue; }
      const tRank = statusRank[t.status as string] ?? 0;
      const eRank = statusRank[existing.status as string] ?? 0;
      if (tRank > eRank) { byKey.set(key, t); continue; }
      if (tRank === eRank) {
        const tCreated = t.created_at ? new Date(t.created_at).getTime() : 0;
        const eCreated = existing.created_at ? new Date(existing.created_at).getTime() : 0;
        if (tCreated > eCreated) byKey.set(key, t);
      }
    }
    return Array.from(byKey.values()).map(t => ({ ...t, status: getDisplayStatus(t) }));
  }, [isDemo, tasks]);
  // Health-aware ordering (Item 13). When the home health score drops, the
  // overdue + high-priority tasks bubble to the top so homeowners can clear
  // the items actually dragging the score. Health data is computed below; we
  // use tasks-as-raw here and then re-sort after the score is known.
  const healthDataForSort = useMemo(() => calculateHealthScore(tasks), [tasks]);
  const displayTasks = useMemo(
    () => sortTasksByHealthUrgency(displayTasksRaw, { healthScore: healthDataForSort.score }),
    [displayTasksRaw, healthDataForSort.score],
  );
  const tasksToShow = taskLimit ? displayTasks.slice(0, taskLimit) : displayTasks;
  const displayWeather = weather || DEMO_WEATHER;
  const unreadNotifications = notifications.filter(n => !n.read);
  const recentNotifications = unreadNotifications.slice(0, 2);

  // Calculate 90-day history cliff warning for free tier
  const shouldShowHistoryWarning = tier === 'free' && historyDaysLimit === 90 && !historyWarningDismissed && maintenanceLogs && maintenanceLogs.length > 0;
  let oldestLogDaysAway = null;
  if (shouldShowHistoryWarning) {
    const sortedLogs = [...maintenanceLogs].sort((a, b) => new Date(a.completed_date).getTime() - new Date(b.completed_date).getTime());
    if (sortedLogs.length > 0) {
      const oldestLog = sortedLogs[0];
      const daysOld = Math.floor((Date.now() - new Date(oldestLog.completed_date).getTime()) / (24 * 60 * 60 * 1000));
      oldestLogDaysAway = Math.max(0, 90 - daysOld);
    }
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Weekly cost estimate: active tasks due this week + any completed this week
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekCost = useMemo(() => {
    const upcomingThisWeek = tasks.filter(t => {
      const d = new Date(t.due_date);
      return d >= weekStart && d < weekEnd && t.status !== 'completed';
    });
    return upcomingThisWeek.reduce((sum, t) => sum + (t.estimated_cost || 0), 0);
  }, [tasks, weekStart.getTime(), weekEnd.getTime()]);

  // Reuse the health score computed above for task ordering — avoids recomputing.
  // 2026-04-29: extract the breakdown components in addition to the score so
  // the DashboardHeroStrip can surface a behavior-driving driver hint (lowest
  // contributor + actionable copy). Replaces the prior "tap to see more"
  // generic CTA with a real prompt like "3 overdue tasks pulling your score
  // down — clear one to claw back ~3 points."
  const {
    score: healthScore,
    rolling90,
    currentMonth,
    overdueCount: healthOverdueCount,
    completedCount: healthCompletedCount,
    totalCount: healthTotalCount,
  } = healthDataForSort;

  // Dismiss the active home-health alert banner (Item 13).
  const dismissHomeHealthAlert = async () => {
    if (!homeHealthAlert || homeHealthAlertDismissing) return;
    setHomeHealthAlertDismissing(true);
    try {
      const { error } = await supabase.rpc('dismiss_home_health_alert', { p_alert_id: homeHealthAlert.id });
      if (error) {
        logger.warn('dismiss_home_health_alert failed:', error.message);
      } else {
        setHomeHealthAlert(null);
      }
    } finally {
      setHomeHealthAlertDismissing(false);
    }
  };

  const homeHealthAlertCopy = homeHealthAlert
    ? (homeHealthAlert.alert_type === 'score_drop'
        ? { title: `Your Home Health Score dropped ${Math.abs(homeHealthAlert.delta ?? 0)} points`, accent: '#FF9800' }
        : homeHealthAlert.alert_type === 'below_threshold'
          ? { title: 'Your Home Health Score needs attention', accent: '#E53935' }
          : { title: `${homeHealthAlert.overdue_count} overdue tasks — let's knock a few out`, accent: '#FF9800' })
    : null;

  const costForecast = useMemo(() => generateCostForecast(equipment, home ? {
    square_footage: home.square_footage,
    stories: home.stories,
    roof_type: home.roof_type,
    has_pool: home.has_pool,
  } : undefined), [equipment, home]);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      {/* Header — greeting + name only. Canopy logo lives in sidebar; no
          duplicate in the content area. */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', margin: 0, fontWeight: 500 }}>
          {greeting}
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '2px 0 0', lineHeight: 1.2 }}>
          {user?.full_name || 'Homeowner'}
        </h1>
      </div>

      {/* Notification Banner */}
      {!notificationsLoading && unreadNotifications.length > 0 && (
        <div style={{
          background: 'var(--color-cream)',
          border: `1px solid var(--color-copper)40`,
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                {unreadNotifications.length} notification{unreadNotifications.length > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {recentNotifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => {
                      if (!notif.read) {
                        markNotificationRead(notif.id).catch((err) => {
                          logger.warn('Failed to mark notification as read:', err?.message);
                        });
                      }
                      navigate('/notifications');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: 0,
                      fontSize: 13,
                      color: 'var(--color-copper)',
                      textDecoration: 'underline',
                      fontWeight: 500,
                    }}
                  >
                    {notif.title}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/notifications')}
              style={{ whiteSpace: 'nowrap', fontSize: 12 }}
            >
              View all &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Expiring Warranties Banner */}
      {!warrantiesLoading && expiringWarranties.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.08) 0%, rgba(255, 193, 7, 0.04) 100%)',
          border: `1px solid ${Colors.warning}40`,
          borderRadius: 12,
          padding: '16px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <div>
              <p style={{ fontWeight: 700, margin: '0 0 2px', color: Colors.charcoal, fontSize: 14 }}>
                {expiringWarranties.length} warranty{expiringWarranties.length > 1 ? 'ies' : ''} expiring soon
              </p>
              <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>
                Review before coverage lapses
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-sm"
              style={{
                background: Colors.warning,
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/warranties')}
            >
              View Warranties &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Pending Home Join Requests */}
      {joinRequests.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {joinRequests.map((req) => (
            <div key={req.id} style={{
              background: 'var(--color-cream)', border: `1px solid var(--color-copper)40`,
              borderRadius: 12, padding: '14px 18px', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {req.requester?.full_name || req.requester?.email || 'Someone'} wants to join your home
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {req.homes?.address}, {req.homes?.city}, {req.homes?.state}
                  {req.message && <span> &mdash; "{req.message}"</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--color-sage)', color: 'var(--color-white)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  disabled={processingRequest === req.id}
                  onClick={async () => {
                    setProcessingRequest(req.id);
                    try {
                      await approveHomeJoinRequest(req.id);
                      setJoinRequests(prev => prev.filter(r => r.id !== req.id));
                    } catch (err: any) {
                      showToast({ message: err?.message || 'Failed to approve.' });
                    } finally {
                      setProcessingRequest(null);
                    }
                  }}
                >
                  {processingRequest === req.id ? '...' : 'Approve'}
                </button>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: 12, color: 'var(--color-error)' }}
                  disabled={processingRequest === req.id}
                  onClick={async () => {
                    setProcessingRequest(req.id);
                    try {
                      await denyHomeJoinRequest(req.id);
                      setJoinRequests(prev => prev.filter(r => r.id !== req.id));
                    } catch (err: any) {
                      showToast({ message: err?.message || 'Failed to deny.' });
                    } finally {
                      setProcessingRequest(null);
                    }
                  }}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CPSC Recall Alerts */}
      <RecallAlertBanner />

      {/* 2026-04-29 (#4 full): post-Quick-Start nudge. Self-gated — only
          renders for users whose home looks like they took the Quick Start
          path (no foundation, no lawn, no equipment, no system flags). */}
      <ImproveRecommendationsBanner />

      {/* Pending Home Member Invites */}
      <PendingInvites />

      {/* 90-Day History Cliff Warning Banner (Free Tier) */}
      {shouldShowHistoryWarning && oldestLogDaysAway !== null && oldestLogDaysAway <= 14 && (
        <div style={{
          background: 'linear-gradient(135deg, var(--color-warning, #FFF3E0) 0%, rgba(255, 193, 7, 0.05) 100%)',
          border: '1px solid var(--color-warning, #FFE0B2)',
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: 6 }}>
              Your oldest maintenance records will be locked in {oldestLogDaysAway} day{oldestLogDaysAway === 1 ? '' : 's'}
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, marginBottom: 10 }}>
              Upgrade to Home to keep your full history and never lose important home records.
            </p>
            <button
              onClick={() => navigate('/subscription')}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-white)',
                background: 'var(--color-warning, #FF9800)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Upgrade Now
            </button>
          </div>
          <button
            onClick={() => {
              setHistoryWarningDismissed(true);
              localStorage.setItem('history-warning-dismissed', Date.now().toString());
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              padding: 0,
              color: 'var(--color-text-secondary)',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Home Health Score alert banner (Item 13) */}
      {homeHealthAlert && homeHealthAlertCopy && (
        <div style={{
          background: `linear-gradient(135deg, ${homeHealthAlertCopy.accent}15 0%, ${homeHealthAlertCopy.accent}05 100%)`,
          border: `1px solid ${homeHealthAlertCopy.accent}66`,
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: 6 }}>
              {homeHealthAlertCopy.title}
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, marginBottom: 10 }}>
              {homeHealthAlert.reason || 'Clear the overdue items below to bring your Home Health Score back up.'}
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => navigate('/calendar')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--color-white)',
                  background: homeHealthAlertCopy.accent,
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Review tasks
              </button>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {homeHealthAlert.previous_score != null
                  ? `Previous: ${homeHealthAlert.previous_score} → Current: ${homeHealthAlert.current_score}`
                  : `Current score: ${homeHealthAlert.current_score}`}
              </span>
            </div>
          </div>
          <button
            onClick={dismissHomeHealthAlert}
            disabled={homeHealthAlertDismissing}
            aria-label="Dismiss home health alert"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: homeHealthAlertDismissing ? 'wait' : 'pointer',
              padding: 0,
              color: 'var(--color-text-secondary)',
              opacity: homeHealthAlertDismissing ? 0.5 : 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* DD-7 — Sale Prep banner. Renders only when the owner has flipped
          `home.selling_soon` via HomeDetails. Session-dismissible. The
          always-visible "Selling your home?" card below stays put as the
          soft nudge for everyone else. */}
      {home?.selling_soon && !sellingSoonDismissed && (
        <div
          role="status"
          aria-label="Sale prep reminder"
          style={{
            background: `linear-gradient(90deg, ${Colors.sage}15 0%, ${Colors.copper}15 100%)`,
            border: `1px solid ${Colors.sage}`,
            borderLeft: `4px solid ${Colors.sage}`,
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              You told us you&apos;re thinking about selling — your Sale Prep kit is ready.
            </p>
            <p className="text-xs text-gray" style={{ marginBottom: 12, lineHeight: 1.5 }}>
              Home Token, maintenance history, document vault, and the Sale Prep checklist are
              all pulled together so you can list faster with proof of care.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-sage btn-sm"
                onClick={() => {
                  trackEvent('dashboard_selling_soon_banner_click', {});
                  navigate('/sale-prep');
                }}
              >
                Open Sale Prep &rarr;
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  trackEvent('dashboard_selling_soon_banner_click', {});
                  navigate('/home-token');
                }}
              >
                View Home Token
              </button>
            </div>
          </div>
          <button
            onClick={dismissSellingSoonBanner}
            aria-label="Dismiss Sale Prep banner for this session"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              padding: 0,
              color: 'var(--color-text-secondary)',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* DD-9: first-visit orientation card (Pro tier, before first visit completes) */}
      <FirstVisitOrientationCard />

      {/* Post-onboarding setup checklist */}
      <SetupChecklist
        home={home}
        equipment={equipment}
        inspectionCount={inspectionCount}
        householdMemberCount={memberCount}
        homeAddOnCount={homeAddOnCount}
      />

      {/* Post-task add-on nudge (fires from quickCompleteTask handlers below) */}
      <AddOnNudge />

      {/* DD-1: single-focus "Your next action" hero above the grid.
          Uses the DD-10 scoring engine to surface overdue → weather → due-soon → setup → add-on. */}
      {!isDemo && displayTasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <NextActionHero tasks={displayTasks} />
        </div>
      )}

      {/* DD-2: Home Health + Home Token hero strip. Free tier sees the
          locked token card nudging upgrade. */}
      {!isDemo && home && (
        <div style={{ marginBottom: 16 }}>
          <DashboardHeroStrip
            healthScore={healthScore}
            healthBreakdown={{
              rolling90,
              currentMonth,
              overdueCount: healthOverdueCount,
              completedCount: healthCompletedCount,
              totalCount: healthTotalCount,
            }}
            tokenLocked={tier === 'free'}
            tokenLockReason="Upgrade to share your Home Token with buyers and agents."
          />
        </div>
      )}

      <div className="dashboard-layout">
        <div className="flex-col gap-lg">
          {/* Weather — only shown for tiers with weather access.
              Free-tier upgrade messaging lives in the consolidated upgrade card below,
              so we no longer render a duplicate Weather teaser here. */}
          {hasWeather && (
            <div
              className="card"
              style={{ background: `linear-gradient(135deg, var(--color-sage)20, var(--color-cream))`, cursor: 'pointer' }}
              onClick={() => navigate('/weather')}
            >
              {weatherLoading ? (
                <div style={{ padding: '12px 0' }}>
                  <Skeleton variant="title" width="40%" />
                  <Skeleton variant="bar" width="60%" height={36} />
                  <Skeleton variant="text" width="50%" />
                </div>
              ) : weatherError ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p className="text-sm text-gray">{weatherError}</p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>Please add home coordinates in settings</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm fw-600 text-gray">Current Weather</p>
                      <p style={{ fontSize: 36, fontWeight: 700 }}>
                        <span style={{ marginRight: 6 }}>{
                          { '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️', '03d': '☁️', '03n': '☁️',
                            '04d': '☁️', '04n': '☁️', '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
                            '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️', '50d': '🌫️', '50n': '🌫️'
                          }[displayWeather.icon] || '🌤️'
                        }</span>
                        {displayWeather.temperature}&#176;F
                      </p>
                      <p className="text-sm text-gray" style={{ textTransform: 'capitalize' }}>{displayWeather.description}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="text-sm text-gray">H: {displayWeather.high}&#176; L: {displayWeather.low}&#176;</p>
                      <p className="text-sm text-gray">Humidity: {displayWeather.humidity}%</p>
                      <p className="text-sm text-gray">Wind: {displayWeather.wind_speed} mph</p>
                    </div>
                  </div>
                  {displayWeather.alerts.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-error)20', borderRadius: 8, fontSize: 13, color: 'var(--color-error)' }}>
                      Warning: {displayWeather.alerts.length} active weather alert{displayWeather.alerts.length > 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Weather Insights (Smart Weather-to-Task Scheduling) */}
          {hasWeather && weather && weather.forecast && weather.forecast.length > 0 && tier !== 'free' && (
            <WeatherInsightCards insights={generateWeatherInsights(weather.forecast, displayTasks)} />
          )}

          {/* Home Health Score gauge removed 2026-04-21 (Wave E jank pass).
              DashboardHeroStrip above owns the score-at-a-glance; the
              drill-down lives on /health-score via "See what's moving the
              needle →" in the hero strip. Previously this card rendered
              the same 40/Fair value as the hero strip — duplicate cruft. */}

          {/* Weekly cost strip */}
          {weekCost > 0 && (
            <div className="card mb-md" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: Colors.copper + '10', border: `1px solid ${Colors.copper}30` }}>
              <span role="img" aria-label="dollar" style={{ fontSize: 16 }}>&#128181;</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: Colors.copper, margin: 0 }}>
                  This week: ~${weekCost.toLocaleString()} in estimated parts &amp; supplies
                </p>
                <p style={{ fontSize: 11, color: Colors.medGray, margin: 0 }}>
                  Across {tasks.filter(t => { const d = new Date(t.due_date); return d >= weekStart && d < weekEnd && t.status !== 'completed'; }).length} upcoming task{tasks.filter(t => { const d = new Date(t.due_date); return d >= weekStart && d < weekEnd && t.status !== 'completed'; }).length === 1 ? '' : 's'} &middot; Cash float, not a bill
                </p>
              </div>
            </div>
          )}

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-md">
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Due This Month</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/calendar')}>See All &rarr;</button>
            </div>

            {/* C-11: stale-template banner — shown when the task template an existing task was
                generated from has been edited since. One-click "Refresh" clears + regenerates. */}
            {!isDemo && staleTasks.length > 0 && (
              <div
                style={{
                  background: `${Colors.sage}10`,
                  border: `1px dashed ${Colors.sage}80`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, color: Colors.charcoal }}>
                    {staleTasks.length} task{staleTasks.length === 1 ? ' was' : 's were'} updated in our catalog
                  </p>
                  <p style={{ fontSize: 12, color: Colors.charcoal, opacity: 0.8, lineHeight: 1.45 }}>
                    Refresh to pull the newest instructions, safety warnings, and timing.
                  </p>
                </div>
                <button
                  className="btn btn-sage btn-sm"
                  disabled={staleRefreshing}
                  onClick={handleRefreshStaleTasks}
                  style={{ fontSize: 12, padding: '6px 12px' }}
                >
                  {staleRefreshing ? 'Refreshing…' : 'Refresh tasks'}
                </button>
              </div>
            )}

            {/* DD-6: demo mode (onboarding incomplete) renders a clear
                EmptyState instead of seeded tasks. */}
            {isDemo && (
              <EmptyState
                title="Your maintenance plan is almost ready"
                description="Finish setup so we can tailor tasks to your home's square footage, climate, and equipment."
                primaryAction={{
                  label: 'Finish setting up',
                  onClick: () => navigate('/onboarding'),
                }}
                secondaryAction={{
                  label: 'See how it works',
                  onClick: () => navigate('/health-score'),
                }}
                style={{ marginBottom: 12 }}
              />
            )}

            {tasksLoading ? (
              <div className="flex-col gap-sm">
                <Skeleton variant="card" count={3} />
              </div>
            ) : (
            <div className="flex-col gap-sm" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {tasksToShow.filter(t => { const d = new Date(t.due_date); return d >= monthStart && d <= monthEnd && t.status !== 'completed'; }).map(task => (
                <div key={task.id} className="card card-clickable" style={{ padding: '14px 20px', cursor: 'pointer' }} onClick={() => !isDemo && navigate(`/task/${task.id}`)}>
                  <div className="task-card">
                    <div className="task-priority" style={{ background: PriorityColors[task.priority] || Colors.silver }} />
                    <div className="task-info">
                      <div className="task-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {task.title}
                        {(() => { const st = SERVICE_TYPE_MAP.get((task as any).template_id || ''); const badge = st ? SERVICE_BADGE_STYLES[st] : undefined; return badge ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.label}</span> : null; })()}
                        {(task as any).created_by_pro_id && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'var(--color-copper-muted, #FFF3E0)', color: 'var(--color-copper)', whiteSpace: 'nowrap' }}>
                            Pro flagged
                          </span>
                        )}
                      </div>
                      <div className="task-meta">
                        {task.category} &middot; ~{task.estimated_minutes || '?'} min &middot; {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="task-actions">
                      <span className="badge" style={{ background: (StatusColors[task.status] || Colors.silver) + '20', color: StatusColors[task.status] || Colors.silver }}>{task.status}</span>
                      {task.status !== 'completed' && !isDemo && (
                        <button className="btn btn-sage btn-sm" onClick={(e) => { e.stopPropagation(); quickCompleteTask(task).then(() => nudgeAddOnFromTaskCategory((task as any).category)).catch(() => {}); }}>Done</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {tasksToShow.filter(t => { const d = new Date(t.due_date); return d >= monthStart && d <= monthEnd && t.status !== 'completed'; }).length === 0 && tasksToShow.length > 0 && (
                <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: `linear-gradient(135deg, var(--color-sage) 0%, var(--color-copper) 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', fontSize: 36, color: 'var(--color-white)',
                  }}>&#127881;</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-charcoal)', marginBottom: 8 }}>All tasks complete!</h3>
                  <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>
                    You've finished every task for this month. Your home is in great shape — enjoy the peace of mind!
                  </p>
                </div>
              )}
              {tasksToShow.length === 0 && !isDemo && (
                home && tasks.length === 0 ? (
                  // P1-10 (2026-04-23): parity with mobile dashboard — when home is set
                  // up but the auto-generation didn't seed anything, give the user a
                  // direct "build my plan" path instead of a passive "you're caught up"
                  // state that leaves them stranded.
                  <EmptyState
                    title="Build my maintenance plan"
                    description="We'll create a personalized schedule from your home profile and equipment."
                    primaryAction={{
                      label: 'Build my plan',
                      onClick: async () => {
                        if (!home) return;
                        try {
                          const generated = generateTasksForHome(
                            home,
                            equipment,
                            [],
                            consumables || [],
                            user?.user_preferences,
                            customTemplates,
                          );
                          if (generated.length > 0) {
                            const saved = await createTasks(generated);
                            setTasks(saved);
                            showToast({ message: `Generated ${saved.length} task${saved.length === 1 ? '' : 's'}.` });
                          }
                        } catch (err) {
                          console.warn('Failed to generate plan:', err);
                          showToast({ message: 'Could not generate plan. Please try again.' });
                        }
                      },
                    }}
                  />
                ) : (
                  <EmptyState
                    title="You're caught up"
                    description="No tasks due this month. New ones will appear here as the season changes."
                  />
                )
              )}
            </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex-col gap-lg">
          {/* Home Photo */}
          {home?.photo_url ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <img
                src={home.photo_url}
                alt="Home"
                onClick={() => {
                  setViewerImages([home.photo_url!]);
                  setViewerInitialIndex(0);
                  setViewerOpen(true);
                }}
                style={{
                  width: '100%',
                  height: 180,
                  objectFit: 'cover',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              />
              <div
                style={{ padding: '12px 16px', cursor: 'pointer' }}
                onClick={() => navigate('/home')}
              >
                <p style={{ fontWeight: 600, fontSize: 14 }}>{home.address}</p>
                <p className="text-xs text-gray">{home.city}, {home.state}</p>
              </div>
            </div>
          ) : (
            <div
              className="card card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => navigate('/home')}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/home'); } }}
              style={{ textAlign: 'center', padding: 28, cursor: 'pointer' }}
              aria-label={home ? 'Add a photo of your home' : 'Set up your home'}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--color-sage)18',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <NavHome size={22} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-charcoal)', margin: 0 }}>
                {home ? 'Add a photo of your home' : 'Set up your home'}
              </p>
              <p className="text-xs text-gray" style={{ marginTop: 4 }}>Tap to get started</p>
            </div>
          )}

          {/* AI Home Assistant */}
          {canAccess(tier, 'ai_chat') ? (
            <DashboardChat />
          ) : (
            <div className="card" style={{ background: 'var(--color-sage-muted, #f0f4f0)', borderLeft: `4px solid var(--color-sage)` }}>
              <div className="flex items-center gap-md">
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--color-card-background)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>&#127807;</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>AI Home Assistant</p>
                  <p className="text-sm text-gray">Get personalized maintenance advice</p>
                </div>
              </div>
              <button className="btn btn-primary btn-sm mt-md" onClick={() => navigate('/subscription')}>Upgrade to Access</button>
            </div>
          )}

          {/* Quick Actions */}
          <div className="card">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Quick Actions</p>
            <div className="flex-col gap-sm">
              {[
                { label: 'Create Custom Task', route: '/task/create', free: false },
                { label: 'Scan Equipment', route: '/equipment', free: true },
                { label: 'Pro Services', route: '/pro-services', free: false },
                { label: 'Contact Agent', route: '/agent', free: true },
                { label: 'Sale Prep Checklist', route: '/sale-prep', free: true },
                { label: 'Home Report (PDF)', route: '/home-report', free: true },
                { label: 'Transfer Home Token', route: '/transfer', free: true },
              ].map(a => {
                const locked = tier === 'free' && !a.free;
                return (
                  <button
                    key={a.label}
                    className="btn btn-ghost"
                    style={{
                      justifyContent: 'flex-start',
                      padding: '10px 12px',
                      opacity: locked ? 0.5 : 1,
                      position: 'relative',
                    }}
                    onClick={() => locked ? navigate('/subscription') : navigate(a.route)}
                  >
                    {a.label} {locked ? <span style={{ fontSize: 11, color: 'var(--color-copper)', marginLeft: 'auto' }}>Upgrade</span> : <span style={{ marginLeft: 'auto' }}>&rarr;</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subscription */}
          <div className="card" style={{ background: 'var(--color-copper-muted, #FFF3E0)' }}>
            <p className="text-xs fw-600 text-copper mb-sm">YOUR PLAN</p>
            <p style={{ fontWeight: 700 }}>{PLANS.find(p => p.value === tier)?.name || 'Free'}</p>
            <p className="text-sm text-gray">{PLANS.find(p => p.value === tier)?.inquireForPricing ? 'Concierge Plan' : `$${PLANS.find(p => p.value === tier)?.price || 0}${PLANS.find(p => p.value === tier)?.period}`}</p>
            {tier === 'free' && <button className="btn btn-primary btn-sm mt-md" onClick={() => navigate('/subscription')}>Upgrade</button>}
          </div>

          {/* Consolidated upgrade teaser (Free Tier) — mirrors Canopy-App/app/(tabs)/index.tsx for feature parity */}
          {tier === 'free' && (
            <div
              className="card card-clickable"
              style={{
                background: 'var(--color-copper-muted, #FFF3E0)',
                borderLeft: `4px solid ${Colors.copper}`,
                cursor: 'pointer',
              }}
              onClick={() => navigate('/subscription')}
              role="button"
              aria-label="Upgrade to Home plan"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    background: Colors.copper + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 20 }}>✨</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: 2 }}>
                    Unlock the full Canopy experience
                  </p>
                  <p className="text-xs text-gray" style={{ margin: 0 }}>
                    Weather alerts, document vault, seasonal plan & unlimited AI scans.
                  </p>
                </div>
                <span style={{ color: Colors.copper, fontSize: 18, flexShrink: 0 }}>›</span>
              </div>
            </div>
          )}

          {/* A1-4: Sale Prep CTA — visible to all tiers, always free */}
          <div
            className="card card-clickable"
            style={{
              background: 'var(--color-cream)',
              borderLeft: `4px solid ${Colors.sage}`,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/sale-prep')}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {/* ASSET-PLACEHOLDER: ILLUS-10 — selling-your-home icon (emoji placeholder) */}
              <div style={{ fontSize: 24, marginTop: 2 }} data-asset-key="ILLUS-10">&#127969;</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Selling your home?</p>
                <p className="text-xs text-gray" style={{ marginBottom: 8, lineHeight: 1.5 }}>
                  Your Home Token + maintenance history can add thousands to your list price. Start the sale-prep checklist.
                </p>
                <button
                  className="btn btn-sage btn-sm"
                  style={{ fontSize: 12, padding: '6px 10px' }}
                  onClick={(e) => { e.stopPropagation(); navigate('/sale-prep'); }}
                >
                  Open Sale Prep &rarr;
                </button>
              </div>
            </div>
          </div>

          {/* Equipment Summary */}
          <div className="card">
            <div className="flex items-center justify-between mb-sm">
              <p style={{ fontWeight: 600 }}>Equipment</p>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/equipment')}>View &rarr;</button>
            </div>
            <p style={{ fontSize: 28, fontWeight: 700 }}>{equipment.length}</p>
            <p className="text-xs text-gray">items registered</p>
          </div>

          {/* Cost Forecast */}
          {costForecast.items.length > 0 && (
            <div className="card" style={{ borderLeft: `4px solid ${costForecast.urgentCount > 0 ? 'var(--color-warning)' : 'var(--color-sage)'}` }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Replacement Forecast</p>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
                Based on national averages &amp; equipment age
              </p>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: costForecast.totalNextYear > 0 ? 'var(--color-warning)' : 'var(--color-sage)' }}>
                    ${costForecast.totalNextYear.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray">Next 12 months</p>
                </div>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-charcoal)' }}>
                    ${costForecast.totalNext5Years.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray">Next 5 years</p>
                </div>
              </div>
              {costForecast.items.slice(0, 3).map(item => {
                const urgencyColor = item.urgency === 'replace_now' ? Colors.error
                  : item.urgency === 'replace_soon' ? Colors.warning
                  : item.urgency === 'plan_ahead' ? Colors.info : Colors.sage;
                return (
                  <div key={item.equipment.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid var(--color-background)' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: urgencyColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.equipment.name}
                        </p>
                        {item.isProQuote && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: 'var(--color-sage)', background: 'var(--color-sage-muted, #f0f4f0)',
                            padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap',
                          }}>Pro Quote</span>
                        )}
                      </div>
                      <p className="text-xs text-gray">
                        {item.remainingYears <= 0 ? 'Past expected lifespan' : item.remainingYears < 1 ? '<1yr remaining' : `~${Math.round(item.remainingYears)}yr remaining`}
                        {' · '}
                        {item.isProQuote
                          ? `$${item.estimatedCost.toLocaleString()}`
                          : item.costRange
                            ? `$${item.costRange.low.toLocaleString()} – $${item.costRange.high.toLocaleString()}`
                            : `~$${item.estimatedCost.toLocaleString()}`
                        }
                      </p>
                    </div>
                  </div>
                );
              })}
              {costForecast.items.length > 3 && (
                <button className="btn btn-ghost btn-sm mt-sm" style={{ width: '100%', fontSize: 12 }} onClick={() => navigate('/equipment')}>
                  View all {costForecast.items.length} items &rarr;
                </button>
              )}
              <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
                {FORECAST_DISCLAIMER}
              </p>
            </div>
          )}

          {/* Emergency Info Quick Access */}
          <div className="card" style={{ borderLeft: `4px solid var(--color-error)` }}>
            <div className="flex items-center justify-between mb-sm">
              <p style={{ fontWeight: 600 }}>Emergency Info</p>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home?edit=emergency')}>Edit &rarr;</button>
            </div>
            {home?.water_shutoff_location || home?.main_breaker_location || home?.gas_meter_location ? (
              <div className="flex-col gap-sm">
                {home.water_shutoff_location && (
                  <div className="flex items-center gap-sm">
                    <span style={{ fontSize: 14 }} role="img" aria-label="Humidity">💧</span>
                    <div>
                      <p className="text-xs text-gray">Water Shutoff</p>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{home.water_shutoff_location}</p>
                    </div>
                  </div>
                )}
                {home.main_breaker_location && (
                  <div className="flex items-center gap-sm">
                    <span style={{ fontSize: 14 }}>⚡</span>
                    <div>
                      <p className="text-xs text-gray">Main Breaker</p>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{home.main_breaker_location}</p>
                    </div>
                  </div>
                )}
                {home.gas_meter_location && (
                  <div className="flex items-center gap-sm">
                    <span style={{ fontSize: 14 }} role="img" aria-label="Heat index">🔥</span>
                    <div>
                      <p className="text-xs text-gray">Gas Meter</p>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{home.gas_meter_location}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <p className="text-sm text-gray">Know where your shutoffs are in an emergency</p>
                <button className="btn btn-ghost btn-sm mt-sm" style={{ color: 'var(--color-copper)' }} onClick={() => navigate('/home?edit=emergency')}>
                  Add Locations
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewerOpen && (
        <ImageViewer
          images={viewerImages}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}
