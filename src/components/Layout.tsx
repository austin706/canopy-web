import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { signOut, resendVerificationEmail, supabase, getUserHomes } from '@/services/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';
import { PLANS } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';
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
    try {
      await signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    reset();
    navigate('/login');
  };

  const isPro = tier === 'pro' || tier === 'pro_plus';
  const navItems: { to: string; icon: React.FC<{ size?: number; color?: string }>; label: string }[] = [
    { to: '/', icon: NavDashboard, label: 'Dashboard' },
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
          <span>Canopy</span>
        </div>
        {/* Property Switcher */}
        {homes.length > 0 && (
          <div style={{ padding: '0 16px 8px', position: 'relative' }}>
            <button
              onClick={() => setShowHomeSwitcher(!showHomeSwitcher)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: home ? Colors.cream : '#f3f4f6',
                border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 500, color: '#374151',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                {home ? `${home.address || 'My Home'}` : 'Select Home'}
              </span>
              <span style={{ fontSize: 10, marginLeft: 8, color: '#9ca3af' }}>{showHomeSwitcher ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showHomeSwitcher && (
              <div style={{
                position: 'absolute', left: 16, right: 16, top: '100%', background: '#fff',
                border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 50, maxHeight: 200, overflowY: 'auto',
              }}>
                {homes.map(h => (
                  <button
                    key={h.id}
                    onClick={() => { switchHome(h.id); setShowHomeSwitcher(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none',
                      background: h.id === home?.id ? (Colors.cream) : 'transparent',
                      cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6',
                      fontWeight: h.id === home?.id ? 600 : 400,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{h.address || 'Unnamed Home'}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{h.city}, {h.state} {h.zip_code}</div>
                  </button>
                ))}
                <button
                  onClick={() => { setShowHomeSwitcher(false); navigate('/onboarding?step=1'); }}
                  style={{
                    width: '100%', textAlign: 'center', padding: '10px 12px', border: 'none',
                    background: 'transparent', cursor: 'pointer', fontSize: 13,
                    color: Colors.copper, fontWeight: 600,
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
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
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
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <NavLink to="/profile" className="btn btn-ghost btn-sm" style={{ flex: 1, textDecoration: 'none', fontSize: 12 }}>Settings</NavLink>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 12, color: '#E53935' }} onClick={handleLogout}>Sign Out</button>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/terms" style={{ fontSize: 10, color: '#999', textDecoration: 'none' }}>Terms</a>
            <a href="/privacy" style={{ fontSize: 10, color: '#999', textDecoration: 'none' }}>Privacy</a>
            <a href="/cancellation" style={{ fontSize: 10, color: '#999', textDecoration: 'none' }}>Cancellation</a>
            <a href="/ai-disclaimer" style={{ fontSize: 10, color: '#999', textDecoration: 'none' }}>AI Disclaimer</a>
          </div>
        </div>
      </nav>
      <main className="main-content">
        {user && !user.email_confirmed && (
          <div style={{
            background: '#FFF3CD',
            borderBottom: '1px solid #FFE082',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: '#856404',
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
                    alert('Your email is already verified!');
                    return;
                  }
                  await resendVerificationEmail();
                  alert('Verification email sent! Check your inbox.');
                } catch (err: any) {
                  alert(err?.message || 'Failed to send. Please try again.');
                }
              }}
              style={{
                background: 'none',
                border: '1px solid #856404',
                borderRadius: 6,
                padding: '4px 12px',
                color: '#856404',
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
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
