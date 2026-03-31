import { supabase } from '@/services/supabase';
import type { Quote, Invoice, InvoicePayment, LineItem } from '@/types';

// ─── Quote Functions ───

export async function createQuote(
  homeId: string,
  homeownerId: string,
  providerId: string,
  title: string,
  description: string,
  lineItems: LineItem[],
  serviceType: 'add_on' | 'one_off' | 'pro_plus_extra' = 'one_off',
  taxRate = 0
): Promise<Quote> {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const totalAmount = subtotal + taxAmount;

  // Generate quote number: QT-YYYY-NNN
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`);
  const quoteNumber = `QT-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      home_id: homeId,
      homeowner_id: homeownerId,
      pro_provider_id: providerId,
      quote_number: quoteNumber,
      title,
      description,
      service_type: serviceType,
      line_items: lineItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendQuote(quoteId: string): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (error) throw error;
}

export async function approveQuote(quoteId: string, notes?: string): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'approved',
      homeowner_approved_at: new Date().toISOString(),
      homeowner_notes: notes || null,
    })
    .eq('id', quoteId);
  if (error) throw error;
}

export async function rejectQuote(quoteId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .update({
      status: 'rejected',
      homeowner_rejected_at: new Date().toISOString(),
      homeowner_notes: reason || null,
    })
    .eq('id', quoteId);
  if (error) throw error;
}

export async function convertQuoteToInvoice(quoteId: string, dueDate: string): Promise<Invoice> {
  const { data: quote, error: fetchError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();
  if (fetchError || !quote) throw fetchError || new Error('Quote not found');

  // Generate invoice number: INV-YYYY-NNN
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`);
  const invoiceNumber = `INV-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

  const { data: invoice, error: insertError } = await supabase
    .from('invoices')
    .insert({
      home_id: quote.home_id,
      homeowner_id: quote.homeowner_id,
      pro_provider_id: quote.pro_provider_id,
      invoice_number: invoiceNumber,
      title: quote.title,
      description: quote.description,
      source_type: 'from_quote',
      line_items: quote.line_items,
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      total_amount: quote.total_amount,
      due_date: dueDate,
      status: 'draft',
    })
    .select()
    .single();
  if (insertError) throw insertError;

  // Update quote with conversion reference
  await supabase
    .from('quotes')
    .update({
      status: 'converted',
      converted_to_invoice_id: invoice.id,
      converted_at: new Date().toISOString(),
    })
    .eq('id', quoteId);

  return invoice;
}

export async function getQuotes(homeId: string, status?: string): Promise<Quote[]> {
  let query = supabase
    .from('quotes')
    .select('*, provider:pro_providers(*)')
    .eq('home_id', homeId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─── Invoice Functions ───

export async function createInvoice(
  homeId: string,
  homeownerId: string,
  providerId: string,
  title: string,
  description: string,
  lineItems: LineItem[],
  dueDate: string,
  taxRate = 0
): Promise<Invoice> {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const totalAmount = subtotal + taxAmount;

  const year = new Date().getFullYear();
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`);
  const invoiceNumber = `INV-${year}-${String((count || 0) + 1).padStart(3, '0')}`;

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      home_id: homeId,
      homeowner_id: homeownerId,
      pro_provider_id: providerId,
      invoice_number: invoiceNumber,
      title,
      description,
      source_type: 'standalone',
      line_items: lineItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      due_date: dueDate,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function sendInvoice(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) throw error;
}

export async function payInvoice(invoiceId: string): Promise<{ clientSecret: string }> {
  // Call Edge Function to create Stripe PaymentIntent
  const { data, error } = await supabase.functions.invoke('create-invoice-payment', {
    body: { invoice_id: invoiceId },
  });
  if (error) throw error;
  return data;
}

export async function getInvoices(homeId: string, status?: string): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select('*, provider:pro_providers(*)')
    .eq('home_id', homeId)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getInvoicePayments(invoiceId: string): Promise<InvoicePayment[]> {
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Record a manual (non-Stripe) payment — cash, check, Venmo, etc. */
export async function recordManualPayment(
  invoiceId: string,
  amount: number,
  paymentMethod: 'cash' | 'check' | 'venmo' | 'zelle' | 'other',
  notes?: string
): Promise<InvoicePayment> {
  // Insert payment record
  const { data: payment, error: paymentError } = await supabase
    .from('invoice_payments')
    .insert({
      invoice_id: invoiceId,
      amount,
      payment_method: paymentMethod,
      status: 'completed',
      notes: notes || null,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (paymentError) throw paymentError;

  // Check if invoice is fully paid
  const { data: allPayments } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('status', 'completed');
  const totalPaid = (allPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  const { data: invoice } = await supabase
    .from('invoices')
    .select('total_amount')
    .eq('id', invoiceId)
    .single();

  if (invoice && totalPaid >= invoice.total_amount) {
    await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId);
  } else {
    // Partial payment — mark as sent (still outstanding) if currently draft
    await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', invoiceId)
      .eq('status', 'draft');
  }

  return payment;
}

// ─── Provider-side invoice functions ───

export async function getProviderQuotes(providerId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('pro_provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getProviderInvoices(providerId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('pro_provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
