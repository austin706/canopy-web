import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';
import { showToast } from '@/components/Toast';
import logger from '@/utils/logger';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface HomeAddOn {
  id: string;
  home_id: string;
  user_id: string;
  category_id: string;
  status: string;
  estimated_price: number | null;
  quoted_price: number | null;
  approved_price: number | null;
  billing_frequency: string | null;
  assigned_provider_id: string | null;
  service_notes: string | null;
  provider_notes: string | null;
  created_at: string;
  status_changed_at: string;
  // Joined
  home?: { address?: string; city?: string; state?: string; zip_code?: string };
  profile?: { first_name?: string; last_name?: string; email?: string };
  category?: { display_name?: string; icon?: string; frequency?: string; is_recurring?: boolean };
}

interface AddOnProvider {
  id: string;
  provider_id: string;
  category_id: string;
  company_name: string;
  contact_name: string | null;
  active: boolean;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  requested: { label: 'Requested', bg: Colors.warning + '20', color: Colors.warning },
  assessing: { label: 'Assessing', bg: Colors.info + '20', color: Colors.info },
  quoted: { label: 'Quoted', bg: Colors.copper + '20', color: Colors.copper },
  approved: { label: 'Approved', bg: Colors.sage + '20', color: Colors.sage },
  active: { label: 'Active', bg: Colors.success + '20', color: Colors.success },
  paused: { label: 'Paused', bg: Colors.medGray + '20', color: Colors.medGray },
  cancelled: { label: 'Cancelled', bg: Colors.error + '20', color: Colors.error },
};

// Keep in sync with ALLOWED_BILLING_FREQUENCIES in submit-add-on-quote and
// INTERVAL_MAP in create-add-on-checkout + the home_add_ons.billing_frequency
// CHECK constraint (migrations 057/075).
const FREQ_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'bimonthly', label: 'Every 2 months' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Twice/year' },
  { value: 'annual', label: 'Annual' },
  { value: 'as_needed', label: 'As needed' },
];

export default function AdminAddOns() {
  const { user } = useStore();
  const [addOns, setAddOns] = useState<HomeAddOn[]>([]);
  const [providers, setProviders] = useState<AddOnProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending'); // pending | all | active | cancelled

  // Quote form state
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteFrequency, setQuoteFrequency] = useState('');
  const [quoteProviderId, setQuoteProviderId] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load add-ons with joins
      let query = supabase
        .from('home_add_ons')
        .select(`
          *,
          home:homes(address, city, state, zip_code),
          profile:profiles!home_add_ons_user_id_fkey(first_name, last_name, email),
          category:add_on_categories(display_name, icon, frequency, is_recurring)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.in('status', ['requested', 'assessing']);
      } else if (filter === 'active') {
        query = query.in('status', ['quoted', 'approved', 'active']);
      } else if (filter === 'cancelled') {
        query = query.in('status', ['cancelled', 'paused']);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAddOns(data || []);

      // Load providers
      const { data: provData } = await supabase
        .from('add_on_providers')
        .select('id, provider_id, category_id, company_name, contact_name, active')
        .eq('active', true)
        .order('company_name');
      setProviders(provData || []);
    } catch (err) {
      logger.error('Failed to load add-on data:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadData(); }, [filter, loadData]);

  const handleSubmitQuote = async (addOnId: string) => {
    const price = parseFloat(quotePrice);
    if (!price || price <= 0) {
      showToast({ message: 'Enter a valid price' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const body: Record<string, unknown> = {
        home_add_on_id: addOnId,
        quoted_price: price,
      };
      if (quoteFrequency) body.billing_frequency = quoteFrequency;
      if (quoteProviderId) body.assign_provider_id = quoteProviderId;
      if (quoteNotes) body.provider_notes = quoteNotes;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-add-on-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit quote');

      // P2 #58 (2026-04-23): audit-log admin quote submission so we can trace
      // who quoted what price / assigned which provider.
      const auditTarget = addOns.find(a => a.id === addOnId);
      logAdminAction('addon.quote_submit', 'home_add_on', addOnId, {
        category_id: auditTarget?.category_id,
        category_label: auditTarget?.category?.display_name,
        homeowner_email: auditTarget?.profile?.email,
        home_address: auditTarget?.home?.address,
        quoted_price: price,
        billing_frequency: quoteFrequency || null,
        assigned_provider_id: quoteProviderId || null,
        provider_notes: quoteNotes || null,
      }).catch(() => {});

      showToast({ message: `Quote submitted: $${price}` });
      setQuotingId(null);
      setQuotePrice('');
      setQuoteFrequency('');
      setQuoteProviderId('');
      setQuoteNotes('');
      await loadData();
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to submit quote' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-wide"><PageSkeleton rows={6} /></div>;

  const pendingCount = addOns.filter(a => a.status === 'requested' || a.status === 'assessing').length;

  return (
    <div className="page-wide">
      <div className="admin-page-header mb-lg">
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Add-On Services</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage add-on quotes, assignments, and service status
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid mb-lg">
        {[
          { label: 'Needs Quote', value: addOns.filter(a => a.status === 'requested' || a.status === 'assessing').length, color: Colors.warning },
          { label: 'Quoted', value: addOns.filter(a => a.status === 'quoted').length, color: Colors.copper },
          { label: 'Active', value: addOns.filter(a => a.status === 'active').length, color: Colors.success },
          { label: 'Total', value: addOns.length, color: Colors.sage },
        ].map(kpi => (
          <div key={kpi.label} className="admin-kpi-card">
            <div className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="kpi-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'pending', label: `Needs Quote (${pendingCount})` },
          { key: 'active', label: 'Active / Quoted' },
          { key: 'all', label: 'All' },
          { key: 'cancelled', label: 'Cancelled / Paused' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: filter === tab.key ? `2px solid ${Colors.sage}` : '1px solid var(--color-border)',
              background: filter === tab.key ? Colors.sage + '15' : 'var(--color-card)',
              color: filter === tab.key ? Colors.sage : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Add-On Table */}
      {addOns.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
          No add-ons in this category.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {addOns.map(addon => {
            const ss = STATUS_STYLES[addon.status] || STATUS_STYLES.requested;
            const isQuoting = quotingId === addon.id;
            const needsQuote = addon.status === 'requested' || addon.status === 'assessing';
            const categoryProviders = providers.filter(p => p.category_id === addon.category_id);

            return (
              <div
                key={addon.id}
                style={{
                  background: 'var(--color-card)',
                  border: isQuoting ? `2px solid ${Colors.sage}` : '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '16px 20px',
                }}
              >
                {/* Main Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>
                        {addon.category?.display_name || addon.category_id}
                      </span>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 5,
                        fontSize: 11, fontWeight: 600, backgroundColor: ss.bg, color: ss.color,
                      }}>{ss.label}</span>
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <div>
                        <strong>Homeowner:</strong> {addon.profile?.first_name} {addon.profile?.last_name} ({addon.profile?.email})
                      </div>
                      <div>
                        <strong>Address:</strong> {addon.home?.address}, {addon.home?.city}, {addon.home?.state} {addon.home?.zip_code}
                      </div>
                      {addon.estimated_price && (
                        <div><strong>Estimated:</strong> ${addon.estimated_price}/mo</div>
                      )}
                      {addon.quoted_price && (
                        <div><strong>Quoted:</strong> <span style={{ color: Colors.copper, fontWeight: 600 }}>${addon.quoted_price}/{addon.billing_frequency || 'mo'}</span></div>
                      )}
                      {addon.approved_price && (
                        <div><strong>Approved:</strong> <span style={{ color: Colors.sage, fontWeight: 600 }}>${addon.approved_price}/{addon.billing_frequency || 'mo'}</span></div>
                      )}
                      {addon.service_notes && (
                        <div><strong>Customer Notes:</strong> {addon.service_notes}</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                        Requested {new Date(addon.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    {needsQuote && !isQuoting && (
                      <button
                        onClick={() => {
                          setQuotingId(addon.id);
                          setQuotePrice(addon.estimated_price?.toString() || '');
                          setQuoteFrequency(addon.billing_frequency || addon.category?.frequency || 'monthly');
                        }}
                        style={{
                          padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                          background: Colors.sage, color: Colors.white, border: 'none', cursor: 'pointer',
                        }}
                      >
                        Submit Quote
                      </button>
                    )}
                    {isQuoting && (
                      <button
                        onClick={() => { setQuotingId(null); setQuotePrice(''); setQuoteNotes(''); }}
                        style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: 12,
                          background: 'transparent', color: Colors.medGray,
                          border: `1px solid ${Colors.medGray}`, cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Quote Form (inline expand) */}
                {isQuoting && (
                  <div style={{
                    marginTop: 16, paddingTop: 16,
                    borderTop: '1px solid var(--color-border)',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                  }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Quoted Price *
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 600 }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quotePrice}
                          onChange={e => setQuotePrice(e.target.value)}
                          placeholder="85.00"
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 14,
                            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Billing Frequency
                      </label>
                      <select
                        value={quoteFrequency}
                        onChange={e => setQuoteFrequency(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
                          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {FREQ_OPTIONS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>

                    {categoryProviders.length > 0 && (
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                          Assign Provider
                        </label>
                        <select
                          value={quoteProviderId}
                          onChange={e => setQuoteProviderId(e.target.value)}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
                            border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <option value="">— None —</option>
                          {categoryProviders.map(p => (
                            <option key={p.id} value={p.id}>{p.company_name}{p.contact_name ? ` (${p.contact_name})` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div style={{ gridColumn: categoryProviders.length > 0 ? '2' : '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Provider Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={quoteNotes}
                        onChange={e => setQuoteNotes(e.target.value)}
                        placeholder="e.g. Assessed on-site 4/15, standard lot"
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 14,
                          border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={() => handleSubmitQuote(addon.id)}
                        disabled={submitting || !quotePrice}
                        style={{
                          padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 700,
                          background: Colors.sage, color: Colors.white, border: 'none',
                          cursor: submitting ? 'wait' : 'pointer',
                          opacity: submitting || !quotePrice ? 0.6 : 1,
                        }}
                      >
                        {submitting ? 'Submitting...' : `Submit Quote — $${quotePrice || '0'}/${quoteFrequency || 'mo'}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
