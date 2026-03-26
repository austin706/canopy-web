import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { PriorityColors, StatusColors, Colors } from '@/constants/theme';
import { quickCompleteTask, quickSkipTask, quickSnoozeTask } from '@/services/utils';
import { getTasks, reopenTask as reopenTaskApi } from '@/services/supabase';
import { getDisplayStatus } from '@/services/taskEngine';
import type { MaintenanceTask } from '@/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DEMO_TASKS: MaintenanceTask[] = [
  { id: 'd1', home_id: '1', title: 'Replace HVAC Air Filters', description: 'Check and replace monthly.', category: 'hvac' as const, priority: 'high' as const, status: 'due' as const, frequency: 'monthly' as const, due_date: new Date().toISOString(), is_weather_triggered: false, applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], estimated_minutes: 10, created_at: '' },
  { id: 'd2', home_id: '1', title: 'Clean Gutters (Spring)', description: 'Remove debris and check drainage.', category: 'roof' as const, priority: 'medium' as const, status: 'upcoming' as const, frequency: 'biannual' as const, due_date: new Date(Date.now() + 7*86400000).toISOString(), is_weather_triggered: false, applicable_months: [4,5], estimated_minutes: 60, created_at: '' },
  { id: 'd3', home_id: '1', title: 'Test Smoke & CO Detectors', description: 'Press test button on every detector.', category: 'safety' as const, priority: 'high' as const, status: 'upcoming' as const, frequency: 'monthly' as const, due_date: new Date(Date.now() + 3*86400000).toISOString(), is_weather_triggered: false, applicable_months: [1,2,3,4,5,6,7,8,9,10,11,12], estimated_minutes: 10, created_at: '' },
];

export default function Calendar() {
  const navigate = useNavigate();
  const { home, tasks: storeTasks, setTasks, reopenTask } = useStore();
  const isDemo = storeTasks.length === 0;
  const tasks = isDemo ? DEMO_TASKS : storeTasks;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);

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

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Show selected day's tasks OR all month tasks
  const displayTasks = selectedDate ? (tasksByDate[selectedDate] || []) : monthTasks;
  const filteredTasks = filter === 'all' ? displayTasks : displayTasks.filter(t => t.status === filter);

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
    return { total, completed, overdue, upcoming };
  }, [monthTasks]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p className="subtitle">Track and manage maintenance tasks</p>
        </div>
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
              const dayTasks = tasksByDate[key] || [];
              const hasTasks = dayTasks.length > 0;
              const isSelected = selectedDate === key;
              const hasOverdue = dayTasks.some(t => t.status === 'overdue');
              const hasHigh = dayTasks.some(t => t.priority === 'urgent' || t.priority === 'high');
              return (
                <div
                  key={day.key}
                  className={`calendar-day ${isToday ? 'today' : ''} ${isOther ? 'other-month' : ''} ${hasTasks ? 'has-tasks' : ''}`}
                  style={{
                    ...(isSelected ? { background: Colors.copper + '30', fontWeight: 700 } : undefined),
                    position: 'relative',
                  }}
                  onClick={() => handleDayClick(key)}
                >
                  {day.date}
                  {hasTasks && (
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', position: 'absolute', bottom: 2, left: 0, right: 0 }}>
                      {dayTasks.slice(0, 3).map((t, i) => (
                        <div key={i} style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: t.status === 'completed' ? Colors.success :
                                     t.status === 'overdue' ? Colors.error :
                                     PriorityColors[t.priority] || Colors.copper,
                        }} />
                      ))}
                      {dayTasks.length > 3 && (
                        <span style={{ fontSize: 8, color: Colors.medGray, lineHeight: '5px' }}>+{dayTasks.length - 3}</span>
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

            {/* Status Filter Tabs */}
            <div className="tabs" style={{ marginBottom: 16, overflowX: 'auto', flexWrap: 'nowrap' }}>
              {['all', 'due', 'upcoming', 'completed', 'overdue'].map(f => (
                <button key={f} className={`tab ${filter === f ? 'active' : ''}`} style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  {f !== 'all' && (
                    <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>
                      ({displayTasks.filter(t => t.status === f).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-col gap-sm" style={{ maxHeight: 500, overflowY: 'auto' }}>
              {filteredTasks.map(task => {
                const dueDate = new Date(task.due_date);
                return (
                  <div key={task.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
                    <div className="flex items-center gap-md">
                      <div style={{ width: 4, height: 40, borderRadius: 2, background: PriorityColors[task.priority] }} />
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => !isDemo && navigate(`/task/${task.id}`)}>
                        <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                        <p className="text-xs text-gray">
                          {task.category} &middot; ~{task.estimated_minutes || '?'} min
                          {!selectedDate && (
                            <span> &middot; {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          )}
                        </p>
                      </div>
                      <span className="badge" style={{ background: (StatusColors[task.status] || '#ccc') + '20', color: StatusColors[task.status] }}>{task.status}</span>
                    </div>
                    {task.status !== 'completed' && task.status !== 'skipped' && !isDemo && (
                      <div className="flex gap-sm mt-sm" style={{ marginLeft: 20, position: 'relative' }}>
                        <button className="btn btn-sage btn-sm" onClick={() => quickCompleteTask(task)}>Complete</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSnoozeMenuId(snoozeMenuId === task.id ? null : task.id)}>Snooze</button>
                        {snoozeMenuId === task.id && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 60, zIndex: 20,
                            background: 'white', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
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
                                  textAlign: 'left', fontSize: 13, cursor: 'pointer', color: Colors.charcoal }}
                                onMouseOver={e => (e.currentTarget.style.background = '#f5f5f5')}
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
                    {task.status === 'completed' && !isDemo && (
                      <div className="flex gap-sm mt-sm" style={{ marginLeft: 20 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleQuickReopen(task)} style={{ borderColor: Colors.copper, color: Colors.copper }}>Reopen</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredTasks.length === 0 && (
                <p className="text-sm text-gray text-center" style={{ padding: 24 }}>
                  {selectedDate ? 'No tasks for this date' : `No ${filter === 'all' ? '' : filter + ' '}tasks this month`}
                </p>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
