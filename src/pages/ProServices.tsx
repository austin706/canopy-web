import { useState, useEffect, lazy, Suspense } from 'react';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';

const Visits = lazy(() => import('@/pages/Visits'));
const Quotes = lazy(() => import('@/pages/Quotes'));
const Invoices = lazy(() => import('@/pages/Invoices'));

interface ServiceRequest {
  id: string;
  title: string;
  date: string;
  status: string;
  description: string;
  source: 'pro_request' | 'appointment';
}

interface NextVisit {
  id: string;
  visit_month: string;
  proposed_date: string | null;
  confirmed_date: string | null;
  status: string;
  homeowner_notes: string;
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
  matched: Colors.info,
  scheduled: Colors.info,
  proposed: Colors.info,
  confirmed: Colors.sage,
  completed: Colors.success,
  cancelled: Colors.medGray,
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Requested',
  requested: 'Requested',
  matched: 'Matched',
  scheduled: 'Scheduled',
  proposed: 'Proposed',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

type SubTab = 'services' | 'visits' | 'quotes' | 'invoices';

export default function ProServices() {
  const { user, home } = useStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SubTab>('services');

  // Bimonthly visit state
  const [nextVisit, setNextVisit] = useState<NextVisit | null>(null);
  const [visitNotes, setVisitNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Service requests state (ad-hoc requests from pro_requests + pro_service_appointments)
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

  // New service request form
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [formData, setFormData] = useState({ date: '', time: '', notes: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tier = user?.subscription_tier || 'free';
  const isPro = tier === 'pro' || tier === 'pro_plus';
  const isProPlus = tier === 'pro_plus';

  useEffect(() => {
    if (home && user) {
      fetchServiceRequests();
      if (isPro) fetchNextVisit();
    }
  }, [home, user]);

  // Fetch the next upcoming bimonthly visit from pro_monthly_visits
  const fetchNextVisit = async () => {
    try {
      if (!user) return;
      const { data } = await supabase
        .from('pro_monthly_visits')
        .select('*')
        .eq('homeowner_id', user.id)
        .in('status', ['proposed', 'confirmed', 'pending'])
        .order('visit_month', { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        const visit = data[0];
        setNextVisit({
          id: visit.id,
          visit_month: visit.visit_month,
          proposed_date: visit.proposed_date,
          confirmed_date: visit.confirmed_date,
          status: visit.status,
          homeowner_notes: visit.homeowner_notes || '',
        });
        setVisitNotes(visit.homeowner_notes || '');
      } else {
        setNextVisit(null);
      }
    } catch (err) {
      console.warn('Failed to fetch next visit:', err);
    }
  };

  // Fetch ad-hoc service requests (pro_requests + pro_service_appointments)
  const fetchServiceRequests = async () => {
    try {
      if (!home) return;

      // Fetch from pro_requests
      const { data: reqData } = await supabase
        .from('pro_requests')
        .select('*, provider:provider_id(business_name)')
        .eq('home_id', home.id)
        .order('created_at', { ascending: false });

      const requests: ServiceRequest[] = (reqData || []).map((r: any) => ({
        id: `req-${r.id}`,
        title: `${r.category.charAt(0).toUpperCase() + r.category.slice(1)} Service`,
        date: r.scheduled_date || r.created_at,
        status: r.status,
        description: `${r.description}${r.provider?.business_name ? ` | Provider: ${r.provider.business_name}` : ''}`,
        source: 'pro_request' as const,
      }));

      // Fetch from pro_service_appointments (custom requests)
      const { data: apptData } = await supabase
        .from('pro_service_appointments')
        .select('*')
        .eq('home_id', home.id)
        .order('scheduled_date', { ascending: false });

      const appts: ServiceRequest[] = (apptData || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        date: a.scheduled_date || a.created_at,
        status: a.status,
        description: a.service_purpose || a.description || '',
        source: 'appointment' as const,
      }));

      setServiceRequests([...requests, ...appts]);
    } catch (err) {
      console.warn('Failed to fetch service requests:', err);
    }
  };

  // Save homeowner notes for the next bimonthly visit
  const handleSaveVisitNotes = async () => {
    if (!nextVisit) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      await supabase
        .from('pro_monthly_visits')
        .update({ homeowner_notes: visitNotes })
        .eq('id', nextVisit.id);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err) {
      console.warn('Failed to save visit notes:', err);
    } finally {
      setSavingNotes(false);
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
      fetchServiceRequests();
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

  const tabBar = (
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
  );

  if (activeTab !== 'services') {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: Colors.charcoal, marginBottom: 16 }}>Pro Services</h1>
        {tabBar}
        <Suspense fallback={<p style={{ color: Colors.medGray }}>Loading...</p>}>
          {activeTab === 'visits' && <Visits />}
          {activeTab === 'quotes' && <Quotes />}
          {activeTab === 'invoices' && <Invoices />}
        </Suspense>
      </div>
    );
  }

  const activeRequests = serviceRequests.filter(r => !['completed', 'cancelled'].includes(r.status));
  const pastRequests = serviceRequests.filter(r => r.status === 'completed');

  const visitDate = nextVisit?.confirmed_date || nextVisit?.proposed_date;
  const visitMonth = nextVisit?.visit_month
    ? new Date(nextVisit.visit_month + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: Colors.charcoal, marginBottom: 16 }}>Pro Services</h1>
      {tabBar}

      {/* ── Your Plan Banner ── */}
      <div className="card mb-lg" style={{ padding: '20px 24px', background: isPro ? Colors.sageMuted : Colors.cream }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: Colors.charcoal, margin: '0 0 4px' }}>
              {isProPlus ? 'Pro+ Concierge' : isPro ? 'Pro Plan' : tier === 'home' ? 'Home Plan' : 'Free Plan'}
            </p>
            <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>
              {isProPlus
                ? 'Full concierge service — all maintenance handled for you.'
                : isPro
                ? 'Includes 6 bimonthly maintenance visits per year from your assigned Canopy pro.'
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

      {/* ── Section 1: Next Bimonthly Visit (Pro/Pro+ only) ── */}
      {isPro && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>
            {isProPlus ? 'Your Next Concierge Visit' : 'Your Next Bimonthly Visit'}
          </h2>
          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
            {isProPlus
              ? 'Your Pro+ plan includes complete home care. Your Canopy team handles scheduling, maintenance, and coordination.'
              : 'Your Pro plan includes a maintenance visit every other month covering routine inspections, filter changes, and minor tasks. These visits are included in your plan at no extra cost.'}
          </p>

          {nextVisit ? (
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 16, color: Colors.charcoal, margin: '0 0 4px' }}>
                    {visitMonth} Visit
                  </p>
                  <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>
                    {visitDate
                      ? `${nextVisit.status === 'confirmed' ? 'Confirmed' : 'Proposed'}: ${new Date(visitDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
                      : 'Date pending — your Canopy team will propose a date soon.'}
                  </p>
                </div>
                <span style={{
                  display: 'inline-block', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  backgroundColor: (STATUS_COLORS[nextVisit.status] || Colors.medGray) + '20',
                  color: STATUS_COLORS[nextVisit.status] || Colors.medGray,
                }}>{STATUS_LABELS[nextVisit.status] || nextVisit.status}</span>
              </div>

              {/* Homeowner notes for the tech */}
              <div style={{ borderTop: `1px solid ${Colors.cream}`, paddingTop: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: Colors.charcoal, marginBottom: 6 }}>
                  Notes for your technician
                </label>
                <p style={{ fontSize: 12, color: Colors.medGray, margin: '0 0 8px' }}>
                  Anything specific you'd like checked during this visit? Leave notes here and your tech will see them before arriving.
                </p>
                <textarea
                  className="form-input"
                  value={visitNotes}
                  onChange={e => { setVisitNotes(e.target.value); setNotesSaved(false); }}
                  placeholder="e.g., AC seems to be running louder than usual, please check. Also the garage door opener has been slow..."
                  style={{ minHeight: 80, resize: 'vertical', marginBottom: 8 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveVisitNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                  {notesSaved && (
                    <span style={{ fontSize: 12, color: Colors.sage, fontWeight: 500 }}>Saved!</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: Colors.medGray }}>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 500 }}>No upcoming visit scheduled yet.</p>
              <p style={{ margin: 0, fontSize: 13 }}>Your Canopy team will coordinate your next bimonthly visit. Check the Visits tab for full history.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Section 2: Your Service Requests (ad-hoc, separate from bimonthly) ── */}
      {activeRequests.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>Your Service Requests</h2>
          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
            On-demand service requests you've submitted. These are separate from your included bimonthly visits.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeRequests.map(req => (
              <div key={req.id} className="card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: '0 0 4px' }}>
                      {req.title}
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, marginLeft: 8,
                        backgroundColor: (STATUS_COLORS[req.status] || Colors.medGray) + '20',
                        color: STATUS_COLORS[req.status] || Colors.medGray,
                      }}>{STATUS_LABELS[req.status] || req.status}</span>
                    </p>
                    <p style={{ fontSize: 12, color: Colors.medGray, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {new Date(req.date).toLocaleDateString()} — {req.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: On-Demand Services Catalog ── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>On-Demand Services</h2>
        <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
          Available to all Canopy members as add-ons. These are billed separately from your plan.
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

      {/* ── Past Service Requests ── */}
      {pastRequests.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: Colors.charcoal, marginBottom: 12 }}>Past Service Requests</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pastRequests.map(req => (
              <div key={req.id} className="card" style={{ padding: '12px 18px', opacity: 0.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 500, fontSize: 14, color: Colors.charcoal, margin: '0 0 2px' }}>{req.title}</p>
                    <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>{new Date(req.date).toLocaleDateString()} — {req.description}</p>
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
