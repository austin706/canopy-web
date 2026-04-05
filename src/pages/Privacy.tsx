export default function Privacy() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: 'var(--color-text)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ color: 'var(--color-sage)', textDecoration: 'none', fontSize: 14 }}>← Back</a>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>Last updated: March 22, 2026</p>

      <p>Canopy ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Canopy mobile application, web platform, and related services (collectively, the "Service").</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>1. Information We Collect</h2>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Information You Provide</h3>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}><strong>Account information:</strong> name, email address, password, and account type (homeowner, agent, or pro provider).</li>
        <li style={{ marginBottom: 8 }}><strong>Property information:</strong> home address, property details, square footage, year built, and other home characteristics you choose to enter.</li>
        <li style={{ marginBottom: 8 }}><strong>Equipment and appliance data:</strong> make, model, serial number, purchase date, warranty information, and photos of your home equipment.</li>
        <li style={{ marginBottom: 8 }}><strong>Maintenance records:</strong> task history, completion dates, notes, and photos related to home maintenance activities.</li>
        <li style={{ marginBottom: 8 }}><strong>Agent information:</strong> brokerage name, license number, client relationships, and gift code distribution records.</li>
        <li style={{ marginBottom: 8 }}><strong>Pro Provider information:</strong> business name, service categories, license and insurance details, service area, availability, and professional qualifications.</li>
        <li style={{ marginBottom: 8 }}><strong>Payment information:</strong> subscription purchases are processed through Apple's App Store or Google Play Store. We do not directly collect or store your credit card or payment details.</li>
      </ul>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Information Collected Automatically</h3>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}><strong>Device information:</strong> device type, operating system, unique device identifiers, and mobile network information.</li>
        <li style={{ marginBottom: 8 }}><strong>Usage data:</strong> features accessed, pages viewed, actions taken, time spent, and interaction patterns within the Service.</li>
        <li style={{ marginBottom: 8 }}><strong>Location data:</strong> with your permission, we may collect your approximate location to provide weather-based maintenance recommendations and to connect you with local Pro Providers.</li>
        <li style={{ marginBottom: 8 }}><strong>Push notification tokens:</strong> if you opt in, we collect tokens to send you maintenance reminders, task alerts, and service updates.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Provide, maintain, and improve the Service.</li>
        <li style={{ marginBottom: 8 }}>Generate personalized maintenance schedules and reminders based on your property and equipment.</li>
        <li style={{ marginBottom: 8 }}>Connect homeowners with Pro Providers in their service area for maintenance work.</li>
        <li style={{ marginBottom: 8 }}>Enable Agents to manage gift subscriptions and support their clients' homeownership transition.</li>
        <li style={{ marginBottom: 8 }}>Process subscription payments and manage your account.</li>
        <li style={{ marginBottom: 8 }}>Send maintenance reminders, weather alerts, and other notifications you've opted into.</li>
        <li style={{ marginBottom: 8 }}>Provide customer support and respond to your inquiries.</li>
        <li style={{ marginBottom: 8 }}>Analyze usage patterns to improve features and user experience.</li>
        <li style={{ marginBottom: 8 }}>Comply with legal obligations and enforce our Terms of Service.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>3. How We Share Your Information</h2>
      <p>We do not sell your personal information. We may share your information in the following limited circumstances:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}><strong>With Pro Providers:</strong> When you request a service or accept a job match, relevant contact and property information is shared with the Pro Provider to facilitate the service. Only information necessary to complete the job is shared.</li>
        <li style={{ marginBottom: 8 }}><strong>With your Agent:</strong> If your account was created through an Agent gift code, your Agent may have limited visibility into your account status (e.g., whether you've activated the subscription). Agents do not have access to your detailed maintenance records or personal data.</li>
        <li style={{ marginBottom: 8 }}><strong>Service providers:</strong> We work with third-party companies that help us operate the Service, including cloud hosting (Supabase), subscription management (RevenueCat), and analytics providers. These providers only access your data as needed to perform their services and are bound by contractual obligations to protect it.</li>
        <li style={{ marginBottom: 8 }}><strong>Legal requirements:</strong> We may disclose your information if required by law, in response to a valid legal process, or to protect the rights, property, or safety of Canopy, our users, or the public.</li>
        <li style={{ marginBottom: 8 }}><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>4. Data Specific to User Types</h2>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Homeowners</h3>
      <p>Your property data, equipment details, and maintenance records are private by default. This information is only shared with Pro Providers when you initiate a service request, and only the details relevant to that specific job.</p>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Agents</h3>
      <p>Client information you access through the Agent portal is subject to your own professional obligations regarding client confidentiality. You may only use client data obtained through Canopy in connection with your professional real estate services. We track gift code distribution for account management purposes.</p>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Pro Providers</h3>
      <p>Your professional profile information (business name, service categories, service area, and ratings) may be visible to homeowners in your area. Your personal contact information is only shared with homeowners who request your services. Job history and performance data are used to improve matching and may be shared in aggregate, anonymized form.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>5. Data Security</h2>
      <p>We implement industry-standard security measures to protect your information, including encryption in transit (TLS/SSL), encryption at rest, secure authentication, and row-level security policies on our database. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>6. Data Retention</h2>
      <p>We retain your information for as long as your account is active or as needed to provide the Service. If you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it for legal, accounting, or compliance purposes.</p>
      <p>Maintenance records and equipment data may be retained in anonymized form to improve our recommendation algorithms.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>7. Your Rights and Choices</h2>
      <p>You have the following rights regarding your data:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}><strong>Access and portability:</strong> You can request a copy of your data at any time through your account settings or by contacting us.</li>
        <li style={{ marginBottom: 8 }}><strong>Correction:</strong> You can update your account information directly in the app or web platform.</li>
        <li style={{ marginBottom: 8 }}><strong>Deletion:</strong> You can request deletion of your account and associated data by contacting us at support@canopyhome.app.</li>
        <li style={{ marginBottom: 8 }}><strong>Notifications:</strong> You can manage push notification preferences in your device settings or within the app.</li>
        <li style={{ marginBottom: 8 }}><strong>Location:</strong> You can disable location services through your device settings at any time.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>8. Children's Privacy</h2>
      <p>The Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will take steps to delete that information.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>9. Third-Party Services</h2>
      <p>The Service may contain links to third-party websites or services. We are not responsible for the privacy practices of those third parties. We encourage you to review the privacy policies of any third-party services you access through Canopy.</p>
      <p>Key third-party services we use include:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}><strong>Supabase</strong> — database and authentication services</li>
        <li style={{ marginBottom: 8 }}><strong>RevenueCat</strong> — subscription management</li>
        <li style={{ marginBottom: 8 }}><strong>Expo / EAS</strong> — mobile app build and distribution</li>
        <li style={{ marginBottom: 8 }}><strong>Apple App Store / Google Play Store</strong> — app distribution and payment processing</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>10. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of material changes through the Service or via email. Your continued use of the Service after notification constitutes acceptance of the updated policy.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>11. Contact Us</h2>
      <p>If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
      <p style={{ marginTop: 8 }}>
        <strong>Canopy</strong><br />
        Email: support@canopyhome.app
      </p>

      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 48, paddingTop: 24, color: 'var(--color-text-secondary)', fontSize: 14, textAlign: 'center' as const }}>
        © {new Date().getFullYear()} Canopy. All rights reserved.
      </div>
    </div>
  );
}
