import { useState, useEffect, lazy, Suspense } from 'react';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';

const Visits = lazy(() => import('@/pages/Visits'));
const Quotes = lazy(() => import('@/pages/Quotes'));
const Invoices = lazy(() => import('@/pages/Invoices'));

interface ProServiceAppointment {
  id: string;
  title: string;
  date: string;
  status: 'pending' | 'requested' | 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  purpose: string;
}

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  priceRange?: string;
  priceMin?: number;
  turnaround?: string;
  includes?: string[];
}

// ── Ad-hoc services available to ALL tiers ──
const AD_HOC_SERVICES: ServiceItem[] = [
  {
    id: 'adhoc-visit',
    title: 'Ad-Hoc Pro Visit',
    description: 'Schedule a one-time visit from a Canopy pro for specific maintenance tasks or concerns.',
    icon: '🔧',
    priceRange: '$149',
    priceMin: 149,
    turnaround: 'Scheduled within 1 week',
    includes: ['60-minute focused visit', 'Up to 3 task items', 'Inspection notes & photos', 'Visit logged to your home record'],
  },
  {
    id: 'hvac-tune-up',
    title: 'HVAC Tune-Up',
    description: 'Professional AC/furnace maintenance and inspection.',
    icon: '❄️',
    priceRange: '$89–$149',
    priceMin: 89,
    turnaround: 'Scheduled within 2 weeks',
    includes: ['System inspection & cleaning', 'Filter replacement', 'Performance check', 'Written report'],
  },
  {
    id: 'gutter-cleaning',
    title: 'Gutter Cleaning',
    description: 'Complete gutter cleaning, flush, and debris removal.',
    icon: '🏠',
    priceRange: '$99–$149',
    priceMin: 99,
    turnaround: 'Scheduled within 2 weeks',
    includes: ['Full gutter cleanout', 'Downspout flush', 'Damage inspection', 'Photo documentation'],
  },
  {
    id: 'pest-treatment',
    title: 'Pest Treatment',
    description: 'Professional pest control inspection and prevention treatment.',
    icon: '🐛',
    priceRange: '$99–$179',
    priceMin: 99,
    turnaround: 'Scheduled within 1 week',
    includes: ['Interior/exterior inspection', 'Targeted treatment', 'Prevention recommendations', 'Follow-up plan'],
  },
  {
    id: 'annual-inspection',
    title: 'Annual Home Inspection',
    description: 'Comprehensive inspection of your entire home — roof to foundation, all systems, all equipment.',
    icon: '🔍',
    priceRange: '$199–$249',
    priceMin: 199,
    turnaround: 'Scheduled within 2 weeks',
    includes: ['Full home walkthrough', 'Equipment condition assessment', 'Photo documentation', 'Written report with recommendations', 'Record added to your Home Token'],
  },
  {
    id: 'emergency-callout',
    title: 'Emergency Callout',
    description: 'Urgent same-day or next-day service for unexpected issues — leaks, electrical problems, HVAC failure.',
    icon: '🚨',
    priceRange: '$199',
    priceMin: 199,
    turnaround: 'Same-day or next-day',
    includes: ['Priority scheduling', 'Diagnostic assessment', 'Temporary fix if possible', 'Quote for full repair'],
  },
  {
    id: 'custom-other',
    title: 'Custom Request',
    description: 'Need something else? Describe what you need and we\'ll get you a quote.',
    icon: '📋',
    turnaround: 'Quote within 48 hours',
  },
];

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  requested: Colors.warning,
  scheduled: Colors.info,
  confirmed: Colors.sage,
  completed: Colors.success,
  cancelled: Colors.medGray,
};

type SubTab = 'services' | 'visits' | 'quotes' | 'invoices';

export default function ProServices() {
  const { user, home } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SubTab>('services');
  const [appointments, setAppointments] = useState<ProServiceAppointment[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [formData, setFormData] = useState({ date: '', time: '', notes: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tier = user?.subscription_tier || 'free';
  const isPro = tier === 'pro' || tier === 'pro_plus';
  const isProPlus = tier === 'pro_plus';

  useEffect(() => {
    if (home) fetchAppointments();
  }, [home]);

  const fetchAppointments = async () => {
    try {
      if (!home) return;
      const { data: apptData } = await supabase
        .from('pro_service_appointments')
        .select('*')
        .eq('home_id', home.id)
        .order('scheduled_date', { ascending: true });

      const directAppts: ProServiceAppointment[] = (apptData || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        date: row.scheduled_date,
        status: row.status,
        purpose: row.service_purpose || row.description || '',
      }));

      const { data: reqData } = await supabase
        .from('pro_requests')
        .select('*, provider:provider_id(business_name)')
        .eq('home_id', home.id)
        .in('status', ['matched', 'scheduled'])
        .order('created_at', { ascending: false });

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

  const handleRequestService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !home || !user?.id) return;
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (selectedService.priceMin) {
        // Create a quote request for priced services
        const { createQuote } = await import('@/services/quotesInvoices');
        await createQuote(
          home.id,
          user.id,
          '',
          selectedService.title,
          `${selectedService.description}${formData.notes ? '\n\nCustomer notes: ' + formData.notes : ''}${formData.date ? '\nPreferred date: ' + formData.date : ''}`,
          [{ description: selectedService.title, amount: selectedService.priceMin, quantity: 1, unit_price: selectedService.priceMin }],
          'one_off',
          0
        );
      } else {
        // Custom request — just create an appointment entry
        await supabase.from('pro_service_appointments').insert({
          id: crypto.randomUUID(),
          home_id: home.id,
          title: selectedService.title,
          scheduled_date: formData.date || null,
          scheduled_time: formData.time || null,
          status: 'pending',
          service_purpose: formData.notes || selectedService.description,
          description: selectedService.description,
          notes: formData.notes,
          created_at: new Date().toISOString(),
        });
      }

      setSuccess(`Your ${selectedService.title} request has been submitted! We'll follow up shortly.`);
      setSelectedService(null);
      setFormData({ date: '', time: '', notes: '' });
      fetchAppointments();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setIsLoading(false);
    }
  };

  if (!home) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <p>Please set up your home first.</p>
      </div>
    );
  }

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'services', label: 'Services' },
    { key: 'visits', label: 'Visits' },
    { key: 'quotes', label: 'Quotes' },
    { key: 'invoices', label: 'Invoices' },
  ];

  // Sub-tab rendering for Visits, Quotes, Invoices
  if (activeTab !== 'services') {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: Colors.charcoal, marginBottom: 16 }}>Pro Services</h1>
        <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${Colors.cream}`, marginBottom: 24 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '10px 20px', fontSize: 14, fontWeight: activeTab === t.key ? 700 : 500,
              color: activeTab === t.key ? Colors.sage : Colors.medGray, background: 'none', border: 'none',
              borderBottomWidth: 3, borderBottomStyle: 'solid',
              borderBottomColor: activeTab === t.key ? Colors.sage : 'transparent', cursor: 'pointer', marginBottom: -2,
            }}>{t.label}</button>
          ))}
        </div>
        <Suspense fallback={<p style={{ color: Colors.medGray }}>Loading...</p>}>
          {activeTab === 'visits' && <Visits />}
          {activeTab === 'quotes' && <Quotes />}
          {activeTab === 'invoices' && <Invoices />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: Colors.charcoal, marginBottom: 16 }}>Pro Services</h1>
      <div style={{ display: 'flex', gap: 0, borderBottom: `2px solid ${Colors.cream}`, marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '10px 20px', fontSize: 14, fontWeight: activeTab === t.key ? 700 : 500,
            color: activeTab === t.key ? Colors.sage : Colors.medGray, background: 'none', border: 'none',
            borderBottomWidth: 3, borderBottomStyle: 'solid',
            borderBottomColor: activeTab === t.key ? Colors.sage : 'transparent', cursor: 'pointer', marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Your Plan ── */}
      <div className="card mb-lg" style={{ padding: '20px 24px', background: isPro ? Colors.sageMuted : Colors.cream }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: Colors.charcoal, margin: '0 0 4px' }}>
              {isProPlus ? 'Pro+ Concierge' : isPro ? 'Pro Plan' : tier === 'home' ? 'Home Plan' : 'Free Plan'}
            </p>
            <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>
              {isProPlus
                ? 'Full concierge service — all maintenance handled for you. Contact your Canopy team for anything.'
                : isPro
                ? 'Includes bimonthly maintenance visits from your assigned Canopy pro.'
                : 'Request any service below on-demand. Upgrade to Pro for scheduled maintenance visits.'}
            </p>
          </div>
          {!isPro && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/subscription')} style={{ flexShrink: 0 }}>
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* ── Pro/Pro+ Included Visits ── */}
      {isPro && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>
            {isProPlus ? 'Your Concierge Service' : 'Your Bimonthly Visits'}
          </h2>
          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
            {isProPlus
              ? 'Your Pro+ plan includes complete home care management. Your Canopy team handles scheduling, maintenance, and coordination — just let us know what you need.'
              : 'Your Pro plan includes a maintenance visit from your assigned Canopy pro every other month. These visits cover routine inspections, filter changes, and minor tasks.'}
          </p>

          {/* Upcoming visit appointments */}
          {appointments.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {appointments
                .filter(a => a.status !== 'completed' && a.status !== 'cancelled')
                .map(apt => (
                  <div key={apt.id} className="card" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: '0 0 4px' }}>
                          {apt.title}
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, marginLeft: 8,
                            backgroundColor: (STATUS_COLORS[apt.status] || Colors.medGray) + '20',
                            color: STATUS_COLORS[apt.status] || Colors.medGray,
                          }}>{apt.status === 'pending' ? 'Requested' : apt.status}</span>
                        </p>
                        <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                          {new Date(apt.date).toLocaleDateString()} — {apt.purpose}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: Colors.medGray }}>
              <p style={{ margin: 0, fontSize: 14 }}>No upcoming visits scheduled. Your next visit will be coordinated by your Canopy team.</p>
            </div>
          )}
        </div>
      )}

      {/* ── On-Demand Services (all tiers) ── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>On-Demand Services</h2>
        <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
          Available to all Canopy members. Request any service and we'll get you scheduled.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {AD_HOC_SERVICES.map(service => (
            <div
              key={service.id}
              onClick={() => { setSelectedService(service); setError(''); setSuccess(''); }}
              className="card"
              style={{
                padding: '18px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                border: selectedService?.id === service.id ? `2px solid ${Colors.sage}` : `2px solid transparent`,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{service.icon}</div>
              <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: '0 0 4px' }}>{service.title}</p>
              {service.priceRange && (
                <p style={{ fontSize: 13, fontWeight: 600, color: Colors.sage, margin: '0 0 4px' }}>{service.priceRange}</p>
              )}
              <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>{service.turnaround || ''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Service Request Form ── */}
      {selectedService && (
        <div className="card" style={{ padding: '24px', marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 4 }}>
            Request: {selectedService.title}
          </h2>
          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>{selectedService.description}</p>

          {selectedService.includes && selectedService.includes.length > 0 && (
            <div style={{ marginBottom: 16, padding: '12px 16px', backgroundColor: Colors.sageMuted, borderRadius: 8 }}>
              <p style={{ fontWeight: 600, fontSize: 13, color: Colors.charcoal, margin: '0 0 8px' }}>What's included:</p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {selectedService.includes.map((item, i) => (
                  <li key={i} style={{ fontSize: 13, color: Colors.charcoal, marginBottom: 4 }}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleRequestService}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: Colors.charcoal }}>Preferred Date</label>
                <input type="date" className="form-input" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: Colors.charcoal }}>Preferred Time</label>
                <input type="time" className="form-input" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: Colors.charcoal }}>Notes</label>
              <textarea
                className="form-input"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Describe what you need or any special instructions..."
                style={{ minHeight: 80, resize: 'vertical' }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#FFF3F3', border: '1px solid #FFCDD2', color: '#C62828', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: '#E8F5E9', border: '1px solid #C8E6C9', color: '#2E7D32', fontSize: 13, marginBottom: 12 }}>
                {success}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? 'Submitting...' : 'Request Service'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setSelectedService(null); setError(''); setSuccess(''); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Past Appointments ── */}
      {appointments.filter(a => a.status === 'completed').length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 12 }}>Past Services</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {appointments
              .filter(a => a.status === 'completed')
              .map(apt => (
                <div key={apt.id} className="card" style={{ padding: '12px 18px', opacity: 0.8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: 14, color: Colors.charcoal, margin: '0 0 2px' }}>{apt.title}</p>
                      <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>{new Date(apt.date).toLocaleDateString()} — {apt.purpose}</p>
                    </div>
                    <span style={{ fontSize: 11, color: Colors.success, fontWeight: 600 }}>Completed</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
