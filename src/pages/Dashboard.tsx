import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import logger from '@/utils/logger';
import { canAccess, getTaskLimit, getHistoryDaysLimit, PLANS } from '@/services/subscriptionGate';
import { Colors, PriorityColors, StatusColors } from '@/constants/theme';
import DashboardChat from '@/components/DashboardChat';
import { quickCompleteTask, calculateHealthScore } from '@/services/utils';
import { ImageViewer } from '@/components/ImageViewer';
import { showToast } from '@/components/Toast';
import { getTasks, createTasks, getHomeJoinRequests, approveHomeJoinRequest, denyHomeJoinRequest, getNotifications, markNotificationRead } from '@/services/supabase';
import { fetchWeather } from '@/services/weather';
import { Skeleton } from '@/components/Skeleton';
import { HealthGauge } from '@/components/HealthGauge';
import { generateTasksForHome, getDisplayStatus } from '@/services/taskEngine';
import { generateWeatherInsights } from '@/services/weatherInsights';
import { WeatherInsightCards } from '@/components/WeatherInsightCards';
import { geocodeAddress } from '@/services/geocoding';
import { upsertHome } from '@/services/supabase';
import { CanopyLogo, NavWeather, NavHome } from '@/components/icons/CanopyLogo';
import { generateCostForecast, FORECAST_DISCLAIMER } from '@/services/costForecast';
import PendingInvites from '@/components/PendingInvites';
import SetupChecklist from '@/components/SetupChecklist';
import RecallAlertBanner from '@/components/RecallAlertBanner';
import { getDocuments, getHomeMembers } from '@/services/supabase';
import type { MaintenanceTask, HomeJoinRequest } from '@/types';
import { TASK_TEMPLATES } from '@/constants/maintenance';

const DEMO_TASKS = [
  { id: 'd1', home_id: '1', title: 'Replace HVAC Air Filters', description: 'Check and replace monthly.', category: 'hvac' as const, priority: 'high' as const, status: 'due' as const, frequency: 'monthly' as const, due_date: new Date().toISOString(), is_weather_triggered: false, applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], estimated_minutes: 10, created_at: '' },
  { id: 'd2', home_id: '1', title: 'Clean Gutters (Spring)', description: 'Remove debris and check drainage.', category: 'roof' as const, priority: 'medium' as const, status: 'upcoming' as const, frequency: 'biannual' as const, due_date: new Date(Date.now() + 7*86400000).toISOString(), is_weather_triggered: false, applicable_months: [4,5], estimated_minutes: 60, created_at: '' },
  { id: 'd3', home_id: '1', title: 'Test Smoke & CO Detectors', description: 'Press test button on every detector.', category: 'safety' as const, priority: 'high' as const, status: 'upcoming' as const, frequency: 'monthly' as const, due_date: new Date(Date.now() + 3*86400000).toISOString(), is_weather_triggered: false, applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], estimated_minutes: 10, created_at: '' },
];

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

  // Load inspection-doc count + household member count for the SetupChecklist.
  const [inspectionCount, setInspectionCount] = useState(0);
  const [memberCount, setMemberCount] = useState(1);
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
  }, [home?.id]);

  // Redirect new users who haven't set up their home yet
  useEffect(() => {
    if (user && !user.onboarding_complete && !home) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, home, navigate]);

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
              console.warn('Failed to persist generated tasks:', saveErr);
              setTasks(generated); // still show locally
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

  // Fetch weather when home has coordinates and user has weather access
  useEffect(() => {
    if (home && home.latitude && home.longitude && canAccess(tier, 'weather_alerts')) {
      const loadWeather = async () => {
        try {
          setWeatherLoading(true);
          setWeatherError(null);
          const weatherData = await fetchWeather(home.latitude!, home.longitude!);
          setWeather(weatherData);
        } catch (error) {
          console.error('Failed to fetch weather:', error);
          setWeatherError('Unable to load weather data');
        } finally {
          setWeatherLoading(false);
        }
      };
      loadWeather();
    }
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
  const displayTasks = isDemo ? DEMO_TASKS : tasks.map(t => ({ ...t, status: getDisplayStatus(t) }));
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

  // Get current season
  const getSeason = (): string => {
    const month = now.getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  };

  const now = new Date();
  const currentMonth = now.toLocaleString('default', { month: 'long' });
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const healthData = useMemo(() => calculateHealthScore(tasks), [tasks]);
  const { score: healthScore, completedCount, totalCount, overdueCount, label: healthLabel } = healthData;

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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <p className="text-sm text-gray">{greeting}</p>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>{user?.full_name || 'Homeowner'}</h1>
        </div>
        <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
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

      {/* Post-onboarding setup checklist */}
      <SetupChecklist
        home={home}
        equipment={equipment}
        inspectionCount={inspectionCount}
        householdMemberCount={memberCount}
      />

      <div className="dashboard-layout">
        <div className="flex-col gap-lg">
          {/* Weather */}
          {hasWeather ? (
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
          ) : (
            <div
              className="card"
              style={{
                background: 'var(--color-background)',
                borderLeft: `4px solid ${Colors.sage}`,
                cursor: 'pointer',
                opacity: 0.85,
              }}
              onClick={() => navigate('/subscription')}
            >
              <div className="flex items-center gap-md">
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: Colors.sageMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}>
                  🔒
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>
                    {displayWeather.alerts && displayWeather.alerts.length > 0 ? `${displayWeather.alerts.length} weather alerts` : 'Weather Alerts'}
                  </p>
                  <p className="text-sm text-gray">Weather alerts available. Upgrade to Home.</p>
                </div>
              </div>
            </div>
          )}

          {/* Weather Insights (Smart Weather-to-Task Scheduling) */}
          {hasWeather && weather && weather.forecast && weather.forecast.length > 0 && tier !== 'free' && (
            <WeatherInsightCards insights={generateWeatherInsights(weather.forecast, displayTasks)} />
          )}

          {/* Health Score Gauge */}
          <div className="card card-elevated">
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <HealthGauge score={healthScore} size={100} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Home Health Score</p>
                <p className="text-sm" style={{ color: healthData.color === 'green' ? Colors.success : healthData.color === 'yellow' ? '#FF9800' : Colors.error, fontWeight: 600, marginBottom: 8 }}>{healthLabel}</p>
                <p className="text-sm" style={{ color: Colors.charcoal }}>
                  <strong>{completedCount}</strong> of <strong>{totalCount}</strong> {currentMonth} tasks complete
                </p>
                {overdueCount > 0 && (
                  <p className="text-xs mt-xs" style={{ color: Colors.error }}>
                    {overdueCount} overdue task{overdueCount > 1 ? 's' : ''} — complete or skip to improve your score
                  </p>
                )}
                <p className="text-xs text-gray mt-sm">
                  {totalCount === 0
                    ? 'Set up your home to generate maintenance tasks'
                    : totalCount > completedCount
                    ? `Complete ${totalCount - completedCount} more task${totalCount - completedCount > 1 ? 's' : ''} this month to keep your score strong`
                    : 'All caught up this month — great work!'}
                </p>
              </div>
            </div>
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-md">
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Due This Month</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/calendar')}>See All &rarr;</button>
            </div>
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
                        {(() => { const st = SERVICE_TYPE_MAP.get(task.template_id || ''); const badge = st ? SERVICE_BADGE_STYLES[st] : undefined; return badge ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>{badge.label}</span> : null; })()}
                      </div>
                      <div className="task-meta">
                        {task.category} &middot; ~{task.estimated_minutes || '?'} min &middot; {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="task-actions">
                      <span className="badge" style={{ background: (StatusColors[task.status] || Colors.silver) + '20', color: StatusColors[task.status] || Colors.silver }}>{task.status}</span>
                      {task.status !== 'completed' && !isDemo && (
                        <button className="btn btn-sage btn-sm" onClick={(e) => { e.stopPropagation(); quickCompleteTask(task).catch(() => {}); }}>Done</button>
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
              {tasksToShow.length === 0 && (
                <div className="empty-state"><div className="icon" style={{ color: Colors.success, fontSize: 40, fontWeight: 700 }}>&#10003;</div><h3>All caught up!</h3><p>No tasks due this month.</p></div>
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
            <div className="card card-clickable" style={{ textAlign: 'center', padding: 32, border: '2px dashed var(--color-copper)', cursor: 'pointer' }} onClick={() => navigate('/home')}>
              <NavHome size={28} />
              <p className="text-sm text-copper fw-600 mt-sm">{home ? 'Add a photo of your home' : 'Set up your home'}</p>
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

          {/* Document Vault Teaser (Free Tier) */}
          {tier === 'free' && (
            <div
              className="card"
              style={{
                background: 'var(--color-background)',
                borderLeft: `4px solid ${Colors.sage}`,
                cursor: 'pointer',
                opacity: 0.9,
              }}
              onClick={() => navigate('/subscription')}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 24, marginTop: 2 }}>🔒</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>Secure Document Vault</p>
                  <p className="text-xs text-gray" style={{ marginBottom: 8 }}>Store warranties, receipts, and insurance docs</p>
                  <button
                    style={{
                      fontSize: 11,
                      color: Colors.sage,
                      background: 'transparent',
                      border: `1px solid ${Colors.sage}`,
                      borderRadius: 3,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Learn More
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Seasonal Recommendations Teaser (Free Tier) */}
          {tier === 'free' && (
            <div
              className="card"
              style={{
                background: 'var(--color-background)',
                borderLeft: `4px solid ${Colors.copper}`,
                cursor: 'pointer',
                opacity: 0.9,
              }}
              onClick={() => navigate('/subscription')}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 24, marginTop: 2 }}>🌿</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>{getSeason()} Maintenance</p>
                  <p className="text-xs text-gray" style={{ marginBottom: 8 }}>4 tasks recommended for your home</p>
                  <button
                    style={{
                      fontSize: 11,
                      color: Colors.copper,
                      background: 'transparent',
                      border: `1px solid ${Colors.copper}`,
                      borderRadius: 3,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Upgrade to see
                  </button>
                </div>
              </div>
            </div>
          )}

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
