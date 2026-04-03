import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { Colors, DarkColors, type ThemeMode } from '@/constants/theme';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  colors: typeof Colors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  resolvedMode: 'light',
  colors: Colors,
  setMode: () => {},
});

const STORAGE_KEY = 'canopy_theme_mode';

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {}
    return 'light';
  });

  const [systemPref, setSystemPref] = useState<'light' | 'dark'>(getSystemPreference);

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setSystemPref(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try { localStorage.setItem(STORAGE_KEY, newMode); } catch {}
  };

  const resolvedMode: 'light' | 'dark' = mode === 'system' ? systemPref : mode;
  const colors = resolvedMode === 'dark' ? DarkColors : Colors;

  // Apply body class for global CSS
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedMode);
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.charcoal;
  }, [resolvedMode, colors]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook to access theme colors and mode */
export function useTheme() {
  return useContext(ThemeContext);
}
