// ═══════════════════════════════════════════════════════════════
// Home Health Score — detail page (web)
// ═══════════════════════════════════════════════════════════════
// Parity with Canopy-App `app/health-score/index.tsx`. Replaces the
// generic /help deep-link the info icon + "How to improve →" used
// to route to. Gives users a real breakdown of the score and a
// ranked action list.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { calculateHealthScore } from '@/services/utils';
import { Colors } from '@/constants/theme';
import { HealthGauge } from '@/components/HealthGauge';
import type { MaintenanceTask } from '@/types';

export default function HealthScorePage() {
  const navigate = useNavigate();
  const { tasks, equipment } = useStore();

  const health = useMemo(() => calculateHealthScore(tasks), [tasks]);

  const actions = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const overdue = tasks
      .filter(t => {
        if (t.status === 'completed' || t.status === 'skipped') return false;
        const d = new Date(t.due_date);
        d.setHours(0, 0, 0, 0);
        return d < now;
      })
      .map(t => {
        const d = new Date(t.due_date);
        d.setHours(0, 0, 0, 0);
        const daysOverdue = Math.floor((now.getTime() - d.getTime()) / 86400000);
        const impact = daysOverdue > 30 ? 15 : daysOverdue > 7 ? 10 : 5;
        return { task: t, daysOverdue, impact };
      })
      .sort((a, b) => b.impact - a.impact || b.daysOverdue - a.daysOverdue);

    const thisMonth = tasks
      .filter(t => {
        if (t.status === 'completed' || t.status === 'skipped') return false;
        const d = new Date(t.due_date);
        return d >= thisMonthStart && d <= thisMonthEnd && d >= now;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const aging = equipment.filter(e => {
      if (!e.install_date || !e.expected_lifespan_years) return false;
      const installed = new Date(e.install_date);
      const years = (now.getTime() - installed.getTime()) / (365.25 * 86400000);
      return years / e.expected_lifespan_years > 0.8;
    });

    return { overdue, thisMonth, aging };
  }, [tasks, equipment]);

  const scoreColor = health.color === 'green' ? Colors.success
    : health.color === 'yellow' ? '#FF9800'
    : Colors.error;

  const formatTaskDate = (t: MaintenanceTask) => {
    const d = new Date(t.due_date);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const hasAnyActions = actions.overdue.length + actions.thisMonth.length + actions.aging.length > 0;

  return (
    <div className="container" style={{ maxWidth: 820, padding: '16px' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => navigate('/dashboard')}
        style={{ marginBottom: 12, padding: 0, fontSize: 13, color: 'var(--color-med-gray)' }}
      >
        &larr; Back to Dashboard
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Home Health Score</h1>

      {/* Hero */}
      <div className="card card-elevated mb-md">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <HealthGauge score={health.score} size={110} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 32, fontWeight: 700, margin: 0, lineHeight: 1 }}>{health.score}</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: scoreColor, margin: '6px 0 2px' }}>
              {health.label}
            </p>
            <p className="text-sm text-gray" style={{ margin: 0 }}>
              {health.completedCount} of {health.totalCount} this month complete
            </p>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>How it's calculated</h3>
      <div className="card mb-md">
        <ComponentRow
          icon="&#128200;"
          label="Rolling 90-day completion"
          weight="50%"
          value={`${health.rolling90}%`}
          detail="Your track record — tasks due in the last 90 days that were completed (skipped tasks don't count against you)."
        />
        <hr style={{ border: 0, borderTop: '1px solid var(--color-light-gray)', margin: '6px 0' }} />
        <ComponentRow
          icon="&#128197;"
          label="This month momentum"
          weight="30%"
          value={`${health.currentMonth}%`}
          detail="How much of this month's list you've knocked out so far."
        />
        <hr style={{ border: 0, borderTop: '1px solid var(--color-light-gray)', margin: '6px 0' }} />
        <ComponentRow
          icon="&#9888;&#65039;"
          label="Overdue penalty"
          weight="20%"
          value={health.overdueCount === 0 ? 'None' : `${health.overdueCount} overdue`}
          detail="Each overdue task deducts 5–15 points depending on how long it's been sitting. Complete or skip them to recover."
        />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
        {health.score >= 85 ? 'Keep it up' : 'Top actions to raise your score'}
      </h3>

      {!hasAnyActions ? (
        <div className="card" style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 36, margin: 0 }}>&#10004;&#65039;</p>
          <p style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>You're all caught up.</p>
          <p className="text-sm text-gray" style={{ marginTop: 4 }}>
            Stay consistent — completing tasks on time keeps your score above 85.
          </p>
        </div>
      ) : (
        <>
          {actions.overdue.slice(0, 5).map(({ task, daysOverdue, impact }) => (
            <button
              key={`overdue-${task.id}`}
              type="button"
              onClick={() => navigate(`/task/${task.id}`)}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                textAlign: 'left',
                borderLeft: `4px solid ${Colors.error}`,
                padding: 14,
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: Colors.error, margin: 0, letterSpacing: 0.3 }}>
                  OVERDUE &middot; +{impact} PTS
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, margin: '2px 0' }}>{task.title}</p>
                <p className="text-sm text-gray" style={{ margin: 0 }}>
                  {daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`} · Was due {formatTaskDate(task)}
                </p>
              </div>
              <span style={{ fontSize: 18, color: 'var(--color-med-gray)' }}>&rsaquo;</span>
            </button>
          ))}

          {actions.thisMonth.slice(0, 5).map(task => (
            <button
              key={`month-${task.id}`}
              type="button"
              onClick={() => navigate(`/task/${task.id}`)}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                textAlign: 'left',
                borderLeft: `4px solid ${Colors.sage}`,
                padding: 14,
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: Colors.sage, margin: 0, letterSpacing: 0.3 }}>
                  THIS MONTH
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, margin: '2px 0' }}>{task.title}</p>
                <p className="text-sm text-gray" style={{ margin: 0 }}>Due {formatTaskDate(task)}</p>
              </div>
              <span style={{ fontSize: 18, color: 'var(--color-med-gray)' }}>&rsaquo;</span>
            </button>
          ))}

          {actions.aging.slice(0, 3).map(eq => (
            <button
              key={`eq-${eq.id}`}
              type="button"
              onClick={() => navigate('/equipment')}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                textAlign: 'left',
                borderLeft: '4px solid #FF9800',
                padding: 14,
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#FF9800', margin: 0, letterSpacing: 0.3 }}>
                  AGING EQUIPMENT
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, margin: '2px 0' }}>{eq.name}</p>
                <p className="text-sm text-gray" style={{ margin: 0 }}>
                  Near end of expected lifespan — plan replacement or a service visit
                </p>
              </div>
              <span style={{ fontSize: 18, color: 'var(--color-med-gray)' }}>&rsaquo;</span>
            </button>
          ))}
        </>
      )}

      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 16,
          background: 'var(--color-sage-muted, #f0f4f0)',
          border: `1px solid ${Colors.sage}`,
        }}
      >
        <span style={{ fontSize: 20 }}>&#128161;</span>
        <p className="text-sm" style={{ margin: 0, lineHeight: 1.5 }}>
          Completing even one overdue task can bump your score 5–15 points instantly. Focus on the top items first.
        </p>
      </div>
    </div>
  );
}

function ComponentRow({
  icon,
  label,
  weight,
  value,
  detail,
}: {
  icon: string;
  label: string;
  weight: string;
  value: string;
  detail: string;
}) {
  return (
    <div style={{ padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }} dangerouslySetInnerHTML={{ __html: icon }} />
        <p style={{ flex: 1, fontSize: 15, fontWeight: 600, margin: 0 }}>{label}</p>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-med-gray)' }}>{weight}</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{value}</span>
      </div>
      <p className="text-sm text-gray" style={{ marginLeft: 24, marginTop: 4, lineHeight: 1.5 }}>
        {detail}
      </p>
    </div>
  );
}
