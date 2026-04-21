import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { resendVerificationEmail, supabase, getUserHomes, STRUCTURE_TYPES } from '@/services/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';
import RescheduleModal from '@/components/RescheduleModal';
import { showToast } from '@/components/Toast';
import { PLANS } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';
import type { Home } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';
import {
  CanopyLogo,
  NavDashboard, NavCalendar, NavWeather, NavEquipment, NavDocuments,
  NavProServices, NavNotifications, NavAgent, NavHome,
  NavSubscription, NavHelp, NavAdmin, NavAgentPortal, NavProPortal,
} from '@/components/icons/CanopyLogo';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, reset, home, homes, setHomes, switchHome } = useStore();
  const tier = user?.subscription_tier || 'free';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showHomeSwitcher, setShowHomeSwitcher] = useState(false);

  // Load all homes for user on mount
  useEffect(() => {
    if (user?.id) {
      getUserHomes(user.id).then(setHomes).catch(() => {});
    }
  }, [user?.id]);

  // Group homes by parent_home_id for display
  const groupedHomes = useMemo(() => {
    const primaryHomes = homes.filter(h => !h.parent_home_id);
    const structures = homes.filter(h => h.parent_home_id);
    return { primaryHomes, structures };
  }, [homes]);

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
    // scope:'local' clears in-memory + localStorage without a network request.
    // navigator.locks are disabled on our Supabase client so no deadlock risk.
    try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
    reset();
    window.location.href = '/login';
  };

  const isPro = tier === 'pro' || tier === 'pro_plus';
  const navItems: { to: string; icon: React.FC<{ size?: number; color?: string }>; label: string }[] = [
    { to: '/dashboard', icon: NavDashboard, label: 'Dashboard' },
    { to: '/calendar', icon: NavCalendar, label: 'Calendar' },
    { to: '/weather', icon: NavWeather, label: 'Weather' },
    { to: '/equipment', icon: NavEquipment, label: 'Equipment' },
    { to: '/documents', icon: NavDocuments, label: 'Documents' },
    { to: '/notifications', icon: NavNotifications, label: 'Notifications' },
    { to: '/pro-services', icon: NavProServices, label: 'Pro Services' },
    { to: '/agent', icon: NavAgent, label: 'My Agent' },
    { to: '/sale-prep', icon: NavHome, label: 'Sale Prep' },
    { to: '/help', icon: NavHelp, label: 'Help & Support' },
  ];

  return (
    <div className="app-layout">
      {/* Mobile top bar */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: 18 }}>Canopy</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggleIcon />
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
            <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}

      <nav className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/canopy-watercolor-logo.png" alt="Canopy" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
            <h2 style={{ margin: 0 }}>Canopy</h2>
          </div>
        </div>
        {/* Property Switcher */}
        {homes.length > 0 && (
          <div style={{ padding: '0 16px 8px', position: 'relative' }}>
            <button
              onClick={() => setShowHomeSwitcher(!showHomeSwitcher)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: home ? 'var(--color-cream)' : 'var(--color-background)',
                border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 500, color: 'var(--color-text)',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                {home ? `${home.address || 'My Home'}` : 'Select Home'}
              </span>
              <span style={{ fontSize: 10, marginLeft: 8, color: 'var(--color-text-secondary)' }}>{showHomeSwitcher ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showHomeSwitcher && (
              <div style={{
                position: 'absolute', left: 16, right: 16, top: '100%', background: 'var(--color-card-background)',
                border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 50, maxHeight: 300, overflowY: 'auto',
              }}>
                {/* Primary homes */}
                {groupedHomes.primaryHomes.map(h => (
                  <div key={h.id}>
                    <button
                      onClick={() => { switchHome(h.id); setShowHomeSwitcher(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none',
                        background: h.id === home?.id ? 'var(--color-cream)' : 'transparent',
                        cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--color-background)',
                        fontWeight: h.id === home?.id ? 600 : 400,
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>{h.address || 'Unnamed Home'}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{h.city}, {h.state} {h.zip_code}</div>
                    </button>
                    {/* Structures under this home */}
                    {groupedHomes.structures.filter(s => s.parent_home_id === h.id).map(struct => (
                      <button
                        key={struct.id}
                        onClick={() => { switchHome(struct.id); setShowHomeSwitcher(false); }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '8px 12px 8px 28px', border: 'none',
                          background: struct.id === home?.id ? 'var(--color-cream)' : 'transparent',
                          cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--color-background)',
                          fontWeight: struct.id === home?.id ? 600 : 400,
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        <span style={{ marginRight: 6 }}>↳</span>
                        <span>
                          {STRUCTURE_TYPES[struct.structure_type as keyof typeof STRUCTURE_TYPES] || 'Structure'}
                          {struct.structure_label ? ` — ${struct.structure_label}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                <button
                  onClick={() => { setShowHomeSwitcher(false); navigate('/onboarding?step=1'); }}
                  style={{
                    width: '100%', textAlign: 'center', padding: '10px 12px', border: 'none',
                    background: 'transparent', cursor: 'pointer', fontSize: 13,
                    color: 'var(--color-copper)', fontWeight: 600,
                  }}
                >
                  + Add Another Property
                </button>
              </div>
            )}
          </div>
        )}
        <div className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          {/* Setup checklist lives on the Dashboard as a widget — no sidebar link needed */}
          {/* Admin users see admin portal link + standalone portal links */}
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
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user?.full_name?.charAt(0) || '?'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name truncate">{user?.full_name || 'User'}</div>
              <div className="user-tier">{PLANS.find(p => p.value === tier)?.name || 'Free'}</div>
            </div>
          </div>
          {/* Settings + Sign Out row. Theme toggle was previously wedged
              between the two text buttons (a floating emoji between links);
              it now lives in /profile → Appearance. Sign Out is no longer
              colored error-red — it's a neutral secondary action, confirmed
              by the modal before it fires. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <NavLink to="/profile" className="btn btn-ghost btn-sm" style={{ flex: 1, textDecoration: 'none', fontSize: 12 }}>Settings</NavLink>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={handleLogout}>Sign Out</button>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/terms" style={{ fontSize: 10, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Terms</a>
            <a href="/privacy" style={{ fontSize: 10, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Privacy</a>
            <a href="/cancellation" style={{ fontSize: 10, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Cancellation</a>
            <a href="/ai-disclaimer" style={{ fontSize: 10, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>AI Disclaimer</a>
          </div>
        </div>
      </nav>
      <main className="main-content">
        {user && !user.email_confirmed && (
          <div style={{
            background: 'var(--color-warning)20',
            borderBottom: '1px solid var(--color-warning)',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'var(--color-warning)',
          }}>
            <span>Please verify your email address. Check your inbox for a confirmation link.</span>
            <button
              onClick={async () => {
                try {
                  // First check if already confirmed (stale store)
                  const { data: { user: authUser } } = await supabase.auth.getUser();
                  if (authUser?.email_confirmed_at) {
                    // Already verified — update store and dismiss banner
                    const storeUser = useStore.getState().user;
                    if (storeUser) useStore.getState().setUser({ ...storeUser, email_confirmed: true });
                    showToast({ message: 'Your email is already verified!' });
                    return;
                  }
                  await resendVerificationEmail();
                  showToast({ message: 'Verification email sent! Check your inbox.' });
                } catch (err: any) {
                  showToast({ message: err?.message || 'Failed to send. Please try again.' });
                }
              }}
              style={{
                background: 'none',
                border: '1px solid var(--color-warning)',
                borderRadius: 6,
                padding: '4px 12px',
                color: 'var(--color-warning)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginLeft: 16,
              }}
            >
              Resend Email
            </button>
          </div>
        )}
        {user && user.subscription_status === 'past_due' && (
          <div
            role="alert"
            style={{
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              color: '#92400E',
              padding: '12px 16px',
              borderRadius: 8,
              margin: '0 0 16px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              ⚠️ Your last payment didn't go through. Update your card to keep your Canopy subscription active and avoid service interruption.
            </span>
            <button
              onClick={() => navigate('/subscription')}
              style={{
                backgroundColor: '#F59E0B',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Update Payment
            </button>
          </div>
        )}
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
        <RescheduleModal />
      </main>
    </div>
  );
}

/** Simple sun/moon toggle button */
function ThemeToggleIcon() {
  const { resolvedMode, setMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  return (
    <button
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 6,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {isDark ? '\u2600\uFE0F' : '\uD83C\uDF19'}
    </button>
  );
}
