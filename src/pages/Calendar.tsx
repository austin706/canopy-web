import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { PriorityColors, StatusColors, Colors } from '@/constants/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Calendar() {
  const { tasks, completeTask, skipTask } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

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

  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    tasks.forEach(t => {
      const d = new Date(t.due_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];
  const filteredTasks = filter === 'all' ? selectedTasks : selectedTasks.filter(t => t.status === filter);

  const nav = (dir: number) => setCurrentDate(new Date(year, month + dir, 1));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p className="subtitle">Track and manage maintenance tasks</p>
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
              const hasTasks = !!tasksByDate[key]?.length;
              const isSelected = selectedDate === key;
              return (
                <div
                  key={day.key}
                  className={`calendar-day ${isToday ? 'today' : ''} ${isOther ? 'other-month' : ''} ${hasTasks ? 'has-tasks' : ''}`}
                  style={isSelected ? { background: Colors.copper + '30', fontWeight: 700 } : undefined}
                  onClick={() => setSelectedDate(key)}
                >
                  {day.date}
                </div>
              );
            })}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-col gap-md">
          <div className="card">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>
              {selectedDate ? `Tasks for ${new Date(parseInt(selectedDate.split('-')[0]), parseInt(selectedDate.split('-')[1]), parseInt(selectedDate.split('-')[2])).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : 'Select a date'}
            </p>
            {selectedDate && (
              <div className="tabs" style={{ marginBottom: 16 }}>
                {['all', 'due', 'upcoming', 'completed'].map(f => (
                  <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-col gap-sm">
              {filteredTasks.map(task => (
                <div key={task.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
                  <div className="flex items-center gap-md">
                    <div style={{ width: 4, height: 40, borderRadius: 2, background: PriorityColors[task.priority] }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</p>
                      <p className="text-xs text-gray">{task.category} &middot; ~{task.estimated_minutes || '?'} min</p>
                    </div>
                    <span className="badge" style={{ background: (StatusColors[task.status] || '#ccc') + '20', color: StatusColors[task.status] }}>{task.status}</span>
                  </div>
                  {task.status !== 'completed' && task.status !== 'skipped' && (
                    <div className="flex gap-sm mt-sm" style={{ marginLeft: 20 }}>
                      <button className="btn btn-sage btn-sm" onClick={() => completeTask(task.id)}>Complete</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => skipTask(task.id)}>Skip</button>
                    </div>
                  )}
                </div>
              ))}
              {selectedDate && filteredTasks.length === 0 && (
                <p className="text-sm text-gray text-center" style={{ padding: 24 }}>No tasks for this date</p>
              )}
              {!selectedDate && <p className="text-sm text-gray text-center" style={{ padding: 24 }}>Click a date to see tasks</p>}
            </div>
          </div>

          {/* Monthly Summary */}
          <div className="card">
            <p style={{ fontWeight: 600, marginBottom: 8 }}>This Month</p>
            <div className="flex gap-lg">
              <div>
                <p style={{ fontSize: 24, fontWeight: 700 }}>{tasks.filter(t => { const d = new Date(t.due_date); return d.getMonth() === month && d.getFullYear() === year; }).length}</p>
                <p className="text-xs text-gray">Total Tasks</p>
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 700, color: Colors.success }}>{tasks.filter(t => { const d = new Date(t.due_date); return d.getMonth() === month && d.getFullYear() === year && t.status === 'completed'; }).length}</p>
                <p className="text-xs text-gray">Completed</p>
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 700, color: Colors.error }}>{tasks.filter(t => { const d = new Date(t.due_date); return d.getMonth() === month && d.getFullYear() === year && t.status === 'overdue'; }).length}</p>
                <p className="text-xs text-gray">Overdue</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
