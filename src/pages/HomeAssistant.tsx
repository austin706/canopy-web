import { useState, useRef, useEffect } from 'react';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { canAccess, getAiLimit } from '@/services/subscriptionGate';
import { useNavigate } from 'react-router-dom';

// P2 #68 (2026-04-23) — fail fast in production if VITE_SUPABASE_URL is missing
// instead of silently falling back to a hardcoded dev URL. Previously, dropping
// the env var would send traffic to the wrong (previous) Supabase project, so
// AI chat would appear to work in dev but hit cross-project auth errors for real
// users. In prod we throw on import so Vite's build would never ship; locally
// we still warn + use a relative path (which will 404 loudly rather than leak).
const SUPABASE_URL: string = (() => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (envUrl && envUrl.length > 0) return envUrl;
  if (import.meta.env.PROD) {
    throw new Error('VITE_SUPABASE_URL is required in production. Refusing to fall back to a hardcoded project URL.');
  }
  console.warn('[HomeAssistant] VITE_SUPABASE_URL missing in dev — AI chat calls will fail loudly until it is set in .env.local');
  return '';
})();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  'What maintenance should I do this month?',
  'My HVAC is making a strange noise — what could it be?',
  'How often should I replace my water heater anode rod?',
  'What are signs my roof needs replacing?',
  'How can I lower my energy bill?',
  'When should I winterize my hose bibs?',
];

export default function HomeAssistant() {
  const { user, home, equipment, tasks, maintenanceLogs } = useStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiUsage, setAiUsage] = useState({ current: 0, limit: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tier = user?.subscription_tier || 'free';
  const hasAccess = canAccess(tier, 'ai_chat');
  const aiChatLimit = getAiLimit(tier, 'ai_chat');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Load AI usage for free tier users
  useEffect(() => {
    if (tier === 'free' && user?.id && aiChatLimit) {
      const loadUsage = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const response = await fetch(
              `${SUPABASE_URL}/functions/v1/get-ai-usage`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ user_id: user.id }),
              }
            );
            const data = await response.json();
            if (response.ok) {
              setAiUsage({ current: data.chat_count || 0, limit: aiChatLimit });
            }
          }
        } catch (err) {
          console.warn('Failed to load AI usage:', err);
        }
      };
      loadUsage();
    }
  }, [tier, user?.id, aiChatLimit]);

  // Build home context string for the AI
  const buildHomeContext = (): string => {
    const parts: string[] = [];

    // Current date so AI knows the season and can give timely advice
    const now = new Date();
    parts.push(`Today's date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    parts.push(`Current season: ${getSeason(now)}`);

    if (home) {
      if (home.address) parts.push(`Address: ${home.address}, ${home.city || ''} ${home.state || ''}`);
      if (home.year_built) parts.push(`Year built: ${home.year_built}`);
      if (home.square_footage) parts.push(`Square footage: ${home.square_footage}`);
      if (home.stories) parts.push(`Stories: ${home.stories}`);
      if (home.foundation_type) parts.push(`Foundation: ${home.foundation_type}`);
      if (home.roof_type) parts.push(`Roof type: ${home.roof_type}`);
      if (home.heating_type) parts.push(`Heating: ${home.heating_type}`);
      if (home.cooling_type) parts.push(`Cooling: ${home.cooling_type}`);
      if (home.has_pool) parts.push('Has pool');
      if (home.has_fireplace) parts.push('Has fireplace');
      if (home.has_sprinkler_system) parts.push('Has sprinkler system');
      if (home.has_sump_pump) parts.push('Has sump pump');
      if (home.has_storm_shelter) parts.push('Has storm shelter');
    }
    if (equipment && equipment.length > 0) {
      const eqList = equipment.map(e =>
        `${e.name} (${e.category}${e.make ? ', ' + e.make : ''}${e.model ? ' ' + e.model : ''}${e.install_date ? ', installed ' + e.install_date : ''})`
      ).join('; ');
      parts.push(`Equipment: ${eqList}`);
    }

    // Active/upcoming tasks so AI knows what's on the homeowner's plate
    if (tasks && tasks.length > 0) {
      const activeTasks = tasks
        .filter(t => t.status === 'upcoming' || t.status === 'overdue' || t.status === 'due')
        .slice(0, 15);
      if (activeTasks.length > 0) {
        const taskList = activeTasks.map(t =>
          `- ${t.title} (${t.status}${t.due_date ? ', due ' + new Date(t.due_date).toLocaleDateString() : ''}${t.priority ? ', ' + t.priority + ' priority' : ''})`
        ).join('\n');
        parts.push(`\nActive maintenance tasks:\n${taskList}`);
      }

      const recentCompleted = tasks
        .filter(t => t.status === 'completed' && t.completed_date)
        .sort((a, b) => new Date(b.completed_date!).getTime() - new Date(a.completed_date!).getTime())
        .slice(0, 5);
      if (recentCompleted.length > 0) {
        const completedList = recentCompleted.map(t =>
          `- ${t.title} (completed ${new Date(t.completed_date!).toLocaleDateString()})`
        ).join('\n');
        parts.push(`\nRecently completed tasks:\n${completedList}`);
      }
    }

    // Recent maintenance logs for context on what's been done
    if (maintenanceLogs && maintenanceLogs.length > 0) {
      const recentLogs = [...maintenanceLogs]
        .sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())
        .slice(0, 8);
      if (recentLogs.length > 0) {
        const logList = recentLogs.map(l =>
          `- ${l.title || l.description || 'Maintenance'} (${new Date(l.completed_date).toLocaleDateString()}${l.category ? ', ' + l.category : ''})`
        ).join('\n');
        parts.push(`\nRecent maintenance history:\n${logList}`);
      }
    }

    return parts.join('\n');
  };

  const getSeason = (date: Date): string => {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText, timestamp: new Date() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/home-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            homeContext: buildHomeContext(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'USAGE_LIMIT') {
          setError(`Monthly chat limit reached (${data.limit} messages). Upgrade your plan for unlimited access.`);
        } else {
          setError(data.error || 'Failed to get response');
        }
        return;
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
      };
      setMessages([...newMessages, assistantMessage]);
      // Update usage counter if free tier
      if (tier === 'free' && aiChatLimit) {
        setAiUsage(prev => ({ ...prev, current: Math.min(prev.current + 1, aiChatLimit) }));
      }
    } catch (err) {
      setError('Failed to connect to AI assistant. Please try again.');
      console.warn('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!hasAccess) {
    return (
      <div className="page" style={{ maxWidth: 700, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: Colors.charcoal, marginBottom: 8 }}>AI Home Assistant</h1>
        <p style={{ color: Colors.medGray, marginBottom: 24 }}>Get personalized home maintenance advice from your AI assistant.</p>
        <button className="btn btn-primary" onClick={() => navigate('/subscription')}>Upgrade to Access</button>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', padding: 0 }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${Colors.cream}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: Colors.sageMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>🌿</div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, margin: 0 }}>Canopy Assistant</h1>
            <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>AI-powered home maintenance advice · <a href="/ai-disclaimer" style={{ color: Colors.sage, textDecoration: 'none' }}>Disclaimer</a></p>
          </div>
        </div>
        {/* Usage counter for free tier */}
        {tier === 'free' && aiChatLimit && (
          <div style={{ marginTop: 12, padding: '10px 12px', backgroundColor: 'var(--color-background)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: Colors.medGray, marginBottom: 6 }}>
              {aiUsage.current === aiChatLimit ? (
                <span style={{ color: Colors.error, fontWeight: 600 }}>Monthly limit reached</span>
              ) : aiUsage.current >= 4 ? (
                <span style={{ color: 'var(--color-warning, #D4A574)', fontWeight: 600 }}>
                  {aiUsage.current} of {aiChatLimit} AI chats used this month
                </span>
              ) : (
                <span>{aiUsage.current} of {aiChatLimit} AI chats used this month</span>
              )}
            </div>
            <div style={{
              height: 4, backgroundColor: Colors.cream, borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${(aiUsage.current / aiChatLimit) * 100}%`,
                backgroundColor: aiUsage.current === aiChatLimit ? Colors.error : aiUsage.current >= 4 ? 'var(--color-warning, #D4A574)' : Colors.sage,
                transition: 'all 0.3s ease',
              }} />
            </div>
            {aiUsage.current >= 4 && (
              <button
                onClick={() => navigate('/subscription')}
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  color: Colors.sage,
                  background: 'transparent',
                  border: `1px solid ${Colors.sage}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                View Plans
              </button>
            )}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>
              Ask me anything about your home
            </p>
            <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 24 }}>
              I can help with maintenance advice, troubleshooting, seasonal tasks, cost estimates, and more.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 500, margin: '0 auto' }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13,
                    border: `1px solid ${Colors.sage}40`, background: Colors.sageMuted,
                    color: Colors.sage, cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={`${msg.role}-${msg.timestamp.getTime()}-${msg.content.substring(0, 20)}`}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: 16,
                borderTopRightRadius: msg.role === 'user' ? 4 : 16,
                borderTopLeftRadius: msg.role === 'assistant' ? 4 : 16,
                backgroundColor: msg.role === 'user' ? Colors.sage : 'var(--color-background)',
                color: msg.role === 'user' ? 'var(--color-card-background)' : Colors.charcoal,
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <div style={{
              padding: '12px 16px', borderRadius: 16, borderTopLeftRadius: 4,
              backgroundColor: 'var(--color-background)', color: Colors.medGray, fontSize: 14,
            }}>
              <span style={{ display: 'inline-block', animation: 'pulse 1.5s infinite' }}>Thinking...</span>
            </div>
          </div>
        )}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, backgroundColor: 'var(--color-error-muted, #FFF3F3)',
            border: '1px solid var(--color-error-muted, #FFCDD2)', color: 'var(--color-error)', fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 24px 20px',
        borderTop: `1px solid ${Colors.cream}`,
        backgroundColor: 'var(--color-card-background)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your home..."
            rows={1}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12, fontSize: 14,
              border: `1px solid ${Colors.sage}40`, outline: 'none', resize: 'none',
              fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 100,
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            style={{
              width: 40, height: 40, borderRadius: '50%', border: 'none',
              backgroundColor: input.trim() && !isLoading ? Colors.sage : Colors.cream,
              color: 'var(--color-white)', cursor: input.trim() && !isLoading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
        <p style={{ fontSize: 11, color: Colors.medGray, textAlign: 'center', marginTop: 8, margin: '8px 0 0' }}>
          AI responses are for informational purposes. Always consult a professional for major repairs.
        </p>
      </div>
    </div>
  );
}
