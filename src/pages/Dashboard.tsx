import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { canAccess, getTaskLimit, PLANS } from '@/services/subscriptionGate';
import { Colors, PriorityColors, StatusColors } from '@/constants/theme';
import { quickCompleteTask } from '@/services/utils';
import { getTasks, createTasks } from '@/services/supabase';
import { fetchWeather } from '@/services/weather';
import { Skeleton } from '@/components/Skeleton';
import { HealthGauge } from '@/components/HealthGauge';
import { generateTasksForHome, getDisplayStatus } from '@/services/taskEngine';
import { geocodeAddress } from '@/services/geocoding';
import { upsertHome } from '@/services/supabase';
import { CanopyLogo, NavWeather, NavHome } from '@/components/icons/CanopyLogo';
import type { MaintenanceTask } from '@/types';

const DEMO_TASKS = [
  { id: 'd1', home_id: '1', title: 'Replace HVAC Air Filters', description: 'Check and replace monthly.', category: 'hvac' as const, priority: 'high' as const, status: 'due' as const, frequency: 'monthly' as const, due_date: new Date().toISOString(), is_weather_triggered: false, applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], estimated_minutes: 10, created_at: '' },
  { id: 'd2', home_id: '1', title: 'Clean Gutters (Spring)', description: 'Remove debris and check drainage.', category: 'roof' as const, priority: 'medium' as const, status: 'upcoming' as const, frequency: 'biannual' as const, due_date: new Date(Date.now() + 7*86400000).toISOString(), is_weather_triggered: false, applicable_months: [4,5], estimated_minutes: 60, created_at: '' },
  { id: 'd3', home_id: '1', title: 'Test Smoke & CO Detectors', description: 'Press test button on every detector.', category: 'safety' as const, priority: 'high' as const, status: 'upcoming' as const, frequency: 'monthly' as const, due_date: new Date(Date.now() + 3*86400000).toISOString(), is_weather_triggered: false, applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], estimated_minutes: 10, created_at: '' },
];

const DEMO_WEATHER = { temperature: 72, feels_like: 74, humidity: 55, wind_speed: 8, description: 'partly cloudy', icon: '02d', high: 78, low: 58, alerts: [], forecast: [] };

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, home, weather, tasks, equipment, setWeather, setTasks } = useStore();
  const tier = user?.subscription_tier || 'free';
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);

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
          const generated = generateTasksForHome(home, equipment, []);
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
  const hasWeather = canAccess(tier, 'weather_alerts');
  const hasAI = canAccess(tier, 'ai_task_generation');
  const taskLimit = getTaskLimit(tier);

  const isDemo = tasks.length === 0;
  const displayTasks = isDemo ? DEMO_TASKS : tasks.map(t => ({ ...t, status: getDisplayStatus(t) }));
  const tasksToShow = taskLimit ? displayTasks.slice(0, taskLimit) : displayTasks;
  const displayWeather = weather || DEMO_WEATHER;

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const { healthScore, completedCount, totalCount } = useMemo(() => {
    const monthTasks = tasksToShow.filter(t => { const d = new Date(t.due_date); return d >= monthStart && d <= monthEnd; });
    const completed = monthTasks.filter(t => t.status === 'completed').length;
    return { healthScore: monthTasks.length > 0 ? Math.round((completed / monthTasks.length) * 100) : 0, completedCount: completed, totalCount: monthTasks.length };
  }, [tasks, tier]);

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

      <div className="dashboard-layout">
        <div className="flex-col gap-lg">
          {/* Weather */}
          {hasWeather ? (
            <div
              className="card"
              style={{ background: `linear-gradient(135deg, ${Colors.sage}20, ${Colors.cream})`, cursor: 'pointer' }}
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
                  <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 8 }}>Please add home coordinates in settings</p>
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
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#E5393520', borderRadius: 8, fontSize: 13, color: '#C62828' }}>
                      Warning: {displayWeather.alerts.length} active weather alert{displayWeather.alerts.length > 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="card" style={{ background: Colors.copperMuted, borderLeft: `4px solid ${Colors.copper}` }}>
              <div className="flex items-center gap-md">
                <div style={{ width: 48, height: 48, borderRadius: 12, background: Colors.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><NavWeather size={24} /></div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600 }}>Weather Alerts</p>
                  <p className="text-sm text-gray">Upgrade to get actionable weather alerts</p>
                </div>
              </div>
              <button className="btn btn-primary mt-md" onClick={() => navigate('/subscription')}>Upgrade to Home</button>
            </div>
          )}

          {/* Health Score Gauge */}
          <div className="card card-elevated">
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <HealthGauge score={healthScore} size={100} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Home Health Score</p>
                <p className="text-sm text-gray" style={{ marginBottom: 8 }}>{currentMonth} maintenance progress</p>
                <p className="text-sm" style={{ color: Colors.charcoal }}>
                  <strong>{completedCount}</strong> of <strong>{totalCount}</strong> tasks complete
                </p>
                <p className="text-xs text-gray mt-sm">
                  {totalCount > completedCount
                    ? `Complete ${totalCount - completedCount} more task${totalCount - completedCount > 1 ? 's' : ''} to improve your score`
                    : 'Great job! All tasks complete this month'}
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
                      <div className="task-title">{task.title}</div>
                      <div className="task-meta">
                        {task.category} &middot; ~{task.estimated_minutes || '?'} min &middot; {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="task-actions">
                      <span className="badge" style={{ background: (StatusColors[task.status] || Colors.silver) + '20', color: StatusColors[task.status] || Colors.silver }}>{task.status}</span>
                      {task.status !== 'completed' && !isDemo && (
                        <button className="btn btn-sage btn-sm" onClick={(e) => { e.stopPropagation(); quickCompleteTask(task); }}>Done</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
            <div className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate('/home')}>
              <img src={home.photo_url} alt="Home" style={{ width: '100%', height: 180, objectFit: 'cover' }} />
              <div style={{ padding: '12px 16px' }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{home.address}</p>
                <p className="text-xs text-gray">{home.city}, {home.state}</p>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 32, border: '2px dashed var(--light-gray)', cursor: 'pointer' }} onClick={() => navigate('/home')}>
              <NavHome size={28} />
              <p className="text-sm text-copper fw-600 mt-sm">{home ? 'Add a photo of your home' : 'Set up your home'}</p>
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
                { label: 'Maintenance Log', route: '/logs', free: true },
                { label: 'Request Pro', route: '/pro-request', free: false },
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
                    {a.label} {locked ? <span style={{ fontSize: 11, color: Colors.copper, marginLeft: 'auto' }}>Upgrade</span> : <span style={{ marginLeft: 'auto' }}>&rarr;</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subscription */}
          <div className="card" style={{ background: Colors.copperMuted }}>
            <p className="text-xs fw-600 text-copper mb-sm">YOUR PLAN</p>
            <p style={{ fontWeight: 700 }}>{PLANS.find(p => p.value === tier)?.name || 'Free'}</p>
            <p className="text-sm text-gray">{(PLANS.find(p => p.value === tier) as any)?.inquireForPricing ? 'Concierge Plan' : `$${PLANS.find(p => p.value === tier)?.price || 0}${PLANS.find(p => p.value === tier)?.period}`}</p>
            {tier === 'free' && <button className="btn btn-primary btn-sm mt-md" onClick={() => navigate('/subscription')}>Upgrade</button>}
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

          {/* Emergency Info Quick Access */}
          <div className="card" style={{ borderLeft: `4px solid ${Colors.error}` }}>
            <div className="flex items-center justify-between mb-sm">
              <p style={{ fontWeight: 600 }}>Emergency Info</p>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/home')}>Edit &rarr;</button>
            </div>
            {home?.water_shutoff_location || home?.main_breaker_location || home?.gas_meter_location ? (
              <div className="flex-col gap-sm">
                {home.water_shutoff_location && (
                  <div className="flex items-center gap-sm">
                    <span style={{ fontSize: 14 }}>💧</span>
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
                    <span style={{ fontSize: 14 }}>🔥</span>
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
                <button className="btn btn-ghost btn-sm mt-sm" style={{ color: Colors.copper }} onClick={() => navigate('/home')}>
                  Add Locations
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
