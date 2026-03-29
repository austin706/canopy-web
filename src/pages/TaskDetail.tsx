import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { PriorityColors, StatusColors, Colors } from '@/constants/theme';
import { quickCompleteTask, quickSkipTask, quickSnoozeTask } from '@/services/utils';
import { reopenTask as reopenTaskApi } from '@/services/supabase';
import { getDisplayStatus } from '@/services/taskEngine';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, reopenTask } = useStore();

  const rawTask = tasks.find(t => t.id === id);
  const task = useMemo(() => rawTask ? { ...rawTask, status: getDisplayStatus(rawTask) } : undefined, [rawTask]);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  const handleReopen = async () => {
    if (!task) return;
    try {
      reopenTask(task.id);
      try {
        await reopenTaskApi(task.id);
      } catch (err) {
        console.warn('Reopen API call failed:', err);
      }
      alert('Task reopened and moved to upcoming.');
      navigate(-1);
    } catch (error) {
      console.error('Error reopening task:', error);
      alert('Failed to reopen task. Please try again.');
    }
  };

  if (!task) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Task Not Found</h1>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/calendar')}>Back to Calendar</button>
        </div>
      </div>
    );
  }

  const isCompleted = task.status === 'completed' || task.status === 'skipped';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>&larr; Back</button>
          <h1>{task.title}</h1>
          <p className="subtitle">{task.description}</p>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Category & Priority */}
        <div className="card mb-lg">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
            <div style={{
              width: 4,
              height: 40,
              borderRadius: 2,
              background: PriorityColors[task.priority]
            }} />
            <div>
              <p style={{ fontSize: 12, color: Colors.medGray, textTransform: 'uppercase', fontWeight: 600 }}>{task.category}</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{task.priority.toUpperCase()} Priority</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <p className="text-xs text-gray">Due Date</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{new Date(task.due_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray">Status</p>
              <span className="badge" style={{ background: (StatusColors[task.status] || '#ccc') + '20', color: StatusColors[task.status] }}>
                {task.status}
              </span>
            </div>
          </div>
        </div>

        {/* Estimated Time & Cost */}
        {(task.estimated_minutes || task.estimated_cost) && (
          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>Estimate</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {task.estimated_minutes && (
                <div>
                  <p className="text-xs text-gray">Time</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>~{task.estimated_minutes} min</p>
                </div>
              )}
              {task.estimated_cost && (
                <div>
                  <p className="text-xs text-gray">Cost</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>${task.estimated_cost}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items to Have on Hand */}
        {task.items_to_have_on_hand && task.items_to_have_on_hand.length > 0 && (
          <div className="card mb-lg" style={{ background: Colors.copperMuted, border: `1px solid ${Colors.copper}30` }}>
            <p style={{ fontWeight: 600, marginBottom: 10, color: Colors.copperDark }}>Items to Have on Hand</p>
            <div className="flex-col gap-xs">
              {task.items_to_have_on_hand.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: Colors.copper, fontSize: 14 }}>•</span>
                  <p style={{ fontSize: 14, color: Colors.charcoal }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {task.instructions && task.instructions.length > 0 && (
          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>How To Do This</p>
            <div className="flex-col gap-sm">
              {task.instructions.map((instruction, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: Colors.sageMuted,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: Colors.sage }}>{i + 1}</span>
                  </div>
                  <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.5, flex: 1 }}>{instruction}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isCompleted && (
          <div className="card">
            <div className="flex-col gap-md">
              <button
                className="btn btn-primary"
                onClick={() => quickCompleteTask(task)}
                style={{ width: '100%' }}
              >
                Mark as Complete
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => quickSkipTask(task)}
                  style={{ width: '100%' }}
                >
                  Skip
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
                    style={{ width: '100%' }}
                  >
                    Snooze
                  </button>
                  {showSnoozeMenu && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: Colors.cardBackground,
                      border: `1px solid ${Colors.lightGray}`,
                      borderRadius: 4,
                      marginTop: 8,
                      zIndex: 10
                    }}>
                      <button
                        className="btn btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: 0 }}
                        onClick={() => {
                          quickSnoozeTask(task, 3);
                          setShowSnoozeMenu(false);
                        }}
                      >
                        3 days
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: 0, borderTop: `1px solid ${Colors.lightGray}` }}
                        onClick={() => {
                          quickSnoozeTask(task, 7);
                          setShowSnoozeMenu(false);
                        }}
                      >
                        1 week
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px', borderRadius: 0, borderTop: `1px solid ${Colors.lightGray}` }}
                        onClick={() => {
                          quickSnoozeTask(task, 14);
                          setShowSnoozeMenu(false);
                        }}
                      >
                        2 weeks
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="card" style={{
            background: Colors.sageMuted,
            border: `1px solid ${Colors.sage}30`,
            textAlign: 'center',
            padding: 32
          }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: Colors.sage, marginBottom: 8 }}>
              {task.status === 'completed' ? 'Completed' : 'Skipped'}
            </p>
            {task.completed_date && (
              <p className="text-xs text-gray">{new Date(task.completed_date).toLocaleDateString()}</p>
            )}
            <button className="btn btn-outline" onClick={handleReopen} style={{ marginTop: 12, borderColor: Colors.copper, color: Colors.copper }}>
              Reopen Task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
