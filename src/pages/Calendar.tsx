import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { PriorityColors, StatusColors, Colors } from '@/constants/theme';
import { quickCompleteTask, quickSkipTask, quickSnoozeTask } from '@/services/utils';
import { getTasks, reopenTask as reopenTaskApi } from '@/services/supabase';
import { getDisplayStatus } from '@/services/taskEngine';
import { supabase } from '@/services/supabase';
import type { MaintenanceTask, ProMonthlyVisit } from '@/types';

const MaintenanceLogs = lazy(() => import('@/pages/MaintenanceLogs'));

type CalendarTab = 'calendar' | 'log';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DEMO_TASKS: MaintenanceTask[] = [
  { id: 'd1', home_id: '1', title: 'Replace HVAC Air Filters', description: 'Check and replace monthly.', category: 'hvac' as const, priority: 'high' as const, status: 'due' as const, frequency: 'monthly' as const, due_date: new Date().toISOString(), is_weather_triggered: false, applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], estimated_minutes: 10, created_at: '' },
  { id: 'd2', home_id: '1', title: 'Clean Gutters (Spring)', description: 'Remove debris and check drainage.', category: 'roof' as const, priority: 'medium' as const, status: 'upcoming' as const, frequency: 'biannual' as const, due_date: new Date(Date.now() + 7*86400000).toISOString(), is_weather_triggered: false, applicable_months: [4,5], estimated_minutes: 60, created_at: '' },
  { id: 'd3', home_id: '1', title: 'Test Smoke & CO Detectors', description: 'Press test button on every detector.', category: 'safety' as const, priority: 'high' as const, status: 'upcoming' as const, frequency: 'monthly' as const, due_date: new Date(Date.now() + 3*86400000).toISOString(), is_weather_triggered: false, applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], estimated_minutes: 10, created_at: '' },
];

export default function Calendar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { home, tasks: storeTasks, setTasks, reopenTask } = useStore();
  const isDemo = storeTasks.length === 0;
  const [activeTab, setActiveTab] = useState<CalendarTab>(
    searchParams.get('tab') === 'log' ? 'log' : 'calendar'
  );
  const tasks = isDemo ? DEMO_TASKS : storeTasks;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);
  const [visits, setVisits] = useState<ProMonthlyVisit[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Fetch tasks on mount if not already loaded
  useEffect(() => {
    const loadTasks = async () => {
      if (!storeTasks.length && home) {
        try {
          setLoading(true);
          const data = await getTasks(home.id);
          if (data) setTasks(data);
        } catch (err) {
          console.warn('Failed to fetch tasks:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    loadTasks();
  }, [home?.id]);

  // Fetch pro visits for the homeowner
  useEffect(() => {
    const loadVisits = async () => {
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (!authUser?.user) return;
        const { data, error } = await supabase
          .from('pro_monthly_visits')
          .select('*, provider:pro_providers(business_name, contact_name)')
          .eq('homeowner_id', authUser.user.id)
          .in('status', ['proposed', 'confirmed', 'in_progress', 'completed'])
          .order('confirmed_date', { ascending: true });
        if (!error && data) setVisits(data);
      } catch (err) {
        console.warn('Failed to fetch visits:', err);
      }
    };
    loadVisits();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Reset selectedDate when navigating to a different month
  useEffect(() => {
    setSelectedDate(null);
    setFilter('all');
  }, [month, year]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const days: { date: number; month: number; year: number; key: string }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) days.push({ date: daysInPrev - i, month: month - 1, year, key: `p${i}` });
    for (let i = 1; i <= daysInMonth; i++) days.push({ date: i, month, year, key: `c${i}` });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push({ date: i, month: month + 1, year, key: `n${i}` });
    return days;
  }, [year, month]);

  // Enrich tasks with computed display status (auto-calculates overdue/due/upcoming)
  const enrichedTasks = useMemo(() => {
    return tasks.map(t => ({ ...t, status: getDisplayStatus(t) }));
  }, [tasks]);

  // Map visits into a calendar-friendly shape
  type CalendarEvent = { type: 'task'; data: MaintenanceTask } | { type: 'visit'; data: ProMonthlyVisit };

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    enrichedTasks.forEach(t => {
      const d = new Date(t.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push({ type: 'task', data: t });
    });
    visits.forEach(v => {
      const dateStr = v.confirmed_date || v.proposed_date;
      if (!dateStr) return;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push({ type: 'visit', data: v });
    });
    return map;
  }, [enrichedTasks, visits]);

  // Keep tasksByDate for backwards compat
  const tasksByDate = useMemo(() => {
    const map: Record<string, MaintenanceTask[]> = {};
    enrichedTasks.forEach(t => {
      const d = new Date(t.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [enrichedTasks]);

  // All tasks for the current month, sorted by due date
  const monthTasks = useMemo(() => {
    return enrichedTasks
      .filter(t => {
        const d = new Date(t.due_date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [enrichedTasks, month, year]);

  // Visits for the current month
  const monthVisits = useMemo(() => {
    return visits.filter(v => {
      const dateStr = v.confirmed_date || v.proposed_date;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a, b) => {
      const da = new Date(a.confirmed_date || a.proposed_date || '');
      const db = new Date(b.confirmed_date || b.proposed_date || '');
      return da.getTime() - db.getTime();
    });
  }, [visits, month, year]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Show selected day's tasks OR all month tasks
  const displayTasks = selectedDate ? (tasksByDate[selectedDate] || []) : monthTasks;
  const displayVisits = selectedDate
    ? visits.filter(v => {
        const dateStr = v.confirmed_date || v.proposed_date;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === selectedDate;
      })
    : monthVisits;
  const filteredTasks = (filter === 'all' || filter === 'visits' ? displayTasks : displayTasks.filter(t => t.status === filter))
    .filter(t => {
      if (!searchTerm.trim()) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        t.title.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower))
      );
    });
  const showVisits = filter === 'all' || filter === 'visits';

  const nav = (dir: number) => setCurrentDate(new Date(year, month + dir, 1));

  const handleQuickReopen = async (task: MaintenanceTask) => {
    try {
      reopenTask(task.id);
      try {
        await reopenTaskApi(task.id);
      } catch (err) {
        console.warn('Reopen API call failed:', err);
      }
    } catch (error) {
      console.error('Error reopening task:', error);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelected = new Set(selectedTaskIds);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTaskIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleBulkMarkComplete = async () => {
    if (selectedTaskIds.size === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    try {
      const tasksToComplete = filteredTasks.filter(t => selectedTaskIds.has(t.id));
      await Promise.all(tasksToComplete.map(t => quickCompleteTask(t)));
      setSelectedTaskIds(new Set());
      setSelectMode(false);
    } catch (error) {
      console.error('Error bulk completing tasks:', error);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDayClick = (key: string) => {
    if (selectedDate === key) {
      // Clicking same day again clears selection (back to month view)
      setSelectedDate(null);
    } else {
      setSelectedDate(key);
    }
  };

  // Count tasks by status for the month
  const monthStats = useMemo(() => {
    const total = monthTasks.length;
    const completed = monthTasks.filter(t => t.status === 'completed').length;
    const overdue = monthTasks.filter(t => t.status === 'overdue').length;
    const upcoming = monthTasks.filter(t => t.status === 'upcoming' || t.status === 'due').length;
    const visitCount = monthVisits.length;
    return { total, completed, overdue, upcoming, visitCount };
  }, [monthTasks, monthVisits]);

  const calendarTabs: { key: CalendarTab; label: string }[] = [
    { key: 'calendar', label: 'Calendar' },
    { key: 'log', label: 'Maintenance Log' },
  ];

  // If Maintenance Log tab is active, render that instead
  if (activeTab === 'log') {
    return (
      <div className="page">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Calendar</h1>
            <p className="subtitle">Tasks, visits & maintenance history</p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, whiteSpace: 'nowrap',
            }}
            onClick={() => navigate('/task/create')}
          >
            + New Task
          </button>
        </div>
        <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid var(--color-cream)`, marginBottom: 24 }}>
          {calendarTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: activeTab === t.key ? 700 : 500,
                color: activeTab === t.key ? 'var(--color-sage)' : 'var(--color-text-secondary)',
                background: 'none',
                border: 'none',
                borderBottomWidth: 3,
                borderBottomStyle: 'solid',
                borderBottomColor: activeTab === t.key ? 'var(--color-sage)' : 'transparent',
                cursor: 'pointer',
                marginBottom: -2,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Suspense fallback={<p style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>}>
          <MaintenanceLogs />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Calendar</h1>
          <p className="subtitle">Tasks, visits & maintenance history</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!selectMode && (
            <button
              className="btn btn-ghost btn-sm"
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                borderRadius: 8, whiteSpace: 'nowrap',
              }}
              onClick={() => setSelectMode(true)}
            >
              Select
            </button>
          )}
          {selectMode && (
            <button
              className="btn btn-ghost btn-sm"
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                borderRadius: 8, whiteSpace: 'nowrap',
              }}
              onClick={() => {
                setSelectMode(false);
                setSelectedTaskIds(new Set());
              }}
            >
              Done
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              borderRadius: 8, whiteSpace: 'nowrap',
            }}
            onClick={() => navigate('/task/create')}
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid var(--color-cream)`, marginBottom: 24 }}>
        {calendarTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: activeTab === t.key ? 700 : 500,
              color: activeTab === t.key ? Colors.sage : Colors.medGray,
              background: 'none',
              border: 'none',
              borderBottomWidth: 3,
              borderBottomStyle: 'solid',
              borderBottomColor: activeTab === t.key ? Colors.sage : 'transparent',
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Monthly Summary Stats */}
      <div className="card mb-md">
        <div className="flex gap-lg items-center" style={{ flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{monthStats.total}</p>
            <p className="text-xs text-gray">Tasks This Month</p>
          </div>
          <div>
            <p style={{ fontSize: 28, fontWeight: 700, color: Colors.success, lineHeight: 1 }}>{monthStats.completed}</p>
            <p className="text-xs text-gray">Completed</p>
          </div>
          <div>
            <p style={{ fontSize: 28, fontWeight: 700, color: Colors.warning, lineHeight: 1 }}>{monthStats.upcoming}</p>
            <p className="text-xs text-gray">Due / Upcoming</p>
          </div>
          {monthStats.overdue > 0 && (
            <div>
              <p style={{ fontSize: 28, fontWeight: 700, color: Colors.error, lineHeight: 1 }}>{monthStats.overdue}</p>
              <p className="text-xs text-gray">Overdue</p>
            </div>
          )}
          {monthStats.visitCount > 0 && (
            <div>
              <p style={{ fontSize: 28, fontWeight: 700, color: Colors.sage, lineHeight: 1 }}>{monthStats.visitCount}</p>
              <p className="text-xs text-gray">Pro Visits</p>
            </div>
          )}
        </div>
      </div>

      <div className="calendar-layout">
        {/* Calendar Grid */}
        <div className="card">
          <div className="flex items-center justify-between mb-lg">
            <button className="btn btn-ghost" onClick={() => nav(-1)}>&larr;</button>
            <div className="flex items-center gap-sm">
              <h2 style={{ fontSize: 18 }}>{MONTHS[month]} {year}</h2>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => { setCurrentDate(new Date()); setSelectedDate(todayKey); }}>Today</button>
            </div>
            <button className="btn btn-ghost" onClick={() => nav(1)}>&rarr;</button>
          </div>
          <div className="calendar-grid">
            {DAYS.map(d => <div key={d} className="calendar-header">{d}</div>)}
            {calendarDays.map(day => {
              const key = `${day.year}-${day.month}-${day.date}`;
              const isToday = key === todayKey;
              const isOther = day.month !== month;
              const dayEvents = eventsByDate[key] || [];
              const dayTasks = dayEvents.filter(e => e.type === 'task').map(e => e.data as MaintenanceTask);
              const dayVisits = dayEvents.filter(e => e.type === 'visit').map(e => e.data as ProMonthlyVisit);
              const hasEvents = dayEvents.length > 0;
              const isSelected = selectedDate === key;
              return (
                <div
                  key={day.key}
                  className={`calendar-day ${isToday ? 'today' : ''} ${isOther ? 'other-month' : ''} ${hasEvents ? 'has-tasks' : ''}`}
                  style={{
                    ...(isSelected ? { background: 'var(--color-copper)30', fontWeight: 700 } : undefined),
                    position: 'relative',
                  }}
                  onClick={() => handleDayClick(key)}
                >
                  {day.date}
                  {hasEvents && (
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', position: 'absolute', bottom: 2, left: 0, right: 0 }}>
                      {/* Show visit indicator first (sage diamond) */}
                      {dayVisits.length > 0 && (
                        <div style={{
                          width: 7, height: 7, borderRadius: 1,
                          background: 'var(--color-sage)',
                          transform: 'rotate(45deg)',
                        }} />
                      )}
                      {/* Then task dots */}
                      {dayTasks.slice(0, dayVisits.length > 0 ? 2 : 3).map((t) => (
                        <div key={t.id} style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: t.status === 'completed' ? 'var(--color-success)' :
                                     t.status === 'overdue' ? 'var(--color-error)' :
                                     PriorityColors[t.priority] || 'var(--color-copper)',
                        }} />
                      ))}
                      {dayEvents.length > 3 && (
                        <span style={{ fontSize: 8, color: 'var(--color-text-secondary)', lineHeight: '5px' }}>+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-col gap-md">
          {loading ? (
            <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
              <p className="text-sm text-gray">Loading tasks...</p>
            </div>
          ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="flex items-center justify-between mb-sm">
              <p style={{ fontWeight: 600 }}>
                {selectedDate
                  ? `Tasks for ${new Date(parseInt(selectedDate.split('-')[0]), parseInt(selectedDate.split('-')[1]), parseInt(selectedDate.split('-')[2])).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
                  : `All ${MONTHS[month]} Tasks`
                }
              </p>
              {selectedDate && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setSelectedDate(null)}>
                  View All Month
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search tasks by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingRight: searchTerm ? 36 : undefined }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 18,
                    color: 'var(--color-text-secondary)',
                    padding: '4px 8px',
                  }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Tabs + Select All Option */}
            <div className="tabs" style={{ marginBottom: 16, overflowX: 'auto', flexWrap: 'nowrap', display: 'flex', alignItems: 'center' }}>
              {selectMode && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', marginRight: 8, cursor: 'pointer', borderRadius: 4, background: 'var(--color-cream)' }}>
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13 }}>All</span>
                </label>
              )}
              {['all', 'due', 'upcoming', 'completed', 'overdue', ...(visits.length > 0 ? ['visits'] : [])].map(f => (
                <button key={f} className={`tab ${filter === f ? 'active' : ''}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== 'all' && (
                    <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>
                      ({f === 'visits' ? displayVisits.length : displayTasks.filter(t => t.status === f).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-col gap-sm" style={{ maxHeight: 500, overflowY: 'auto' }}>
              {/* Pro Visit Cards */}
              {showVisits && displayVisits.map(visit => {
                const visitDate = new Date(visit.confirmed_date || visit.proposed_date || '');
                const provider = (visit as any).provider;
                const visitStatusColor = visit.status === 'completed' ? Colors.success
                  : visit.status === 'in_progress' ? Colors.copper
                  : visit.status === 'confirmed' ? Colors.sage
                  : Colors.medGray;
                return (
                  <div key={visit.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
                    <div className="flex items-center gap-md">
                      <div style={{ width: 4, height: 40, borderRadius: 2, background: 'var(--color-sage)' }} />
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'var(--color-sage)20', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0,
                      }}>
                        &#128736;
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigate('/visits')}>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>Pro Home Visit</p>
                        <p className="text-xs text-gray">
                          {provider?.business_name || 'Canopy Tech'}
                          {!selectedDate && (
                            <span> &middot; {visitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                          {visit.proposed_time_slot && <span> &middot; {visit.proposed_time_slot}</span>}
                        </p>
                      </div>
                      <span className="badge" style={{ background: `${visitStatusColor}20`, color: visitStatusColor }}>
                        {visit.status === 'proposed' ? 'proposed' : visit.status}
                      </span>
                    </div>
                    {visit.status === 'proposed' && (
                      <div className="flex gap-sm mt-sm" style={{ marginLeft: 48 }}>
                        <button className="btn btn-sage btn-sm" onClick={async () => {
                          try {
                            await supabase.from('pro_monthly_visits').update({ status: 'confirmed', homeowner_confirmed_at: new Date().toISOString() }).eq('id', visit.id);
                            setVisits(prev => prev.map(v => v.id === visit.id ? { ...v, status: 'confirmed' as const } : v));
                          } catch (err) { console.error(err); }
                        }}>Confirm</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/visits')}>Reschedule</button>
                      </div>
                    )}
                    {visit.status === 'completed' && visit.pro_notes && (
                      <p className="text-xs text-gray" style={{ marginLeft: 48, marginTop: 4 }}>
                        {visit.pro_notes.slice(0, 100)}{visit.pro_notes.length > 100 ? '...' : ''}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Task Cards */}
              {(filter !== 'visits') && filteredTasks.map(task => {
                const dueDate = new Date(task.due_date);
                const isSelected = selectedTaskIds.has(task.id);
                return (
                  <div key={task.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)', background: isSelected ? 'var(--color-copper)15' : 'transparent' }}>
                    <div className="flex items-center gap-md">
                      {selectMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTaskSelection(task.id)}
                          style={{ cursor: 'pointer', flexShrink: 0 }}
                        />
                      )}
                      <div style={{ width: 4, height: 40, borderRadius: 2, background: PriorityColors[task.priority] }} />
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', cursor: selectMode ? 'default' : 'pointer' }} onClick={() => !isDemo && !selectMode && navigate(`/task/${task.id}`)}>
                        <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                        <p className="text-xs text-gray">
                          {task.category} &middot; ~{task.estimated_minutes || '?'} min
                          {!selectedDate && (
                            <span> &middot; {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                        </p>
                      </div>
                      <span className="badge" style={{ background: `${StatusColors[task.status] || '#ccc'}20`, color: StatusColors[task.status] }}>{task.status}</span>
                    </div>
                    {!selectMode && task.status !== 'completed' && task.status !== 'skipped' && !isDemo && (
                      <div className="flex gap-sm mt-sm" style={{ marginLeft: 20, position: 'relative' }}>
                        <button className="btn btn-sm" style={{ background: 'var(--color-sage)', color: '#fff', border: 'none' }} onClick={() => quickCompleteTask(task)}>Complete</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSnoozeMenuId(snoozeMenuId === task.id ? null : task.id)}>Snooze</button>
                        {snoozeMenuId === task.id && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 60, zIndex: 20,
                            background: 'var(--color-card-background)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                            padding: '4px 0', marginTop: 4, minWidth: 140,
                          }}>
                            {[
                              { label: '3 days', days: 3 },
                              { label: '1 week', days: 7 },
                              { label: '2 weeks', days: 14 },
                              { label: '1 month', days: 30 },
                            ].map(opt => (
                              <button key={opt.days} onClick={() => { quickSnoozeTask(task, opt.days); setSnoozeMenuId(null); }}
                                style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', background: 'none',
                                  textAlign: 'left', fontSize: 13, cursor: 'pointer', color: 'var(--color-charcoal)' }}
                                onMouseOver={e => (e.currentTarget.style.background = 'var(--color-background)')}
                                onMouseOut={e => (e.currentTarget.style.background = 'none')}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => quickSkipTask(task)}>Skip</button>
                      </div>
                    )}
                    {!selectMode && task.status === 'completed' && !isDemo && (
                      <div className="flex gap-sm mt-sm" style={{ marginLeft: 20 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleQuickReopen(task)} style={{ borderColor: 'var(--color-copper)', color: 'var(--color-copper)' }}>Reopen</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredTasks.length === 0 && displayVisits.length === 0 && (
                <p className="text-center" style={{ padding: 24, color: 'var(--color-text-secondary)', fontSize: 14 }}>
                  {selectedDate ? 'No tasks or visits for this date' : `No ${filter === 'all' ? '' : filter + ' '}tasks this month`}
                </p>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Floating Action Bar for Bulk Actions */}
      {selectMode && selectedTaskIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, left: 20, maxWidth: 600,
          background: 'var(--color-charcoal)', color: 'var(--color-white)',
          padding: '16px 20px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          zIndex: 50,
        }}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>
            {selectedTaskIds.size} selected
          </p>
          <button
            className="btn btn-sage btn-sm"
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6 }}
            onClick={handleBulkMarkComplete}
            disabled={bulkProcessing}
          >
            {bulkProcessing ? 'Completing...' : 'Mark Complete'}
          </button>
        </div>
      )}
    </div>
  );
}
