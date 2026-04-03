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
        <div><h1 style={{ fontSize: 28 }}>Admin Dashboard</h1><p className="text-sm text-copper fw-500">Canopy Home</p></div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>&#8592; Back to App</button>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Overview</h2>
      <div className="stats-grid">
        {[
          { label: 'Users', value: stats?.totalUsers||0, color: Colors.copper, abbr: 'US' },
          { label: 'Agents', value: stats?.totalAgents||0, color: Colors.sage, abbr: 'AG' },
          { label: 'Homes', value: stats?.totalHomes||0, color: Colors.info, abbr: 'HM' },
          { label: 'Equipment', value: stats?.totalEquipment||0, color: Colors.copperDark, abbr: 'EQ' },
          { label: 'Total Tasks', value: stats?.totalTasks||0, color: Colors.sage, abbr: 'TK' },
          { label: 'Completed', value: stats?.completedTasks||0, color: Colors.success, abbr: 'OK' },
          { label: 'Active Codes', value: stats?.activeGiftCodes||0, color: Colors.copper, abbr: 'GC' },
          { label: 'Pro Requests', value: stats?.proRequests||0, color: Colors.warning, abbr: 'PR' },
        ].map(s => (
          <div key={s.label} className="card stat-card">
            <div className="stat-icon" style={{ background: s.color + '15', fontSize: 12, fontWeight: 700, color: s.color }}>{s.abbr}</div>
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
          { label: 'Agent Management', route: '/admin/agents', badge: stats?.totalAgents },
          { label: 'Pro Service Requests', route: '/admin/pro-requests', badge: stats?.proRequests },
          { label: 'User Accounts', route: '/admin/users', badge: stats?.totalUsers },
          { label: 'Gift Codes', route: '/admin/gift-codes', badge: stats?.activeGiftCodes },
          { label: 'Pro Providers', route: '/admin/pro-providers', badge: undefined },
          { label: 'Service Areas', route: '/admin/service-areas', badge: undefined },
          { label: 'Notifications', route: '/admin/notifications', badge: undefined },
          { label: 'Email Templates', route: '/admin/emails', badge: undefined },
          { label: 'Analytics', route: '/admin/analytics', badge: undefined },
          { label: 'Audit Log', route: '/admin/audit-log', badge: undefined },
          { label: 'Agent Portal (View as Agent)', route: '/agent-portal', badge: undefined },
          { label: 'Pro Provider Portal (View as Pro)', route: '/pro-portal', badge: undefined },
        ].map(n => (
          <Link key={n.label} to={n.route} className="card" style={{ textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-md">
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
