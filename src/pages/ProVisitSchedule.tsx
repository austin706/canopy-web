import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

interface ProMonthlyVisit {
  id: string;
  pro_provider_id: string;
  home_id: string;
  title: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'proposed' | 'confirmed' | 'in_progress' | 'completed';
  service_purpose: string;
  time_spent_minutes?: number;
  completion_notes?: string;
  completion_photo_url?: string;
  tasks?: string[];
  user?: { full_name: string; email: string };
  home?: { address: string; city: string; state: string };
}

interface LineItem {
  id: string;
  description: string;
  isCompleted: boolean;
}

export default function ProVisitSchedule() {
  const navigate = useNavigate();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';
  const [visits, setVisits] = useState<ProMonthlyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [completeFormId, setCompleteFormId] = useState<string | null>(null);

  // Propose form state
  const [proposeForm, setProposeForm] = useState({
    clientId: '',
    visitDate: '',
    visitTime: '09:00',
    tasks: [] as string[],
  });

  // Complete form state
  const [completeForm, setCompleteForm] = useState({
    timeSpent: '',
    notes: '',
    photoUrl: '',
    tasks: [] as LineItem[],
  });

  useEffect(() => {
    loadProviderAndVisits();
  }, [currentMonth]);

  const loadProviderAndVisits = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      // Admin sees all visits
      if (isAdmin) {
        await loadVisits(null);
        return;
      }

      const { data: provider } = await supabase
        .from('pro_providers')
        .select('id')
        .eq('user_id', authUser.user.id)
        .single();

      if (provider) {
        setProviderId(provider.id);
        await loadVisits(provider.id);
      }
    } catch (err) {
      console.error('Error loading provider:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVisits = async (provId: string | null) => {
    try {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];

      let query = supabase
        .from('pro_service_appointments')
        .select('*, user:user_id(full_name, email), home:home_id(address, city, state)')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd)
        .order('scheduled_date', { ascending: true });

      if (provId) {
        query = query.eq('pro_provider_id', provId);
      }

      const { data: visitsData } = await query;
      setVisits(visitsData || []);
    } catch (err) {
      console.error('Error loading visits:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProposeVisit = async () => {
    if (!providerId || !proposeForm.clientId || !proposeForm.visitDate) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase.from('pro_service_appointments').insert({
        pro_provider_id: providerId,
        home_id: proposeForm.clientId,
        title: 'Proposed Service Visit',
        scheduled_date: proposeForm.visitDate,
        scheduled_time: proposeForm.visitTime,
        status: 'proposed',
        service_purpose: proposeForm.tasks.join(', '),
        tasks: proposeForm.tasks,
      });

      if (error) throw error;

      setProposeForm({ clientId: '', visitDate: '', visitTime: '09:00', tasks: [] });
      setShowProposeForm(false);
      await loadVisits(providerId);
      alert('Visit proposal created. Awaiting homeowner confirmation.');
    } catch (err) {
      console.error('Error proposing visit:', err);
      alert('Failed to propose visit');
    }
  };

  const handleStartVisit = async (visitId: string) => {
    if (!providerId) return;

    try {
      const { error } = await supabase
        .from('pro_service_appointments')
        .update({ status: 'in_progress' })
        .eq('id', visitId);

      if (error) throw error;

      await loadVisits(providerId);
    } catch (err) {
      console.error('Error starting visit:', err);
      alert('Failed to start visit');
    }
  };

  const handleCompleteVisit = async (visitId: string) => {
    if (!providerId || !completeForm.timeSpent) {
      alert('Please enter time spent');
      return;
    }

    try {
      const { error } = await supabase
        .from('pro_service_appointments')
        .update({
          status: 'completed',
          time_spent_minutes: parseInt(completeForm.timeSpent),
          completion_notes: completeForm.notes,
          completion_photo_url: completeForm.photoUrl,
        })
        .eq('id', visitId);

      if (error) throw error;

      setCompleteFormId(null);
      setCompleteForm({ timeSpent: '', notes: '', photoUrl: '', tasks: [] });
      await loadVisits(providerId);
      alert('Visit completed successfully');
    } catch (err) {
      console.error('Error completing visit:', err);
      alert('Failed to complete visit');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'proposed':
        return Colors.warning;
      case 'confirmed':
        return Colors.success;
      case 'in_progress':
        return Colors.info;
      case 'completed':
        return Colors.sage;
      default:
        return Colors.medGray;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'proposed':
        return 'Waiting for confirmation';
      case 'confirmed':
        return 'Confirmed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const monthDisplay = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Loading visits...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/pro-portal')}>
            ← Back
          </button>
          <h1>Visit Schedule</h1>
          <p className="subtitle">{visits.length} visits this month</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowProposeForm(!showProposeForm)}>
          {showProposeForm ? 'Cancel' : 'Propose Visit'}
        </button>
      </div>

      {/* Month Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
        >
          ← Previous
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, minWidth: 150, textAlign: 'center' }}>
          {monthDisplay}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
        >
          Next →
        </button>
      </div>

      {/* Propose Visit Form */}
      {showProposeForm && (
        <div className="card mb-lg" style={{ backgroundColor: Colors.warmWhite, borderLeft: `4px solid ${Colors.copper}` }}>
          <h3 style={{ marginTop: 0 }}>Propose New Visit</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Client *
              </label>
              <select
                className="form-select"
                value={proposeForm.clientId}
                onChange={(e) => setProposeForm({ ...proposeForm, clientId: e.target.value })}
              >
                <option value="">Select client...</option>
                {/* In production, load available clients from database */}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Date *
              </label>
              <input
                type="date"
                className="form-input"
                value={proposeForm.visitDate}
                onChange={(e) => setProposeForm({ ...proposeForm, visitDate: e.target.value })}
              />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
              Time
            </label>
            <input
              type="time"
              className="form-input"
              value={proposeForm.visitTime}
              onChange={(e) => setProposeForm({ ...proposeForm, visitTime: e.target.value })}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
              Tasks (comma-separated)
            </label>
            <textarea
              className="form-input"
              placeholder="e.g., HVAC inspection, filter replacement"
              style={{ resize: 'vertical', minHeight: 80 }}
              value={proposeForm.tasks.join(', ')}
              onChange={(e) => setProposeForm({ ...proposeForm, tasks: e.target.value.split(',').map(t => t.trim()) })}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleProposeVisit}>
              Send Proposal
            </button>
            <button className="btn btn-secondary" onClick={() => setShowProposeForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Visits List */}
      {visits.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>📅</div>
          <h3>No visits scheduled</h3>
          <p>Propose a visit to get started.</p>
        </div>
      ) : (
        <div className="grid-1" style={{ gap: 16 }}>
          {visits.map(visit => (
            <div key={visit.id} className="card">
              {/* Visit Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>{visit.title}</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: getStatusColor(visit.status) + '20',
                        color: getStatusColor(visit.status),
                        fontSize: 11,
                      }}
                    >
                      {getStatusLabel(visit.status)}
                    </span>
                    {visit.status === 'completed' && visit.time_spent_minutes && (
                      <span style={{ fontSize: 13, color: Colors.medGray }}>
                        {visit.time_spent_minutes} minutes
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Visit Details */}
              <div style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${Colors.lightGray}` }}>
                {visit.user?.full_name && (
                  <p style={{ margin: '0 0 4px 0' }}>
                    <strong>Homeowner:</strong> {visit.user.full_name}
                  </p>
                )}
                {visit.home && (
                  <p style={{ margin: '0 0 4px 0' }}>
                    <strong>Address:</strong> {visit.home.address}, {visit.home.city}, {visit.home.state}
                  </p>
                )}
                <p style={{ margin: '0 0 4px 0' }}>
                  <strong>Date & Time:</strong> {new Date(visit.scheduled_date).toLocaleDateString()} at {visit.scheduled_time}
                </p>
                {visit.service_purpose && (
                  <p style={{ margin: 0 }}>
                    <strong>Purpose:</strong> {visit.service_purpose}
                  </p>
                )}
              </div>

              {/* Status-Specific Content */}
              {visit.status === 'proposed' && (
                <div style={{ color: Colors.warning, fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>
                  Waiting for homeowner to confirm this visit.
                </div>
              )}

              {visit.status === 'completed' && visit.completion_notes && (
                <div style={{ backgroundColor: Colors.warmWhite, padding: 12, borderRadius: 6, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600 }}>Completion Notes:</p>
                  <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{visit.completion_notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {visit.status === 'confirmed' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleStartVisit(visit.id)}
                    style={{ flex: 1 }}
                  >
                    Start Visit
                  </button>
                )}

                {visit.status === 'in_progress' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setCompleteFormId(completeFormId === visit.id ? null : visit.id)}
                    style={{ flex: 1 }}
                  >
                    Complete Visit
                  </button>
                )}
              </div>

              {/* Complete Visit Form */}
              {completeFormId === visit.id && visit.status === 'in_progress' && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${Colors.lightGray}` }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>Complete Visit</h4>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                      Time Spent (minutes) *
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g., 120"
                      value={completeForm.timeSpent}
                      onChange={(e) => setCompleteForm({ ...completeForm, timeSpent: e.target.value })}
                      min="1"
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                      Notes
                    </label>
                    <textarea
                      className="form-input"
                      placeholder="Work performed, observations, recommendations..."
                      style={{ resize: 'vertical', minHeight: 100 }}
                      value={completeForm.notes}
                      onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                      Photo URL
                    </label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://..."
                      value={completeForm.photoUrl}
                      onChange={(e) => setCompleteForm({ ...completeForm, photoUrl: e.target.value })}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                      Task Checklist
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Task checklist would be populated from visit.tasks */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          id="task-0"
                          style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="task-0" style={{ cursor: 'pointer', fontSize: 13 }}>
                          Sample task
                        </label>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleCompleteVisit(visit.id)}
                      style={{ flex: 1 }}
                    >
                      Save & Complete
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setCompleteFormId(null)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
