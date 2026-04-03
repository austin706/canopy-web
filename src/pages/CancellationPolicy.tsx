export default function CancellationPolicy() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1a1a1a', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ color: '#8B9E7E', textDecoration: 'none', fontSize: 14 }}>← Back to Canopy</a>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Cancellation & Refund Policy</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Last updated: April 3, 2026</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Overview</h2>
      <p>Canopy offers flexible subscription management. You can cancel at any time, and we aim to make the process straightforward and fair. This policy explains how to cancel your subscription, what happens to your data and access, and our refund terms.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Subscription Plans</h2>
      <p>Canopy offers the following subscription tiers:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}><strong>Free</strong> — Access to core home management features, equipment tracking, and task organization.</li>
        <li style={{ marginBottom: 8 }}><strong>Home</strong> — $6.99/month or $75.49/year. Includes AI-powered maintenance recommendations, task scheduling, equipment scanning, and inspection summaries.</li>
        <li style={{ marginBottom: 8 }}><strong>Pro</strong> — $149/month or $1,609/year. Includes all Home features plus priority pro provider matching, advanced analytics, and unlimited inspections.</li>
        <li style={{ marginBottom: 8 }}><strong>Pro+</strong> — Custom pricing concierge tier. Includes all Pro features plus dedicated support and custom workflows.</li>
      </ul>
      <p>Subscriptions can be purchased via Stripe (web and mobile), Apple App Store, or Google Play Store. Billing and cancellation methods depend on your purchase platform.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>How to Cancel</h2>
      <p>You can cancel your subscription using any of these methods:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}><strong>In-app (mobile)</strong> — Open the Canopy app, go to your Profile, select Subscription, and tap Cancel Plan.</li>
        <li style={{ marginBottom: 8 }}><strong>Web</strong> — Visit canopyhome.app, log in, navigate to your Subscription settings, and click Cancel Plan.</li>
        <li style={{ marginBottom: 8 }}><strong>App Store</strong> — iOS: Open Settings, tap your Apple ID, select Subscriptions, find Canopy, and tap Cancel Subscription. Android: Open Google Play, go to your account, select Subscriptions, find Canopy, and tap Manage Subscription, then Cancel.</li>
      </ul>
      <p>Cancellation takes effect at the end of your current billing period. You will retain full access to all paid features until the period ends.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>What Happens When You Cancel</h2>
      <p>When your subscription is canceled:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>You keep full access to all paid features until the end of your current billing period.</li>
        <li style={{ marginBottom: 8 }}>After the period ends, your account automatically reverts to the Free tier.</li>
        <li style={{ marginBottom: 8 }}>All your data is preserved and accessible on the Free tier, including your home profile, equipment catalog, maintenance history, inspection documents, and photos.</li>
        <li style={{ marginBottom: 8 }}>You can re-subscribe at any time to regain access to paid features without losing your data.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Refund Policy</h2>
      <p><strong>Stripe (web and mobile):</strong> Canopy offers a full refund within 7 days of your initial purchase if you request it within that window. After 7 days, refunds are not available for unused subscription time. Contact support@canopyhome.app with your request.</p>
      <p><strong>Apple App Store:</strong> Refunds for App Store purchases are handled by Apple according to their policies. Contact Apple Support directly to request a refund.</p>
      <p><strong>Google Play Store:</strong> Refunds for Google Play purchases are handled by Google according to their policies. Contact Google Play Support directly to request a refund.</p>
      <p><strong>Gift Codes:</strong> Gift codes are non-refundable once redeemed. Unredeemed gift codes may be refunded to the original purchasing account holder.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Pro+ Tier</h2>
      <p>Pro+ subscriptions are custom service agreements with individualized terms. Cancellation and refund terms are specified in your service agreement. If you wish to cancel a Pro+ subscription or have questions about your terms, contact support@canopyhome.app and reference your service agreement.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Pro Provider Cancellation</h2>
      <p>If you are a Pro Provider using Canopy to connect with homeowners, you may deactivate your account at any time. Outstanding payments for completed work will still be processed according to your agreement. Active jobs must be completed or properly handed off to another provider before you deactivate. Reactivation of a deactivated Pro Provider account is subject to review and approval by the Canopy team.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Data After Cancellation</h2>
      <p>After cancellation, Canopy retains your account data for 12 months. During this period, you can re-subscribe to regain full access without data loss. You may request a full data export of your profile, equipment, maintenance history, and documents at any time by contacting support@canopyhome.app. You may also request permanent deletion of your data. Some information may be retained longer as required by law or for legitimate business purposes, such as transaction records for accounting and fraud prevention.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Changes to This Policy</h2>
      <p>Canopy reserves the right to update this Cancellation & Refund Policy at any time. We will provide at least 30 days notice of material changes via email or in-app notification. Your continued use of Canopy after such notification constitutes acceptance of the updated policy.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contact</h2>
      <p>If you have questions about this policy or need assistance with cancellation, refunds, or subscription management, please contact us at support@canopyhome.app.</p>

      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 48, paddingTop: 24, color: '#999', fontSize: 14, textAlign: 'center' as const }}>
        © {new Date().getFullYear()} Canopy. All rights reserved.
      </div>
    </div>
  );
}
