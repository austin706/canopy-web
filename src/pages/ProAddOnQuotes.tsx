import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';
import { showToast } from '@/components/Toast';
import { useTabState } from '@/utils/useTabState';
import logger from '@/utils/logger';

const ADDON_QUOTE_TABS = ['pending', 'quoted', 'active'] as const;
type AddOnQuoteTab = typeof ADDON_QUOTE_TABS[number];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface AssignedAddOn {
  id: string;
  home_id: string;
  user_id: string;
  category_id: string;
  status: string;
  estimated_price: number | null;
  quoted_price: number | null;
  approved_price: number | null;
  billing_frequency: string | null;
  service_notes: string | null;
  created_at: string;
  home?: { address?: string; city?: string; state?: string; zip_code?: string };
  profile?: { first_name?: string; last_name?: string };
  category?: { display_name?: string; icon?: string; frequency?: string };
}

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  requested: { label: 'Needs Quote', bg: Colors.warning + '20', color: Colors.warning },
  assessing: { label: 'Assessing', bg: Colors.info + '20', color: Colors.info },
  quoted: { label: 'Quote Sent', bg: Colors.copper + '20', color: Colors.copper },
  approved: { label: 'Approved', bg: Colors.sage + '20', color: Colors.sage },
  active: { label: 'Active', bg: Colors.success + '20', color: Colors.success },
  paused: { label: 'Paused', bg: Colors.medGray + '20', color: Colors.medGray },
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

export default function ProAddOnQuotes() {
  const { user } = useStore();
  const [addOns, setAddOns] = useState<AssignedAddOn[]>([]);
  const [loading, setLoading] = useState(true);
  // P3 #77 (2026-04-23) — URL-sync tab so back-button + deep-link work.
  const [tab, setTab] = useTabState<AddOnQuoteTab>(ADDON_QUOTE_TABS, 'pending');

  // Quote form
  const [quotingId, setQuotingId] = useState<string | null>(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteFrequency, setQuoteFrequency] = useState('monthly');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, [user]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get provider's categories
      const { data: providerCats } = await supabase
        .from('add_on_providers')
        .select('category_id')
        .eq('provider_id', user.id)
        .eq('active', true);

      if (!providerCats || providerCats.length === 0) {
        setAddOns([]);
        setLoading(false);
        return;
      }

      const categoryIds = providerCats.map(p => p.category_id);

      // Get add-ons assigned to this provider OR in their categories that need quoting
      const { data, error } = await supabase
        .from('home_add_ons')
        .select(`
          *,
          home:homes(address, city, state, zip_code),
          profile:profiles!home_add_ons_user_id_fkey(full_name, email),
          category:add_on_categories(display_name, icon, frequency)
        `)
        .in('category_id', categoryIds)
        .not('status', 'in', '("cancelled","expired")')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAddOns(data || []);
    } catch (err) {
      logger.error('Failed to load add-ons:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleSubmitQuote = async (addOnId: string) => {
    const price = parseFloat(quotePrice);
    if (!price || price <= 0) {
      showToast({ message: 'Enter a valid price' });
      return;
    }

    setSubmitting(true);
    try {
      // P2 #49 (2026-04-23): Client-side guard — verify the current pro is an ACTIVE provider
      // for this add-on's category before calling the edge function. Belt-and-suspenders with
      // the server-side auth check in submit-add-on-quote. Prevents a stale browser from
      // submitting a quote after the pro was deactivated or moved categories.
      const target = addOns.find(a => a.id === addOnId);
      if (!target) {
        showToast({ message: 'Add-on no longer in your queue.' });
        await loadData();
        return;
      }
      if (!user?.id) {
        showToast({ message: 'Not authenticated' });
        return;
      }
      const { data: providerRow, error: providerErr } = await supabase
        .from('add_on_providers')
        .select('provider_id, category_id, active')
        .eq('provider_id', user.id)
        .eq('category_id', target.category_id)
        .eq('active', true)
        .maybeSingle();
      if (providerErr) throw providerErr;
      if (!providerRow) {
        showToast({ message: 'You are not an active provider for this category.' });
        await loadData();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-add-on-quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          home_add_on_id: addOnId,
          quoted_price: price,
          billing_frequency: quoteFrequency || undefined,
          provider_notes: quoteNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit quote');

      showToast({ message: `Quote submitted: $${price}/${quoteFrequency}` });
      setQuotingId(null);
      setQuotePrice('');
      setQuoteNotes('');
      await loadData();
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to submit quote' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="page-wide"><PageSkeleton rows={4} /></div>;

  const pendingAddOns = addOns.filter(a => a.status === 'requested' || a.status === 'assessing');
  const quotedAddOns = addOns.filter(a => a.status === 'quoted' || a.status === 'approved');
  const activeAddOns = addOns.filter(a => a.status === 'active');

  const displayList = tab === 'pending' ? pendingAddOns : tab === 'quoted' ? quotedAddOns : activeAddOns;

  return (
    <div className="page-wide">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Add-On Quotes</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Submit quotes for homeowner add-on service requests
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {[
          { key: 'pending' as const, label: `Needs Quote (${pendingAddOns.length})` },
          { key: 'quoted' as const, label: `Quoted (${quotedAddOns.length})` },
          { key: 'active' as const, label: `Active (${activeAddOns.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', borderBottom: tab === t.key ? `3px solid ${Colors.sage}` : '3px solid transparent',
              background: 'transparent', color: tab === t.key ? Colors.sage : 'var(--text-secondary)',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {displayList.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
          {tab === 'pending' ? 'No pending quote requests.' : tab === 'quoted' ? 'No quoted add-ons waiting for approval.' : 'No active services.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayList.map(addon => {
            const ss = STATUS_STYLES[addon.status] || STATUS_STYLES.requested;
            const isQuoting = quotingId === addon.id;
            const needsQuote = addon.status === 'requested' || addon.status === 'assessing';

            return (
              <div
                key={addon.id}
                style={{
                  background: 'var(--color-card)', borderRadius: 10,
                  border: isQuoting ? `2px solid ${Colors.sage}` : '1px solid var(--color-border)',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {addon.category?.display_name || addon.category_id}
                      </span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        backgroundColor: ss.bg, color: ss.color,
                      }}>{ss.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <div>{addon.profile?.first_name} {addon.profile?.last_name} — {addon.home?.address}, {addon.home?.city}</div>
                      {addon.estimated_price && <div>Estimated: ${addon.estimated_price}/mo</div>}
                      {addon.service_notes && <div style={{ fontStyle: 'italic' }}>"{addon.service_notes}"</div>}
                      {addon.quoted_price && <div>Quoted: <strong style={{ color: Colors.copper }}>${addon.quoted_price}/{addon.billing_frequency || 'mo'}</strong></div>}
                      {addon.approved_price && <div>Approved: <strong style={{ color: Colors.sage }}>${addon.approved_price}/{addon.billing_frequency || 'mo'}</strong></div>}
                    </div>
                  </div>

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
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Submit Quote
                    </button>
                  )}
                </div>

                {/* Inline quote form */}
                {isQuoting && (
                  <div style={{
                    marginTop: 14, paddingTop: 14,
                    borderTop: '1px solid var(--color-border)',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                  }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Price <span aria-hidden="true">*</span></label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>$</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={quotePrice} onChange={e => setQuotePrice(e.target.value)}
                          placeholder="85.00"
                          style={{
                            flex: 1, padding: '8px 10px', borderRadius: 6, fontSize: 14,
                            border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Frequency</label>
                      <select
                        value={quoteFrequency} onChange={e => setQuoteFrequency(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 14,
                          border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--text-primary)',
                        }}
                      >
                        {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
                      <input
                        type="text" value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)}
                        placeholder="Assessment notes, scope details..."
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 14,
                          border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--text-primary)',
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={() => { setQuotingId(null); setQuotePrice(''); setQuoteNotes(''); }}
                        style={{
                          padding: '8px 16px', borderRadius: 6, fontSize: 13,
                          background: 'transparent', color: Colors.medGray, border: `1px solid ${Colors.medGray}`, cursor: 'pointer',
                        }}
                      >Cancel</button>
                      <button
                        onClick={() => handleSubmitQuote(addon.id)}
                        disabled={submitting || !quotePrice}
                        style={{
                          padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 700,
                          background: Colors.sage, color: Colors.white, border: 'none',
                          cursor: submitting ? 'wait' : 'pointer', opacity: submitting || !quotePrice ? 0.6 : 1,
                        }}
                      >
                        {submitting ? 'Submitting...' : `Submit $${quotePrice || '0'}/${quoteFrequency}`}
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
