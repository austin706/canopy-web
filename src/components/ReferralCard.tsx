// ═══════════════════════════════════════════════════════════════
// ReferralCard — Share your referral link, see your stats
// ═══════════════════════════════════════════════════════════════
// Shown on the Profile page. Gets/creates the user's referral code
// and displays a shareable link with copy button + referral stats.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getReferralStats } from '@/services/referrals';
import { Colors } from '@/constants/theme';
import { trackEvent } from '@/utils/analytics';

interface Stats {
  code: string | null;
  totalReferred: number;
  pendingReferred: number;
  qualifiedReferred: number;
  rewardedReferred: number;
}

export default function ReferralCard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getReferralStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!stats?.code) return;
    const url = `${window.location.origin}/signup?ref=${stats.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent('referral_link_copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return null;
  if (!stats?.code) return null;

  const referralUrl = `${window.location.origin}/signup?ref=${stats.code}`;

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `${Colors.sage}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          🎁
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Refer a Friend</h3>
          <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>
            When they subscribe, you both get 1 month free
          </p>
        </div>
      </div>

      {/* Referral link with copy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: Colors.cream,
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 12,
        }}
      >
        <input
          readOnly
          value={referralUrl}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: 13,
            color: Colors.charcoal,
            outline: 'none',
            fontFamily: 'monospace',
          }}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          onClick={handleCopy}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0, minWidth: 70 }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Stats */}
      {stats.totalReferred > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 13,
            color: Colors.medGray,
          }}
        >
          <span>
            <strong style={{ color: Colors.charcoal }}>{stats.totalReferred}</strong> referred
          </span>
          {stats.qualifiedReferred > 0 && (
            <span>
              <strong style={{ color: Colors.sage }}>{stats.qualifiedReferred}</strong> subscribed
            </span>
          )}
          {stats.rewardedReferred > 0 && (
            <span>
              <strong style={{ color: Colors.copper }}>{stats.rewardedReferred}</strong> months earned
            </span>
          )}
        </div>
      )}

      {/* Share options */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => {
            trackEvent('referral_share_click', { method: 'native' });
            if (navigator.share) {
              navigator.share({
                title: 'Try Canopy Home',
                text: "I've been using Canopy to manage my home maintenance — it's great. Use my link to sign up and we both get a free month!",
                url: referralUrl,
              });
            }
          }}
          className="btn btn-sm"
          style={{
            background: Colors.cream,
            color: Colors.charcoal,
            border: `1px solid ${Colors.lightGray}`,
          }}
        >
          Share
        </button>
        <Link
          to="/refer"
          className="btn btn-sm"
          style={{
            background: 'transparent',
            color: Colors.copper,
            border: `1px solid ${Colors.copper}`,
            textDecoration: 'none',
          }}
        >
          View details
        </Link>
      </div>
    </div>
  );
}
