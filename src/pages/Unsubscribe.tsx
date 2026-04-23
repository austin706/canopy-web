// Unsubscribe landing page (CAN-SPAM compliance).
// Accessible unauthenticated from /unsubscribe?email=X so recipients can
// opt out without signing in. Writes to email_unsubscribes table via the
// `unsubscribe-email` edge function, which the send-* functions check
// before dispatching marketing / drip / newsletter messages.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import logger from '@/utils/logger';

type Status = 'idle' | 'submitting' | 'done' | 'error';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const emailParam = params.get('email') || '';
  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  // Auto-submit if email was prefilled from the link — one-click unsubscribe.
  useEffect(() => {
    if (emailParam && status === 'idle') {
      handleSubmit(emailParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(targetEmail: string) {
    if (!targetEmail || !targetEmail.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }
    setStatus('submitting');
    try {
      const { error } = await supabase.functions.invoke('unsubscribe-email', {
        body: { email: targetEmail.trim().toLowerCase() },
      });
      if (error) throw error;
      setStatus('done');
      setMessage(`You've been unsubscribed from Canopy marketing emails. You may still receive transactional messages (receipts, password resets, security alerts).`);
    } catch (err) {
      setStatus('error');
      setMessage(`We couldn't process your request. Email support@canopyhome.app and we'll take care of it manually.`);
      logger.error('Unsubscribe failed:', err);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 24px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#2D2A26' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color: '#B87333' }}>Canopy Home</h1>
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 20 }}>Unsubscribe</h2>

      {status === 'done' ? (
        <div style={{ background: '#ECFDF5', border: '1px solid #10B981', borderRadius: 8, padding: 16, color: '#065F46' }}>
          {message}
        </div>
      ) : (
        <>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#4A4541', marginBottom: 16 }}>
            Enter your email address to stop receiving Canopy marketing and drip emails. Transactional messages (account confirmations, payment receipts, password resets) will continue, as required.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{ width: '100%', padding: '12px 14px', border: '1px solid #E5E0D4', borderRadius: 8, fontSize: 15, marginBottom: 12 }}
          />
          <button
            onClick={() => handleSubmit(email)}
            disabled={status === 'submitting'}
            style={{ background: '#B87333', color: 'white', fontWeight: 600, fontSize: 15, border: 'none', padding: '12px 28px', borderRadius: 8, cursor: status === 'submitting' ? 'wait' : 'pointer' }}
          >
            {status === 'submitting' ? 'Unsubscribing…' : 'Unsubscribe'}
          </button>
          {status === 'error' && (
            <p style={{ color: '#B91C1C', marginTop: 12, fontSize: 14 }}>{message}</p>
          )}
        </>
      )}

      <p style={{ marginTop: 40, fontSize: 12, color: '#8A8680', lineHeight: 1.6 }}>
        Canopy Home · Tulsa, OK · <a href="mailto:support@canopyhome.app" style={{ color: '#8B9E7E' }}>support@canopyhome.app</a>
      </p>
    </div>
  );
}
