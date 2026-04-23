import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { payInvoice } from '@/services/quotesInvoices';
import { Colors, StatusColors } from '@/constants/theme';
import type { Invoice, InvoicePayment } from '@/types';
import { getErrorMessage } from '@/utils/errors';

type FilterTab = 'all' | 'unpaid' | 'paid' | 'overdue';

export default function Invoices() {
  const { user } = useStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (user) {
      loadInvoices();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('invoices')
        .select('*, provider:pro_providers(business_name, contact_name)')
        .eq('homeowner_id', user!.id)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setInvoices((data || []) as Invoice[]);
      setPayments([]);
      setError('');
    } catch (err: any) {
      setError(getErrorMessage(err) || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async (invoiceId: string) => {
    if (!user) return;
    setProcessingPaymentId(invoiceId);
    setError('');
    setSuccessMessage('');
    try {
      // P1 #21 (2026-04-23): the edge function today always returns
      // {url, sessionId, payoutMode}, but the previous handler silently
      // fell through whenever `url` was missing — leaving the user with
      // no feedback at all if the response shape changed (e.g., a
      // future saved-card auto-charge path). Branch explicitly so any
      // unexpected shape surfaces as an error rather than a no-op.
      const result = (await payInvoice(invoiceId)) as
        | { url?: string; sessionId?: string; success?: boolean; payoutMode?: string }
        | null;
      if (result?.url) {
        window.location.href = result.url;
      } else if (result?.success === true || (result?.sessionId && !result?.url)) {
        await loadInvoices();
        setSuccessMessage('Payment recorded. This invoice has been marked as paid.');
      } else {
        setError('Payment status unclear. Please refresh and check the invoice status, or try again.');
      }
    } catch (err: any) {
      setError(getErrorMessage(err) || 'Payment failed. Please try again.');
    } finally {
      setProcessingPaymentId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getInvoiceStatus = (invoice: Invoice): string => {
    if (invoice.status === 'paid') return 'paid';
    if (new Date(invoice.due_date) < new Date() && invoice.amount_paid < invoice.total_amount) return 'overdue';
    return 'unpaid';
  };

  const getInvoicePayments = (invoiceId: string): InvoicePayment[] => {
    return payments.filter(p => p.invoice_id === invoiceId);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const status = getInvoiceStatus(invoice);
    switch (activeTab) {
      case 'all':
        return true;
      case 'unpaid':
        return status === 'unpaid';
      case 'paid':
        return status === 'paid';
      case 'overdue':
        return status === 'overdue';
      default:
        return true;
    }
  });

  const tabCounts = {
    all: invoices.length,
    unpaid: invoices.filter(i => getInvoiceStatus(i) === 'unpaid').length,
    paid: invoices.filter(i => getInvoiceStatus(i) === 'paid').length,
    overdue: invoices.filter(i => getInvoiceStatus(i) === 'overdue').length,
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner"></div>
        <p>Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <h1>Invoices</h1>
      </div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--color-error-muted, #E5393520)', color: 'var(--color-error)', fontSize: 14, marginBottom: 16 }}>{error}</div>}
      {successMessage && <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--color-success-muted, #2E7D3220)', color: 'var(--color-success)', fontSize: 14, marginBottom: 16 }}>{successMessage}</div>}

      {/* Filter Tabs */}
      <div className="tabs mb-lg">
        {(['all', 'unpaid', 'paid', 'overdue'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="empty-state">
          <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-copper)' }}>--</div>
          <h3>No {activeTab} invoices</h3>
          <p>Invoices from service providers will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredInvoices.map(invoice => {
            const status = getInvoiceStatus(invoice);
            const invoicePayments = getInvoicePayments(invoice.id);
            const statusColor = status === 'paid' ? 'var(--color-success)' : status === 'overdue' ? 'var(--color-error)' : 'var(--color-warning)';
            return (
              <div key={invoice.id}>
                <div
                  className="card"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                        <p style={{ fontWeight: 600, fontSize: 14 }}>Invoice #{invoice.invoice_number || invoice.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-gray">{formatDate(invoice.issued_date)}</p>
                      </div>
                      <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{invoice.title}</p>
                      <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                        <div>
                          <p className="text-xs text-gray mb-xs">Total</p>
                          <p style={{ fontWeight: 600 }}>{formatCurrency(invoice.total_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray mb-xs">Paid</p>
                          <p style={{ fontWeight: 600 }}>{formatCurrency(invoice.amount_paid)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray mb-xs">Due</p>
                          <p style={{ fontWeight: 600 }}>{formatDate(invoice.due_date)}</p>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ background: statusColor + '20', color: statusColor }}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === invoice.id && (
                  <div className="card" style={{ padding: 20, marginTop: -8, borderTop: `1px solid var(--color-border)`, borderRadius: '0 0 8px 8px' }}>
                    {invoice.line_items && invoice.line_items.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <p className="text-xs fw-600 mb-sm">Line Items</p>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                          <tbody>
                            {invoice.line_items.map((item, idx) => (
                              <tr key={`${item.description}-${idx}`} style={{ borderBottom: `1px solid var(--color-border)` }}>
                                <td style={{ padding: '8px 0', textAlign: 'left' }}>{item.description}</td>
                                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div style={{ padding: 12, background: 'var(--color-background)', borderRadius: 8, marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <p className="text-sm">Subtotal</p>
                        <p style={{ fontWeight: 600 }}>{formatCurrency(invoice.subtotal)}</p>
                      </div>
                      {invoice.tax_amount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <p className="text-sm">Tax</p>
                          <p style={{ fontWeight: 600 }}>{formatCurrency(invoice.tax_amount)}</p>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid var(--color-border)`, paddingTop: 8, marginBottom: 8 }}>
                        <p className="text-sm fw-600">Total</p>
                        <p style={{ fontWeight: 700, fontSize: 16 }}>{formatCurrency(invoice.total_amount)}</p>
                      </div>
                      {invoice.amount_paid > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid var(--color-border)`, paddingTop: 8 }}>
                          <p className="text-sm">Amount Paid</p>
                          <p style={{ fontWeight: 600, color: 'var(--color-sage)' }}>{formatCurrency(invoice.amount_paid)}</p>
                        </div>
                      )}
                    </div>

                    {invoicePayments.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p className="text-xs fw-600 mb-sm">Payment History</p>
                        {invoicePayments.map((payment, idx) => (
                          <div key={payment.id || `payment-${idx}`} style={{ padding: 8, background: 'var(--color-background)', borderRadius: 4, marginBottom: 4, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <p style={{ margin: 0 }}>{formatDate(payment.paid_at)}</p>
                              <p style={{ margin: 0, fontWeight: 600 }}>{formatCurrency(payment.amount)}</p>
                            </div>
                            {payment.payment_method && (
                              <p className="text-xs text-gray" style={{ margin: 0, marginTop: 4 }}>Method: {payment.payment_method}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {getInvoiceStatus(invoice) !== 'paid' && (
                      <button
                        className="btn btn-primary btn-lg"
                        onClick={() => handlePayNow(invoice.id)}
                        disabled={processingPaymentId === invoice.id}
                        style={{ width: '100%' }}
                      >
                        {processingPaymentId === invoice.id ? 'Processing Payment...' : 'Pay Now'}
                      </button>
                    )}
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
