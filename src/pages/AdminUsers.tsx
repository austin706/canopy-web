import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllUsers, updateProfile } from '@/services/supabase';


export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { getAllUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false)); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Change role to ${newRole}?`)) return;
    try {
      await updateProfile(userId, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e: any) { alert(e.message); }
  };

  const handleTierChange = async (userId: string, newTier: string) => {
    if (!confirm(`Override subscription to ${newTier}?`)) return;
    try {
      const expires = newTier === 'free' ? null : new Date(Date.now() + 365 * 86400000).toISOString();
      await updateProfile(userId, { subscription_tier: newTier, subscription_expires_at: expires });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: newTier, subscription_expires_at: expires } : u));
    } catch (e: any) { alert(e.message); }
  };

  const filtered = users.filter(u => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-wide">
      <div className="mb-lg">
        <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
        <h1>User Accounts</h1>
        <p className="subtitle">{users.length} users</p>
      </div>

      <input className="form-input mb-lg" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." style={{ maxWidth: 400 }} />

      {loading ? <div className="text-center"><div className="spinner" /></div> : (
        <div className="card table-container">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Tier</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td className="fw-600">{u.full_name || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td>
                    <select className="form-select" value={u.subscription_tier || 'free'} onChange={e => handleTierChange(u.id, e.target.value)} style={{ width: 120, padding: '4px 8px', fontSize: 12 }}>
                      <option value="free">Free</option><option value="home">Home</option><option value="pro">Pro</option><option value="pro_plus">Pro+</option>
                    </select>
                  </td>
                  <td>
                    <select className="form-select" value={u.role || 'user'} onChange={e => handleRoleChange(u.id, e.target.value)} style={{ width: 120, padding: '4px 8px', fontSize: 12 }}>
                      <option value="user">User</option><option value="agent">Agent</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="text-sm text-gray">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-gray" style={{ padding: 32 }}>No users found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
