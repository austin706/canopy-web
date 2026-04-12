// ═══════════════════════════════════════════════════════════════
// HomeQRCode — Generates a scannable QR code for the home profile
// ═══════════════════════════════════════════════════════════════
// Shows a QR code that links to the public Home Token / maintenance
// record page. Can be printed, shared, or displayed at the home.

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import { trackEvent } from '@/utils/analytics';

interface HomeQRCodeProps {
  /** Override the URL encoded in the QR code */
  url?: string;
  /** Size in pixels (default 200) */
  size?: number;
  /** Show the copy/download controls (default true) */
  showControls?: boolean;
}

/**
 * Generates a QR code image via the goqr.me public API.
 * The QR links to the home's public Home Token page.
 */
export default function HomeQRCode({ url, size = 200, showControls = true }: HomeQRCodeProps) {
  const { home } = useStore();
  const [copied, setCopied] = useState(false);

  if (!home?.id) return null;

  // Build the shareable URL for this home's verified record
  // Links to the authenticated home report for now; a public token page will follow
  const shareUrl = url || `${window.location.origin}/home-report`;

  // QR code image via goqr.me (free, no API key, high reliability)
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(shareUrl)}&color=2C2C2C&bgcolor=FAF8F5&margin=8`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackEvent('home_qr_link_copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    trackEvent('home_qr_downloaded');
    const link = document.createElement('a');
    link.href = qrSrc;
    link.download = `canopy-home-qr-${home.id.slice(0, 8)}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    trackEvent('home_qr_printed');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head><title>Canopy Home QR Code</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;margin:0;background:#FAF8F5;">
          <img src="/canopy-watercolor-logo.png" alt="Canopy" style="height:40px;margin-bottom:16px;" />
          <h2 style="color:#2C2C2C;margin:0 0 8px;">Home Maintenance Record</h2>
          <p style="color:#888;font-size:13px;margin:0 0 24px;">Scan to view verified maintenance history</p>
          <img src="${qrSrc}" alt="QR Code" style="width:${size}px;height:${size}px;" />
          <p style="color:#888;font-size:11px;margin-top:16px;">Powered by Canopy Home</p>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

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
          📱
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Home QR Code</h3>
          <p style={{ fontSize: 13, color: Colors.medGray, margin: 0 }}>
            Share your verified maintenance record
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          background: Colors.warmWhite,
          borderRadius: 12,
          border: `1px solid ${Colors.lightGray}`,
        }}
      >
        <img
          src={qrSrc}
          alt="Home QR Code"
          width={size}
          height={size}
          style={{ borderRadius: 8 }}
          loading="lazy"
        />
        <p style={{ fontSize: 12, color: Colors.medGray, textAlign: 'center', margin: 0 }}>
          Scan to view your home's maintenance history
        </p>
      </div>

      {showControls && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            onClick={handleCopy}
            className="btn btn-sm"
            style={{
              background: Colors.cream,
              color: Colors.charcoal,
              border: `1px solid ${Colors.lightGray}`,
              flex: 1,
              minWidth: 80,
            }}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={handleDownload}
            className="btn btn-sm"
            style={{
              background: Colors.cream,
              color: Colors.charcoal,
              border: `1px solid ${Colors.lightGray}`,
              flex: 1,
              minWidth: 80,
            }}
          >
            Download
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-sm"
            style={{
              background: Colors.cream,
              color: Colors.charcoal,
              border: `1px solid ${Colors.lightGray}`,
              flex: 1,
              minWidth: 80,
            }}
          >
            Print
          </button>
        </div>
      )}
    </div>
  );
}
