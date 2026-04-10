import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Colors } from '@/constants/theme';

/**
 * Standalone layout for pro provider portal — NO homeowner sidebar or nav.
 * Pros see only pro-relevant tools: Dashboard, Jobs, Visit Schedule, Quotes/Invoices, Profile.
 */
export default function ProLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, reset } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    try {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
    } catch {}
    reset();
    window.location.href = '/login';
  };

  const navItems = [
    { to: '/pro-portal', label: 'Dashboard', icon: '📊' },
    { to: '/pro-portal/job-queue', label: 'Job Queue', icon: '📋' },
    { to: '/pro-portal/visit-schedule', label: 'Visit Schedule', icon: '📅' },
    { to: '/pro-portal/quotes-invoices', label: 'Quotes & Invoices', icon: '💰' },
    { to: '/pro-portal/availability', label: 'Availability', icon: '🕐' },
    { to: '/pro-portal/profile', label: 'My Profile', icon: '👤' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Canopy</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: Colors.white, background: Colors.sage, padding: '2px 8px', borderRadius: 4, marginLeft: 4 }}>PRO</span>
        </div>
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle navigation menu">
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
        </button>
      </header>

      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}

      <nav className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
            <div>
              <h2 style={{ margin: 0 }}>Canopy</h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: Colors.sage }}>PRO PROVIDER</span>
            </div>
          </div>
        </div>
        <div className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/pro-portal'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar" style={{ background: Colors.sage + '30', color: Colors.sage }}>{user?.full_name?.charAt(0) || '?'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name truncate">{user?.full_name || 'Provider'}</div>
              <div className="user-tier" style={{ color: Colors.sage }}>Pro Provider</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 12, color: Colors.error }} onClick={handleLogout}>Sign Out</button>
          </div>
        </div>
      </nav>
      <main className="main-content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
