// ═══════════════════════════════════════════════════════════════
// ZipPreCheck — Hero ZIP coverage pre-check (Landing page)
// ═══════════════════════════════════════════════════════════════
// DL-2: Above-the-fold ZIP input that tells visitors whether pro
// visits are covered in their area. Three result states:
//   ✅ covered       — full Canopy with pro visits available
//   ⏳ coming soon   — waitlist CTA
//   🆓 free only     — free tier works anywhere, no pro visits yet
//
// Schema reference: service_areas(zip_code TEXT, is_active BOOLEAN)
// — 5-digit exact match. Shared with serviceArea.ts edge-function
// helper so the client and the edge agree on coverage.
//
// Persists the last-checked ZIP to localStorage under
// 'canopy.precheck.zip' so the onboarding flow can pre-fill the
// address step and skip re-asking. Fires `landing_zip_check` and
// (on waitlist submit) `landing_zip_waitlist_submit` GA4 events.

import { useState } from 'react';
import { supabase } from '@/services/supabase';
import { trackEvent } from '@/utils/analytics';
import { Colors, FontWeight, BorderRadius } from '@/constants/theme';
import logger from '@/utils/logger';

const LS_ZIP_KEY = 'canopy.precheck.zip';
const ZIP_RE = /^\d{5}$/;

type CheckResult = 'covered' | 'coming_soon' | 'free_only';

interface ZipPreCheckProps {
  isMobile: boolean;
  fontStack: string;
  onCtaSignup: (source: string) => void;
}

export default function ZipPreCheck({ isMobile, fontStack, onCtaSignup }: ZipPreCheckProps) {
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const clean = zip.trim().substring(0, 5);
    if (!ZIP_RE.test(clean)) {
      setError('Enter a 5-digit ZIP code');
      return;
    }

    setLoading(true);
    try {
      // Exact 5-digit coverage check
      const { data: covered, error: coveredErr } = await supabase
        .from('service_areas')
        .select('zip_code')
        .eq('zip_code', clean)
        .eq('is_active', true)
        .maybeSingle();

      if (coveredErr) throw coveredErr;

      // Persist for onboarding so the address step can pre-fill
      try {
        localStorage.setItem(LS_ZIP_KEY, clean);
      } catch {
        // private-mode / disabled storage — non-fatal
      }

      if (covered) {
        setResult('covered');
        trackEvent('landing_zip_check', { zip: clean, result: 'covered' });
        return;
      }

      // Coarse "coming soon" heuristic: any other OK/TX/AR/FL ZIP is a
      // metro we've committed to in 2026 per the landing copy. Anything
      // else routes to 'free_only' (software works anywhere).
      const first = clean.substring(0, 1);
      const comingSoon = first === '7' || first === '3'; // 70xxx–79xxx, 30xxx–39xxx
      const outcome: CheckResult = comingSoon ? 'coming_soon' : 'free_only';
      setResult(outcome);
      trackEvent('landing_zip_check', { zip: clean, result: outcome });
    } catch (err) {
      logger.error('ZipPreCheck coverage lookup failed:', err);
      setError('Could not check coverage right now. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = zip.trim().substring(0, 5);
    const email = waitlistEmail.trim();

    if (!email) {
      setError('Add an email so we can notify you when we launch.');
      return;
    }

    try {
      // Reuse the pro_interest table as the waitlist sink. Failures are
      // non-blocking — we still thank the user and record the event.
      await supabase.from('pro_interest').insert({
        zip_code: clean,
        email,
      });
    } catch (err) {
      logger.warn('Waitlist insert failed (soft-fail):', err);
    }

    trackEvent('landing_zip_waitlist_submit', {
      zip: clean,
      email_provided: true,
    });
    setWaitlistSubmitted(true);
  };

  const handleReset = () => {
    setResult(null);
    setWaitlistSubmitted(false);
    setWaitlistEmail('');
    setError(null);
  };

  // ───── Render: covered ───────────────────────────────────────────────
  if (result === 'covered') {
    return (
      <CheckCard>
        <div style={{ ...resultRowStyle, color: Colors.sageDark }}>
          <span style={{ fontSize: 22, marginRight: 10 }}>✅</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>
              You&apos;re covered in {zip}.
            </div>
            <div style={{ fontSize: 13, color: Colors.medGray, marginTop: 2 }}>
              Full Canopy (software + pro visits) is live in your area.
            </div>
          </div>
        </div>
        <div style={btnRow(isMobile)}>
          <button
            onClick={() => onCtaSignup('zip_precheck_covered')}
            style={primaryBtn(fontStack)}
            aria-label="Get started, coverage confirmed"
          >
            Get Started Free
          </button>
          <button onClick={handleReset} style={secondaryBtn(fontStack)} aria-label="Check a different ZIP">
            Check another ZIP
          </button>
        </div>
      </CheckCard>
    );
  }

  // ───── Render: coming soon (waitlist) ───────────────────────────────
  if (result === 'coming_soon') {
    if (waitlistSubmitted) {
      return (
        <CheckCard>
          <div style={{ ...resultRowStyle, color: Colors.sageDark }}>
            <span style={{ fontSize: 22, marginRight: 10 }}>🎉</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>
                You&apos;re on the list.
              </div>
              <div style={{ fontSize: 13, color: Colors.medGray, marginTop: 2 }}>
                We&apos;ll email you the moment pro visits open in {zip}.
                Meanwhile, start with the free plan. It works anywhere.
              </div>
            </div>
          </div>
          <div style={btnRow(isMobile)}>
            <button
              onClick={() => onCtaSignup('zip_precheck_waitlist')}
              style={primaryBtn(fontStack)}
              aria-label="Start with the free plan"
            >
              Start Free Plan
            </button>
            <button onClick={handleReset} style={secondaryBtn(fontStack)} aria-label="Check a different ZIP">
              Check another ZIP
            </button>
          </div>
        </CheckCard>
      );
    }
    return (
      <CheckCard>
        <div style={{ ...resultRowStyle, color: Colors.charcoal }}>
          <span style={{ fontSize: 22, marginRight: 10 }}>⏳</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>
              Pro visits aren&apos;t in {zip} yet, but we&apos;re coming.
            </div>
            <div style={{ fontSize: 13, color: Colors.medGray, marginTop: 2 }}>
              Add your email and we&apos;ll tell you the moment we launch. Or jump into the free plan now.
            </div>
          </div>
        </div>
        <form onSubmit={handleWaitlist} style={waitlistForm(isMobile)}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={waitlistEmail}
            onChange={(e) => {
              setWaitlistEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="you@example.com"
            style={zipInput(fontStack)}
            aria-label="Email for launch notification"
            aria-invalid={!!error}
            aria-describedby={error ? 'zip-precheck-waitlist-error' : undefined}
          />
          <button type="submit" style={primaryBtn(fontStack)}>
            Notify me
          </button>
        </form>
        {error && (
          <div
            id="zip-precheck-waitlist-error"
            role="alert"
            style={{ fontSize: 12, color: Colors.error, marginTop: -4, marginBottom: 6 }}
          >
            {error}
          </div>
        )}
        <button
          onClick={() => onCtaSignup('zip_precheck_coming_soon_start_free')}
          style={linkBtn(fontStack)}
          aria-label="Skip waitlist and start with the free plan"
        >
          Skip, start with the free plan
        </button>
      </CheckCard>
    );
  }

  // ───── Render: free only ─────────────────────────────────────────────
  if (result === 'free_only') {
    return (
      <CheckCard>
        <div style={{ ...resultRowStyle, color: Colors.charcoal }}>
          <span style={{ fontSize: 22, marginRight: 10 }}>🆓</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>
              The free plan works in {zip} today.
            </div>
            <div style={{ fontSize: 13, color: Colors.medGray, marginTop: 2 }}>
              AI maintenance planning, equipment tracking, and the document vault work anywhere in the US.
              Pro visits roll out to your metro next, and we&apos;ll notify you.
            </div>
          </div>
        </div>
        <div style={btnRow(isMobile)}>
          <button
            onClick={() => onCtaSignup('zip_precheck_free_only')}
            style={primaryBtn(fontStack)}
            aria-label="Start with the free plan"
          >
            Start Free Plan
          </button>
          <button onClick={handleReset} style={secondaryBtn(fontStack)} aria-label="Check a different ZIP">
            Check another ZIP
          </button>
        </div>
      </CheckCard>
    );
  }

  // ───── Render: initial input ─────────────────────────────────────────
  return (
    <form
      onSubmit={handleCheck}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: Colors.white,
        border: `1px solid ${Colors.sageLight}`,
        borderRadius: BorderRadius.full,
        padding: '6px 6px 6px 18px',
        marginBottom: 24,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        maxWidth: '100%',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}
      aria-label="Check Canopy coverage by ZIP code"
    >
      <label htmlFor="zip-precheck" style={{ fontSize: 13, fontWeight: FontWeight.semibold, color: Colors.sageDark }}>
        Now serving Tulsa &amp; surrounding ZIPs:
      </label>
      <input
        id="zip-precheck"
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        pattern="\d{5}"
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
        placeholder="ZIP"
        style={{
          width: 72,
          padding: '6px 10px',
          fontSize: 14,
          fontWeight: FontWeight.medium,
          color: Colors.charcoal,
          border: `1px solid ${Colors.lightGray}`,
          borderRadius: BorderRadius.full,
          outline: 'none',
          fontFamily: fontStack,
          background: Colors.white,
        }}
        aria-label="Enter your 5-digit ZIP code"
        aria-invalid={!!error}
        aria-describedby={error ? 'zip-precheck-error' : undefined}
      />
      <button
        type="submit"
        disabled={loading || !zip}
        style={{
          padding: '8px 18px',
          fontSize: 13,
          fontWeight: FontWeight.semibold,
          background: loading ? Colors.medGray : Colors.sage,
          color: Colors.white,
          border: 'none',
          borderRadius: BorderRadius.full,
          cursor: loading || !zip ? 'not-allowed' : 'pointer',
          fontFamily: fontStack,
          opacity: loading || !zip ? 0.7 : 1,
          transition: 'background 0.2s ease',
        }}
      >
        {loading ? 'Checking…' : 'Check my ZIP'}
      </button>
      {error && (
        <span
          id="zip-precheck-error"
          role="alert"
          style={{ fontSize: 12, color: Colors.error, width: '100%', textAlign: 'left', paddingLeft: 12 }}
        >
          {error}
        </span>
      )}
    </form>
  );
}

// ─── Shared inline-style helpers ───────────────────────────────────────

function CheckCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: Colors.white,
        border: `1px solid ${Colors.sageLight}`,
        borderRadius: BorderRadius.lg,
        padding: '18px 20px',
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        maxWidth: 520,
        marginLeft: 'auto',
        marginRight: 'auto',
        textAlign: 'left',
      }}
    >
      {children}
    </div>
  );
}

const resultRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  marginBottom: 12,
};

const btnRow = (isMobile: boolean): React.CSSProperties => ({
  display: 'flex',
  gap: 10,
  flexDirection: isMobile ? 'column' : 'row',
  marginTop: 4,
});

const waitlistForm = (isMobile: boolean): React.CSSProperties => ({
  display: 'flex',
  gap: 8,
  marginTop: 4,
  marginBottom: 8,
  flexDirection: isMobile ? 'column' : 'row',
});

const zipInput = (fontStack: string): React.CSSProperties => ({
  flex: 1,
  padding: '10px 14px',
  fontSize: 14,
  border: `1px solid ${Colors.lightGray}`,
  borderRadius: BorderRadius.md,
  outline: 'none',
  fontFamily: fontStack,
  minWidth: 0,
});

const primaryBtn = (fontStack: string): React.CSSProperties => ({
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: FontWeight.semibold,
  background: Colors.copper,
  color: Colors.white,
  border: 'none',
  borderRadius: BorderRadius.md,
  cursor: 'pointer',
  fontFamily: fontStack,
  whiteSpace: 'nowrap',
});

const secondaryBtn = (fontStack: string): React.CSSProperties => ({
  padding: '10px 20px',
  fontSize: 14,
  fontWeight: FontWeight.medium,
  background: 'transparent',
  color: Colors.charcoal,
  border: `1px solid ${Colors.lightGray}`,
  borderRadius: BorderRadius.md,
  cursor: 'pointer',
  fontFamily: fontStack,
});

const linkBtn = (fontStack: string): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  color: Colors.copper,
  fontSize: 13,
  fontWeight: FontWeight.medium,
  cursor: 'pointer',
  padding: '4px 0 0 0',
  fontFamily: fontStack,
  textDecoration: 'underline',
});
