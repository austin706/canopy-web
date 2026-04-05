export default function AIDisclaimer() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: 'var(--color-text)', lineHeight: 1.7 }}>
      <div style={{ marginBottom: 32 }}>
        <a href="/" style={{ color: 'var(--color-sage)', textDecoration: 'none', fontSize: 14 }}>← Back</a>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>AI Recommendations Disclaimer</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>Last updated: April 3, 2026</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Overview</h2>
      <p>Canopy uses artificial intelligence to provide personalized home maintenance recommendations, equipment scanning, task scheduling suggestions, inspection summaries, and a conversational home assistant. This page explains the role of AI in our platform and important limitations.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>What AI Does in Canopy</h2>
      <p>Canopy leverages AI to enhance your home maintenance experience across several features:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}><strong>Equipment scanning</strong> — Uses computer vision to identify make, model, and serial numbers from photos of your HVAC, water heater, appliances, and other equipment.</li>
        <li style={{ marginBottom: 8 }}><strong>Maintenance task generation</strong> — Creates personalized task schedules based on your home profile, equipment, climate zone, age of systems, and season.</li>
        <li style={{ marginBottom: 8 }}><strong>AI Home Assistant</strong> — Provides a conversational interface that answers questions about your home, maintenance tasks, equipment specifications, and best practices.</li>
        <li style={{ marginBottom: 8 }}><strong>Inspection summaries</strong> — Generates summaries and actionable insights from professional inspection data and photos provided by Pro Providers.</li>
        <li style={{ marginBottom: 8 }}><strong>Document analysis</strong> — Extracts tasks, recommendations, and information from uploaded inspection reports and maintenance documents.</li>
      </ul>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Important Limitations</h2>
      <p>AI recommendations are informational only and are not professional advice. AI-generated content is not a substitute for:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Licensed contractor assessments and professional evaluations.</li>
        <li style={{ marginBottom: 8 }}>Formal home inspections conducted by certified inspectors.</li>
        <li style={{ marginBottom: 8 }}>Engineering evaluations for structural concerns.</li>
        <li style={{ marginBottom: 8 }}>Building code compliance reviews or permit requirements.</li>
      </ul>
      <p>Additionally, AI may produce inaccurate, incomplete, or outdated recommendations. Climate and equipment data used to generate recommendations may not reflect your exact conditions. AI does not inspect your home — all recommendations are based solely on data you provide or that we infer from your profile.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Your Responsibility</h2>
      <p>You are responsible for verifying the accuracy and relevance of AI-generated recommendations before acting on them. Always consult qualified professionals for:</p>
      <ul style={{ paddingLeft: 24, marginTop: 8 }}>
        <li style={{ marginBottom: 8 }}>Structural, electrical, plumbing, or gas system concerns.</li>
        <li style={{ marginBottom: 8 }}>HVAC or refrigeration system repairs.</li>
        <li style={{ marginBottom: 8 }}>Safety-related recommendations or warning signs.</li>
        <li style={{ marginBottom: 8 }}>Any recommendation that seems incorrect, incomplete, or potentially dangerous.</li>
      </ul>
      <p>Report any AI recommendations that concern you to support@canopyhome.app immediately. Canopy is not responsible for outcomes, property damage, personal injury, increased repair costs, voided warranties, or other consequences resulting from following or not following AI recommendations.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Data & Privacy</h2>
      <p>AI processes your home data — including address, property details, equipment information, maintenance history, and photos — to generate personalized recommendations. Your data is not used to train or improve AI models. Conversations with the AI Home Assistant are not shared with third parties and are used only to improve your experience within Canopy. See our Privacy Policy for full details on how we collect, use, and protect your information.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Accuracy & Updates</h2>
      <p>AI models are updated periodically and may produce different recommendations as our technology improves. We work to improve accuracy, but we cannot guarantee that all AI-generated content is correct. Historical recommendations may not reflect current best practices, updated equipment specifications, or newly discovered issues.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Liability</h2>
      <p>To the maximum extent permitted by law, Canopy disclaims all liability for damages arising from reliance on or disregard of AI-generated recommendations. This includes, but is not limited to, property damage, personal injury, increased repair costs, voided warranties, or any other loss or harm. Use of AI features in Canopy constitutes acceptance of these limitations.</p>

      <h2 style={{ fontSize: 22, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contact</h2>
      <p>If you have concerns about AI recommendations or questions about how AI is used in Canopy, please contact us at support@canopyhome.app. Report concerning or potentially dangerous recommendations immediately.</p>

      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 48, paddingTop: 24, color: 'var(--color-text-secondary)', fontSize: 14, textAlign: 'center' as const }}>
        © {new Date().getFullYear()} Canopy. All rights reserved.
      </div>
    </div>
  );
}
