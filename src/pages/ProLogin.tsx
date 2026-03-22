import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

export default function ProLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateInputs = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!password.trim()) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    try {
      const authData = await signIn(email, password);
      const userId = authData.user.id;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (profileError || !profileData || profileData.role !== 'pro_provider') {
        const { data: proData, error: proError } = await supabase
          .from('pro_providers')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (proError || !proData) {
          await supabase.auth.signOut();
          alert('Access Denied: This account is not registered as a service provider.');
          return;
        }
      }

      navigate('/pro-portal');
    } catch (error: any) {
      alert(error.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 400, margin: '0 auto', paddingTop: 60 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Pro Portal</h1>
        <p className="subtitle">Manage service requests and availability</p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 24 }}>Sign In</h2>

        <div className="form-group">
          <label>Email</label>
          <input
            className="form-input"
            placeholder="your.email@example.com"
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
          />
          {errors.email && <p style={{ color: Colors.error, fontSize: 12, marginTop: 4 }}>{errors.email}</p>}
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            className="form-input"
            placeholder="Enter your password"
            type="password"
            value={password}
            onChange={e => {
              setPassword(e.target.value);
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
          />
          {errors.password && <p style={{ color: Colors.error, fontSize: 12, marginTop: 4 }}>{errors.password}</p>}
        </div>

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </div>

      <div className="card" style={{ backgroundColor: Colors.sageMuted, marginTop: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Provider Access</h3>
        <p style={{ fontSize: 13, color: Colors.medGray, margin: 0, lineHeight: 1.5 }}>
          This portal is for registered Canopy service providers. If you'd like to join our provider network, please
          contact us at providers@canopyhome.app.
        </p>
      </div>
    </div>
  );
}
