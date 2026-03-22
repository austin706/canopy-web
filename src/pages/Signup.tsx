import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '@/services/supabase';

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password, fullName);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-layout">
        <div className="auth-hero">
          <div className="auth-hero-content">
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#127793;</div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Welcome!</h1>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>You're one step away from smart home maintenance.</p>
          </div>
        </div>
        <div className="auth-form-panel">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#4CAF5020', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>&#9989;</div>
            <h1 style={{ fontSize: 24 }}>Check Your Email</h1>
            <p style={{ color: '#7A7A7A', margin: '12px 0 24px', lineHeight: 1.6 }}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
            <button className="btn btn-primary btn-lg btn-full" onClick={() => navigate('/login')}>Back to Login</button>
          </div>
        </div>
      </div>
    );
  }

  const pwStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pwColors = ['', '#E53935', '#FF9800', '#4CAF50'];
  const pwLabels = ['', 'Weak', 'Good', 'Strong'];

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#127793;</div>
          <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Canopy</h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 32 }}>Smart home maintenance, powered by AI</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['AI-powered maintenance schedules', 'Equipment lifecycle tracking', 'Weather-triggered task alerts', 'Pro service coordination'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>&#10003;</span>
                {f}
              </div>
            ))}
          </div>
          <p style={{ marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Powered by Oak &amp; Sage Realty</p>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1>Create Account</h1>
            <p className="subtitle">Start managing your home with Canopy</p>
          </div>
          {error && <div style={{ background: '#E5393520', color: '#C62828', padding: '10px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label>Full Name</label>
              <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jane Doe" required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-wrapper">
                <input className="form-input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
                <button type="button" className="password-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
              {password.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#E8E2D8' }}>
                    <div style={{ width: `${(pwStrength / 3) * 100}%`, height: '100%', borderRadius: 2, background: pwColors[pwStrength], transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: pwColors[pwStrength], fontWeight: 600 }}>{pwLabels[pwStrength]}</span>
                </div>
              )}
            </div>
            <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#7A7A7A' }}>
            Already have an account? <Link to="/login" style={{ color: '#C4844E', fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
