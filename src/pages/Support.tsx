import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { getErrorMessage } from '@/utils/errors';

type SupportCategory = 'general' | 'bug' | 'billing' | 'pro-issue' | 'account' | 'feature' | 'other';

export default function Support() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'general' as SupportCategory,
    subject: '',
    message: '',
  });

  const categoryLabels: Record<SupportCategory, string> = {
    general: 'General Question',
    bug: 'Bug Report',
    billing: 'Billing & Subscription',
    'pro-issue': 'Pro Service Issue',
    account: 'Account Issue',
    feature: 'Feature Request',
    other: 'Other',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate message length
      if (formData.message.length < 20) {
        setError('Message must be at least 20 characters long.');
        setLoading(false);
        return;
      }

      // Step 1: Insert support ticket into database
      const { data: ticket, error: insertError } = await supabase
        .from('support_tickets')
        .insert([{
          name: formData.name,
          email: formData.email,
          category: formData.category,
          subject: formData.subject,
          message: formData.message,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Step 2: Send branded auto-reply via support-email edge function
      try {
        await supabase.functions.invoke('support-email', {
          body: {
            mode: 'support-auto-reply',
            name: formData.name,
            email: formData.email,
            subject: formData.subject,
            ticket_id: ticket.id,
          },
        });
      } catch (emailErr) {
        // Log but don't fail — ticket is already saved
        console.error('Auto-reply email error:', emailErr);
      }

      // Step 3: Notify admin via send-email (internal notification)
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: 'support@canopyhome.app',
            subject: `[Canopy Support] ${categoryLabels[formData.category]}: ${formData.subject}`,
            html: `
              <h2>New Support Request</h2>
              <p><strong>Ticket ID:</strong> ${ticket.id}</p>
              <p><strong>From:</strong> ${formData.name}</p>
              <p><strong>Email:</strong> ${formData.email}</p>
              <p><strong>Category:</strong> ${categoryLabels[formData.category]}</p>
              <p><strong>Subject:</strong> ${formData.subject}</p>
              <hr />
              <h3>Message:</h3>
              <p>${formData.message.replace(/\n/g, '<br>')}</p>
            `,
          },
        });
      } catch (adminEmailErr) {
        console.error('Admin notification email error:', adminEmailErr);
      }

      setSubmitted(true);
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      setError(getErrorMessage(err) || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center' }}>
        <div style={{ marginBottom: 32 }}>
          <a href="/" style={{ color: Colors.sage, textDecoration: 'none', fontSize: 14 }}>← Back</a>
        </div>

        <div style={{ marginTop: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: Colors.charcoal }}>Message Sent!</h1>
          <p style={{ color: Colors.medGray, fontSize: 18, marginBottom: 32 }}>
            We'll get back to you within 24 hours.
          </p>
          <p style={{ color: Colors.medGray }}>
            Redirecting to your dashboard in a moment...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: Colors.charcoal, lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ color: Colors.sage, textDecoration: 'none', fontSize: 14 }}>← Back</a>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Contact Support</h1>
      <p style={{ color: Colors.medGray, marginBottom: 32 }}>
        We're here to help. Our team responds within 24 hours.
      </p>

      {/* Before contacting us section */}
      <div style={{
        backgroundColor: Colors.cream,
        border: `1px solid ${Colors.lightGray}`,
        borderRadius: 8,
        padding: 24,
        marginBottom: 48,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Before contacting us</h2>
        <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 12 }}>
          You might find quick answers in our resources:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <a href="/help" style={{
            color: Colors.copper,
            textDecoration: 'none',
            fontSize: 14,
            padding: 8,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: 4,
            textAlign: 'center' as const,
          }}>
            Help & FAQ
          </a>
          <a href="/ai-disclaimer" style={{
            color: Colors.copper,
            textDecoration: 'none',
            fontSize: 14,
            padding: 8,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: 4,
            textAlign: 'center' as const,
          }}>
            AI Disclaimer
          </a>
          <a href="/cancellation" style={{
            color: Colors.copper,
            textDecoration: 'none',
            fontSize: 14,
            padding: 8,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: 4,
            textAlign: 'center' as const,
          }}>
            Cancellation Policy
          </a>
          <a href="/terms" style={{
            color: Colors.copper,
            textDecoration: 'none',
            fontSize: 14,
            padding: 8,
            border: `1px solid ${Colors.lightGray}`,
            borderRadius: 4,
            textAlign: 'center' as const,
          }}>
            Terms of Service
          </a>
        </div>
      </div>

      {/* Contact form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: 48 }}>
        {error && (
          <div style={{
            backgroundColor: 'var(--color-error-muted, #ffebee)',
            color: 'var(--color-error)',
            padding: 16,
            borderRadius: 6,
            marginBottom: 24,
            fontSize: 14,
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Name <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
            }}
            placeholder="Your name"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Email <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
            }}
            placeholder="your@email.com"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Category <span style={{ color: Colors.error }}>*</span>
          </label>
          <select
            required
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as SupportCategory })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
            }}
          >
            <option value="general">General Question</option>
            <option value="bug">Bug Report</option>
            <option value="billing">Billing & Subscription</option>
            <option value="pro-issue">Pro Service Issue</option>
            <option value="account">Account Issue</option>
            <option value="feature">Feature Request</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Subject <span style={{ color: Colors.error }}>*</span>
          </label>
          <input
            type="text"
            required
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
            }}
            placeholder="Brief description of your issue"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Message <span style={{ color: Colors.error }}>*</span>
          </label>
          <textarea
            required
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            minLength={20}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 6,
              border: `1px solid ${Colors.lightGray}`,
              backgroundColor: Colors.inputBackground,
              fontSize: 14,
              fontFamily: 'inherit',
              minHeight: 150,
              resize: 'vertical',
            }}
            placeholder="Please provide as much detail as possible (minimum 20 characters)..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 24px',
            backgroundColor: Colors.copper,
            color: Colors.white,
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      {/* Footer */}
      <div style={{ backgroundColor: Colors.cream, padding: 24, borderRadius: 8, textAlign: 'center', marginBottom: 48 }}>
        <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 8 }}>
          You can also email us directly at:
        </p>
        <p style={{ fontSize: 14 }}>
          <strong>support@canopyhome.app</strong>
        </p>
      </div>

      <div style={{ borderTop: `1px solid ${Colors.lightGray}`, paddingTop: 24, color: 'var(--color-text-secondary)', fontSize: 14, textAlign: 'center' }}>
        © {new Date().getFullYear()} Canopy. All rights reserved.
      </div>
    </div>
  );
}
