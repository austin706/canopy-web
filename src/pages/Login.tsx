import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signIn, getProfile, getHome, getEquipment, getTasks, getAgent } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { CanopyLogo } from '@/components/icons/CanopyLogo';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setHome, setEquipment, setTasks, setAgent } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateForm = (): boolean => {
    setEmailError('');
    setPasswordError('');
    let isValid = true;

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

    return isValid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const { user: authUser } = await signIn(email, password);
      if (!authUser) throw new Error('Login failed');

      const profile = await getProfile(authUser.id);
      const userData = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
        subscription_tier: profile?.subscription_tier || 'free',
        onboarding_complete: profile?.onboarding_complete || false,
        created_at: authUser.created_at,
        role: profile?.role || 'user',
        agent_id: profile?.agent_id,
        phone: profile?.phone,
      };
      setUser(userData as any);

      // Load home data
      let homeData = null;
      try {
        homeData = await getHome(authUser.id);
        if (homeData) {
          setHome(homeData);
          const [equip, tasks] = await Promise.all([getEquipment(homeData.id), getTasks(homeData.id)]);
          setEquipment(equip);
          setTasks(tasks);
        }
      } catch {}

      // Load agent
      if (userData.agent_id) {
        try { const a = await getAgent(userData.agent_id); setAgent(a); } catch {}
      }

      // Route by role — but check onboarding first for regular users
      if (userData.role === 'admin') navigate('/admin');
      else if (userData.role === 'agent') navigate('/agent-portal');
      else if (!userData.onboarding_complete && !homeData) navigate('/home');
      else navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Hero Panel - left side */}
      <div className="auth-hero">
        <div className="auth-hero-content">
          {/* TODO: Replace with final branded logo when ready */}
          <div style={{ marginBottom: 16 }}><CanopyLogo size={48} color="#fff" /></div>
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
          <p style={{ marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Powered by Oak & Sage Realty</p>
        </div>
      </div>

      {/* Form Panel - right side */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {/* TODO: Replace with final branded logo when ready */}
            <div style={{ marginBottom: 12 }}><CanopyLogo size={48} /></div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Canopy</h1>
            <p className="subtitle">Sign in to your account</p>
          </div>
          {error && <div style={{ background: '#E5393520', color: '#C62828', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required />
              {emailError && <p style={{ color: '#C62828', fontSize: 13, marginTop: 4 }}>{emailError}</p>}
            </div>
            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
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
              {passwordError && <p style={{ color: '#C62828', fontSize: 13, marginTop: 4 }}>{passwordError}</p>}
            </div>
            <div style={{ textAlign: 'right', marginBottom: 20, marginTop: -8 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#C4844E', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</Link>
            </div>
            <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#7A7A7A' }}>
            Don't have an account? <Link to="/signup" style={{ color: '#C4844E', fontWeight: 600, textDecoration: 'none' }}>Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
