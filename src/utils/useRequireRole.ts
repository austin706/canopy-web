// useRequireRole — defense-in-depth role gate for agent/pro/admin pages.
//
// Router-level RoleRoute in App.tsx is the primary gate. This hook adds a
// second layer inside the page component: if the auth store's user.role is
// missing or doesn't match the allowed set, redirect immediately. Useful
// when:
//   - store is rehydrated with a stale/downgraded session
//   - a page is reached via direct import or a stray `navigate()` call that
//     bypassed the RoleRoute wrapper
//   - an admin impersonation flow clears the role field
//
// Added 2026-04-22 as the systemic win for audit P0-8/P0-9.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';

export type RoleRequirement = 'agent' | 'admin' | 'pro_provider' | 'user';

export function useRequireRole(allowed: RoleRequirement[], redirectTo: string = '/') {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    const role = user?.role as RoleRequirement | undefined;
    if (!role || !allowed.includes(role)) {
      navigate(redirectTo, { replace: true });
    }
    // Intentionally watch both role and auth state — if either flips, re-evaluate.
  }, [isAuthenticated, user?.role, allowed, redirectTo, navigate]);
}
