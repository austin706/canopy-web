// ═══════════════════════════════════════════════════════════════
// Upgrade Gate Component
// ═══════════════════════════════════════════════════════════════
// Reusable soft-gate UI for gated content. Shows an inline banner
// with lock icon, message, and upgrade button when content is gated.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './UpgradeGate.css';

interface UpgradeGateProps {
  feature: string; // e.g., "equipment", "history", "home"
  currentTier: string;
  children: React.ReactNode;
  lockedMessage?: string;
  isLocked?: boolean; // If true, show gate instead of children
}

export default function UpgradeGate({
  feature,
  currentTier,
  children,
  lockedMessage,
  isLocked = false,
}: UpgradeGateProps) {
  const navigate = useNavigate();

  if (!isLocked) {
    return <>{children}</>;
  }

  const defaultMessages: Record<string, string> = {
    equipment:
      "You've reached the equipment limit for your plan. Upgrade to manage all your items.",
    history:
      'Extended history is available with a paid plan. View your maintenance timeline and records.',
    home: 'Unlock additional homes with Home 2-Pack or Pro 2-Pack.',
    chat: 'Upgrade to use AI chat for your questions.',
    scan: 'Upgrade to unlock unlimited photo scans.',
  };

  const message = lockedMessage || defaultMessages[feature] || 'Upgrade your plan to access this feature.';

  return (
    <div className="upgrade-gate-container">
      <div className="upgrade-gate-banner">
        <div className="upgrade-gate-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="upgrade-gate-content">
          <p className="upgrade-gate-message">{message}</p>
        </div>
        <button
          className="upgrade-gate-button"
          onClick={() => navigate('/subscription')}
        >
          Upgrade
        </button>
      </div>
    </div>
  );
}
