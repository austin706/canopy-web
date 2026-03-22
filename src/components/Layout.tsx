import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { signOut } from '@/services/supabase';
import { PLANS } from '@/services/subscriptionGate';

export default function Layout() {
  const navigate = useNavigate();
  const { user, reset } = useStore();
  const tier = user?.subscription_tier || 'free';

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    reset();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: '&#127968;', label: 'Dashboard' },
    { to: '/calendar', icon: '&#128197;', label: 'Calendar' },
    { to: '/equipment', icon: '&#128736;', label: 'Equipment' },
    { to: '/pro-request', icon: '&#128295;', label: 'Pro Services' },
    { to: '/logs', icon: '&#128203;', label: 'Maintenance Log' },
    { to: '/agent', icon: '&#128100;', label: 'My Agent' },
    { to: '/home', icon: '&#127969;', label: 'Home Details' },
    { to: '/subscription', icon: '&#11088;', label: 'Subscription' },
  ];

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <h2>&#127793; Canopy</h2>
          <span>Oak &amp; Sage Realty</span>
        </div>
        <div className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span dangerouslySetInnerHTML={{ __html: item.icon }} />
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>&#128272;</span> Admin Portal
            </NavLink>
          )}
          {user?.role === 'agent' && (
            <NavLink to="/agent-portal" className={({ isActive }) => isActive ? 'active' : ''}>
              <span>&#128188;</span> Agent Portal
            </NavLink>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user?.full_name?.charAt(0) || '?'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name truncate">{user?.full_name || 'User'}</div>
              <div className="user-tier">{PLANS.find(p => p.value === tier)?.name || 'Free'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <NavLink to="/profile" className="btn btn-ghost btn-sm" style={{ flex: 1, textDecoration: 'none', fontSize: 12 }}>Profile</NavLink>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 12, color: '#E53935' }} onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
