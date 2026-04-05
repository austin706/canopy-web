import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { updatePassword } from '@/services/supabase';
import { CanopyLogo } from '@/components/icons/CanopyLogo';
import { getErrorMessage } from '@/utils/errors';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validatePassword()) return;

    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(getErrorMessage(err) || 'Failed to update password. Please try again.');
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
          <p style={{ marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Smart home maintenance</p>
        </div>
      </div>

      {/* Form Panel - right side */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ marginBottom: 12 }}><CanopyLogo size={48} /></div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Create New Password</h1>
            <p className="subtitle">Enter your new password below</p>
          </div>

          {success && (
            <div style={{ background: 'var(--color-success-muted, #E8F5E920)', color: 'var(--color-success)', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Password updated successfully!</div>
              <div style={{ fontSize: 12 }}>Redirecting to login...</div>
            </div>
          )}

          {error && (
            <div style={{ background: 'var(--color-error-muted, #E5393520)', color: 'var(--color-error)', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {!success ? (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#7A7A7A', padding: '4px 8px' }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    className="form-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#7A7A7A', padding: '4px 8px' }}
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading || !password || !confirmPassword}>
                {loading ? <span className="spinner" /> : 'Update Password'}
              </button>
            </form>
          ) : null}

          {!success && (
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--color-text-secondary)' }}>
              <Link to="/login" style={{ color: 'var(--color-copper)', fontWeight: 600, textDecoration: 'none' }}>Back to Login</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
