// ═══════════════════════════════════════════════════════════════
// DEPRECATED 2026-04-27 — left as stub; route is redirected in App.tsx.
// ═══════════════════════════════════════════════════════════════
// The Free-vs-Home upsell that used to live here ran BEFORE any home
// context existed (no address, no systems), so the comparison was
// abstract. The single conversion moment now lives at /onboarding's
// plan step, where the user has already shared address + systems.
//
// The signup flow now routes to /verify-email instead. The /signup-success
// path is mapped to a <Navigate> redirect in App.tsx so deep links
// don't 404. This component only exists so any stale build / lazy import
// resolves cleanly. Safe to delete once we're confident no caches
// reference it.
// ═══════════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DeprecatedSignupSuccessRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/verify-email', { replace: true });
  }, [navigate]);
  return null;
}
