import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, sendNotification } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Quote {
  id: string;
  pro_provider_id: string;
  home_id: string;
  title: string;
  description: string;
  line_items: LineItem[];
  tax_rate: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  created_at: string;
  total: number;
  user?: { full_name: string };
}

interface Invoice {
  id: string;
  pro_provider_id: string;
  home_id: string;
  homeowner_id?: string;
  title: string;
  description: string;
  line_items: LineItem[];
  tax_rate: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  due_date: string;
  created_at: string;
  total: number;
  amount_paid: number;
  user?: { full_name: string };
}

interface AssignedClient {
  homeId: string;
  homeownerId: string;
  fullName: string;
  address: string;
}

interface QuoteTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  line_items: { description: string; amount: number }[];
  default_tax_rate: number;
  is_active: boolean;
}

type TabType = 'quotes' | 'invoices';

export default function ProQuotesInvoices() {
  const navigate = useNavigate();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<TabType>('quotes');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [clients, setClients] = useState<AssignedClient[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Quote templates
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    category: 'general',
    lineItems: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }] as LineItem[],
    taxRate: 0,
  });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    clientId: '',
    title: '',
    description: '',
    lineItems: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }] as LineItem[],
    taxRate: 0,
    dueDate: '',
  });

  useEffect(() => {
    loadProviderAndData();
  }, []);

  const loadProviderAndData = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      // Admin sees all quotes/invoices and all clients
      if (isAdmin) {
        await Promise.all([loadQuotes(null), loadInvoices(null), loadAllClients()]);
        return;
      }

      const { data: provider } = await supabase
        .from('pro_providers')
        .select('id, zip_codes')
        .eq('user_id', authUser.user.id)
        .single();

      if (provider) {
        setProviderId(provider.id);
        await Promise.all([
          loadQuotes(provider.id),
          loadInvoices(provider.id),
          loadAssignedClients(provider.zip_codes || []),
          loadTemplates(provider.id),
        ]);
      }
    } catch (err) {
      console.error('Error loading provider:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignedClients = async (zipCodes: string[]) => {
    try {
      // Get homes in provider's service area with Pro/Pro+ subscriptions
      const { data: homes } = await supabase
        .from('homes')
        .select('id, user_id, address, city, state, zip_code')
        .in('zip_code', zipCodes.length > 0 ? zipCodes : ['__none__']);
      if (!homes || homes.length === 0) return;

      const userIds = [...new Set(homes.map(h => h.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, subscription_tier')
        .in('id', userIds)
        .in('subscription_tier', ['pro', 'pro_plus']);

      if (!profiles) return;
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const assignedClients: AssignedClient[] = homes
        .filter(h => profileMap.has(h.user_id))
        .map(h => ({
          homeId: h.id,
          homeownerId: h.user_id,
          fullName: profileMap.get(h.user_id)!.full_name || 'Unknown',
          address: [h.address, h.city, h.state].filter(Boolean).join(', '),
        }));
      setClients(assignedClients);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const loadAllClients = async () => {
    try {
      const { data: homes } = await supabase
        .from('homes')
        .select('id, user_id, address, city, state, zip_code');
      if (!homes) return;

      const userIds = [...new Set(homes.map(h => h.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, subscription_tier')
        .in('id', userIds);

      if (!profiles) return;
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      const allClients: AssignedClient[] = homes
        .filter(h => profileMap.has(h.user_id))
        .map(h => ({
          homeId: h.id,
          homeownerId: h.user_id,
          fullName: profileMap.get(h.user_id)!.full_name || 'Unknown',
          address: [h.address, h.city, h.state].filter(Boolean).join(', '),
        }));
      setClients(allClients);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const loadQuotes = async (provId: string | null) => {
    try {
      let query = supabase
        .from('quotes')
        .select('*, user:homeowner_id(full_name)')
        .order('created_at', { ascending: false });

      if (provId) {
        query = query.eq('pro_provider_id', provId);
      }

      const { data } = await query;
      setQuotes(data || []);
    } catch (err) {
      console.error('Error loading quotes:', err);
    }
  };

  const loadInvoices = async (provId: string | null) => {
    try {
      let query = supabase
        .from('invoices')
        .select('*, user:homeowner_id(full_name)')
        .order('created_at', { ascending: false });

      if (provId) {
        query = query.eq('pro_provider_id', provId);
      }

      const { data } = await query;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error loading invoices:', err);
    }
  };

  // ─── Quote Template Functions ───

  const loadTemplates = async (provId: string) => {
    try {
      const { data } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('provider_id', provId)
        .eq('is_active', true)
        .order('name');
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const handleSaveTemplate = async () => {
    if (!providerId || !templateForm.name.trim()) {
      alert('Please enter a template name');
      return;
    }

    const lineItems = templateForm.lineItems.map(item => ({
      description: item.description,
      amount: item.quantity * item.unitPrice,
    }));

    try {
      if (editingTemplateId) {
        const { error } = await supabase
          .from('quote_templates')
          .update({
            name: templateForm.name,
            description: templateForm.description,
            category: templateForm.category,
            line_items: lineItems,
            default_tax_rate: templateForm.taxRate / 100,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplateId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('quote_templates')
          .insert({
            provider_id: providerId,
            name: templateForm.name,
            description: templateForm.description,
            category: templateForm.category,
            line_items: lineItems,
            default_tax_rate: templateForm.taxRate / 100,
          });
        if (error) throw error;
      }

      await loadTemplates(providerId);
      setEditingTemplateId(null);
      setTemplateForm({ name: '', description: '', category: 'general', lineItems: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }], taxRate: 0 });
      alert(editingTemplateId ? 'Template updated' : 'Template saved');
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      const { error } = await supabase
        .from('quote_templates')
        .update({ is_active: false })
        .eq('id', templateId);
      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch {
      alert('Failed to delete template');
    }
  };

  const handleEditTemplate = (template: QuoteTemplate) => {
    setEditingTemplateId(template.id);
    const lineItems = (template.line_items || []).map((item: any, i: number) => ({
      id: String(i + 1),
      description: item.description || '',
      quantity: 1,
      unitPrice: item.amount || 0,
    }));
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      category: template.category,
      lineItems: lineItems.length > 0 ? lineItems : [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      taxRate: (template.default_tax_rate || 0) * 100,
    });
    setShowTemplateManager(true);
  };

  const handleApplyTemplate = (template: QuoteTemplate) => {
    const lineItems = (template.line_items || []).map((item: any, i: number) => ({
      id: String(i + 1),
      description: item.description || '',
      quantity: 1,
      unitPrice: item.amount || 0,
    }));
    setFormData({
      ...formData,
      title: template.name,
      description: template.description || '',
      lineItems: lineItems.length > 0 ? lineItems : formData.lineItems,
      taxRate: (template.default_tax_rate || 0) * 100,
    });
    alert(`Template "${template.name}" applied. Adjust details and select a client.`);
  };

  const handleSaveCurrentAsTemplate = () => {
    if (!formData.title) {
      alert('Add a title first before saving as template');
      return;
    }
    setTemplateForm({
      name: formData.title,
      description: formData.description,
      category: 'general',
      lineItems: formData.lineItems,
      taxRate: formData.taxRate,
    });
    setEditingTemplateId(null);
    setShowTemplateManager(true);
  };

  const calculateLineItemTotal = (): number => {
    return formData.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateTotal = (subtotal: number): number => {
    const taxAmount = subtotal * (formData.taxRate / 100);
    return subtotal + taxAmount;
  };

  const subtotal = calculateLineItemTotal();
  const total = calculateTotal(subtotal);
  const taxAmount = subtotal * (formData.taxRate / 100);

  const handleAddLineItem = () => {
    const newId = String(Math.max(...formData.lineItems.map(item => parseInt(item.id, 10)), 0) + 1);
    setFormData({
      ...formData,
      lineItems: [...formData.lineItems, { id: newId, description: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const handleRemoveLineItem = (id: string) => {
    if (formData.lineItems.length > 1) {
      setFormData({
        ...formData,
        lineItems: formData.lineItems.filter(item => item.id !== id),
      });
    }
  };

  const handleLineItemChange = (id: string, field: keyof LineItem, value: any) => {
    setFormData({
      ...formData,
      lineItems: formData.lineItems.map(item =>
        item.id === id ? { ...item, [field]: field === 'description' ? value : Number(value) } : item
      ),
    });
  };

  const handleCreateQuote = async () => {
    if (!providerId || !formData.clientId || !formData.title || formData.lineItems.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const client = clients.find(c => c.homeId === formData.clientId);
      const { error } = await supabase.from('quotes').insert({
        pro_provider_id: providerId,
        home_id: formData.clientId,
        homeowner_id: client?.homeownerId,
        title: formData.title,
        description: formData.description,
        service_type: 'one_off',
        line_items: formData.lineItems.map(item => ({
          description: item.description,
          amount: item.quantity * item.unitPrice,
        })),
        subtotal: subtotal,
        tax_rate: formData.taxRate,
        tax_amount: taxAmount,
        total_amount: total,
        status: 'draft',
      });

      if (error) throw error;

      resetForm();
      setShowForm(false);
      if (providerId) await loadQuotes(providerId);
      alert('Quote created successfully');
    } catch (err) {
      console.error('Error creating quote:', err);
      alert('Failed to create quote');
    }
  };

  const handleCreateInvoice = async () => {
    if (!providerId || !formData.clientId || !formData.title || !formData.dueDate || formData.lineItems.length === 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const client = clients.find(c => c.homeId === formData.clientId);
      const { error } = await supabase.from('invoices').insert({
        pro_provider_id: providerId,
        home_id: formData.clientId,
        homeowner_id: client?.homeownerId,
        title: formData.title,
        description: formData.description,
        source_type: 'standalone',
        line_items: formData.lineItems.map(item => ({
          description: item.description,
          amount: item.quantity * item.unitPrice,
        })),
        subtotal: subtotal,
        tax_rate: formData.taxRate,
        tax_amount: taxAmount,
        total_amount: total,
        due_date: formData.dueDate,
        status: 'draft',
      });

      if (error) throw error;

      resetForm();
      setShowForm(false);
      if (providerId) await loadInvoices(providerId);
      alert('Invoice created successfully');
    } catch (err) {
      console.error('Error creating invoice:', err);
      alert('Failed to create invoice');
    }
  };

  const handleSendQuote = async (quoteId: string) => {
    if (!providerId) return;

    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: 'sent' })
        .eq('id', quoteId);

      if (error) throw error;

      await loadQuotes(providerId);
      alert('Quote sent to client');
    } catch (err) {
      console.error('Error sending quote:', err);
      alert('Failed to send quote');
    }
  };

  const handleConvertToInvoice = async (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote || !providerId) return;

    try {
      const { error } = await supabase.from('invoices').insert({
        pro_provider_id: providerId,
        home_id: quote.home_id,
        homeowner_id: (quote as any).homeowner_id,
        title: quote.title,
        description: quote.description,
        source_type: 'from_quote',
        line_items: quote.line_items,
        subtotal: (quote as any).subtotal || quote.total,
        tax_rate: quote.tax_rate,
        tax_amount: (quote as any).tax_amount || 0,
        total_amount: quote.total,
        status: 'sent',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });

      if (error) throw error;

      await Promise.all([loadQuotes(providerId), loadInvoices(providerId)]);
      alert('Invoice created from quote');
    } catch (err) {
      console.error('Error converting quote:', err);
      alert('Failed to convert quote');
    }
  };

  const handleSendInvoice = async (invoiceId: string) => {
    if (!providerId) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoiceId);

      if (error) throw error;

      // Notify homeowner about the invoice
      const invoice = invoices.find(i => i.id === invoiceId);
      if (invoice?.homeowner_id) {
        const { data: provider } = await supabase.from('pro_providers').select('business_name, contact_name').eq('id', providerId).single();
        const providerName = provider?.business_name || provider?.contact_name || 'Your service provider';
        const dueDateStr = invoice.due_date ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
        sendNotification({
          user_id: invoice.homeowner_id,
          title: 'New Invoice Received',
          body: `${providerName} sent you an invoice for "${invoice.title}" — $${invoice.total.toFixed(2)}${dueDateStr ? ` due ${dueDateStr}` : ''}. Tap to review and pay.`,
          category: 'account_billing',
          action_url: `/invoices/${invoiceId}`,
        }).catch(() => {});
      }

      await loadInvoices(providerId);
      alert('Invoice sent to client');
    } catch (err) {
      console.error('Error sending invoice:', err);
      alert('Failed to send invoice');
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      title: '',
      description: '',
      lineItems: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      taxRate: 0,
      dueDate: '',
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'draft':
        return Colors.medGray;
      case 'sent':
        return Colors.info;
      case 'approved':
        return Colors.success;
      case 'rejected':
        return Colors.error;
      case 'paid':
        return Colors.sage;
      case 'overdue':
        return Colors.error;
      default:
        return Colors.medGray;
    }
  };

  const getPaymentStatusColor = (status: string, amountPaid: number, total: number): string => {
    if (status === 'paid' || amountPaid >= total) return Colors.sage;
    if (status === 'overdue') return Colors.error;
    if (amountPaid > 0) return Colors.warning;
    return Colors.medGray;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Loading...</p>
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
          <h1>Quotes & Invoices</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : `Create ${activeTab === 'quotes' ? 'Quote' : 'Invoice'}`}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs mb-lg">
        <button
          className={`tab ${activeTab === 'quotes' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('quotes');
            setShowForm(false);
          }}
        >
          Quotes ({quotes.length})
        </button>
        <button
          className={`tab ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('invoices');
            setShowForm(false);
          }}
        >
          Invoices ({invoices.length})
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card mb-lg" style={{ backgroundColor: Colors.warmWhite, borderLeft: `4px solid ${Colors.copper}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>
              Create {activeTab === 'quotes' ? 'Quote' : 'Invoice'}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {templates.length > 0 && activeTab === 'quotes' && (
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.find(t => t.id === e.target.value);
                    if (t) handleApplyTemplate(t);
                    e.target.value = '';
                  }}
                >
                  <option value="" disabled>Use Template...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                </select>
              )}
              {activeTab === 'quotes' && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                  onClick={handleSaveCurrentAsTemplate}
                >
                  Save as Template
                </button>
              )}
              {activeTab === 'quotes' && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                  onClick={() => { setShowTemplateManager(!showTemplateManager); setEditingTemplateId(null); }}
                >
                  Manage Templates
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Client *
              </label>
              <select
                className="form-select"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              >
                <option value="">Select client...</option>
                {clients.map(client => (
                  <option key={client.homeId} value={client.homeId}>
                    {client.fullName} — {client.address}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Title *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., HVAC Service"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
              Description
            </label>
            <textarea
              className="form-input"
              placeholder="Service details..."
              style={{ resize: 'vertical', minHeight: 60 }}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Line Items */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Line Items *</label>
              <button className="btn btn-ghost btn-sm" onClick={handleAddLineItem}>
                + Add Line Item
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 100px 120px 40px', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, color: Colors.medGray }}>Item</div>
              <div style={{ fontWeight: 600, color: Colors.medGray }}>Description</div>
              <div style={{ fontWeight: 600, color: Colors.medGray }}>Qty</div>
              <div style={{ fontWeight: 600, color: Colors.medGray }}>Unit Price</div>
              <div />
            </div>

            {formData.lineItems.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr 100px 120px 40px',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 8,
                  paddingBottom: 8,
                  borderBottom: `1px solid ${Colors.lightGray}`,
                }}
              >
                <div style={{ fontSize: 13, color: Colors.medGray }}>{index + 1}</div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Item description"
                  value={item.description}
                  onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                  style={{ padding: '8px', fontSize: 13 }}
                />
                <input
                  type="number"
                  className="form-input"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => handleLineItemChange(item.id, 'quantity', e.target.value)}
                  min="1"
                  style={{ padding: '8px', fontSize: 13 }}
                />
                <input
                  type="number"
                  className="form-input"
                  placeholder="$0.00"
                  value={item.unitPrice}
                  onChange={(e) => handleLineItemChange(item.id, 'unitPrice', e.target.value)}
                  min="0"
                  step="0.01"
                  style={{ padding: '8px', fontSize: 13 }}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRemoveLineItem(item.id)}
                  style={{ color: Colors.error }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Tax & Total */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                Tax Rate (%)
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            {activeTab === 'invoices' && (
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  Due Date *
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Total Preview */}
          <div style={{ backgroundColor: Colors.lightGray, padding: 12, borderRadius: 6, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span>Tax:</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 'bold' }}>
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={activeTab === 'quotes' ? handleCreateQuote : handleCreateInvoice}
            >
              Create {activeTab === 'quotes' ? 'Quote' : 'Invoice'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template Manager */}
      {showTemplateManager && activeTab === 'quotes' && (
        <div className="card mb-lg" style={{ borderLeft: `4px solid ${Colors.sage}` }}>
          <h3 style={{ marginTop: 0 }}>{editingTemplateId ? 'Edit Template' : 'Save Quote Template'}</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Template Name *</label>
              <input type="text" className="form-input" placeholder="e.g., Standard HVAC Service" value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Category</label>
              <select className="form-select" value={templateForm.category} onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })}>
                <option value="general">General</option>
                <option value="hvac">HVAC</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="roof">Roof</option>
                <option value="pool">Pool</option>
                <option value="deck">Deck</option>
                <option value="lawn">Lawn</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Description</label>
            <textarea className="form-input" style={{ resize: 'vertical', minHeight: 40 }} placeholder="Template description..." value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Default Line Items</label>
            {templateForm.lineItems.map((item, idx) => (
              <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input type="text" className="form-input" style={{ flex: 1 }} placeholder="Description" value={item.description} onChange={e => setTemplateForm({ ...templateForm, lineItems: templateForm.lineItems.map(li => li.id === item.id ? { ...li, description: e.target.value } : li) })} />
                <input type="number" className="form-input" style={{ width: 80 }} placeholder="Qty" value={item.quantity} onChange={e => setTemplateForm({ ...templateForm, lineItems: templateForm.lineItems.map(li => li.id === item.id ? { ...li, quantity: Number(e.target.value) } : li) })} />
                <input type="number" className="form-input" style={{ width: 100 }} placeholder="Price" value={item.unitPrice} onChange={e => setTemplateForm({ ...templateForm, lineItems: templateForm.lineItems.map(li => li.id === item.id ? { ...li, unitPrice: Number(e.target.value) } : li) })} />
                {templateForm.lineItems.length > 1 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setTemplateForm({ ...templateForm, lineItems: templateForm.lineItems.filter(li => li.id !== item.id) })} style={{ color: Colors.error }}>×</button>
                )}
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const newId = String(Math.max(...templateForm.lineItems.map(i => parseInt(i.id, 10)), 0) + 1);
              setTemplateForm({ ...templateForm, lineItems: [...templateForm.lineItems, { id: newId, description: '', quantity: 1, unitPrice: 0 }] });
            }}>+ Add Line Item</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Default Tax Rate (%)</label>
              <input type="number" className="form-input" style={{ width: 100 }} value={templateForm.taxRate} onChange={e => setTemplateForm({ ...templateForm, taxRate: Number(e.target.value) })} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSaveTemplate}>{editingTemplateId ? 'Update Template' : 'Save Template'}</button>
            <button className="btn btn-ghost" onClick={() => { setShowTemplateManager(false); setEditingTemplateId(null); }}>Cancel</button>
          </div>

          {/* Existing Templates List */}
          {templates.length > 0 && (
            <div style={{ marginTop: 24, borderTop: `1px solid ${Colors.lightGray}`, paddingTop: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>Saved Templates ({templates.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {templates.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: Colors.cream, borderRadius: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</span>
                      <span style={{ fontSize: 11, color: Colors.medGray, marginLeft: 8 }}>{t.category} · {t.line_items?.length || 0} items</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => handleApplyTemplate(t)}>Use</button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => handleEditTemplate(t)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: Colors.error }} onClick={() => handleDeleteTemplate(t.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quotes Tab Content */}
      {activeTab === 'quotes' && (
        quotes.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }} role="img" aria-label="Clipboard">📋</div>
            <h3>No quotes yet</h3>
            <p>Create your first quote to send to clients.</p>
          </div>
        ) : (
          <div className="grid-1" style={{ gap: 16 }}>
            {quotes.map(quote => (
              <div key={quote.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>{quote.title}</h3>
                    <p style={{ margin: '0 0 8px 0', fontSize: 13, color: Colors.medGray }}>
                      {quote.user?.full_name}
                    </p>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: getStatusColor(quote.status) + '20',
                        color: getStatusColor(quote.status),
                        fontSize: 11,
                      }}
                    >
                      {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: Colors.copper, marginBottom: 8 }}>
                      {formatCurrency(quote.total)}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>
                      {new Date(quote.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {quote.description && (
                  <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12, margin: '0 0 12px 0' }}>
                    {quote.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  {quote.status === 'draft' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSendQuote(quote.id)}
                      style={{ flex: 1 }}
                    >
                      Send
                    </button>
                  )}
                  {quote.status === 'approved' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleConvertToInvoice(quote.id)}
                      style={{ flex: 1 }}
                    >
                      Convert to Invoice
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Invoices Tab Content */}
      {activeTab === 'invoices' && (
        invoices.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>🧾</div>
            <h3>No invoices yet</h3>
            <p>Create an invoice to request payment from clients.</p>
          </div>
        ) : (
          <div className="grid-1" style={{ gap: 16 }}>
            {invoices.map(invoice => (
              <div key={invoice.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>{invoice.title}</h3>
                    <p style={{ margin: '0 0 8px 0', fontSize: 13, color: Colors.medGray }}>
                      {invoice.user?.full_name}
                    </p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: getStatusColor(invoice.status) + '20',
                          color: getStatusColor(invoice.status),
                          fontSize: 11,
                        }}
                      >
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: getPaymentStatusColor(invoice.status, invoice.amount_paid, invoice.total) + '20',
                          color: getPaymentStatusColor(invoice.status, invoice.amount_paid, invoice.total),
                          fontSize: 11,
                        }}
                      >
                        {invoice.amount_paid >= invoice.total ? '✓ Paid' : invoice.amount_paid > 0 ? '⚠ Partial' : '⚠ Unpaid'}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: Colors.copper, marginBottom: 4 }}>
                      {formatCurrency(invoice.total)}
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 12, color: Colors.medGray }}>
                      Paid: {formatCurrency(invoice.amount_paid)}
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: Colors.medGray }}>
                      Due: {new Date(invoice.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {invoice.description && (
                  <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12, margin: '0 0 12px 0' }}>
                    {invoice.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  {invoice.status === 'draft' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSendInvoice(invoice.id)}
                      style={{ flex: 1 }}
                    >
                      Send
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
