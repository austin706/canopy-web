import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { showToast } from '@/components/Toast';

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

      // P1 #26 (2026-04-23): single source of truth for pro authority.
      //
      // The previous implementation checked `profiles.role === 'pro_provider'`
      // OR a `pro_providers` lookup with an OR fallback. That let two
      // failure modes through:
      //   1. orphaned `pro_providers` row + `profiles.role` cleared by an
      //      admin (account was meant to be revoked but pro row was missed)
      //   2. `profiles.role = 'pro_provider'` set manually but no pro_providers
      //      row (incomplete onboarding)
      // Treat `pro_providers` as the authoritative source, and reconcile
      // `profiles.role` to match if it has drifted. Also require an
      // active provider row (no `suspended_at`) so admins can suspend pros
      // by setting that timestamp.
      let { data: proData, error: proError } = await supabase
        .from('pro_providers')
        .select('id, user_id, suspended_at')
        .eq('user_id', userId)
        .maybeSingle();

      // P1 #27 (2026-04-23): auto-link orphaned provider row on first login.
      //
      // Admin approval (`AdminProviderApplications.handleApprove`) creates a
      // `pro_providers` row with `user_id = NULL` BEFORE the technician has
      // an auth account. The applicant then receives the `provider-welcome`
      // email, signs up via standard Supabase auth, and tries to sign in
      // here. Without this fallback the user_id-keyed lookup misses the
      // orphan row and the user lands in a "not registered" dead-end —
      // requiring an admin to manually paste the new auth user.id into the
      // orphan row.
      //
      // Fallback: if no row matches by user_id, look for an unlinked row
      // (user_id IS NULL) with the same email. Bind it. Audit log isn't
      // available on the public path, but RLS ensures only the row owner
      // (the freshly-authed user) can write.
      if (!proError && !proData) {
        const email = authData.user.email;
        if (email) {
          const { data: orphan } = await supabase
            .from('pro_providers')
            .select('id, user_id, suspended_at, email')
            .eq('email', email)
            .is('user_id', null)
            .maybeSingle();

          if (orphan) {
            const { data: linked, error: linkErr } = await supabase
              .from('pro_providers')
              .update({ user_id: userId, updated_at: new Date().toISOString() })
              .eq('id', orphan.id)
              .is('user_id', null) // race guard: only link if still unlinked
              .select('id, user_id, suspended_at')
              .maybeSingle();

            if (!linkErr && linked) {
              proData = linked;
            }
          }
        }
      }

      if (proError || !proData || proData.suspended_at) {
        await supabase.auth.signOut();
        showToast({
          message: proData?.suspended_at
            ? 'Access Denied: Your provider account has been suspended. Contact support@canopyhome.app.'
            : 'Access Denied: This account is not registered as a service provider.',
        });
        return;
      }

      // Reconcile drifted profile role so subsequent role gates
      // (`useRequireRole`, RoleRoute) see a consistent value.
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (!profileData || profileData.role !== 'pro_provider') {
        try {
          await supabase
            .from('profiles')
            .update({ role: 'pro_provider', updated_at: new Date().toISOString() })
            .eq('id', userId);
        } catch {
          // Non-fatal: portal will still load via pro_providers; useRequireRole
          // may bounce until the next session refresh, which is the safer default.
        }
      }

      navigate('/pro-portal');
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to sign in. Please check your credentials.' });
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
