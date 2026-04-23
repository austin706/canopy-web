// ═══════════════════════════════════════════════════════════════
// useTabState — URL-synced tab state with back-button support
// ═══════════════════════════════════════════════════════════════
// P3 #77 (2026-04-23)
//
// Prior behavior: tab selections on Pro/Admin portals were local useState,
// so hitting back-button from a sub-screen always landed on the first tab
// regardless of where the user came from, and tab URLs weren't shareable.
//
// This hook URL-syncs via a query param (default `?tab=`) so:
//   • Browser back/forward navigates between tabs.
//   • Reloading keeps the user on the same tab.
//   • Deep links like /admin/builders?tab=approved work.
//
// Defaults to `initial` if the URL param is missing or not in `allowed`.
// Written as a drop-in replacement for `const [tab, setTab] = useState(...)`.

import { useCallback, useEffect, useState } from 'react';

export function useTabState<T extends string>(
  allowed: readonly T[],
  initial: T,
  paramKey: string = 'tab'
): [T, (next: T) => void] {
  const readFromUrl = useCallback((): T => {
    if (typeof window === 'undefined') return initial;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(paramKey);
    if (raw && (allowed as readonly string[]).includes(raw)) {
      return raw as T;
    }
    return initial;
  }, [allowed, initial, paramKey]);

  const [tab, setTabState] = useState<T>(() => readFromUrl());

  // Keep in sync with browser back/forward.
  useEffect(() => {
    const onPopState = () => {
      setTabState(readFromUrl());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [readFromUrl]);

  const setTab = useCallback((next: T) => {
    setTabState(next);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (next === initial) {
      url.searchParams.delete(paramKey);
    } else {
      url.searchParams.set(paramKey, next);
    }
    // pushState so back-button returns to previous tab rather than previous page.
    window.history.pushState(window.history.state, '', url.toString());
  }, [initial, paramKey]);

  return [tab, setTab];
}
