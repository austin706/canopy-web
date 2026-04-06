import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import {
  getHomeMembers,
  inviteHomeMember,
  removeHomeMember,
  updateHomeMemberRole,
  type HomeMember,
} from '@/services/supabase';
import { Colors } from '@/constants/theme';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  owner: Colors.copper,
  editor: Colors.sage,
  viewer: Colors.silver,
};

export default function HomeMembers({ homeId }: { homeId: string }) {
  const { user } = useStore();
  const [members, setMembers] = useState<HomeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [homeId]);

  const loadMembers = async () => {
    try {
      const data = await getHomeMembers(homeId);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user) return;
    setInviting(true);
    try {
      await inviteHomeMember(homeId, inviteEmail, inviteRole, user.id);
      setInviteEmail('');
      setShowInvite(false);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to send invite.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member: HomeMember) => {
    const name = member.profile?.full_name || member.invite_email || 'this member';
    if (!confirm(`Remove ${name} from this home?`)) return;
    try {
      await removeHomeMember(member.id);
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
    }
  };

  const handleRoleChange = async (memberId: string, role: 'editor' | 'viewer') => {
    try {
      await updateHomeMemberRole(memberId, role);
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
    } catch (err: any) {
      alert(err.message || 'Failed to update role.');
    }
  };

  if (loading) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Home Members</h3>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowInvite(!showInvite)}
        >
          {showInvite ? 'Cancel' : '+ Invite'}
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div style={{
          background: Colors.cream,
          border: `1px solid ${Colors.lightGray}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Email</label>
              <input
                className="form-input"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="Enter email address..."
                style={{ fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Role</label>
              <select
                className="form-select"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
                style={{ fontSize: 14 }}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 8, marginBottom: 0 }}>
            Editors can add/edit equipment, complete tasks, and add logs. Viewers can only see data.
          </p>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <p style={{ fontSize: 13, color: Colors.medGray, fontStyle: 'italic' }}>
          No members invited yet. Invite family members or roommates to view or manage this home.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(member => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--color-surface, white)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: ROLE_COLORS[member.role] + '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: ROLE_COLORS[member.role],
              }}>
                {(member.profile?.full_name || member.invite_email || '?')[0].toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {member.profile?.full_name || member.invite_email || 'Unknown'}
                </div>
                <div style={{ fontSize: 11, color: Colors.medGray }}>
                  {member.profile?.email || member.invite_email}
                  {member.invite_status === 'pending' && (
                    <span style={{ marginLeft: 6, color: Colors.warning, fontWeight: 600 }}>Pending</span>
                  )}
                </div>
              </div>

              {/* Role badge / dropdown */}
              <select
                className="admin-filter-select"
                value={member.role}
                onChange={e => handleRoleChange(member.id, e.target.value as 'editor' | 'viewer')}
                disabled={member.role === 'owner'}
                style={{ fontSize: 12, minWidth: 80 }}
              >
                {member.role === 'owner' && <option value="owner">Owner</option>}
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>

              {/* Remove button */}
              {member.role !== 'owner' && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRemove(member)}
                  style={{ fontSize: 12, color: Colors.error, padding: '4px 8px' }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
