// ===============================================================
// Canopy Web — Toast/Snackbar Component
// ===============================================================
// Provides a fixed-position notification with optional action button.
// Auto-dismisses after configurable timeout (default 5s).
// Slides up animation with Canopy theming.

import { useEffect, useState } from 'react';
import { Colors } from '@/constants/theme';

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

type ToastConfig = {
  message: string;
  action?: ToastAction;
  timeout?: number;
  onDismiss?: () => void;
};

// Global toast state management
let toastStack: ToastConfig[] = [];
let listeners: ((config: ToastConfig | null) => void)[] = [];

export function showToast(config: Omit<ToastConfig, 'onDismiss'>) {
  const toastConfig: ToastConfig = {
    ...config,
    timeout: config.timeout ?? 5000,
    onDismiss: () => {
      toastStack = toastStack.filter(t => t !== toastConfig);
      notifyListeners();
    },
  };

  toastStack.push(toastConfig);
  notifyListeners();
}

function notifyListeners() {
  const currentToast = toastStack[toastStack.length - 1] || null;
  listeners.forEach(listener => listener(currentToast));
}

function subscribeToToast(listener: (config: ToastConfig | null) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

// ===============================================================
// Toast Component
// ===============================================================

export default function Toast() {
  const [currentToast, setCurrentToast] = useState<ToastConfig | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToToast((config) => {
      if (config) {
        setCurrentToast(config);
        setIsVisible(true);
        setIsExiting(false);
      } else {
        setIsExiting(true);
        setTimeout(() => {
          setIsVisible(false);
        }, 300);
      }
    });

    return unsubscribe;
  }, []);

  // Auto-dismiss after timeout
  useEffect(() => {
    if (!currentToast || !isVisible) return;

    const timeout = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
        currentToast.onDismiss?.();
      }, 300);
    }, currentToast.timeout ?? 5000);

    return () => clearTimeout(timeout);
  }, [currentToast, isVisible]);

  const handleActionClick = async () => {
    if (currentToast?.action) {
      await currentToast.action.onClick();
      // Dismiss toast after action
      setIsExiting(true);
      setTimeout(() => {
        setIsVisible(false);
        currentToast.onDismiss?.();
      }, 300);
    }
  };

  if (!isVisible || !currentToast) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: `translateX(-50%) translateY(${isExiting ? 120 : 0}px)`,
        zIndex: 9999,
        opacity: isExiting ? 0 : 1,
        transition: 'all 0.3s ease-out',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: Colors.charcoal,
          color: Colors.white,
          padding: '12px 16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '90vw',
          minWidth: '280px',
          boxShadow: '0 4px 12px rgba(44, 44, 44, 0.3)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: '14px',
          fontWeight: '500',
        }}
      >
        <span style={{ flex: 1 }}>{currentToast.message}</span>
        {currentToast.action && (
          <button
            onClick={handleActionClick}
            style={{
              background: 'none',
              border: 'none',
              color: Colors.copper,
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              padding: '4px 8px',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.2s ease',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.opacity = '1';
            }}
          >
            {currentToast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ===============================================================
// Hook for easy usage in components
// ===============================================================

export function useToast() {
  return {
    show: (message: string, action?: ToastAction, timeout?: number) => {
      showToast({ message, action, timeout });
    },
  };
}
