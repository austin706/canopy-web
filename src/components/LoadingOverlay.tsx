import React from 'react';
import { Colors } from '@/constants/theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

/**
 * Semi-transparent overlay with centered spinner + optional message
 * For blocking operations like payment processing, file uploads, scanning
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = 'Processing...',
}) => {
  if (!visible) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.spinner} />
        {message && <p style={styles.message}>{message}</p>}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9998,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: `4px solid ${Colors.silver}`,
    borderTop: `4px solid ${Colors.copper}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '1rem',
  },
  message: {
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: '500',
    margin: 0,
    textAlign: 'center',
  },
};

// Inject the spin animation globally if not already present
if (typeof window !== 'undefined') {
  const styleId = 'canopy-loading-overlay-animation';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleElement);
  }
}
