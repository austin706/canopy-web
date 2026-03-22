import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

interface Stats {
  totalUsers: number; totalAgents: number; activeGiftCodes: number; redeemedGiftCodes: number;
  totalHomes: number; totalEquipment: number; totalTasks: number; completedTasks: number; proRequests: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, reset } = useStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [u, a, gc, gcr, h, e, t, tc, pr] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('agents').select('*', { count: 'exact', head: true }),
        supabase.from('gift_codes').select('*', { count: 'exact', head: true }).is('redeemed_by', null),
        supabase.from('gift_codes').select('*', { count: 'exact', head: true }).not('redeemed_by', 'is', null),
        supabase.from('homes').select('*', { count: 'exact', head: true }),
        supabase.from('equipment').select('*', { count: 'exact', head: true }),
        supabase.from('maintenance_tasks').select('*', { count: 'exact', head: true }),
        supabase.from('maintenance_tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('pro_requests').select('*', { count: 'exact', head: true }),
      ]);
      setStats({ totalUsers: u.count||0, totalAgents: a.count||0, activeGiftCodes: gc.count||0, redeemedGiftCodes: gcr.count||0, totalHomes: h.count||0, totalEquipment: e.count||0, totalTasks: t.count||0, completedTasks: tc.count||0, proRequests: pr.count||0 });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    reset();
    navigate('/login');
  };

  if (loading) return <div className="page text-center" style={{ paddingTop: 100 }}><div className="spinner" style={{ width: 40, height: 40 }} /><p className="mt-md text-gray">Loading admin data...</p></div>;

  const rate = stats && stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div><h1 style={{ fontSize: 28 }}>Admin Dashboard</h1><p className="text-sm text-copper fw-500">Oak &amp; Sage &middot; Canopy</p></div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>&#8592; Back to App</button>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Overview</h2>
      <div className="stats-grid">
        {[
          { label: 'Users', value: stats?.totalUsers||0, color: Colors.copper, icon: '&#128101;' },
          { label: 'Agents', value: stats?.totalAgents||0, color: Colors.sage, icon: '&#128188;' },
          { label: 'Homes', value: stats?.totalHomes||0, color: Colors.info, icon: '&#127968;' },
          { label: 'Equipment', value: stats?.totalEquipment||0, color: Colors.copperDark, icon: '&#128736;' },
          { label: 'Total Tasks', value: stats?.totalTasks||0, color: Colors.sage, icon: '&#128203;' },
          { label: 'Completed', value: stats?.completedTasks||0, color: Colors.success, icon: '&#9989;' },
          { label: 'Active Codes', value: stats?.activeGiftCodes||0, color: Colors.copper, icon: '&#127873;' },
          { label: 'Pro Requests', value: stats?.proRequests||0, color: Colors.warning, icon: '&#128295;' },
        ].map(s => (
          <div key={s.label} className="card stat-card">
            <div className="stat-icon" style={{ background: s.color + '15' }} dangerouslySetInnerHTML={{ __html: s.icon }} />
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Completion Rate */}
      {stats && stats.totalTasks > 0 && (
        <div className="card mb-lg">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Platform Task Completion Rate</p>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${rate}%`, background: Colors.sage }} /></div>
          <p className="text-xs text-gray mt-sm">{rate}% ({stats.completedTasks}/{stats.totalTasks})</p>
        </div>
      )}

      {/* Navigation */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, marginTop: 24 }}>Manage</h2>
      <div className="grid-2">
        {[
          { label: 'Agent Management', icon: '&#128188;', route: '/admin/agents', badge: stats?.totalAgents },
          { label: 'Pro Service Requests', icon: '&#128295;', route: '/admin/pro-requests', badge: stats?.proRequests },
          { label: 'User Accounts', icon: '&#128101;', route: '/admin/users', badge: stats?.totalUsers },
          { label: 'Gift Codes', icon: '&#127873;', route: '/admin/gift-codes', badge: stats?.activeGiftCodes },
        ].map(n => (
          <Link key={n.label} to={n.route} className="card" style={{ textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-md">
              <span style={{ fontSize: 20 }} dangerouslySetInnerHTML={{ __html: n.icon }} />
              <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>{n.label}</span>
            </div>
            <div className="flex items-center gap-sm">
              {n.badge !== undefined && n.badge > 0 && <span className="badge badge-copper">{n.badge}</span>}
              <span style={{ color: 'var(--silver)' }}>&rarr;</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
