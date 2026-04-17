import React from 'react';
import { Colors } from '@/constants/theme';

/**
 * TrustBar: Landing page trust section showing localized credentials
 * and social proof for Tulsa market.
 */
export default function TrustBar() {
  // ASSET-PLACEHOLDER: TRUST-1 — Customer count badge ("500+ Tulsa homeowners trust Canopy")
  const CUSTOMER_COUNT = '500+';

  return (
    <section style={{
      background: Colors.cream,
      borderRadius: 12,
      padding: '32px 24px',
      marginTop: 48,
      textAlign: 'center',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Built in Tulsa badge */}
        <div style={{
          display: 'inline-block',
          background: Colors.sage + '20',
          color: Colors.sage,
          fontSize: 12,
          fontWeight: 600,
          padding: '6px 14px',
          borderRadius: 20,
          marginBottom: 16,
        }}>
          Built in Tulsa 🏘️
        </div>

        {/* Main headline */}
        <h3 style={{
          fontSize: 20,
          fontWeight: 700,
          color: Colors.charcoal,
          margin: '0 0 8px 0',
        }}>
          {CUSTOMER_COUNT} Tulsa homeowners trust Canopy
        </h3>

        <p style={{
          fontSize: 14,
          color: Colors.medGray,
          margin: '0 0 24px 0',
          lineHeight: 1.5,
        }}>
          Join your neighbors protecting their homes with verified maintenance records, AI-powered insights, and the Home Token.
        </p>

        {/* Trust badges row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 24,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* BBB Accredited */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 60,
              height: 60,
              background: Colors.lightGray,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}>
              {/* ASSET-PLACEHOLDER: TRUST-2 — BBB Accredited badge SVG */}
              🏢
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal }}>
              BBB Accredited
            </span>
          </div>

          {/* Tulsa Chamber */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 60,
              height: 60,
              background: Colors.lightGray,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}>
              {/* ASSET-PLACEHOLDER: TRUST-3 — Tulsa Chamber of Commerce badge SVG */}
              🤝
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal }}>
              Tulsa Chamber Member
            </span>
          </div>

          {/* Certified Professionals */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 60,
              height: 60,
              background: Colors.lightGray,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}>
              {/* ASSET-PLACEHOLDER: TRUST-4 — Certified Professionals badge SVG */}
              ✓
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal }}>
              Vetted Pros
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
