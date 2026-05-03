import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import { MailIcon, PhoneIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/icons/Icons';
import { useStore } from '@/store/useStore';
import { updateProfile } from '@/services/supabase';
import { DEFAULT_SETUP_CHECKLIST_STATE } from '@/types';
import packageJson from '../../package.json';

// ─── Help Center article data ────────────────────────────────────────────

interface HelpArticle {
  id: string;
  question: string;
  answer: string;
  /** Keywords for search (not displayed). */
  keywords?: string[];
}

interface HelpSection {
  title: string;
  icon: string;
  items: HelpArticle[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Getting Started',
    icon: '🏠',
    items: [
      {
        id: 'what-is-canopy',
        question: 'What is Canopy?',
        answer: 'Canopy is a home maintenance app that helps you keep track of your home\'s equipment, schedule maintenance tasks, receive weather alerts, and connect with professional service providers — all in one place. Whether you\'re a first-time homeowner or managing multiple properties, Canopy turns the overwhelming world of home maintenance into a simple, personalized plan.',
        keywords: ['about', 'overview', 'introduction'],
      },
      {
        id: 'setup-home',
        question: 'How do I set up my home?',
        answer: 'After creating your account, the onboarding flow walks you through entering your home address, year built, square footage, and key details like heating type, roof material, and whether you have a pool or fireplace. This information powers your personalized maintenance schedule and weather alerts. You can always update these details later from the Home Details page.',
        keywords: ['onboarding', 'address', 'home details'],
      },
      {
        id: 'setup-checklist',
        question: 'What is the Setup Checklist?',
        answer: 'After onboarding, a Setup Checklist appears on your Dashboard to help you get the most out of Canopy in your first week. It tracks key steps like adding equipment, setting up notifications, reviewing your maintenance calendar, and inviting household members. Items auto-complete as you do them, and you can dismiss the checklist when you\'re done.',
        keywords: ['checklist', 'first steps', 'activation', 'getting started widget'],
      },
      {
        id: 'add-equipment',
        question: 'How do I add equipment?',
        answer: 'Go to the Equipment page and click "Add Equipment". Select a category (HVAC, Water Heater, Roof, etc.), fill in the details like make, model, serial number, and installation date, then click Save. You can also use the AI Equipment Scanner to photograph your equipment label — the scanner reads the nameplate and auto-fills make, model, serial number, capacity, and more.',
        keywords: ['equipment', 'add', 'scan', 'nameplate'],
      },
      {
        id: 'equipment-scanning',
        question: 'How does equipment scanning work?',
        answer: 'The AI Equipment Scanner uses your phone camera or a photo upload to read equipment nameplates and labels. Point it at the manufacturer label on your HVAC unit, water heater, appliance, or other equipment. The AI extracts make, model, serial number, capacity, fuel type, efficiency rating, and estimated lifespan. It works best with clear, well-lit photos of the full label. You\'ll have a chance to review and correct any details before saving. Each scan uses one of your AI credits (unlimited on Home+ and Pro plans).',
        keywords: ['scan', 'camera', 'photo', 'AI', 'label', 'nameplate', 'vision'],
      },
    ],
  },
  {
    title: 'Tasks & Maintenance',
    icon: '📋',
    items: [
      {
        id: 'how-tasks-work',
        question: 'How do tasks work?',
        answer: 'Maintenance tasks are automatically generated based on your equipment and home needs. You can view them on the Calendar page, sorted by due date. Click any task to see details, estimated time, cost estimates, and step-by-step instructions. You can mark tasks as complete, skip them, or snooze them for later. Completing a task also updates your home health score and maintenance history.',
        keywords: ['tasks', 'calendar', 'maintenance', 'schedule', 'complete'],
      },
      {
        id: 'health-score',
        question: 'What is the home health score?',
        answer: 'Your home health score (0–100) reflects how well-maintained your home is based on completed vs. overdue tasks, equipment age, and maintenance history. Keeping up with tasks raises your score; skipping or ignoring them lowers it. The score is visible on your Dashboard and is included in your Home Token if you choose to share it during a home sale.',
        keywords: ['health', 'score', 'dashboard', 'maintenance'],
      },
      {
        id: 'weather-alerts',
        question: 'How do weather alerts work?',
        answer: 'Canopy fetches real-time weather alerts from the National Weather Service based on your home\'s location. Each alert includes actionable maintenance tips — for example, a freeze warning tells you to disconnect hoses and drip faucets. Weather-smart task scheduling also cross-references the 5-day forecast with your outdoor tasks and bumps urgent ones to the top when conditions warrant it.',
        keywords: ['weather', 'alerts', 'forecast', 'NWS', 'smart scheduling'],
      },
      {
        id: 'trash-recycling',
        question: 'How does trash & recycling tracking work?',
        answer: 'In Home Details, you can set your trash day, recycling day (weekly or biweekly), and yard waste schedule. Canopy generates pinned weekly tasks with night-before reminders so you never miss pickup day. Seasonal yard waste schedules automatically skip winter months. These tasks appear on your Calendar alongside regular maintenance.',
        keywords: ['trash', 'recycling', 'yard waste', 'pickup', 'schedule'],
      },
      {
        id: 'cost-forecast',
        question: 'How does the cost forecast work?',
        answer: 'The cost forecast estimates your annual and 5-year maintenance spending based on your equipment age, regional cost data, and upcoming tasks. It factors in regional cost-of-living multipliers so estimates reflect local pricing. Pro subscribers also see estimated pro service costs. Use it to budget for major replacements before they become emergencies.',
        keywords: ['cost', 'forecast', 'budget', 'estimate', 'spending'],
      },
    ],
  },
  {
    title: 'Subscriptions & Billing',
    icon: '💳',
    items: [
      {
        id: 'subscription-plans',
        question: 'What\'s included in each plan?',
        answer: 'Free: Basic calendar with generic checklists and up to 5 equipment slots. Home ($6.99/mo on web, $9.99/mo on iOS/Android): All AI-powered maintenance tasks, unlimited equipment, personalized checklists, weather-smart scheduling, cost forecasts, Home Token, and the AI Home Assistant. Home is DIY — you handle maintenance yourself with Canopy\'s guidance. Pro ($149/mo on web, $199/mo on iOS/Android): Everything in Home plus bimonthly professional home inspections with a Certified Pro. Pro+ services (sold per-add-on): The curated bundle on top of any subscription — Annual Maintenance Inspection ($149/yr base, scaled by sqft), pest, lawn, pool, septic, cleaning, deep services and more. Open Add-Ons in your dashboard. Note: a Canopy Maintenance Inspection documents the maintenance state of the home; it is not a substitute for a buyer\'s-side licensed home inspection before close.',
        keywords: ['plans', 'pricing', 'tiers', 'free', 'home', 'pro', 'subscription'],
      },
      {
        id: 'gift-codes',
        question: 'How do gift codes work?',
        answer: 'Gift codes can be redeemed on the Subscription page to activate plan features on your account. Real estate agents often provide gift codes to their buyers as a closing gift. Enter your code and click Redeem. The plan applies immediately for the duration specified by the code (typically 12 months of the Home plan).',
        keywords: ['gift', 'code', 'redeem', 'agent', 'closing gift'],
      },
      {
        id: 'cancel-subscription',
        question: 'How do I cancel or change my subscription?',
        answer: 'Go to Profile → Subscription to manage your plan. You can upgrade, downgrade, or cancel at any time. If you cancel a paid plan, you keep access through the end of your current billing period. Your data is never deleted — it stays in your account even on the Free tier. The Home Token and all maintenance history persist regardless of subscription status.',
        keywords: ['cancel', 'downgrade', 'change plan', 'billing'],
      },
    ],
  },
  {
    title: 'Pro Services',
    icon: '🔧',
    items: [
      {
        id: 'pro-service',
        question: 'What is the Pro service?',
        answer: 'Pro subscribers get regularly scheduled home inspections from a Certified Pro — a vetted, background-checked, insured technician trained in the Canopy system. During a visit, your pro walks through a comprehensive checklist covering HVAC, plumbing, electrical, roof, exterior, and more. After the visit, you receive an AI-generated summary with findings, photos, and prioritized recommendations. Need an Annual Maintenance Inspection (Home tier or pre-sale prep)? Add it from the Add-Ons page. The maintenance inspection is a Canopy-vetted Pro walkthrough that gets stamped onto your Home Token; for a buyer\'s-side licensed inspection before closing on a sale, hire a separate licensed home inspector.',
        keywords: ['pro', 'service', 'inspection', 'visit', 'technician', 'certified'],
      },
      {
        id: 'pro-scheduling',
        question: 'How does pro visit scheduling work?',
        answer: 'Once you\'re on a Pro plan and a provider is assigned to your area, visits are scheduled on a bimonthly cadence (Pro 2-Pack: bimonthly per home). You\'ll see upcoming appointments on your Calendar and Pro Services page. You can view your assigned provider\'s profile, availability, and past visit summaries. Looking for the certified annual inspection or one of the curated add-ons under Pro+ services? Open the Add-Ons page.',
        keywords: ['scheduling', 'appointment', 'bimonthly', 'monthly', 'provider'],
      },
      {
        id: 'visit-summary',
        question: 'What is a visit summary?',
        answer: 'After each pro visit, an AI-generated summary is created using the inspection data, checklist results, and provider notes. The summary is written in plain language and includes: what was checked, what passed, items needing attention, prioritized recommendations with urgency levels, and a home health score. You\'ll receive a notification and email when it\'s ready.',
        keywords: ['summary', 'report', 'inspection', 'AI', 'findings'],
      },
    ],
  },
  {
    title: 'Home Token',
    icon: '🏷️',
    items: [
      {
        id: 'what-is-home-token',
        question: 'What is the Home Token?',
        answer: 'The Home Token is a comprehensive digital record of your home — equipment inventory, maintenance history, inspection reports, verified ownership, and completeness score. Think of it as a "Carfax for your home." When you sell, you can transfer the Token to the buyer, giving them full context on the home\'s condition and care history. It\'s a powerful selling tool that demonstrates responsible homeownership.',
        keywords: ['token', 'maintenance passport', 'home report', 'transfer', 'sell'],
      },
      {
        id: 'home-transfer',
        question: 'How does the Home Token transfer work?',
        answer: 'When selling your home, go to Home Token → Transfer. Enter the buyer\'s email address to initiate the transfer. The buyer receives an invitation to accept the Token, which transfers all maintenance history, equipment records, and inspection data to their account. Your agent can attest to the transfer for additional credibility. The transfer is permanent — once accepted, the new owner has full control.',
        keywords: ['transfer', 'sell', 'buyer', 'agent attestation', 'sale'],
      },
      {
        id: 'ownership-verification',
        question: 'How does ownership verification work?',
        answer: 'To earn a "Verified Owner" badge on your Home Token, go to Home Details and upload proof-of-ownership documents (such as a government ID and a utility bill or property tax statement). A Canopy admin reviews your documents and approves or rejects the verification. The badge appears on your Home Token transfer page, increasing buyer confidence. We\'re working on automated title company verification for the future.',
        keywords: ['verification', 'verified', 'badge', 'documents', 'upload', 'ownership'],
      },
      {
        id: 'completeness-score',
        question: 'What is the completeness score?',
        answer: 'The completeness score measures how thorough your Home Token is — from 0% to 100%. It factors in how many equipment items are registered, how much maintenance history exists, whether you have inspection reports, and whether ownership is verified. A higher score means more value when transferring to a buyer.',
        keywords: ['completeness', 'score', 'token', 'value'],
      },
    ],
  },
  {
    title: 'Agents & Gift Codes',
    icon: '🤝',
    items: [
      {
        id: 'agent-linking',
        question: 'How does agent linking work?',
        answer: 'Real estate agents can create Canopy accounts and purchase gift codes to give their buyers as closing gifts. When a buyer redeems a gift code, their account is automatically linked to the agent. The agent can see which codes have been redeemed and which homes are under management in their Agent Portal. Agents are a referral and lead source for Canopy.',
        keywords: ['agent', 'real estate', 'link', 'gift code', 'portal'],
      },
      {
        id: 'agent-qr-code',
        question: 'What is the agent QR code?',
        answer: 'Each agent gets a permanent QR code linked to their profile (e.g., canopyhome.app/a/your-slug). The QR code can be printed on business cards, flyers, or closing packets. When a buyer scans it, they\'re taken to a branded page where they can redeem their gift code and get started with Canopy.',
        keywords: ['QR', 'code', 'business card', 'flyer', 'slug'],
      },
    ],
  },
  {
    title: 'Account & Data',
    icon: '🔒',
    items: [
      {
        id: 'home-members',
        question: 'How do I invite someone to my home?',
        answer: 'Go to Home Details → Home Members to invite another person by email. You can assign them as an Owner (full access), Editor (can modify equipment and tasks), or Viewer (read-only). Invited members see the home on their Dashboard and can interact with it based on their role. You can remove members or change roles at any time.',
        keywords: ['invite', 'member', 'share', 'household', 'access', 'role'],
      },
      {
        id: 'secure-vault',
        question: 'What is the Secure Vault?',
        answer: 'The Secure Vault stores sensitive home documents and notes (warranties, insurance policies, access codes, gate combinations) behind a PIN lock. All data is encrypted and stored securely in your account. Only you can access vault contents — household members with Editor or Viewer roles cannot see vault items.',
        keywords: ['vault', 'secure', 'PIN', 'documents', 'encrypted', 'warranty'],
      },
      {
        id: 'notifications',
        question: 'How do I manage notifications?',
        answer: 'Go to the Notifications page to customize which alerts you receive (task reminders, weather alerts, equipment warnings, pro visit updates) and when you receive them (day of, 1 day before, or 3 days before). You can also control email notifications per category in your notification preferences.',
        keywords: ['notifications', 'alerts', 'email', 'preferences', 'reminders'],
      },
      {
        id: 'data-export',
        question: 'Can I export my data?',
        answer: 'You can generate a Home Report from the Home Token page, which compiles your equipment, maintenance history, and home details into a printable format (use your browser\'s Print → Save as PDF). Full data export (CSV/JSON of all records) is planned for a future release. Your data is always yours — we never delete it, even if you downgrade to the Free plan.',
        keywords: ['export', 'download', 'PDF', 'report', 'data', 'backup'],
      },
      {
        id: 'account-deletion',
        question: 'How do I delete my account?',
        answer: 'To delete your account, contact support at support@canopyhome.app. We\'ll verify your identity and process the deletion within 48 hours. Account deletion removes your profile, home data, equipment records, and maintenance history permanently. Active subscriptions are cancelled automatically. We recommend exporting your Home Report first.',
        keywords: ['delete', 'account', 'remove', 'GDPR', 'privacy'],
      },
      {
        id: 'ical-calendar',
        question: 'How do I link my calendar?',
        answer: 'Go to Profile → Link Calendar to generate a subscription URL for your maintenance tasks. Click "Enable" to create the link, then copy it into Apple Calendar, Google Calendar, or Outlook. Tasks will appear as calendar events with reminders. You can rotate the URL at any time if you want to revoke access.',
        keywords: ['calendar', 'iCal', 'subscribe', 'Google Calendar', 'Apple Calendar', 'sync'],
      },
    ],
  },
  {
    title: 'AI Features',
    icon: '🌿',
    items: [
      {
        id: 'ai-assistant',
        question: 'What is the AI Home Assistant?',
        answer: 'The AI Home Assistant is a chat interface where you can ask home maintenance questions, get troubleshooting help, and receive personalized seasonal tips. It knows about your home\'s equipment, location, and maintenance history so it can give specific advice rather than generic answers. Free users get 5 lifetime chats; Home+ users get unlimited access.',
        keywords: ['AI', 'assistant', 'chat', 'advice', 'troubleshooting'],
      },
      {
        id: 'ai-usage-limits',
        question: 'What are AI usage limits?',
        answer: 'AI features (equipment scanning, chat, inspection parsing) are gated by your subscription tier. Free users get a limited number of lifetime uses. Home and Pro subscribers get generous monthly limits or unlimited access depending on the feature. Your current usage is tracked automatically. If you hit a limit, you\'ll see a prompt to upgrade.',
        keywords: ['usage', 'limits', 'quota', 'credits', 'upgrade'],
      },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────

export default function Help() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    // Support deep-links like /help#equipment-scanning
    const hash = location.hash?.replace('#', '');
    return hash || null;
  });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [resettingChecklist, setResettingChecklist] = useState(false);
  const { user, setUser } = useStore();
  const appVersion = packageJson.version;

  const handleResetChecklist = async () => {
    if (!user) return;
    setResettingChecklist(true);
    try {
      const resetState = { ...DEFAULT_SETUP_CHECKLIST_STATE, dismissed: false, dismissed_at: null };
      await updateProfile(user.id, { setup_checklist_state: resetState });
      setUser({ ...user, setup_checklist_state: resetState });
    } finally {
      setResettingChecklist(false);
    }
  };

  // ── Search filtering ──
  const filteredSections = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      if (activeCategory) {
        return HELP_SECTIONS.filter(s => s.title === activeCategory);
      }
      return HELP_SECTIONS;
    }
    return HELP_SECTIONS
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q) ||
          (item.keywords ?? []).some(k => k.toLowerCase().includes(q))
        ),
      }))
      .filter(section => section.items.length > 0);
  }, [search, activeCategory]);

  const totalResults = filteredSections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Help Center</h1>
          <p className="subtitle">Search articles or browse by category</p>
        </div>
      </div>

      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Search help articles…"
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveCategory(null); }}
            style={{
              width: '100%',
              padding: '14px 16px 14px 44px',
              fontSize: 15,
              border: `1px solid ${Colors.lightGray}`,
              borderRadius: 10,
              background: Colors.white,
              outline: 'none',
              color: Colors.charcoal,
              boxSizing: 'border-box',
            }}
          />
          <span style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            fontSize: 18, opacity: 0.45, pointerEvents: 'none',
          }}>🔍</span>
          {search && (
            <span style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 12, color: Colors.medGray,
            }}>
              {totalResults} result{totalResults !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Category pills */}
        {!search && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28,
          }}>
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                padding: '7px 14px',
                borderRadius: 20,
                border: `1px solid ${!activeCategory ? Colors.sage : Colors.lightGray}`,
                background: !activeCategory ? Colors.sageMuted : Colors.white,
                color: !activeCategory ? Colors.sage : Colors.medGray,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              All
            </button>
            {HELP_SECTIONS.map(section => (
              <button
                key={section.title}
                onClick={() => setActiveCategory(activeCategory === section.title ? null : section.title)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 20,
                  border: `1px solid ${activeCategory === section.title ? Colors.sage : Colors.lightGray}`,
                  background: activeCategory === section.title ? Colors.sageMuted : Colors.white,
                  color: activeCategory === section.title ? Colors.sage : Colors.medGray,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span style={{ fontSize: 14 }}>{section.icon}</span>
                {section.title}
              </button>
            ))}
          </div>
        )}

        {/* AI Home Assistant banner */}
        {!search && !activeCategory && (
          <div
            className="card mb-lg"
            style={{
              background: `linear-gradient(135deg, ${Colors.sageMuted} 0%, ${Colors.copperMuted} 100%)`,
              cursor: 'pointer',
              border: `1px solid ${Colors.sage}30`,
            }}
            onClick={() => navigate('/assistant')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: Colors.sage,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
              }}>
                <span role="img" aria-label="leaf">🌿</span>
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: Colors.charcoal, marginBottom: 4 }}>
                  AI Home Assistant
                </h3>
                <p style={{ fontSize: 13, color: Colors.medGray, lineHeight: 1.4 }}>
                  Get personalized maintenance advice, troubleshooting help, and seasonal tips from your AI assistant.
                </p>
              </div>
              <span style={{ fontSize: 20, color: Colors.sage, flexShrink: 0 }}>→</span>
            </div>
          </div>
        )}

        {/* No results */}
        {search && filteredSections.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🔍</p>
            <p style={{ fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>
              No articles found for "{search}"
            </p>
            <p style={{ fontSize: 13, color: Colors.medGray, lineHeight: 1.5 }}>
              Try a different search term, or <a
                href="mailto:support@canopyhome.app"
                style={{ color: Colors.copper, textDecoration: 'none', fontWeight: 600 }}
              >contact support</a> for help.
            </p>
          </div>
        )}

        {/* Article sections */}
        {filteredSections.map(section => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: 17, fontWeight: 700, color: Colors.charcoal, marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>{section.icon}</span>
              {section.title}
              <span style={{
                fontSize: 12, fontWeight: 500, color: Colors.medGray,
                background: Colors.cream, padding: '2px 8px', borderRadius: 10,
              }}>
                {section.items.length}
              </span>
            </h2>
            <div className="flex-col gap-md">
              {section.items.map(item => (
                <div key={item.id} className="card" id={item.id}>
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
                      <p style={{ fontSize: 14, color: Colors.medGray, lineHeight: 1.7 }}>{item.answer}</p>
                      {item.id === 'setup-checklist' && user?.setup_checklist_state?.dismissed && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={handleResetChecklist}
                          disabled={resettingChecklist}
                          style={{ marginTop: 12 }}
                        >
                          {resettingChecklist ? 'Resetting...' : 'Show Setup Checklist Again'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Contact Support */}
        <div>
          <h2 style={{
            fontSize: 17, fontWeight: 700, color: Colors.charcoal, marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>📬</span>
            Contact Support
          </h2>
          <div className="card">
            <div className="flex-col gap-md">
              <a
                href="mailto:support@canopyhome.app"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, borderRadius: 4, background: Colors.cream,
                  textDecoration: 'none', transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = Colors.copperMuted)}
                onMouseLeave={e => (e.currentTarget.style.background = Colors.cream)}
              >
                <MailIcon size={22} color={Colors.copper} />
                <div>
                  <p style={{ fontWeight: 600, color: Colors.charcoal, marginBottom: 2 }}>Email Support</p>
                  <p className="text-xs text-gray">support@canopyhome.app</p>
                </div>
              </a>

              <div style={{ height: 1, background: Colors.lightGray }} />

              <a
                href="tel:+19189480950"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, borderRadius: 4, background: Colors.cream,
                  textDecoration: 'none', transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = Colors.copperMuted)}
                onMouseLeave={e => (e.currentTarget.style.background = Colors.cream)}
              >
                <PhoneIcon size={22} color={Colors.copper} />
                <div>
                  <p style={{ fontWeight: 600, color: Colors.charcoal, marginBottom: 2 }}>Phone Support</p>
                  <p className="text-xs text-gray">+1 (918) 948-0950</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: 32, paddingTop: 16,
          borderTop: `1px solid ${Colors.lightGray}`,
        }}>
          <p className="text-xs text-gray">Canopy v{appVersion}</p>
        </div>
      </div>
    </div>
  );
}
