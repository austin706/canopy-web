import { useState } from 'react';
import { Colors } from '@/constants/theme';
import { MailIcon, PhoneIcon, ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon } from '@/components/icons/Icons';

const FAQ_SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      {
        id: 'what-is-canopy',
        question: 'What is Canopy?',
        answer: 'Canopy is a home maintenance app by Oak & Sage Realty that helps you keep track of your home\'s equipment, schedule maintenance tasks, receive weather alerts, and connect with professional service providers \u2014 all in one place.',
      },
      {
        id: 'setup-home',
        question: 'How do I set up my home?',
        answer: 'After creating your account, the onboarding flow walks you through entering your home address, year built, square footage, and key details. This information powers your personalized maintenance schedule and weather alerts.',
      },
      {
        id: 'add-equipment',
        question: 'How do I add equipment?',
        answer: 'Go to the Equipment page and click "Add Equipment". Select a category (HVAC, Water Heater, Roof, etc.), fill in the details like make, model, serial number, and installation date, then click Save. You can also scan equipment labels with the AI scanner to auto-fill details.',
      },
    ],
  },
  {
    title: 'Tasks & Maintenance',
    items: [
      {
        id: 'how-tasks-work',
        question: 'How do tasks work?',
        answer: 'Maintenance tasks are automatically generated based on your equipment and home needs. You can view them on the Calendar page, sorted by due date. Click any task to see details, estimated time, and step-by-step instructions. You can mark tasks as complete, skip them, or snooze them for later.',
      },
      {
        id: 'health-score',
        question: 'What is the home health score?',
        answer: 'Your home health score (0\u2013100) reflects how well-maintained your home is based on completed vs. overdue tasks, equipment age, and maintenance history. Keeping up with tasks raises your score; skipping or ignoring them lowers it.',
      },
      {
        id: 'weather-alerts',
        question: 'How do weather alerts work?',
        answer: 'Canopy fetches real-time weather alerts from the National Weather Service based on your home\'s location. Each alert includes actionable maintenance tips \u2014 for example, a freeze warning tells you to disconnect hoses and drip faucets.',
      },
    ],
  },
  {
    title: 'Subscriptions & Billing',
    items: [
      {
        id: 'subscription-plans',
        question: 'What\'s included in each plan?',
        answer: 'Free: Basic calendar with generic checklists and up to 5 equipment slots. Home Plan: All 37 AI-powered tasks, unlimited equipment, personalized checklists, and weather alerts. Pro/Pro+: Home Plan features plus professional service scheduling and provider matching.',
      },
      {
        id: 'gift-codes',
        question: 'How do gift codes work?',
        answer: 'Gift codes can be redeemed on the Subscription page to activate plan features on your account. Enter your code and click Redeem. The plan will be applied immediately for the duration specified by the gift code.',
      },
    ],
  },
  {
    title: 'Pro Services',
    items: [
      {
        id: 'pro-service',
        question: 'What is the Pro service?',
        answer: 'Pro services connect you with vetted local professionals for maintenance tasks like HVAC tune-ups, gutter cleaning, and plumbing repairs. Submit a service request describing what you need, and a qualified provider will be matched with you.',
      },
      {
        id: 'pro-scheduling',
        question: 'How does scheduling work?',
        answer: 'Once a provider accepts your request, they\'ll schedule a date for the service. You\'ll see the appointment on your Pro Services page. The provider can also mark the job as complete when finished.',
      },
    ],
  },
  {
    title: 'Account & Data',
    items: [
      {
        id: 'contact-agent',
        question: 'How do I contact my agent?',
        answer: 'Your real estate agent information is available in the Profile section. You can call them directly using the phone number listed, or send them a message through the app.',
      },
      {
        id: 'secure-vault',
        question: 'What is the Secure Vault?',
        answer: 'The Secure Vault stores sensitive home documents and notes (warranties, insurance policies, access codes) behind a PIN lock. All data is encrypted and stored securely in your account.',
      },
      {
        id: 'notifications',
        question: 'How do I manage notifications?',
        answer: 'Go to the Notifications page to customize which alerts you receive (task reminders, weather alerts, equipment warnings) and when you receive them (day of, 1 day before, or 3 days before).',
      },
    ],
  },
];

export default function Help() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const appVersion = '1.0.0';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Help & Support</h1>
          <p className="subtitle">Frequently asked questions and support</p>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* FAQ Sections */}
        {FAQ_SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, marginBottom: 16 }}>
              {section.title}
            </h2>
            <div className="flex-col gap-md">
              {section.items.map(item => (
                <div key={item.id} className="card">
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12, padding: 0,
                      border: 'none', background: 'none', cursor: 'pointer',
                    }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal, textAlign: 'left', flex: 1 }}>
                      {item.question}
                    </p>
                    <span style={{ flexShrink: 0, display: 'flex' }}>
                      {expandedId === item.id
                        ? <ChevronUpIcon size={16} color={Colors.copper} />
                        : <ChevronDownIcon size={16} color={Colors.copper} />}
                    </span>
                  </button>
                  {expandedId === item.id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${Colors.lightGray}` }}>
                      <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.6 }}>{item.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Contact Support Section */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, marginBottom: 16 }}>
            Contact Support
          </h2>
          <div className="card">
            <div className="flex-col gap-md">
              <a
                href="mailto:support@oakandsagerealty.com"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 4,
                  background: Colors.cream,
                  textDecoration: 'none',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = Colors.copperMuted)}
                onMouseLeave={(e) => (e.currentTarget.style.background = Colors.cream)}
              >
                <MailIcon size={22} color={Colors.copper} />
                <div>
                  <p style={{ fontWeight: 600, color: Colors.charcoal, marginBottom: 2 }}>Email Support</p>
                  <p className="text-xs text-gray">support@oakandsagerealty.com</p>
                </div>
              </a>

              <div style={{
                height: 1,
                background: Colors.lightGray,
              }} />

              <a
                href="tel:+19189840376"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 4,
                  background: Colors.cream,
                  textDecoration: 'none',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = Colors.copperMuted)}
                onMouseLeave={(e) => (e.currentTarget.style.background = Colors.cream)}
              >
                <PhoneIcon size={22} color={Colors.copper} />
                <div>
                  <p style={{ fontWeight: 600, color: Colors.charcoal, marginBottom: 2 }}>Phone Support</p>
                  <p className="text-xs text-gray">+1 (918) 984-0376</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 32,
          paddingTop: 16,
          borderTop: `1px solid ${Colors.lightGray}`,
        }}>
          <p className="text-xs text-gray">Canopy v{appVersion}</p>
        </div>
      </div>
    </div>
  );
}
