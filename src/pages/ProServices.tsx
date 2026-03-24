import { useState, useEffect } from 'react';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { canAccess } from '@/services/subscriptionGate';

interface ProServiceTemplate {
  id: string;
  title: string;
  description: string;
}

interface ProServiceAppointment {
  id: string;
  title: string;
  date: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  purpose: string;
}

const PRO_SERVICE_TEMPLATES: ProServiceTemplate[] = [
  {
    id: 'hvac-tune-up',
    title: 'HVAC Tune-Up',
    description: 'Professional AC/furnace maintenance and inspection',
  },
  {
    id: 'gutter-cleaning',
    title: 'Gutter Cleaning',
    description: 'Complete gutter cleaning and debris removal',
  },
  {
    id: 'pest-treatment',
    title: 'Pest Treatment',
    description: 'Professional pest control and prevention',
  },
  {
    id: 'lawn-treatment',
    title: 'Lawn Treatment',
    description: 'Fertilization and lawn care service',
  },
  {
    id: 'pool-maintenance',
    title: 'Pool Maintenance',
    description: 'Pool cleaning, balancing, and equipment check',
  },
  {
    id: 'chimney-sweep',
    title: 'Chimney Sweep',
    description: 'Professional chimney cleaning and inspection',
  },
  {
    id: 'custom-other',
    title: 'Custom/Other',
    description: 'Any other professional service or custom request',
  },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: Colors.info,
  confirmed: Colors.sage,
  completed: Colors.success,
  cancelled: Colors.medGray,
};

export default function ProServices() {
  const { user, home } = useStore();
  const [appointments, setAppointments] = useState<ProServiceAppointment[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProServiceTemplate | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    reminderDays: '3',
    notes: '',
    itemsToHave: [''],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const tier = user?.subscription_tier || 'free';
  const hasAccess = canAccess(tier, 'pro_service_scheduler');

  useEffect(() => {
    if (home && hasAccess) {
      fetchAppointments();
    }
  }, [home, hasAccess]);

  const fetchAppointments = async () => {
    try {
      if (!home) return;
      // Fetch direct appointments
      const { data: apptData, error: apptErr } = await supabase
        .from('pro_service_appointments')
        .select('*')
        .eq('home_id', home.id)
        .order('scheduled_date', { ascending: true });

      if (apptErr) throw apptErr;

      const directAppts: ProServiceAppointment[] = (apptData || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        date: row.scheduled_date,
        status: row.status,
        purpose: row.service_purpose || row.description || '',
      }));

      // Also fetch pro_requests that are matched/scheduled (pipeline-generated services)
      const { data: reqData } = await supabase
        .from('pro_requests')
        .select('*, provider:provider_id(business_name)')
        .eq('home_id', home.id)
        .in('status', ['matched', 'scheduled'])
        .order('created_at', { ascending: false });

      // Filter out requests that already have a linked appointment
      const linkedRequestIds = new Set(
        (apptData || []).filter((a: any) => a.request_id).map((a: any) => a.request_id)
      );

      const requestAppts: ProServiceAppointment[] = (reqData || [])
        .filter((r: any) => !linkedRequestIds.has(r.id))
        .map((r: any) => ({
          id: `req-${r.id}`,
          title: `${r.category.charAt(0).toUpperCase() + r.category.slice(1)} Service`,
          date: r.scheduled_date || r.created_at,
          status: r.status === 'matched' ? 'confirmed' as const : 'scheduled' as const,
          purpose: `${r.description}${r.provider?.business_name ? ` • Provider: ${r.provider.business_name}` : ''}`,
        }));

      setAppointments([...directAppts, ...requestAppts]);
    } catch (err) {
      console.warn('Failed to fetch appointments:', err);
    }
  };

  const handleSubmitScheduling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !formData.date || !home) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const appointment = {
        id: crypto.randomUUID(),
        home_id: home.id,
        title: selectedTemplate.title,
        scheduled_date: formData.date,
        scheduled_time: formData.time || '09:00',
        status: 'scheduled',
        service_purpose: selectedTemplate.description,
        reminder_days_before: parseInt(formData.reminderDays, 10),
        notes: formData.notes,
        items_to_have_on_hand: formData.itemsToHave.filter(s => s.trim()),
        created_at: new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from('pro_service_appointments')
        .insert(appointment);

      if (err) throw err;

      setAppointments([...appointments, {
        id: appointment.id,
        title: appointment.title,
        date: appointment.scheduled_date,
        status: appointment.status,
        purpose: appointment.service_purpose,
      } as ProServiceAppointment]);
      setSelectedTemplate(null);
      setFormData({ date: '', time: '', reminderDays: '3', notes: '', itemsToHave: [''] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '32px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: Colors.charcoal,
    marginBottom: '16px',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: Colors.cardBackground,
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '12px',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  };

  const templateCardStyle: React.CSSProperties = {
    backgroundColor: Colors.cardBackground,
    border: `2px solid ${Colors.copper}`,
    borderRadius: '12px',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
  };

  const templateCardHoverStyle: React.CSSProperties = {
    ...templateCardStyle,
    boxShadow: `0 4px 12px ${Colors.copperMuted}`,
  };

  const badgeStyle = (status: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    backgroundColor: STATUS_COLORS[status] + '20',
    color: STATUS_COLORS[status],
    marginLeft: '8px',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: Colors.charcoal,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${Colors.lightGray}`,
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    backgroundColor: Colors.inputBackground,
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: Colors.sage,
    color: Colors.white,
    fontSize: '14px',
    fontWeight: '600',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
  };

  const closeButtonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: Colors.medGray,
    color: Colors.white,
    fontSize: '13px',
    cursor: 'pointer',
  };

  const upgradePromptStyle: React.CSSProperties = {
    backgroundColor: Colors.copperMuted,
    border: `1px solid ${Colors.copper}`,
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
  };

  const removeItemButtonStyle: React.CSSProperties = {
    padding: '4px 8px',
    backgroundColor: Colors.error,
    color: Colors.white,
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  };

  if (!home) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <p>Please set up your home first.</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: Colors.charcoal, marginBottom: '16px' }}>
          Pro Service Scheduler
        </h1>
        <div style={upgradePromptStyle}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', color: Colors.copper, marginBottom: '8px' }}>
            Upgrade to Access Pro Services
          </h2>
          <p style={{ fontSize: '14px', color: Colors.medGray, margin: '0 0 16px 0' }}>
            Schedule professional services directly from Canopy
          </p>
          <a
            href="/subscription"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: Colors.copper,
              color: Colors.white,
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '14px',
            }}
          >
            View Plans
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: '24px', fontWeight: '600', color: Colors.charcoal, marginBottom: '24px' }}>
        Pro Service Scheduler
      </h1>

      {/* Upcoming Appointments */}
      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Upcoming Appointments</h2>
        {appointments.length === 0 ? (
          <p style={{ fontSize: '14px', color: Colors.medGray }}>
            No appointments scheduled yet. Choose a service below to get started.
          </p>
        ) : (
          appointments.map((apt) => (
            <div key={apt.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: Colors.charcoal, margin: '0 0 4px 0' }}>
                    {apt.title}
                    <span style={badgeStyle(apt.status)}>{apt.status}</span>
                  </h3>
                  <p style={{ fontSize: '13px', color: Colors.medGray, margin: '0' }}>
                    {new Date(apt.date).toLocaleDateString()} — {apt.purpose}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Service Templates Grid */}
      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Available Services</h2>
        <div style={gridStyle}>
          {PRO_SERVICE_TEMPLATES.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              style={selectedTemplate?.id === template.id ? templateCardHoverStyle : templateCardStyle}
              onMouseEnter={(e) => {
                if (selectedTemplate?.id !== template.id) {
                  Object.assign(e.currentTarget.style, {
                    boxShadow: `0 2px 8px ${Colors.copperMuted}`,
                  });
                }
              }}
              onMouseLeave={(e) => {
                if (selectedTemplate?.id !== template.id) {
                  Object.assign(e.currentTarget.style, {
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  });
                }
              }}
            >
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: Colors.copper, marginBottom: '4px' }}>
                {template.title}
              </h3>
              <p style={{ fontSize: '12px', color: Colors.medGray, margin: '0' }}>
                {template.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Form */}
      {selectedTemplate && (
        <div style={sectionStyle}>
          <div style={cardStyle}>
            <h2 style={{ ...sectionTitleStyle, marginBottom: '20px' }}>
              Schedule {selectedTemplate.title}
            </h2>

            <form onSubmit={handleSubmitScheduling}>
              {/* Date */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Service Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={inputStyle}
                />
              </div>

              {/* Time */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Preferred Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  style={inputStyle}
                />
              </div>

              {/* Reminder Days */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Reminder (days before)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reminderDays}
                  onChange={(e) => setFormData({ ...formData, reminderDays: e.target.value })}
                  style={inputStyle}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special instructions or notes..."
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' } as React.CSSProperties}
                />
              </div>

              {/* Items to Have */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Items to Have on Hand</label>
                {formData.itemsToHave.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...formData.itemsToHave];
                        updated[index] = e.target.value;
                        setFormData({ ...formData, itemsToHave: updated });
                      }}
                      placeholder={`Item ${index + 1}`}
                      style={{ ...inputStyle, flex: 1 } as React.CSSProperties}
                    />
                    {formData.itemsToHave.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            itemsToHave: formData.itemsToHave.filter((_, i) => i !== index),
                          });
                        }}
                        style={removeItemButtonStyle}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      itemsToHave: [...formData.itemsToHave, ''],
                    });
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: Colors.sage,
                    color: Colors.white,
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  + Add Item
                </button>
              </div>

              {error && (
                <div
                  style={{
                    color: Colors.error,
                    fontSize: '14px',
                    marginBottom: '16px',
                    padding: '10px',
                    backgroundColor: Colors.error + '10',
                    borderRadius: '6px',
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" style={buttonStyle} disabled={isLoading}>
                  {isLoading ? 'Scheduling...' : 'Schedule Service'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  style={closeButtonStyle}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
