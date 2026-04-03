import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '@/services/supabase';
import { CanopyLogo } from '@/components/icons/CanopyLogo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Hero Panel - left side */}
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div style={{ marginBottom: 16 }}><img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 56, width: 'auto', objectFit: 'contain' }} /></div>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Canopy</h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 32 }}>Smart home maintenance, powered by AI</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['AI-powered maintenance schedules', 'Equipment lifecycle tracking', 'Weather-triggered task alerts', 'Pro service coordination'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</span>
                {f}
              </div>
            ))}
          </div>
          <p style={{ marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Powered by Canopy</p>
        </div>
      </div>

      {/* Form Panel - right side */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ marginBottom: 12 }}><CanopyLogo size={48} /></div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Reset Password</h1>
            <p className="subtitle">Enter your email to receive a reset link</p>
          </div>

          {success && (
            <div style={{ background: '#E8F5E920', color: '#2E7D32', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
              Check your email for a password reset link. The link will expire in 1 hour.
            </div>
          )}

          {error && (
            <div style={{ background: '#E5393520', color: '#C62828', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {!success ? (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                />
              </div>
              <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 14, color: '#7A7A7A', marginBottom: 20 }}>Check your email for further instructions.</p>
              <button className="btn btn-primary btn-lg btn-full" onClick={() => setSuccess(false)} style={{ marginBottom: 12 }}>
                Send Another Email
              </button>
            </div>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#7A7A7A' }}>
            <Link to="/login" style={{ color: '#C4844E', fontWeight: 600, textDecoration: 'none' }}>Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
