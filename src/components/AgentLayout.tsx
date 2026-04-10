import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import logger from '@/utils/logger';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Colors } from '@/constants/theme';

/**
 * Standalone layout for agent portal — NO homeowner sidebar or nav.
 * Agents see only agent-relevant tools: Clients, New Client, Codes, Profile.
 */
export default function AgentLayout() {
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
    { to: '/agent-portal', label: 'Dashboard', icon: '📊' },
    { to: '/agent-portal/purchase-codes', label: 'Purchase Codes', icon: '🎟️' },
    { to: '/agent-portal/link-client', label: 'Link Client', icon: '🔗' },
    { to: '/agent-portal/profile', label: 'My Profile', icon: '👤' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Canopy</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: Colors.copper, background: Colors.copperMuted, padding: '2px 8px', borderRadius: 4, marginLeft: 4 }}>AGENT</span>
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
              <span style={{ fontSize: 11, fontWeight: 600, color: Colors.copper }}>AGENT PORTAL</span>
            </div>
          </div>
        </div>
        <div className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/agent-portal'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user?.full_name?.charAt(0) || '?'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name truncate">{user?.full_name || 'Agent'}</div>
              <div className="user-tier" style={{ color: Colors.copper }}>Agent</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 12, color: 'var(--color-error)' }} onClick={handleLogout}>Sign Out</button>
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
