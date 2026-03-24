import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { signOut } from '@/services/supabase';
import { PLANS } from '@/services/subscriptionGate';
import {
  CanopyLogo,
  NavDashboard, NavCalendar, NavWeather, NavEquipment, NavDocuments,
  NavProServices, NavLogs, NavNotifications, NavAgent, NavHome,
  NavSubscription, NavHelp, NavAdmin, NavAgentPortal, NavProPortal,
} from '@/components/icons/CanopyLogo';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, reset } = useStore();
  const tier = user?.subscription_tier || 'free';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    reset();
    navigate('/login');
  };

  const navItems: { to: string; icon: React.FC<{ size?: number; color?: string }>; label: string }[] = [
    { to: '/', icon: NavDashboard, label: 'Dashboard' },
    { to: '/calendar', icon: NavCalendar, label: 'Calendar' },
    { to: '/weather', icon: NavWeather, label: 'Weather' },
    { to: '/equipment', icon: NavEquipment, label: 'Equipment' },
    { to: '/documents', icon: NavDocuments, label: 'Documents' },
    { to: '/pro-services', icon: NavProServices, label: 'Pro Services' },
    { to: '/logs', icon: NavLogs, label: 'Maintenance Log' },
    { to: '/notifications', icon: NavNotifications, label: 'Notifications' },
    { to: '/agent', icon: NavAgent, label: 'My Agent' },
    { to: '/home', icon: NavHome, label: 'Home Details' },
    { to: '/subscription', icon: NavSubscription, label: 'Subscription' },
    { to: '/help', icon: NavHelp, label: 'Help & FAQ' },
  ];

  return (
    <div className="app-layout">
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Canopy</span>
        </div>
        <button
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}

      <nav className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
            <h2 style={{ margin: 0 }}>Canopy</h2>
          </div>
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
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          {/* Admin users see all three portals */}
          {user?.role === 'admin' && (
            <>
              <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
                <NavAdmin size={18} /> Admin Portal
              </NavLink>
              <NavLink to="/agent-portal" className={({ isActive }) => isActive ? 'active' : ''}>
                <NavAgentPortal size={18} /> Agent Portal
              </NavLink>
              <NavLink to="/pro-portal" className={({ isActive }) => isActive ? 'active' : ''}>
                <NavProPortal size={18} /> Pro Portal
              </NavLink>
            </>
          )}
          {/* Agent users see only Agent Portal */}
          {user?.role === 'agent' && (
            <NavLink to="/agent-portal" className={({ isActive }) => isActive ? 'active' : ''}>
              <NavAgentPortal size={18} /> Agent Portal
            </NavLink>
          )}
          {/* Pro Provider users see only Pro Portal */}
          {user?.role === 'pro_provider' && (
            <NavLink to="/pro-portal" className={({ isActive }) => isActive ? 'active' : ''}>
              <NavProPortal size={18} /> Pro Portal
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
