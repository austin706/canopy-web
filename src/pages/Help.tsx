import { useState } from 'react';
import { Colors } from '@/constants/theme';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'add-equipment',
    question: 'How do I add equipment?',
    answer: 'Go to the Equipment page and click "Add Equipment". Select a category (HVAC, Water Heater, Roof, etc.), fill in the details like make, model, serial number, and installation date, then click Save. Your equipment will appear in the list with maintenance reminders.',
  },
  {
    id: 'how-tasks-work',
    question: 'How do tasks work?',
    answer: 'Maintenance tasks are automatically generated based on your equipment and home needs. You can view them on the Calendar page, sorted by due date. Click any task to see details, estimated time, and step-by-step instructions. You can mark tasks as complete, skip them, or snooze them for later.',
  },
  {
    id: 'subscription-plans',
    question: "What's included in each plan?",
    answer: 'Free: Basic calendar with generic checklists and up to 5 equipment slots. Home Plan: All 37 AI-powered tasks, unlimited equipment, personalized checklists, and weather alerts. Pro/Pro+: Home Plan features plus monthly professional visits and additional services like filter changes and gutter cleaning.',
  },
  {
    id: 'gift-codes',
    question: 'How do gift codes work?',
    answer: 'Gift codes can be redeemed on the Subscription page to add plan features to your account. Enter your gift code and click Redeem to activate. The features will be added to your existing account immediately.',
  },
  {
    id: 'contact-agent',
    question: 'How do I contact my agent?',
    answer: 'Your real estate agent information is available in the Profile section. You can call them directly using the phone number listed, or send them a message through the app. Some agents can also view your property details if they have access.',
  },
  {
    id: 'export-data',
    question: 'Can I export my data?',
    answer: 'Yes, you can export your maintenance history and home data from the Profile page. This includes all completed tasks, maintenance logs, and equipment information. The export format is compatible with most spreadsheet applications.',
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
        {/* FAQ Section */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, marginBottom: 16 }}>
            Frequently Asked Questions
          </h2>
          <div className="flex-col gap-md">
            {FAQ_ITEMS.map(item => (
              <div key={item.id} className="card">
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <p style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: Colors.charcoal,
                    textAlign: 'left',
                    flex: 1
                  }}>
                    {item.question}
                  </p>
                  <span style={{
                    fontSize: 16,
                    color: Colors.copper,
                    flexShrink: 0
                  }}>
                    {expandedId === item.id ? '−' : '+'}
                  </span>
                </button>

                {expandedId === item.id && (
                  <div style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: `1px solid ${Colors.lightGray}`,
                  }}>
                    <p style={{
                      fontSize: 14,
                      color: Colors.medGray,
                      lineHeight: 1.6
                    }}>
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

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
                <span style={{ fontSize: 20 }}>✉️</span>
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
                <span style={{ fontSize: 20 }}>☎️</span>
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
