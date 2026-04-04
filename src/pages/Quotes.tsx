import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { approveQuote, rejectQuote } from '@/services/quotesInvoices';
import { Colors, StatusColors } from '@/constants/theme';
import type { Quote } from '@/types';
import { getErrorMessage } from '@/utils/errors';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

export default function Quotes() {
  const { user } = useStore();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (user) {
      loadQuotes();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('quotes')
        .select('*, provider:pro_providers(business_name, contact_name)')
        .eq('homeowner_id', user!.id)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setQuotes((data || []) as Quote[]);
      setError('');
    } catch (err: any) {
      setError(getErrorMessage(err) || 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (quoteId: string) => {
    if (!user) return;
    setActionInProgress(true);
    try {
      await approveQuote(quoteId, noteText);
      await loadQuotes();
      setNoteText('');
      setExpandedId(null);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async (quoteId: string) => {
    if (!user) return;
    setActionInProgress(true);
    try {
      await rejectQuote(quoteId, noteText);
      await loadQuotes();
      setNoteText('');
      setExpandedId(null);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setActionInProgress(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredQuotes = quotes.filter(q => {
    switch (activeTab) {
      case 'all':
        return true;
      case 'pending':
        return q.status === 'sent';
      case 'approved':
        return q.status === 'approved';
      case 'rejected':
        return q.status === 'rejected';
      default:
        return true;
    }
  });

  const tabCounts = {
    all: quotes.length,
    pending: quotes.filter(q => q.status === 'sent').length,
    approved: quotes.filter(q => q.status === 'approved').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner"></div>
        <p>Loading quotes...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1>Quotes</h1>
      </div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--color-error-muted, #E5393520)', color: 'var(--color-error)', fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {/* Filter Tabs */}
      <div className="tabs mb-lg">
        {(['all', 'pending', 'approved', 'rejected'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
          </button>
        ))}
      </div>

      {/* Quotes List */}
      {filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div>
          <h3>No {activeTab} quotes</h3>
          <p>Quotes from service providers will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredQuotes.map(quote => (
            <div key={quote.id}>
              <div
                className="card"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setExpandedId(expandedId === quote.id ? null : quote.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>Quote #{quote.quote_number || quote.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-gray">{formatDate(quote.issued_date)}</p>
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{quote.title}</p>
                    <p className="text-sm text-gray">{quote.provider?.business_name}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{formatCurrency(quote.total_amount)}</p>
                    <span className="badge" style={{ background: (StatusColors[quote.status] || '#ccc') + '20', color: StatusColors[quote.status] || '#ccc' }}>
                      {quote.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === quote.id && (
                <div className="card" style={{ padding: 20, marginTop: -8, borderTop: `1px solid ${Colors.lightGray}`, borderRadius: '0 0 8px 8px' }}>
                  {quote.line_items && quote.line_items.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <p className="text-xs fw-600 mb-sm">Line Items</p>
                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <tbody>
                          {quote.line_items.map((item, idx) => (
                            <tr key={`${item.description}-${idx}`} style={{ borderBottom: `1px solid ${Colors.lightGray}` }}>
                              <td style={{ padding: '8px 0', textAlign: 'left' }}>{item.description}</td>
                              <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ padding: 12, background: Colors.cream, borderRadius: 8, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <p className="text-sm">Subtotal</p>
                      <p style={{ fontWeight: 600 }}>{formatCurrency(quote.subtotal)}</p>
                    </div>
                    {quote.tax_amount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <p className="text-sm">Tax</p>
                        <p style={{ fontWeight: 600 }}>{formatCurrency(quote.tax_amount)}</p>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${Colors.lightGray}`, paddingTop: 8 }}>
                      <p className="text-sm fw-600">Total</p>
                      <p style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(quote.total_amount)}</p>
                    </div>
                  </div>

                  {quote.status === 'sent' && (
                    <>
                      <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="text-xs fw-600">Optional Notes</label>
                        <textarea
                          className="form-textarea"
                          placeholder="Add any notes with your decision..."
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          style={{ fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleReject(quote.id)}
                          disabled={actionInProgress}
                          style={{ flex: 1 }}
                        >
                          {actionInProgress ? 'Processing...' : 'Reject'}
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleApprove(quote.id)}
                          disabled={actionInProgress}
                          style={{ flex: 1 }}
                        >
                          {actionInProgress ? 'Processing...' : 'Approve'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
