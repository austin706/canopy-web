// ═══════════════════════════════════════════════════════════════
// Refer — share your referral code, see who's converted
// ═══════════════════════════════════════════════════════════════
//
// Refer-a-month, get-a-month: any user can share their unique code.
// When a referee signs up via the link AND starts a paid plan, the
// stripe-webhook applies a one-month customer balance credit to BOTH
// referrer and referee on their next invoice.

import { useEffect, useState } from 'react';
import { getOrCreateReferralCode, getReferralStats } from '@/services/referrals';
import { useStore } from '@/store/useStore';

export default function Refer() {
  const { user } = useStore();
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState<{ totalReferred: number; pendingReferred: number; rewardedReferred: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = code ? `https://canopyhome.app/signup?ref=${encodeURIComponent(code)}` : '';

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const c = await getOrCreateReferralCode();
        setCode(c?.code || null);
        const s = await getReferralStats();
        setStats({
          totalReferred: s.totalReferred,
          pendingReferred: s.pendingReferred,
          rewardedReferred: s.rewardedReferred,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load referral data');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no-op */ }
  }

  function shareNative() {
    if (navigator.share) {
      navigator.share({
        title: 'Try Canopy — your home, finally on autopilot',
        text: 'Use my code and your first month is on Canopy. Same goes for me. Win-win.',
        url: shareUrl,
      }).catch(() => {});
    } else {
      copyLink();
    }
  }

  if (!user) return <div style={{ padding: 40 }}>Please sign in to view your referral code.</div>;
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Refer a friend, get a month free</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
        Share your code. When a friend signs up and starts any paid Canopy plan, you both get a one-month credit applied to your next invoice. No limit on referrals.
      </p>

      {error && (
        <div style={{ padding: 16, background: '#fee', color: '#c00', borderRadius: 8, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {code && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Your code
          </div>
          <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 20 }}>
            {code}
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Share link
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid var(--light-gray)',
                borderRadius: 6,
                fontSize: 13,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            />
            <button className="btn btn-primary btn-sm" onClick={copyLink}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <button className="btn btn-secondary" onClick={shareNative} style={{ width: '100%' }}>
            Share via…
          </button>
        </div>
      )}

      {stats && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Your referrals</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)' }}>{stats.totalReferred}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Total signed up</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{stats.pendingReferred}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Pending paid plan</div>
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-sage)' }}>{stats.rewardedReferred}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Credits earned</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 32, padding: 20, background: 'var(--light-gray)', borderRadius: 8, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        <strong>How it works:</strong> credit posts automatically when your friend's first paid invoice is processed. Free-tier referrers get the credit applied to their first paid month if they later upgrade.
      </div>
    </div>
  );
}
