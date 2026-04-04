import { useState, useRef, useEffect } from 'react';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { useNavigate } from 'react-router-dom';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  'What should I do this month?',
  'My HVAC is making a noise',
  'How can I lower my energy bill?',
];

const getSeason = (date: Date): string => {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
};

export default function DashboardChat() {
  const { user, home, equipment, tasks, maintenanceLogs } = useStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  const buildHomeContext = (): string => {
    const parts: string[] = [];
    const now = new Date();
    parts.push(`Today's date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    parts.push(`Current season: ${getSeason(now)}`);

    if (home) {
      if (home.address) parts.push(`Address: ${home.address}, ${home.city || ''} ${home.state || ''}`);
      if (home.year_built) parts.push(`Year built: ${home.year_built}`);
      if (home.square_footage) parts.push(`Square footage: ${home.square_footage}`);
      if (home.foundation_type) parts.push(`Foundation: ${home.foundation_type}`);
      if (home.roof_type) parts.push(`Roof type: ${home.roof_type}`);
      if (home.heating_type) parts.push(`Heating: ${home.heating_type}`);
      if (home.cooling_type) parts.push(`Cooling: ${home.cooling_type}`);
      if (home.has_pool) parts.push('Has pool');
      if (home.has_fireplace) parts.push('Has fireplace');
      if (home.has_sprinkler_system) parts.push('Has sprinkler system');
    }
    if (equipment && equipment.length > 0) {
      const eqList = equipment.map(e =>
        `${e.name} (${e.category}${e.make ? ', ' + e.make : ''}${e.model ? ' ' + e.model : ''})`
      ).join('; ');
      parts.push(`Equipment: ${eqList}`);
    }
    if (tasks && tasks.length > 0) {
      const activeTasks = tasks
        .filter(t => t.status === 'upcoming' || t.status === 'overdue' || t.status === 'due')
        .slice(0, 10);
      if (activeTasks.length > 0) {
        const taskList = activeTasks.map(t =>
          `- ${t.title} (${t.status}${t.due_date ? ', due ' + new Date(t.due_date).toLocaleDateString() : ''})`
        ).join('\n');
        parts.push(`\nActive tasks:\n${taskList}`);
      }
    }
    if (maintenanceLogs && maintenanceLogs.length > 0) {
      const recentLogs = [...maintenanceLogs]
        .sort((a, b) => new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime())
        .slice(0, 5);
      if (recentLogs.length > 0) {
        const logList = recentLogs.map(l =>
          `- ${l.title || l.description || 'Maintenance'} (${new Date(l.completed_date).toLocaleDateString()})`
        ).join('\n');
        parts.push(`\nRecent maintenance:\n${logList}`);
      }
    }
    return parts.join('\n');
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    if (!expanded) setExpanded(true);

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
        `${import.meta.env.VITE_SUPABASE_URL || 'https://uxxrmyxoyesipprwlxrn.supabase.co'}/functions/v1/home-assistant`,
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
          setError(`Monthly chat limit reached (${data.limit} messages). Upgrade for unlimited access.`);
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

  return (
    <div className="card" style={{
      overflow: 'hidden',
      border: `1px solid ${Colors.sage}30`,
      background: `linear-gradient(135deg, ${Colors.sageMuted}, ${Colors.white})`,
    }}>
      {/* Header — always visible */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          marginBottom: expanded ? 12 : 0,
        }}
        onClick={() => {
          if (!expanded) setExpanded(true);
          else if (messages.length === 0) setExpanded(false);
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: Colors.sage,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: Colors.white, flexShrink: 0,
        }}>
          <span role="img" aria-label="leaf">&#127807;</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, margin: 0 }}>Home Assistant</p>
          <p style={{ fontSize: 11, color: Colors.medGray, margin: 0 }}>Ask anything about your home</p>
        </div>
        {messages.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, padding: '4px 8px' }}
            onClick={(e) => { e.stopPropagation(); navigate('/assistant'); }}
          >
            Full View &rarr;
          </button>
        )}
        {!expanded && (
          <span style={{ fontSize: 18, color: Colors.sage }}>&#8595;</span>
        )}
      </div>

      {/* Collapsed: show quick question chips */}
      {!expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              style={{
                padding: '6px 12px', borderRadius: 16, fontSize: 12,
                border: `1px solid ${Colors.sage}40`, background: Colors.white,
                color: Colors.sage, cursor: 'pointer', fontWeight: 500,
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Expanded: show messages + input */}
      {expanded && (
        <>
          {/* Messages */}
          <div style={{
            maxHeight: 280, overflowY: 'auto', marginBottom: 10,
            borderRadius: 8, background: Colors.white, padding: messages.length ? '10px' : 0,
          }}>
            {messages.length === 0 && (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 10 }}>
                  I can help with maintenance advice, troubleshooting, seasonal tasks, and more.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      style={{
                        padding: '6px 12px', borderRadius: 16, fontSize: 12,
                        border: `1px solid ${Colors.sage}40`, background: Colors.sageMuted,
                        color: Colors.sage, cursor: 'pointer', fontWeight: 500,
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={`${msg.role}-${msg.timestamp.getTime()}-${msg.content.substring(0, 20)}`}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 8,
                }}
              >
                <div style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: 12,
                  borderTopRightRadius: msg.role === 'user' ? 4 : 12,
                  borderTopLeftRadius: msg.role === 'assistant' ? 4 : 12,
                  backgroundColor: msg.role === 'user' ? Colors.sage : '#f5f5f5',
                  color: msg.role === 'user' ? Colors.white : Colors.charcoal,
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                <div style={{
                  padding: '8px 12px', borderRadius: 12, borderTopLeftRadius: 4,
                  backgroundColor: '#f5f5f5', color: Colors.medGray, fontSize: 13,
                }}>
                  Thinking...
                </div>
              </div>
            )}
            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 8, backgroundColor: 'var(--color-copper-muted, #FFF3F3)',
                border: '1px solid #FFCDD2', color: 'var(--color-error)', fontSize: 12, marginBottom: 8,
              }}>
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              aria-label="Ask the home assistant"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your home..."
              rows={1}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13,
                border: `1px solid ${Colors.sage}40`, outline: 'none', resize: 'none',
                fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 80,
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              style={{
                width: 34, height: 34, borderRadius: '50%', border: 'none',
                backgroundColor: input.trim() && !isLoading ? Colors.sage : Colors.cream,
                color: Colors.white, cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}
            >
              &#8593;
            </button>
          </div>
          <p style={{ fontSize: 10, color: Colors.medGray, textAlign: 'center', marginTop: 6, margin: '6px 0 0' }}>
            AI responses are for informational purposes only.
          </p>
        </>
      )}
    </div>
  );
}
