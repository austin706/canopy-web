import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

interface Stats {
  totalUsers: number; totalAgents: number; activeGiftCodes: number; redeemedGiftCodes: number;
  totalHomes: number; totalEquipment: number; totalTasks: number; completedTasks: number; proRequests: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  timestamp: string;
  details: any;
}

export default function AdminDashboard() {
  const { user } = useStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
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

      // Fetch recent audit log entries
      const { data: auditData } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5);
      setRecentActivity(auditData || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="page text-center" style={{ paddingTop: 100 }}><div className="spinner" style={{ width: 40, height: 40 }} /><p className="mt-md text-gray">Loading admin data...</p></div>;

  const rate = stats && stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="page-wide">
      {/* Page Header */}
      <div className="admin-page-header mb-lg">
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{today}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid mb-lg">
        {[
          { label: 'Users', value: stats?.totalUsers||0, icon: '👥', color: Colors.copper },
          { label: 'Agents', value: stats?.totalAgents||0, icon: '🏢', color: Colors.sage },
          { label: 'Homes', value: stats?.totalHomes||0, icon: '🏠', color: Colors.info },
          { label: 'Equipment', value: stats?.totalEquipment||0, icon: '⚙️', color: Colors.copperDark },
          { label: 'Tasks', value: stats?.totalTasks||0, icon: '✓', color: Colors.sage },
          { label: 'Completed', value: stats?.completedTasks||0, icon: '✓✓', color: Colors.success },
          { label: 'Active Codes', value: stats?.activeGiftCodes||0, icon: '🎁', color: Colors.copper },
          { label: 'Pro Requests', value: stats?.proRequests||0, icon: '⭐', color: Colors.warning },
        ].map(kpi => (
          <div key={kpi.label} className="admin-kpi-card">
            <div className="kpi-icon" style={{ background: kpi.color + '15' }}>{kpi.icon}</div>
            <div className="kpi-value">{kpi.value}</div>
            <div className="kpi-label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Task Completion Rate */}
      {stats && stats.totalTasks > 0 && (
        <div style={{
          background: 'var(--color-card)',
          padding: 20,
          borderRadius: 8,
          marginBottom: 32,
          border: '1px solid var(--color-border)'
        }}>
          <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Platform Task Completion Rate</p>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${rate}%`, background: Colors.sage }} /></div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{rate}% ({stats.completedTasks}/{stats.totalTasks})</p>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h2>
        <div className="admin-card-grid">
          {[
            { label: 'Agent Management', route: '/admin/agents', icon: '🏢', count: stats?.totalAgents || 0 },
            { label: 'User Accounts', route: '/admin/users', icon: '👥', count: stats?.totalUsers || 0 },
            { label: 'Pro Service Requests', route: '/admin/pro-requests', icon: '⭐', count: stats?.proRequests || 0 },
            { label: 'Gift Codes', route: '/admin/gift-codes', icon: '🎁', count: stats?.activeGiftCodes || 0 },
            { label: 'Pro Providers', route: '/admin/pro-providers', icon: '🏅', count: 0 },
            { label: 'Service Areas', route: '/admin/service-areas', icon: '📍', count: 0 },
            { label: 'Notifications', route: '/admin/notifications', icon: '🔔', count: 0 },
            { label: 'Email Templates', route: '/admin/emails', icon: '📧', count: 0 },
            { label: 'Provider Applications', route: '/admin/provider-applications', icon: '📝', count: 0 },
            { label: 'Support Tickets', route: '/admin/support-tickets', icon: '🎫', count: 0 },
            { label: 'Analytics', route: '/admin/analytics', icon: '📊', count: 0 },
            { label: 'Audit Log', route: '/admin/audit-log', icon: '📋', count: 0 },
          ].map(action => (
            <Link
              key={action.label}
              to={action.route}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 20,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = Colors.copper;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${Colors.copper}15`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{action.icon}</div>
                <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 4px 0', color: 'var(--charcoal)' }}>{action.label}</p>
                {action.count > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{action.count} items</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Recent Activity</h2>
          <div style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden'
          }}>
            <div style={{ padding: 16 }}>
              {recentActivity.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottom: '1px solid var(--color-border)',
                  }}
                  className="last:border-b-0"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, margin: '0 0 4px 0', color: 'var(--charcoal)' }}>
                        {entry.action.replace(/\./g, ' ').replace(/_/g, ' ')}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                        {entry.entity_type} • {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 11,
                      background: 'var(--color-background)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap'
                    }}>
                      {entry.entity_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Portal Links (for testing) */}
      <div style={{ marginTop: 32, paddingTop: 32, borderTop: '1px solid var(--color-border)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Portal Previews</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/agent-portal" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary btn-sm">View as Agent</button>
          </Link>
          <Link to="/pro-portal" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary btn-sm">View as Pro</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
