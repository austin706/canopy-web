import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import logger from '@/utils/logger';

// Unified calendar event from either table
interface CalendarVisit {
  id: string;
  type: 'bimonthly' | 'service';
  pro_provider_id: string;
  home_id: string;
  title: string;
  date: string; // normalized display date
  time: string;
  status: string;
  purpose: string;
  homeowner_name?: string;
  homeowner_email?: string;
  address?: string;
  city?: string;
  state?: string;
  time_spent_minutes?: number;
  notes?: string;
  homeowner_notes?: string;
}

interface AssignedClient {
  id: string; // profile id (homeowner_id)
  home_id: string;
  full_name: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
}

export default function ProVisitSchedule() {
  const navigate = useNavigate();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';
  const [visits, setVisits] = useState<CalendarVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [providerZips, setProviderZips] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [completeFormId, setCompleteFormId] = useState<string | null>(null);
  const [clients, setClients] = useState<AssignedClient[]>([]);

  // Propose form state
  const [proposeForm, setProposeForm] = useState({
    clientId: '', // homeowner profile id
    homeId: '',
    visitDate: '',
    visitTime: '09:00',
    visitEndTime: '12:00',
  });
  const [conflictWarning, setConflictWarning] = useState('');

  // Complete form state
  const [completeForm, setCompleteForm] = useState({
    timeSpent: '',
    notes: '',
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

      if (isAdmin) {
        await loadVisits(null, []);
        return;
      }

      const { data: provider } = await supabase
        .from('pro_providers')
        .select('id, zip_codes')
        .eq('user_id', authUser.user.id)
        .single();

      if (provider) {
        setProviderId(provider.id);
        setProviderZips(provider.zip_codes || []);
        await loadVisits(provider.id, provider.zip_codes || []);
        await loadClients(provider.zip_codes || []);
      }
    } catch (err) {
      logger.error('Error loading provider:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async (zips: string[]) => {
    try {
      const { data: proClients } = await supabase
        .from('profiles')
        .select('id, full_name, email, subscription_tier')
        .in('subscription_tier', ['pro']);

      const clientList: AssignedClient[] = [];
      for (const c of (proClients || [])) {
        const { data: homeData } = await supabase
          .from('homes')
          .select('id, address, city, state, zip_code')
          .eq('user_id', c.id)
          .single();

        if (!homeData) continue;

        // Filter by provider's zip codes if set
        if (zips.length > 0 && homeData.zip_code) {
          if (!zips.includes(homeData.zip_code)) continue;
        }

        clientList.push({
          id: c.id,
          home_id: homeData.id,
          full_name: c.full_name || c.email,
          email: c.email,
          address: homeData.address,
          city: homeData.city,
          state: homeData.state,
          zip_code: homeData.zip_code,
        });
      }

      setClients(clientList);
    } catch (err) {
      logger.error('Error loading clients:', err);
    }
  };

  const loadVisits = async (provId: string | null, _zips: string[]) => {
    try {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];

      // 1) Load bimonthly visits from pro_monthly_visits
      let bimonthlyQuery = supabase
        .from('pro_monthly_visits')
        .select('*, homeowner:homeowner_id(full_name, email), home:home_id(address, city, state)')
        .or(`proposed_date.gte.${monthStart},confirmed_date.gte.${monthStart}`)
        .or(`proposed_date.lte.${monthEnd},confirmed_date.lte.${monthEnd}`)
        .order('proposed_date', { ascending: true });

      if (provId) {
        bimonthlyQuery = bimonthlyQuery.eq('pro_provider_id', provId);
      }

      const { data: bimonthlyData } = await bimonthlyQuery;

      // 2) Load ad-hoc service appointments from pro_service_appointments
      let serviceQuery = supabase
        .from('pro_service_appointments')
        .select('*, home:home_id(address, city, state)')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd)
        .order('scheduled_date', { ascending: true });

      if (provId) {
        serviceQuery = serviceQuery.eq('pro_provider_id', provId);
      }

      const { data: serviceData } = await serviceQuery;

      // 3) Merge into unified format
      const merged: CalendarVisit[] = [];

      for (const v of (bimonthlyData || [])) {
        const displayDate = v.confirmed_date || v.proposed_date || '';
        // Filter to actual month range
        if (displayDate < monthStart || displayDate > monthEnd) continue;

        merged.push({
          id: v.id,
          type: 'bimonthly',
          pro_provider_id: v.pro_provider_id,
          home_id: v.home_id,
          title: 'Bimonthly Home Visit',
          date: displayDate,
          time: v.confirmed_start_time || v.proposed_time_slot || '',
          status: v.status,
          purpose: v.selected_task_ids?.length
            ? `${v.selected_task_ids.length} task${v.selected_task_ids.length !== 1 ? 's' : ''} selected`
            : 'Routine maintenance visit',
          homeowner_name: (v.homeowner as { full_name?: string })?.full_name,
          homeowner_email: (v.homeowner as { email?: string })?.email,
          address: (v.home as { address?: string })?.address,
          city: (v.home as { city?: string })?.city,
          state: (v.home as { state?: string })?.state,
          time_spent_minutes: v.time_spent_minutes,
          notes: v.pro_notes,
          homeowner_notes: v.homeowner_notes,
        });
      }

      for (const a of (serviceData || [])) {
        merged.push({
          id: a.id,
          type: 'service',
          pro_provider_id: a.pro_provider_id,
          home_id: a.home_id,
          title: a.title || 'Service Appointment',
          date: a.scheduled_date,
          time: a.scheduled_time || '',
          status: a.status,
          purpose: a.service_purpose || a.description || '',
          address: (a.home as { address?: string })?.address,
          city: (a.home as { city?: string })?.city,
          state: (a.home as { state?: string })?.state,
          notes: a.notes,
        });
      }

      // Sort by date
      merged.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
      setVisits(merged);
    } catch (err) {
      logger.error('Error loading visits:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check if provider has a conflicting visit on the same date/time
  const checkProviderConflict = async (
    provId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeVisitId?: string
  ): Promise<string | null> => {
    // Check bimonthly visits on this date
    let bimonthlyQuery = supabase
      .from('pro_monthly_visits')
      .select('id, proposed_date, confirmed_date, proposed_time_slot, confirmed_start_time, confirmed_end_time, homeowner_id')
      .eq('pro_provider_id', provId)
      .in('status', ['proposed', 'confirmed', 'in_progress'])
      .or(`proposed_date.eq.${date},confirmed_date.eq.${date}`);

    if (excludeVisitId) {
      bimonthlyQuery = bimonthlyQuery.neq('id', excludeVisitId);
    }

    const { data: bimonthlyConflicts } = await bimonthlyQuery;

    // Check service appointments on this date
    let serviceQuery = supabase
      .from('pro_service_appointments')
      .select('id, scheduled_date, scheduled_time')
      .eq('pro_provider_id', provId)
      .eq('scheduled_date', date)
      .in('status', ['proposed', 'confirmed', 'scheduled', 'in_progress']);

    if (excludeVisitId) {
      serviceQuery = serviceQuery.neq('id', excludeVisitId);
    }

    const { data: serviceConflicts } = await serviceQuery;

    // Check time overlap for bimonthly visits
    for (const v of (bimonthlyConflicts || [])) {
      const existingStart = v.confirmed_start_time || v.proposed_time_slot || '08:00';
      const existingEnd = v.confirmed_end_time || addHours(existingStart, 3); // default 3hr block
      if (timesOverlap(startTime, endTime, existingStart, existingEnd)) {
        return `Provider already has a bimonthly visit on ${date} from ${formatTime(existingStart)} to ${formatTime(existingEnd)}.`;
      }
    }

    // Check time overlap for service appointments
    for (const a of (serviceConflicts || [])) {
      const existingStart = a.scheduled_time || '08:00';
      const existingEnd = addHours(existingStart, 2); // default 2hr block for service
      if (timesOverlap(startTime, endTime, existingStart, existingEnd)) {
        return `Provider already has a service appointment on ${date} at ${formatTime(existingStart)}.`;
      }
    }

    return null; // No conflict
  };

  // Helper: check if two time ranges overlap (times as HH:MM strings)
  const timesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const s1 = toMinutes(start1), e1 = toMinutes(end1);
    const s2 = toMinutes(start2), e2 = toMinutes(end2);
    return s1 < e2 && s2 < e1;
  };

  // Helper: add hours to a time string
  const addHours = (time: string, hours: number): string => {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = (h || 0) * 60 + (m || 0) + hours * 60;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  // Helper: format HH:MM to readable time
  const formatTime = (time: string): string => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = (h || 0) >= 12 ? 'PM' : 'AM';
    const displayH = (h || 0) % 12 || 12;
    return `${displayH}:${String(m || 0).padStart(2, '0')} ${ampm}`;
  };

  const handleProposeVisit = async () => {
    if (!providerId || !proposeForm.clientId || !proposeForm.visitDate) {
      showToast({ message: 'Please fill in all required fields' });
      return;
    }

    if (!proposeForm.visitTime || !proposeForm.visitEndTime) {
      showToast({ message: 'Please select both start and end times' });
      return;
    }

    if (proposeForm.visitTime >= proposeForm.visitEndTime) {
      showToast({ message: 'End time must be after start time' });
      return;
    }

    const client = clients.find(c => c.id === proposeForm.clientId);
    if (!client) {
      showToast({ message: 'Please select a valid client' });
      return;
    }

    // Check for double-booking
    const conflict = await checkProviderConflict(
      providerId,
      proposeForm.visitDate,
      proposeForm.visitTime,
      proposeForm.visitEndTime
    );

    if (conflict) {
      setConflictWarning(conflict + ' Please choose a different date or time.');
      return;
    }

    try {
      const visitMonth = proposeForm.visitDate.substring(0, 7) + '-01'; // YYYY-MM-01
      const timeSlotDisplay = `${proposeForm.visitTime}-${proposeForm.visitEndTime}`;
      const { error } = await supabase.from('pro_monthly_visits').insert({
        pro_provider_id: providerId,
        homeowner_id: client.id,
        home_id: client.home_id,
        visit_month: visitMonth,
        proposed_date: proposeForm.visitDate,
        proposed_time_slot: timeSlotDisplay,
        status: 'proposed',
      });

      if (error) throw error;

      setProposeForm({ clientId: '', homeId: '', visitDate: '', visitTime: '09:00', visitEndTime: '12:00' });
      setShowProposeForm(false);
      setConflictWarning('');
      await loadVisits(providerId, providerZips);
      showToast({ message: 'Visit proposal sent. Awaiting homeowner confirmation.' });
    } catch (err: any) {
      logger.error('Error proposing visit:', err);
      showToast({ message: 'Failed to propose visit: ' + (err.message || '') });
    }
  };

  const handleStartVisit = async (visit: CalendarVisit) => {
    try {
      const table = visit.type === 'bimonthly' ? 'pro_monthly_visits' : 'pro_service_appointments';
      const updateData = visit.type === 'bimonthly'
        ? { status: 'in_progress', started_at: new Date().toISOString() }
        : { status: 'in_progress' };

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', visit.id);

      if (error) throw error;

      // For bimonthly visits, navigate to inspection flow
      if (visit.type === 'bimonthly') {
        navigate(`/pro-portal/inspection/${visit.id}`);
        return;
      }

      await loadVisits(providerId, providerZips);
    } catch (err) {
      logger.error('Error starting visit:', err);
      showToast({ message: 'Failed to start visit' });
    }
  };

  const handleCompleteVisit = async (visit: CalendarVisit) => {
    if (!completeForm.timeSpent) {
      showToast({ message: 'Please enter time spent' });
      return;
    }

    try {
      const table = visit.type === 'bimonthly' ? 'pro_monthly_visits' : 'pro_service_appointments';

      if (visit.type === 'bimonthly') {
        const { error } = await supabase
          .from(table)
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            time_spent_minutes: parseInt(completeForm.timeSpent),
            pro_notes: completeForm.notes,
          })
          .eq('id', visit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(table)
          .update({
            status: 'completed',
            notes: completeForm.notes,
            actual_cost: null,
          })
          .eq('id', visit.id);
        if (error) throw error;
      }

      setCompleteFormId(null);
      setCompleteForm({ timeSpent: '', notes: '' });
      await loadVisits(providerId, providerZips);
      showToast({ message: 'Visit completed successfully' });
    } catch (err) {
      logger.error('Error completing visit:', err);
      showToast({ message: 'Failed to complete visit' });
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'proposed': return Colors.warning;
      case 'confirmed': return Colors.success;
      case 'in_progress': return Colors.info;
      case 'completed': return Colors.sage;
      case 'scheduled': return Colors.sage;
      case 'pending': return Colors.warning;
      default: return Colors.medGray;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'proposed': return 'Awaiting Confirmation';
      case 'confirmed': return 'Confirmed';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'scheduled': return 'Scheduled';
      case 'pending': return 'Pending';
      default: return status;
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
            &larr; Back
          </button>
          <h1>Visit Schedule</h1>
          <p className="subtitle">{visits.length} visit{visits.length !== 1 ? 's' : ''} this month</p>
        </div>
        {!isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowProposeForm(!showProposeForm)}>
            {showProposeForm ? 'Cancel' : 'Propose Visit'}
          </button>
        )}
      </div>

      {/* Month Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
        >
          &larr; Previous
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, minWidth: 150, textAlign: 'center' }}>
          {monthDisplay}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
        >
          Next &rarr;
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
                onChange={(e) => {
                  const client = clients.find(c => c.id === e.target.value);
                  setProposeForm({
                    ...proposeForm,
                    clientId: e.target.value,
                    homeId: client?.home_id || '',
                  });
                }}
              >
                <option value="">Select client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} — {c.address}, {c.city}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 4 }}>
                  No Pro/Pro+ clients in your service area.
                </p>
              )}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Start Time *
              </label>
              <input
                type="time"
                className="form-input"
                value={proposeForm.visitTime}
                onChange={(e) => {
                  setProposeForm({ ...proposeForm, visitTime: e.target.value });
                  setConflictWarning('');
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                End Time *
              </label>
              <input
                type="time"
                className="form-input"
                value={proposeForm.visitEndTime}
                onChange={(e) => {
                  setProposeForm({ ...proposeForm, visitEndTime: e.target.value });
                  setConflictWarning('');
                }}
              />
            </div>
          </div>
          {conflictWarning && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              backgroundColor: 'var(--color-copper-muted, #FFF3F3)', border: '1px solid #FFCDD2', color: 'var(--color-error)', fontSize: 13,
            }}>
              {conflictWarning}
            </div>
          )}
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
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>&#128197;</div>
          <h3>No visits this month</h3>
          <p>{isAdmin ? 'No visits scheduled for any provider.' : 'Propose a visit to get started.'}</p>
        </div>
      ) : (
        <div className="grid-1" style={{ gap: 16 }}>
          {visits.map(visit => (
            <div key={`${visit.type}-${visit.id}`} className="card" style={{
              borderLeft: `4px solid ${visit.type === 'bimonthly' ? Colors.sage : Colors.copper}`,
            }}>
              {/* Visit Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      backgroundColor: visit.type === 'bimonthly' ? Colors.sageMuted : Colors.copperMuted,
                      color: visit.type === 'bimonthly' ? Colors.sage : Colors.copper,
                    }}>
                      {visit.type === 'bimonthly' ? 'Bimonthly' : 'Service'}
                    </span>
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
                      <span style={{ fontSize: 12, color: Colors.medGray }}>
                        {visit.time_spent_minutes} min
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{visit.title}</h3>
                </div>
              </div>

              {/* Visit Details */}
              <div style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${Colors.lightGray}` }}>
                {visit.homeowner_name && (
                  <p style={{ margin: '0 0 4px 0' }}>
                    <strong>Homeowner:</strong> {visit.homeowner_name}
                  </p>
                )}
                {visit.address && (
                  <p style={{ margin: '0 0 4px 0' }}>
                    <strong>Address:</strong> {visit.address}, {visit.city}, {visit.state}
                  </p>
                )}
                <p style={{ margin: '0 0 4px 0' }}>
                  <strong>Date:</strong> {visit.date ? new Date(visit.date + 'T12:00:00').toLocaleDateString() : '—'}
                  {visit.time ? ` at ${visit.time.includes('-')
                    ? visit.time.split('-').map(t => formatTime(t.trim())).join(' – ')
                    : formatTime(visit.time)}` : ''}
                </p>
                {visit.purpose && (
                  <p style={{ margin: 0 }}>
                    <strong>Purpose:</strong> {visit.purpose}
                  </p>
                )}
                {visit.homeowner_notes && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 6,
                    backgroundColor: Colors.copperMuted, border: `1px solid ${Colors.copper}30`,
                  }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: Colors.copper }}>Homeowner Notes:</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: Colors.charcoal }}>{visit.homeowner_notes}</p>
                  </div>
                )}
              </div>

              {/* Status-Specific Content */}
              {visit.status === 'proposed' && (
                <div style={{ color: Colors.warning, fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>
                  Waiting for homeowner to confirm this visit.
                </div>
              )}

              {visit.status === 'completed' && visit.notes && (
                <div style={{ backgroundColor: Colors.warmWhite, padding: 12, borderRadius: 6, marginBottom: 12 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 600 }}>Completion Notes:</p>
                  <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{visit.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {visit.status === 'confirmed' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleStartVisit(visit)}
                    style={{ flex: 1 }}
                  >
                    {visit.type === 'bimonthly' ? 'Start Inspection' : 'Start Visit'}
                  </button>
                )}

                {visit.status === 'in_progress' && visit.type === 'bimonthly' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => navigate(`/pro-portal/inspection/${visit.id}`)}
                    style={{ flex: 1 }}
                  >
                    Continue Inspection
                  </button>
                )}

                {visit.status === 'in_progress' && visit.type === 'service' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setCompleteFormId(completeFormId === visit.id ? null : visit.id)}
                    style={{ flex: 1 }}
                  >
                    Complete Visit
                  </button>
                )}

                {visit.status === 'scheduled' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleStartVisit(visit)}
                    style={{ flex: 1 }}
                  >
                    Start Visit
                  </button>
                )}
              </div>

              {/* Complete Visit Form (service appointments only) */}
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

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleCompleteVisit(visit)}
                      style={{ flex: 1 }}
                    >
                      Save &amp; Complete
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
