import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { getPendingInvites, acceptHomeInvite, declineHomeInvite } from '@/services/supabase';
import { showToast } from '@/components/Toast';
import { Colors } from '@/constants/theme';
import { supabase } from '@/services/supabase';

interface PendingInvite {
  id: string;
  home_id: string;
  role: string;
  invite_email: string;
  home?: { address: string; city: string; state: string } | null;
}

export default function PendingInvites() {
  const { user } = useStore();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      getPendingInvites(user.email).then(setInvites).catch(() => {});
    }
  }, [user?.email]);

  const handleAccept = async (invite: PendingInvite) => {
    if (!user) return;
    setActing(invite.id);
    try {
      // Link user_id if not yet set
      await supabase
        .from('home_members')
        .update({ user_id: user.id, invite_status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', invite.id);
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to accept invite.' });
    } finally {
      setActing(null);
    }
  };

  const handleDecline = async (invite: PendingInvite) => {
    setActing(invite.id);
    try {
      await declineHomeInvite(invite.id);
      setInvites(prev => prev.filter(i => i.id !== invite.id));
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to decline invite.' });
    } finally {
      setActing(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div style={{
      background: '#E3F2FD',
      border: '1px solid #90CAF9',
      borderRadius: 8,
      padding: 16,
      marginBottom: 20,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, marginTop: 0, color: '#1565C0' }}>
        Home Invitations ({invites.length})
      </h3>
      {invites.map(invite => (
        <div key={invite.id} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'white',
          borderRadius: 6,
          marginBottom: 8,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {invite.home?.address || 'A home'}
            </div>
            <div style={{ fontSize: 11, color: Colors.medGray }}>
              {invite.home ? `${invite.home.city}, ${invite.home.state}` : ''} — as {invite.role}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleAccept(invite)}
              disabled={acting === invite.id}
              style={{ fontSize: 12 }}
            >
              Accept
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleDecline(invite)}
              disabled={acting === invite.id}
              style={{ fontSize: 12 }}
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
