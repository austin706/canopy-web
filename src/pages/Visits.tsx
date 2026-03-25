import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { isProOrHigher } from '@/services/subscriptionGate';
import { Colors, StatusColors } from '@/constants/theme';
import { getItemsToHaveOnHand } from '@/services/proVisits';
import type { ProMonthlyVisit, VisitAllocation } from '@/types';

export default function Visits() {
  const { user } = useStore();
  const [upcomingVisit, setUpcomingVisit] = useState<ProMonthlyVisit | null>(null);
  const [pastVisits, setPastVisits] = useState<ProMonthlyVisit[]>([]);
  const [allocation, setAllocation] = useState<VisitAllocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [preparedItems, setPreparedItems] = useState<Set<string>>(new Set());

  const tier = user?.subscription_tier || 'free';
  const hasPro = isProOrHigher(tier);

  useEffect(() => {
    if (user && hasPro) {
      loadVisits();
    } else {
      setLoading(false);
    }
  }, [user, hasPro]);

  const loadVisits = async () => {
    try {
      setLoading(true);
      // Mock data fetch - replace with actual service calls
      // const upcoming = await getUpcomingVisits(user!.id);
      // const past = await getPastVisits(user!.id);
      // const alloc = await getVisitAllocation(user!.id);
      setUpcomingVisit(null);
      setPastVisits([]);
      setAllocation({ visits_available: 1, visits_used: 0, forfeited: false, month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }) });
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load visits');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!upcomingVisit) return;
    try {
      // const result = await confirmVisit(upcomingVisit.id);
      // setUpcomingVisit(result);
      alert('Visit confirmed!');
      await loadVisits();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = async () => {
    if (!upcomingVisit) return;
    setCanceling(true);
    try {
      // const result = await cancelVisit(upcomingVisit.id);
      // setUpcomingVisit(null);
      alert('Visit cancelled');
      setShowCancelModal(false);
      await loadVisits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCanceling(false);
    }
  };

  const handleReschedule = async () => {
    if (!upcomingVisit || !newDate) return;
    setRescheduling(true);
    try {
      // const result = await rescheduleVisit(upcomingVisit.id, newDate);
      // setUpcomingVisit(result);
      alert('Visit rescheduled!');
      setShowRescheduleModal(false);
      setNewDate('');
      await loadVisits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRescheduling(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!hasPro) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Pro Visits</h1></div>
        <div className="card text-center" style={{ padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 20, color: Colors.copper }}>PRO</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Pro Visits Locked</h2>
          <p className="text-gray mb-lg">Upgrade to a Pro plan to book monthly maintenance visits with qualified professionals.</p>
          <button className="btn btn-primary" onClick={() => window.location.href = '/subscription'}>View Plans</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner"></div>
        <p>Loading visits...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <h1>Pro Monthly Visits</h1>
      </div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 8, background: '#E5393520', color: '#C62828', fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {/* Upcoming Visit Section */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Upcoming Visit</h2>

        {upcomingVisit && (
          <div
            className="card"
            style={{
              background: Colors.copperMuted,
              borderLeft: `4px solid ${Colors.copper}`,
              marginBottom: 16,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 24 }}>🛒</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: Colors.charcoal, marginBottom: 4 }}>
                  Prepare for Your Visit
                </h3>
                <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12 }}>
                  <strong>{formatDate(upcomingVisit.confirmed_date || upcomingVisit.proposed_date)}</strong> • Your pro provider will be working on scheduled items. Please have these supplies ready:
                </p>

                {(() => {
                  const items = getItemsToHaveOnHand(upcomingVisit.selected_task_ids || []);
                  return items.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map((item) => (
                        <label
                          key={item}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            cursor: 'pointer',
                            color: preparedItems.has(item) ? Colors.medGray : Colors.charcoal,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={preparedItems.has(item)}
                            onChange={(e) => {
                              const newItems = new Set(preparedItems);
                              if (e.target.checked) {
                                newItems.add(item);
                              } else {
                                newItems.delete(item);
                              }
                              setPreparedItems(newItems);
                            }}
                            style={{
                              width: 18,
                              height: 18,
                              cursor: 'pointer',
                            }}
                          />
                          <span
                            style={{
                              textDecoration: preparedItems.has(item) ? 'line-through' : 'none',
                            }}
                          >
                            {item}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: Colors.medGray, fontStyle: 'italic' }}>
                      No supplies needed for your scheduled tasks
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {upcomingVisit ? (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 4 }}>Scheduled for</p>
                <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{formatDate(upcomingVisit.scheduled_date)}</p>
                <p style={{ fontSize: 14, color: Colors.medGray }}>{upcomingVisit.scheduled_time}</p>
              </div>
              <span className="badge" style={{ background: (StatusColors[upcomingVisit.status] || '#ccc') + '20', color: StatusColors[upcomingVisit.status] || '#ccc' }}>
                {upcomingVisit.status}
              </span>
            </div>

            <div style={{ padding: 12, background: Colors.cream, borderRadius: 8, marginBottom: 16 }}>
              <p className="text-xs fw-600 text-copper mb-xs">Provider</p>
              <p style={{ fontWeight: 500, fontSize: 13 }}>{upcomingVisit.provider_name}</p>
            </div>

            {upcomingVisit.service_purpose && (
              <p className="text-sm text-gray mb-lg">{upcomingVisit.service_purpose}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {upcomingVisit.status === 'scheduled' && (
                <>
                  <button className="btn btn-primary" onClick={handleConfirm} style={{ flex: 1 }}>Confirm</button>
                  <button className="btn btn-secondary" onClick={() => setShowRescheduleModal(true)} style={{ flex: 1 }}>Reschedule</button>
                  <button className="btn btn-secondary" onClick={() => setShowCancelModal(true)} style={{ flex: 1 }}>Cancel</button>
                </>
              )}
              {upcomingVisit.status === 'confirmed' && (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowRescheduleModal(true)} style={{ flex: 1 }}>Reschedule</button>
                  <button className="btn btn-secondary" onClick={() => setShowCancelModal(true)} style={{ flex: 1 }}>Cancel</button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div>
            <h3>No upcoming visits</h3>
            <p>Your next Pro visit will appear here once scheduled.</p>
          </div>
        )}
      </div>

      {/* Visit Allocation */}
      {allocation && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Monthly Allocation</h2>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 14 }}>{allocation.visits_used} of {allocation.visits_available} visits used this month</p>
              <span className="badge" style={{ background: allocation.forfeited ? '#dc354520' : '#8B9E7E20', color: allocation.forfeited ? '#dc3545' : '#8B9E7E' }}>
                {allocation.forfeited ? 'Forfeited' : 'Active'}
              </span>
            </div>
            <div style={{ height: 8, background: Colors.lightGray, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: Colors.sage, width: `${(allocation.visits_used / allocation.visits_available) * 100}%`, transition: 'width 0.3s' }}></div>
            </div>
            <p className="text-xs text-gray mt-sm">{allocation.month}</p>
          </div>
        </div>
      )}

      {/* Past Visits */}
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Past Visits</h2>
        {pastVisits.length === 0 ? (
          <div className="empty-state">
            <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div>
            <h3>No past visits</h3>
            <p>Completed visits will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pastVisits.map(visit => (
              <div key={visit.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{formatDate(visit.scheduled_date)}</p>
                    <p className="text-xs text-gray">{visit.provider_name}</p>
                  </div>
                  <span className="badge" style={{ background: '#4CAF5020', color: '#2E7D32' }}>Completed</span>
                </div>
                {visit.tasks_completed && (
                  <p className="text-sm text-gray mb-sm">Tasks: {visit.tasks_completed.join(', ')}</p>
                )}
                {visit.time_spent && (
                  <p className="text-sm text-gray mb-sm">Duration: {visit.time_spent} minutes</p>
                )}
                {visit.notes && (
                  <p className="text-sm text-gray">Notes: {visit.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 400, padding: 24 }}>
            <h2 style={{ marginBottom: 16 }}>Cancel Visit?</h2>
            <div style={{ padding: 12, background: '#FFF3CD', borderRadius: 8, marginBottom: 16, borderLeft: `4px solid #FFC107` }}>
              <p className="text-sm" style={{ margin: 0, color: '#856404' }}>
                <strong>Cancellation Policy:</strong> If cancelled 48+ hours before your visit, you can rebook in the same month. Cancellations within 48 hours may forfeit this month's visit.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)} style={{ flex: 1 }}>Keep Visit</button>
              <button className="btn" style={{ flex: 1, background: '#dc3545', color: 'white' }} onClick={handleCancel} disabled={canceling}>
                {canceling ? 'Cancelling...' : 'Cancel Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 400, padding: 24 }}>
            <h2 style={{ marginBottom: 16 }}>Reschedule Visit</h2>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>New Date</label>
              <input
                className="form-input"
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setShowRescheduleModal(false); setNewDate(''); }} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleReschedule} disabled={!newDate || rescheduling} style={{ flex: 1 }}>
                {rescheduling ? 'Rescheduling...' : 'Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
