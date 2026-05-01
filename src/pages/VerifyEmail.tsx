// ═══════════════════════════════════════════════════════════════
// VerifyEmail — post-signup verification gate (web parity)
// ═══════════════════════════════════════════════════════════════
// Replaces SignupSuccess (the abstract Free-vs-Home upsell that ran
// before any home context existed). After signup we now show a
// "Check your inbox" gate, poll Supabase for confirmation, and route
// straight into /onboarding the moment the user confirms.
// The single conversion moment lives at /onboarding's plan step,
// where the user has already shared their address + systems.
//
// 2026-04-27 — Wave 1 P0-7 + Wave 3.
// Mobile mirror: Canopy-App/app/auth/verify-email.tsx
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { trackEvent } from '@/utils/analytics';

const POLL_INTERVAL_MS = 4000;
const RESEND_COOLDOWN_S = 30;

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mount-fire view event so we can measure verification drop-off and
  // resend friction in GA4. Separate from the polling effect to avoid
  // re-firing on every interval tick.
  useEffect(() => {
    try { trackEvent('email_verification_view'); } catch {}
  }, []);

  // Load current user's email and start polling for verification.
  useEffect(() => {
    let cancelled = false;
    const checkVerification = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        if (data.user?.email) setEmail(data.user.email);
        const confirmedAt = data.user?.email_confirmed_at;
        if (confirmedAt) {
          try { trackEvent('email_verified'); } catch {}
          if (pollRef.current) clearInterval(pollRef.current);
          navigate('/onboarding', { replace: true });
        }
      } catch {
        // network blip — let the next interval retry
      }
    };
    checkVerification();
    pollRef.current = setInterval(checkVerification, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resendStatus === 'sending' || !email) return;
    setResendStatus('sending');
    setResendError('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setResendStatus('sent');
      setResendCooldown(RESEND_COOLDOWN_S);
      try { trackEvent('email_verification_resent'); } catch {}
    } catch (err: any) {
      setResendStatus('error');
      setResendError(err?.message || 'Failed to resend. Try again in a moment.');
    }
  };

  const handleUseDifferentEmail = async () => {
    try { await supabase.auth.signOut(); } catch {}
    navigate('/signup');
  };

  const card: React.CSSProperties = {
    maxWidth: 480,
    width: '100%',
    background: Colors.white,
    borderRadius: 12,
    border: `1px solid ${Colors.lightGray}`,
    padding: '40px 32px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  };

  const helpRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 14,
    color: Colors.charcoal,
    lineHeight: 1.45,
    margin: '6px 0',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: Colors.warmWhite,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '60px 16px',
    }}>
      <div style={card}>
        {/* Mailbox icon circle */}
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: `${Colors.sage}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 36,
        }}>
          ✉️
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, color: Colors.charcoal, textAlign: 'center', margin: '0 0 8px' }}>
          Check your inbox
        </h1>
        <p style={{ fontSize: 15, color: Colors.medGray, textAlign: 'center', lineHeight: 1.5, margin: '0 0 32px' }}>
          We sent a verification link to{' '}
          <strong style={{ color: Colors.charcoal }}>{email || 'your email'}</strong>
          . Click it to continue setting up your home.
        </p>

        {/* What to expect */}
        <div style={{
          background: Colors.cream,
          border: `1px solid ${Colors.lightGray}`,
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 24,
        }}>
          <div style={helpRow}>
            <span style={{ color: Colors.sage, fontSize: 16 }}>●</span>
            <span>We'll detect the verification automatically — no need to copy a code.</span>
          </div>
          <div style={helpRow}>
            <span style={{ color: Colors.sage, fontSize: 16 }}>●</span>
            <span>The email usually arrives within 30 seconds. Check your spam folder if not.</span>
          </div>
          <div style={helpRow}>
            <span style={{ color: Colors.sage, fontSize: 16 }}>●</span>
            <span>Verification keeps your account and home data secure.</span>
          </div>
        </div>

        <button
          onClick={handleResend}
          disabled={resendCooldown > 0 || resendStatus === 'sending'}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: `1.5px solid ${Colors.copper}`,
            background: 'transparent',
            color: Colors.copper,
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: (resendCooldown > 0 || resendStatus === 'sending') ? 'not-allowed' : 'pointer',
            opacity: (resendCooldown > 0 || resendStatus === 'sending') ? 0.5 : 1,
          }}
        >
          {resendStatus === 'sending'
            ? 'Sending…'
            : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : 'Resend verification email'}
        </button>

        {resendStatus === 'sent' && (
          <p style={{ color: Colors.success, fontSize: 14, textAlign: 'center', margin: '12px 0 0' }}>
            ✓ Sent. Check your inbox.
          </p>
        )}
        {resendStatus === 'error' && resendError && (
          <p style={{ color: Colors.error, fontSize: 14, textAlign: 'center', margin: '12px 0 0' }}>
            {resendError}
          </p>
        )}

        <button
          onClick={handleUseDifferentEmail}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: Colors.medGray,
            fontSize: 14,
            padding: '16px 0 0',
            cursor: 'pointer',
          }}
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}
