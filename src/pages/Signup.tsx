import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signUp } from '@/services/supabase';
import { CanopyLogo } from '@/components/icons/CanopyLogo';

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fullNameError, setFullNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState('');

  const validateForm = (): boolean => {
    setFullNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setTermsError('');
    let isValid = true;

    if (!fullName.trim()) {
      setFullNameError('Full name is required');
      isValid = false;
    }

    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setEmailError('Please enter a valid email address');
        isValid = false;
      }
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }

    if (!acceptedTerms) {
      setTermsError('You must accept the Terms of Service and Privacy Policy');
      isValid = false;
    }

    return isValid;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, fullName);
      // Don't block — redirect to login with a success message
      navigate('/login?signup=success');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const pwStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const pwColors = ['', '#E53935', '#FF9800', '#4CAF50'];
  const pwLabels = ['', 'Weak', 'Good', 'Strong'];

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div style={{ marginBottom: 16 }}><img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 56, width: 'auto', objectFit: 'contain' }} /></div>
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
              {fullNameError && <p style={{ color: '#C62828', fontSize: 13, marginTop: 4 }}>{fullNameError}</p>}
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required />
              {emailError && <p style={{ color: '#C62828', fontSize: 13, marginTop: 4 }}>{emailError}</p>}
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-wrapper">
                <input className="form-input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
                <button type="button" className="password-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
              {passwordError && <p style={{ color: '#C62828', fontSize: 13, marginTop: 4 }}>{passwordError}</p>}
              {password.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#E8E2D8' }}>
                    <div style={{ width: `${(pwStrength / 3) * 100}%`, height: '100%', borderRadius: 2, background: pwColors[pwStrength], transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: pwColors[pwStrength], fontWeight: 600 }}>{pwLabels[pwStrength]}</span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <div className="password-wrapper">
                <input className="form-input" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm password" required />
                <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? 'Hide' : 'Show'}</button>
              </div>
              {confirmPasswordError && <p style={{ color: '#C62828', fontSize: 13, marginTop: 4 }}>{confirmPasswordError}</p>}
            </div>
            <div className="form-group">
              <label className="flex items-center gap-sm" style={{ cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />
                <span style={{ color: '#555' }}>
                  I agree to the <a href="/terms" target="_blank" style={{ color: '#C4844E', textDecoration: 'none', fontWeight: 600 }}>Terms of Service</a> and <a href="/privacy" target="_blank" style={{ color: '#C4844E', textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</a>
                </span>
              </label>
              {termsError && <p style={{ color: '#C62828', fontSize: 13, marginTop: 4 }}>{termsError}</p>}
            </div>
            <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading || !acceptedTerms}>
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
