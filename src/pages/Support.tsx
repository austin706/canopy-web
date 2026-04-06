import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import { getErrorMessage } from '@/utils/errors';

type SupportCategory = 'general' | 'bug' | 'billing' | 'pro-issue' | 'account' | 'feature' | 'other';

/** Auto-detect device & browser info for bug reports */
function getDeviceInfo() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || 'Unknown';
  const language = navigator.language;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  const online = navigator.onLine;
  const cookiesEnabled = navigator.cookieEnabled;

  // Parse browser name/version from UA
  let browser = 'Unknown';
  if (ua.includes('Firefox/')) browser = 'Firefox ' + ua.split('Firefox/')[1]?.split(' ')[0];
  else if (ua.includes('Edg/')) browser = 'Edge ' + ua.split('Edg/')[1]?.split(' ')[0];
  else if (ua.includes('Chrome/')) browser = 'Chrome ' + ua.split('Chrome/')[1]?.split(' ')[0];
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari ' + (ua.split('Version/')[1]?.split(' ')[0] || '');

  // Parse OS
  let os = 'Unknown';
  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS ' + (ua.split('Mac OS X ')[1]?.split(')')[0]?.replace(/_/g, '.') || '');
  else if (ua.includes('Android')) os = 'Android ' + (ua.split('Android ')[1]?.split(';')[0] || '');
  else if (ua.includes('iPhone OS')) os = 'iOS ' + (ua.split('iPhone OS ')[1]?.split(' ')[0]?.replace(/_/g, '.') || '');
  else if (ua.includes('Linux')) os = 'Linux';

  return {
    browser,
    os,
    platform,
    language,
    screen: `${screenWidth}x${screenHeight}`,
    viewport: `${viewportWidth}x${viewportHeight}`,
    pixel_ratio: pixelRatio,
    online,
    cookies_enabled: cookiesEnabled,
    user_agent: ua,
    timestamp: new Date().toISOString(),
  };
}

export default function Support() {
  const navigate = useNavigate();
  const { user } = useStore();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'general' as SupportCategory,
    subject: '',
    message: '',
    stepsToReproduce: '',
  });

  // Pre-fill name/email from logged-in user
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.full_name || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  const categoryLabels: Record<SupportCategory, string> = {
    general: 'General Question',
    bug: 'Bug Report',
    billing: 'Billing & Subscription',
    'pro-issue': 'Pro Service Issue',
    account: 'Account Issue',
    feature: 'Feature Request',
    other: 'Other',
  };

  const isBugReport = formData.category === 'bug';

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Screenshot must be under 10MB.');
      return;
    }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (formData.message.length < 20) {
        setError('Message must be at least 20 characters long.');
        setLoading(false);
        return;
      }

      // Upload screenshot if present
      let screenshotUrl: string | null = null;
      if (screenshotFile && user) {
        setUploadProgress(true);
        const ext = screenshotFile.name.split('.').pop() || 'png';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('support-screenshots')
          .upload(path, screenshotFile, { contentType: screenshotFile.type });
        if (uploadErr) throw new Error('Screenshot upload failed: ' + uploadErr.message);
        screenshotUrl = path;
        setUploadProgress(false);
      }

      // Build device info for bug reports
      const deviceInfo = isBugReport ? getDeviceInfo() : null;

      // Insert support ticket
      const insertData: Record<string, any> = {
        name: formData.name,
        email: formData.email,
        category: formData.category,
        subject: formData.subject,
        message: formData.message,
        user_id: user?.id || null,
      };

      if (isBugReport) {
        insertData.device_info = deviceInfo;
        insertData.steps_to_reproduce = formData.stepsToReproduce || null;
        insertData.screenshot_url = screenshotUrl;
        insertData.app_version = 'web';
        insertData.priority = 'normal';
      }

      const { data: ticket, error: insertError } = await supabase
        .from('support_tickets')
        .insert([insertData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Auto-reply email
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
        console.error('Auto-reply email error:', emailErr);
      }

      // Admin notification
      try {
        const bugExtra = isBugReport
          ? `
            <p><strong>Device:</strong> ${deviceInfo?.browser} on ${deviceInfo?.os}</p>
            <p><strong>Screen:</strong> ${deviceInfo?.screen} (${deviceInfo?.viewport} viewport)</p>
            ${formData.stepsToReproduce ? `<h3>Steps to Reproduce:</h3><p>${formData.stepsToReproduce.replace(/\n/g, '<br>')}</p>` : ''}
            ${screenshotUrl ? '<p><strong>Screenshot attached</strong></p>' : ''}
          `
          : '';
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
              ${bugExtra}
            `,
          },
        });
      } catch (adminEmailErr) {
        console.error('Admin notification email error:', adminEmailErr);
      }

      setSubmitted(true);
      setTimeout(() => { navigate('/'); }, 3000);
    } catch (err) {
      setError(getErrorMessage(err) || 'Failed to send message. Please try again.');
      setUploadProgress(false);
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
          <p style={{ color: Colors.medGray }}>Redirecting to your dashboard in a moment...</p>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 6,
    border: `1px solid ${Colors.lightGray}`,
    backgroundColor: Colors.inputBackground,
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: Colors.charcoal, lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ color: Colors.sage, textDecoration: 'none', fontSize: 14 }}>← Back</a>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Contact Support</h1>
      <p style={{ color: Colors.medGray, marginBottom: 32 }}>
        We're here to help. Our team responds within 24 hours.
      </p>

      {/* Before contacting us */}
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
          {[
            { href: '/help', label: 'Help & FAQ' },
            { href: '/ai-disclaimer', label: 'AI Disclaimer' },
            { href: '/cancellation', label: 'Cancellation Policy' },
            { href: '/terms', label: 'Terms of Service' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              color: Colors.copper,
              textDecoration: 'none',
              fontSize: 14,
              padding: 8,
              border: `1px solid ${Colors.lightGray}`,
              borderRadius: 4,
              textAlign: 'center',
            }}>
              {link.label}
            </a>
          ))}
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
            style={inputStyle}
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
            style={inputStyle}
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
            style={inputStyle}
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
            style={inputStyle}
            placeholder="Brief description of your issue"
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
            Message <span style={{ color: Colors.error }}>*</span>
          </label>
          <textarea
            required
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            minLength={20}
            style={{ ...inputStyle, minHeight: 150, resize: 'vertical' }}
            placeholder="Please provide as much detail as possible (minimum 20 characters)..."
          />
        </div>

        {/* Bug-specific fields */}
        {isBugReport && (
          <div style={{
            background: '#FFF8E1',
            border: '1px solid #FFE082',
            borderRadius: 8,
            padding: 20,
            marginBottom: 24,
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, marginTop: 0 }}>Bug Report Details</h3>
            <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16, marginTop: 0 }}>
              Your device and browser info will be automatically captured to help us reproduce the issue.
            </p>

            {/* Auto-captured device info preview */}
            <div style={{
              background: 'white',
              border: `1px solid ${Colors.lightGray}`,
              borderRadius: 6,
              padding: 12,
              marginBottom: 16,
              fontSize: 12,
              color: Colors.medGray,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: Colors.charcoal, fontSize: 13 }}>Auto-captured info:</div>
              <div>Browser: {getDeviceInfo().browser}</div>
              <div>OS: {getDeviceInfo().os}</div>
              <div>Screen: {getDeviceInfo().screen} ({getDeviceInfo().viewport} viewport)</div>
            </div>

            {/* Steps to reproduce */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                Steps to Reproduce
              </label>
              <textarea
                value={formData.stepsToReproduce}
                onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
                style={{ ...inputStyle, minHeight: 100, resize: 'vertical', backgroundColor: 'white' }}
                placeholder={"1. Go to...\n2. Click on...\n3. Observe that..."}
              />
            </div>

            {/* Screenshot upload */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>
                Screenshot (optional)
              </label>
              {screenshotPreview ? (
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6, border: `1px solid ${Colors.lightGray}` }}
                  />
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    style={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: Colors.error,
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${Colors.lightGray}`,
                    borderRadius: 6,
                    padding: '20px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'white',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                  <div style={{ fontSize: 13, color: Colors.medGray }}>Click to attach a screenshot</div>
                  <div style={{ fontSize: 11, color: Colors.silver }}>PNG, JPG up to 10MB</div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleScreenshotChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        )}

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
          {uploadProgress ? 'Uploading screenshot...' : loading ? 'Sending...' : 'Send Message'}
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
