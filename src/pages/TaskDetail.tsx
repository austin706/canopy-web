import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { PriorityColors, StatusColors, Colors } from '@/constants/theme';
import { quickCompleteTask, quickSkipTask, quickSnoozeTask } from '@/services/utils';
import { reopenTask as reopenTaskApi, deleteTask as deleteTaskApi } from '@/services/supabase';
import { getDisplayStatus } from '@/services/taskEngine';
import { supabase } from '@/services/supabase';

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tasks, reopenTask, setTasks, user, home } = useStore();

  const rawTask = tasks.find(t => t.id === id);
  const [dbTask, setDbTask] = useState<any>(null);
  const [loadingDb, setLoadingDb] = useState(false);

  // If task isn't in the store (e.g. navigated from inspection summary), fetch from DB
  useEffect(() => {
    if (rawTask || !id || loadingDb || dbTask) return;
    setLoadingDb(true);
    supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (data && !error) {
          setDbTask(data);
          // Also add to the store so subsequent renders find it
          const { tasks: current } = useStore.getState();
          if (!current.find(t => t.id === data.id)) {
            setTasks([...current, data]);
          }
        }
        setLoadingDb(false);
      });
  }, [id, rawTask]);

  const resolvedRaw = rawTask || dbTask;
  const task = useMemo(() => resolvedRaw ? { ...resolvedRaw, status: getDisplayStatus(resolvedRaw) } : undefined, [resolvedRaw]);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
  const [showCategoryBundleModal, setShowCategoryBundleModal] = useState(false);
  const [bundleTasksList, setBundleTasksList] = useState<any[]>([]);
  const [selectedBundleTasks, setSelectedBundleTasks] = useState<Set<string>>(new Set());
  const [hasProRequest, setHasProRequest] = useState(false);
  const [isLoadingProRequest, setIsLoadingProRequest] = useState(false);

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

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm('Delete this task? It will be removed from your calendar but kept in your home history.')) return;
    try {
      await deleteTaskApi(task.id);
      // Remove from local store
      const { tasks: currentTasks, setTasks: storeTasks } = useStore.getState();
      storeTasks(currentTasks.filter(t => t.id !== task.id));
      navigate(-1);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  // Check if task has an existing pro request
  useEffect(() => {
    if (!task) return;

    const checkProRequest = async () => {
      try {
        const { data } = await supabase
          .from('pro_request_tasks')
          .select('id')
          .eq('task_id', task.id)
          .limit(1);

        setHasProRequest((data && data.length > 0) || false);
      } catch (err) {
        console.warn('Failed to check pro request:', err);
      }
    };

    checkProRequest();
  }, [task]);

  const handleRequestProClick = async () => {
    if (!task) return;

    try {
      setIsLoadingProRequest(true);

      // Query for other tasks with the same category and matching statuses
      const { data: otherTasks } = await supabase
        .from('maintenance_tasks')
        .select('id, title, due_date, priority, description')
        .eq('category', task.category)
        .eq('home_id', home?.id)
        .neq('id', task.id)
        .in('status', ['upcoming', 'due', 'overdue']);

      setBundleTasksList(otherTasks || []);
      setSelectedBundleTasks(new Set());
      setShowCategoryBundleModal(true);
    } catch (error) {
      console.error('Error loading bundle tasks:', error);
      alert('Failed to load category tasks. Continuing with just this task.');
      await createProRequest([task.id]);
    } finally {
      setIsLoadingProRequest(false);
    }
  };

  const createProRequest = async (taskIds: string[]) => {
    if (!user || !home || !task) return;

    try {
      setIsLoadingProRequest(true);

      // Get all selected tasks for description and urgency
      const selectedTasks = [task, ...bundleTasksList.filter(t => taskIds.includes(t.id))];
      const description = selectedTasks.map(t => `${t.title}${t.description ? ': ' + t.description : ''}`).join('; ');

      // Determine urgency based on highest priority
      const priorityOrder = { urgent: 3, high: 2, medium: 1, low: 0 };
      const maxPriority = Math.max(
        ...selectedTasks.map(t => priorityOrder[t.priority as keyof typeof priorityOrder] || 0)
      );
      const urgency = maxPriority >= 2 ? 'urgent' : 'routine';

      // Create pro_request
      const { data: proRequestData, error: proRequestError } = await supabase
        .from('pro_requests')
        .insert({
          user_id: user.id,
          home_id: home.id,
          category: task.category,
          description,
          urgency,
          status: 'pending',
          source: 'task'
        })
        .select('id')
        .single();

      if (proRequestError) throw proRequestError;

      // Link all selected tasks to the pro request
      const proRequestTasksData = taskIds.map(taskId => ({
        pro_request_id: proRequestData.id,
        task_id: taskId
      }));

      const { error: linkError } = await supabase
        .from('pro_request_tasks')
        .insert(proRequestTasksData);

      if (linkError) throw linkError;

      alert(`Pro request created! We'll send you quotes for ${taskIds.length} task${taskIds.length !== 1 ? 's' : ''}.`);
      setShowCategoryBundleModal(false);
      setHasProRequest(true);
    } catch (error) {
      console.error('Error creating pro request:', error);
      alert('Failed to create pro request. Please try again.');
    } finally {
      setIsLoadingProRequest(false);
    }
  };

  const handleConfirmBundle = async () => {
    if (!task) return;
    const allTaskIds = [task.id, ...Array.from(selectedBundleTasks)];
    await createProRequest(allTaskIds);
  };

  if (!task) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>{loadingDb ? 'Loading...' : 'Task Not Found'}</h1>
          </div>
          {!loadingDb && <button className="btn btn-primary" onClick={() => navigate('/calendar')}>Back to Calendar</button>}
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
              <span className="badge" style={{ background: (StatusColors[task.status] || Colors.silver) + '20', color: StatusColors[task.status] }}>
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
              {task.items_to_have_on_hand.map((item: string) => (
                <div key={item} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: Colors.copper, fontSize: 14 }}>•</span>
                  <p style={{ fontSize: 14, color: Colors.charcoal }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Purchase / Affiliate Link */}
        {task.purchase_url && (
          <a
            href={task.purchase_url}
            target="_blank"
            rel="noopener noreferrer"
            className="card mb-lg"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#FFF8F0',
              border: `1px solid ${Colors.copper}40`,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 20 }}>🛒</span>
            <div>
              <p style={{ fontWeight: 600, color: Colors.copper, fontSize: 14, margin: 0 }}>Buy Replacement</p>
              <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>Order the exact part on Amazon</p>
            </div>
            <span style={{ marginLeft: 'auto', color: Colors.copper, fontSize: 18 }}>→</span>
          </a>
        )}

        {/* Instructions */}
        {task.instructions && task.instructions.length > 0 && (
          <div className="card mb-lg">
            <p style={{ fontWeight: 600, marginBottom: 12 }}>How To Do This</p>
            <div className="flex-col gap-sm">
              {task.instructions.map((instruction: string, i: number) => (
                <div key={instruction} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
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
              {hasProRequest ? (
                <div style={{
                  padding: 12,
                  background: Colors.copperMuted,
                  border: `1px solid ${Colors.copper}40`,
                  borderRadius: 4,
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: Colors.copper }}>Pro Request Pending</p>
                </div>
              ) : (
                ['upcoming', 'due'].includes(task.status) && (
                  <button
                    className="btn"
                    onClick={handleRequestProClick}
                    disabled={isLoadingProRequest}
                    style={{
                      width: '100%',
                      background: Colors.copper,
                      color: Colors.white,
                      border: 'none',
                      fontWeight: 600,
                      opacity: isLoadingProRequest ? 0.6 : 1
                    }}
                  >
                    {isLoadingProRequest ? 'Loading...' : 'Request a Pro'}
                  </button>
                )
              )}

              <button
                className="btn btn-primary"
                onClick={() => quickCompleteTask(task)}
                style={{ width: '100%' }}
              >
                Mark as Complete
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
                <button
                  className="btn btn-ghost"
                  onClick={handleDelete}
                  style={{ width: '100%', color: Colors.error }}
                >
                  Delete
                </button>
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
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
              <button className="btn btn-outline" onClick={handleReopen} style={{ borderColor: Colors.copper, color: Colors.copper }}>
                Reopen Task
              </button>
              <button className="btn btn-outline" onClick={handleDelete} style={{ borderColor: Colors.error, color: Colors.error }}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Category Bundle Modal */}
      {showCategoryBundleModal && bundleTasksList.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: Colors.cardBackground,
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: Colors.charcoal }}>
              Bundle {task.category} Tasks?
            </h2>
            <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 20 }}>
              You have {bundleTasksList.length} other {task.category} task{bundleTasksList.length !== 1 ? 's' : ''} that need attention. Would you like to include them in this request?
            </p>

            <div style={{ marginBottom: 20, maxHeight: 300, overflowY: 'auto' }}>
              {bundleTasksList.map((bundleTask) => (
                <label key={bundleTask.id} style={{
                  display: 'flex',
                  gap: 12,
                  padding: 12,
                  marginBottom: 8,
                  border: `1px solid ${Colors.lightGray}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: selectedBundleTasks.has(bundleTask.id) ? Colors.copperMuted : 'transparent'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedBundleTasks.has(bundleTask.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedBundleTasks);
                      if (e.target.checked) {
                        newSet.add(bundleTask.id);
                      } else {
                        newSet.delete(bundleTask.id);
                      }
                      setSelectedBundleTasks(newSet);
                    }}
                    style={{ marginTop: 2, cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal, marginBottom: 2 }}>
                      {bundleTask.title}
                    </p>
                    <p style={{ fontSize: 12, color: Colors.medGray }}>
                      Due: {new Date(bundleTask.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowCategoryBundleModal(false)}
                disabled={isLoadingProRequest}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => handleConfirmBundle()}
                disabled={isLoadingProRequest}
                style={{
                  background: Colors.copper,
                  color: Colors.white,
                  border: 'none',
                  fontWeight: 600,
                  opacity: isLoadingProRequest ? 0.6 : 1
                }}
              >
                {isLoadingProRequest ? 'Creating...' : `Include selected (${selectedBundleTasks.size})`}
              </button>
            </div>

            {bundleTasksList.length > 0 && selectedBundleTasks.size === 0 && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowCategoryBundleModal(false);
                  createProRequest([task.id]);
                }}
                disabled={isLoadingProRequest}
                style={{ width: '100%', marginTop: 12 }}
              >
                Just this task
              </button>
            )}
          </div>
        </div>
      )}

      {/* Simple Modal for no matching tasks */}
      {showCategoryBundleModal && bundleTasksList.length === 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: Colors.cardBackground,
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: Colors.charcoal }}>
              Request a Pro
            </h2>
            <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 20 }}>
              No other {task.category} tasks found. Proceeding with just this task.
            </p>
            <button
              className="btn"
              onClick={() => {
                setShowCategoryBundleModal(false);
                createProRequest([task.id]);
              }}
              disabled={isLoadingProRequest}
              style={{
                width: '100%',
                background: Colors.copper,
                color: Colors.white,
                border: 'none',
                fontWeight: 600,
                opacity: isLoadingProRequest ? 0.6 : 1
              }}
            >
              {isLoadingProRequest ? 'Creating...' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
