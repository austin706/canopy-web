// ═══════════════════════════════════════════════════════════════
// GetTheApp — landing page for canopyhome.app/get-the-app (DL-7 v1)
// ═══════════════════════════════════════════════════════════════
//
// Purpose: a single permanent destination that QR codes (in marketing,
// in-product, on physical materials) can encode. This page detects the
// device's user agent and presents the right next step:
//   • iOS / iPadOS → primary CTA links to App Store (when live)
//   • Android      → primary CTA links to Google Play (when live)
//   • Desktop      → shows both badges + a QR for the user's phone
//
// Apps are not live yet (2026-05-07). All Store links are placeholders
// tagged TODO_APP_LIVE so Austin can find-and-replace once iOS + Android
// approvals land. Until then, every CTA falls through to a "Coming soon,
// want to be notified?" mailto so we don't ship dead buttons.
//
// Why a server-side smart redirect would be better: it could 302 directly
// to the right Store deep link without rendering a page at all, which is
// the cleanest UX. Worth doing once the apps are live and we have a real
// edge function or Vercel rewrite to host it. Until then, this client-side
// page is fine.

import { useEffect, useState } from 'react';
import { Colors, FontSize, FontWeight, BorderRadius } from '@/constants/theme';

const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// ── Store URL placeholders ─────────────────────────────────────────
// TODO_APP_LIVE: replace these with the real App Store / Google Play
// URLs once the apps are approved. Format:
//   iOS:     https://apps.apple.com/us/app/canopy-home/id<APP_STORE_ID>
//   Android: https://play.google.com/store/apps/details?id=app.canopyhome
//
// Both stores allow you to set up pre-launch listings; if you want to
// flip these on early so the page works the moment approval lands,
// the literal IDs are what you swap.
const APP_STORE_URL = '#TODO_APP_LIVE_iOS';
const PLAY_STORE_URL = '#TODO_APP_LIVE_Android';
const APPS_LIVE = false; // flip to `true` when at least one store is live

type Device = 'ios' | 'android' | 'desktop';

function detectDevice(): Device {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export default function GetTheApp() {
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    setDevice(detectDevice());
    document.title = 'Get the Canopy app | Canopy Home';
  }, []);

  // Once the apps are live and the user is on a phone, redirect them
  // straight to the Store. Until then, we just render the cards.
  useEffect(() => {
    if (!APPS_LIVE) return;
    if (device === 'ios' && APP_STORE_URL.startsWith('http')) {
      window.location.replace(APP_STORE_URL);
    } else if (device === 'android' && PLAY_STORE_URL.startsWith('http')) {
      window.location.replace(PLAY_STORE_URL);
    }
  }, [device]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${Colors.warmWhite} 0%, ${Colors.cream} 100%)`,
        fontFamily: fontStack,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: Colors.white,
          border: `1px solid ${Colors.lightGray}`,
          borderRadius: BorderRadius.lg,
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 12px 40px -12px rgba(38, 32, 28, 0.12)',
        }}
      >
        <p
          style={{
            fontSize: FontSize.xs,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: Colors.copper,
            margin: '0 0 12px 0',
          }}
        >
          Canopy Home
        </p>
        <h1
          style={{
            fontSize: FontSize.xxl,
            fontWeight: FontWeight.bold,
            color: Colors.charcoal,
            margin: '0 0 16px 0',
            lineHeight: 1.2,
          }}
        >
          {APPS_LIVE ? 'Get the Canopy app.' : 'The Canopy app is on its way.'}
        </h1>
        <p
          style={{
            fontSize: FontSize.md,
            color: Colors.medGray,
            lineHeight: 1.55,
            margin: '0 0 28px 0',
          }}
        >
          {APPS_LIVE
            ? 'Push notifications fire at the moment a task matters, so you stop scrolling email for what is due. Snap a photo of any appliance and Canopy reads the label.'
            : 'iOS and Android are in the App Store review queue. The web app at canopyhome.app already does everything you need today. Drop your email and we\'ll tell you the moment the mobile apps go live.'}
        </p>

        {/* Store badges. Until APPS_LIVE flips, these render as styled
            "Coming soon" cards rather than real linked badges. Apple and
            Google have strict brand guidelines about official badges, so
            we keep them out until we have working store URLs to point
            them at. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StoreCard
            kind="ios"
            href={APP_STORE_URL}
            live={APPS_LIVE && APP_STORE_URL.startsWith('http')}
            highlight={device === 'ios'}
          />
          <StoreCard
            kind="android"
            href={PLAY_STORE_URL}
            live={APPS_LIVE && PLAY_STORE_URL.startsWith('http')}
            highlight={device === 'android'}
          />
        </div>

        <p
          style={{
            fontSize: FontSize.sm,
            color: Colors.medGray,
            margin: '0 0 8px 0',
          }}
        >
          Already using Canopy on the web?{' '}
          <a
            href="https://canopyhome.app"
            style={{ color: Colors.copper, fontWeight: FontWeight.semibold, textDecoration: 'none' }}
          >
            canopyhome.app
          </a>
        </p>
      </div>
    </div>
  );
}

// ── StoreCard ──────────────────────────────────────────────────────
// Card-style replacement for the official Apple / Google badges. We
// avoid the real badge images until we have working Store URLs because
// Apple and Google both prohibit using their badges with non-functional
// links, and a broken App Store badge looks worse than a "coming soon"
// card. Once APPS_LIVE flips, we can swap in the real badges.
function StoreCard({
  kind,
  href,
  live,
  highlight,
}: {
  kind: 'ios' | 'android';
  href: string;
  live: boolean;
  highlight: boolean;
}) {
  const label = kind === 'ios' ? 'App Store' : 'Google Play';
  const sub = kind === 'ios' ? 'Download for iPhone & iPad' : 'Download for Android';
  const icon = kind === 'ios' ? '' : '▶';

  const content = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        background: highlight ? Colors.copperMuted : Colors.cream,
        border: `1.5px solid ${highlight ? Colors.copper : Colors.lightGray}`,
        borderRadius: BorderRadius.md,
        textAlign: 'left',
        cursor: live ? 'pointer' : 'default',
        opacity: live ? 1 : 0.85,
        transition: 'all 0.2s',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: FontSize.xl,
          color: Colors.charcoal,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: FontSize.xs, color: Colors.medGray, fontWeight: FontWeight.semibold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {live ? 'Download on the' : 'Coming to the'}
        </div>
        <div style={{ fontSize: FontSize.md, color: Colors.charcoal, fontWeight: FontWeight.semibold }}>
          {label}
        </div>
        {!live && (
          <div style={{ fontSize: FontSize.xs, color: Colors.medGray, marginTop: 2 }}>
            In review · launching soon
          </div>
        )}
        {live && (
          <div style={{ fontSize: FontSize.xs, color: Colors.medGray, marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );

  if (live) {
    return (
      <a href={href} style={{ textDecoration: 'none' }} aria-label={`Download Canopy on ${label}`}>
        {content}
      </a>
    );
  }
  return <div role="presentation" aria-label={`${label} listing coming soon`}>{content}</div>;
}
