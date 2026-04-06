import React, { useMemo } from 'react';
import { Colors } from '@/constants/theme';

interface ProgressBarProps {
  progress: number; // 0-100 for determinate, ignored for indeterminate
  visible: boolean;
  indeterminate?: boolean; // If true, shows animated shimmer instead of progress
}

/**
 * Thin progress bar at the top of the page (like YouTube/GitHub style)
 * - Determinate mode: shows 0-100% progress
 * - Indeterminate mode: animated shimmer effect
 * - Smoothly animates between progress values using CSS transitions
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  visible,
  indeterminate = false,
}) => {
  const style = useMemo<React.CSSProperties>(() => {
    const baseStyle: React.CSSProperties = {
      position: 'fixed',
      top: 0,
      left: 0,
      height: '3px',
      backgroundColor: Colors.copper,
      zIndex: 9999,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease-in-out, width 0.3s ease-in-out',
      width: indeterminate ? '30%' : `${Math.min(Math.max(progress, 0), 100)}%`,
    };

    return baseStyle;
  }, [progress, visible, indeterminate]);

  return (
    <>
      <div style={style} />
      {visible && indeterminate && <style>{`
        @keyframes progressShimmer {
          0% { transform: translateX(0); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        div[data-progress-bar-shimmer] {
          animation: progressShimmer 2s infinite ease-in-out;
        }
      `}</style>}
    </>
  );
};

/**
 * Context hook for controlling the progress bar from anywhere in the app
 * Usage:
 *   const { setProgress, show, hide } = useProgress();
 *   show();
 *   setProgress(50);
 *   hide();
 */
interface ProgressContextType {
  progress: number;
  visible: boolean;
  indeterminate: boolean;
  setProgress: (value: number) => void;
  show: (indeterminate?: boolean) => void;
  hide: () => void;
}

import { createContext, useContext, useState, useCallback } from 'react';

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [indeterminate, setIndeterminate] = useState(false);

  const show = useCallback((indetermMode?: boolean) => {
    setVisible(true);
    setIndeterminate(indetermMode ?? false);
    setProgress(0);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const updateProgress = useCallback((value: number) => {
    setProgress(Math.min(Math.max(value, 0), 100));
  }, []);

  return (
    <ProgressContext.Provider
      value={{
        progress,
        visible,
        indeterminate,
        setProgress: updateProgress,
        show,
        hide,
      }}
    >
      <ProgressBar progress={progress} visible={visible} indeterminate={indeterminate} />
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = (): ProgressContextType => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within ProgressProvider');
  }
  return context;
};
