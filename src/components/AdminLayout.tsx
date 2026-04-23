import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * AdminLayout — Dedicated admin portal layout with grouped sidebar navigation.
 * Replaces the homeowner Layout for /admin/* routes so admins get a focused,
 * purpose-built experience.
 */

interface NavSection {
  title: string;
  items: { to: string; label: string; icon: React.ReactNode; badge?: number }[];
}

// ── SVG Icons (inline, no deps) ─────────────────────────────────
const Icon = {
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  Agent: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  GiftCode: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
    </svg>
  ),
  Wrench: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  Clipboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  ),
  MapPin: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Mail: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/>
    </svg>
  ),
  BarChart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  ),
  FileText: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Shield: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Database: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  Ticket: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 013-3h14a3 3 0 013 3"/><path d="M2 9v6a3 3 0 003 3h14a3 3 0 003-3V9"/><path d="M13 6v12"/><path d="M2 9h20"/>
    </svg>
  ),
  Home: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Briefcase: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
    </svg>
  ),
  LogOut: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  Sun: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  Moon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  ),
  Link: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
    </svg>
  ),
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, reset } = useStore();
  const { resolvedMode, setMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    reset();
    window.location.href = '/login';
  };

  const navSections: NavSection[] = [
    {
      title: 'Overview',
      items: [
        { to: '/admin', label: 'Dashboard', icon: <Icon.Dashboard /> },
        { to: '/admin/analytics', label: 'Analytics', icon: <Icon.BarChart /> },
      ],
    },
    {
      title: 'People',
      items: [
        { to: '/admin/users', label: 'Users', icon: <Icon.Users /> },
        { to: '/admin/agents', label: 'Agents', icon: <Icon.Agent /> },
        { to: '/admin/builders', label: 'Builders', icon: <Icon.Home /> },
        { to: '/admin/pro-providers', label: 'Pro Providers', icon: <Icon.Wrench /> },
        { to: '/admin/provider-applications', label: 'Applications', icon: <Icon.Clipboard /> },
        { to: '/admin/technician-onboarding', label: 'Tech Onboarding', icon: <Icon.Clipboard /> },
      ],
    },
    {
      title: 'Operations',
      items: [
        { to: '/admin/pro-requests', label: 'Pro Requests', icon: <Icon.Briefcase /> },
        { to: '/admin/add-ons', label: 'Add-On Quotes', icon: <Icon.Wrench /> },
        { to: '/admin/service-areas', label: 'Service Areas', icon: <Icon.MapPin /> },
        { to: '/admin/gift-codes', label: 'Gift Codes', icon: <Icon.GiftCode /> },
        { to: '/admin/support-tickets', label: 'Support Tickets', icon: <Icon.Ticket /> },
        { to: '/admin/verifications', label: 'Verifications', icon: <Icon.Shield /> },
      ],
    },
    {
      title: 'Communications',
      items: [
        { to: '/admin/notifications', label: 'Notifications', icon: <Icon.Bell /> },
        { to: '/admin/emails', label: 'Email Templates', icon: <Icon.Mail /> },
      ],
    },
    {
      title: 'System',
      items: [
        { to: '/admin/audit-log', label: 'Audit Log', icon: <Icon.Shield /> },
        { to: '/admin/reference-data', label: 'Reference Data', icon: <Icon.Database /> },
        { to: '/admin/affiliate-products', label: 'Affiliate Links', icon: <Icon.Link /> },
      ],
    },
  ];

  // Breadcrumb from path
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((seg, i) => ({
    label: seg.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    path: '/' + pathSegments.slice(0, i + 1).join('/'),
    isLast: i === pathSegments.length - 1,
  }));

  return (
    <div className="admin-layout">
      {/* Mobile top bar */}
      <header className="admin-topbar-mobile">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Canopy</span>
          <span className="admin-badge-pill">ADMIN</span>
        </div>
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle navigation menu">
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
        </button>
      </header>

      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}

      {/* Sidebar */}
      <nav className={`admin-sidebar ${mobileMenuOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            {!sidebarCollapsed && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>Canopy</div>
                <div className="admin-badge-pill" style={{ marginTop: 2 }}>ADMIN</div>
              </div>
            )}
          </div>
        </div>

        <div className="admin-sidebar-nav">
          {navSections.map(section => (
            <div key={section.title} className="admin-nav-section">
              {!sidebarCollapsed && <div className="admin-nav-section-title">{section.title}</div>}
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/admin'}
                  className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="admin-nav-icon">{item.icon}</span>
                  {!sidebarCollapsed && <span className="admin-nav-label">{item.label}</span>}
                  {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="admin-nav-badge">{item.badge}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Portal links */}
        <div className="admin-sidebar-portals">
          {!sidebarCollapsed && <div className="admin-nav-section-title">Portals</div>}
          <NavLink to="/agent-portal" className="admin-nav-link" title={sidebarCollapsed ? 'Agent Portal' : undefined}>
            <span className="admin-nav-icon"><Icon.Agent /></span>
            {!sidebarCollapsed && <span className="admin-nav-label">Agent Portal</span>}
          </NavLink>
          <NavLink to="/pro-portal" className="admin-nav-link" title={sidebarCollapsed ? 'Pro Portal' : undefined}>
            <span className="admin-nav-icon"><Icon.Wrench /></span>
            {!sidebarCollapsed && <span className="admin-nav-label">Pro Portal</span>}
          </NavLink>
          <NavLink to="/dashboard" className="admin-nav-link" title={sidebarCollapsed ? 'Homeowner App' : undefined}>
            <span className="admin-nav-icon"><Icon.Home /></span>
            {!sidebarCollapsed && <span className="admin-nav-label">Homeowner App</span>}
          </NavLink>
        </div>

        {/* Footer */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-row">
            <div className="admin-avatar">{user?.full_name?.charAt(0) || '?'}</div>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="admin-user-name">{user?.full_name || 'Admin'}</div>
                <div className="admin-user-email">{user?.email || ''}</div>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                className="admin-footer-btn"
                onClick={() => setMode(isDark ? 'light' : 'dark')}
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? <Icon.Sun /> : <Icon.Moon />}
              </button>
              <button className="admin-footer-btn admin-footer-btn-danger" onClick={handleLogout} title="Sign Out">
                <Icon.LogOut />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className={`admin-main ${sidebarCollapsed ? 'expanded' : ''}`}>
        {/* Top breadcrumb bar */}
        <div className="admin-content-header">
          <nav className="admin-breadcrumbs">
            {breadcrumbs.map((bc, i) => (
              <span key={bc.path}>
                {i > 0 && <span className="admin-breadcrumb-sep">/</span>}
                {bc.isLast ? (
                  <span className="admin-breadcrumb-current">{bc.label}</span>
                ) : (
                  <a href={bc.path} className="admin-breadcrumb-link" onClick={e => { e.preventDefault(); navigate(bc.path); }}>{bc.label}</a>
                )}
              </span>
            ))}
          </nav>
        </div>
        <div className="admin-content-body">
          {/* P3 #87 (2026-04-23) — key by pathname so navigating resets boundary. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
