import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllUsers, updateProfile, deleteUserAccount } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { logAdminAction } from '@/services/auditLog';


export default function AdminUsers() {
  const navigate = useNavigate();
  const { user: currentUser, setUser } = useStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTierAction, setBulkTierAction] = useState<string | null>(null);

  useEffect(() => { getAllUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false)); }, []);

  // If admin changes their own profile, sync the store so UI updates immediately
  const syncCurrentUser = (userId: string, updates: Record<string, any>) => {
    if (currentUser && currentUser.id === userId) {
      setUser({ ...currentUser, ...updates } as any);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Change role to ${newRole}?`)) return;
    try {
      const user = users.find(u => u.id === userId);
      const oldRole = user?.role || 'user';
      await updateProfile(userId, { role: newRole, admin_override: true, admin_override_at: new Date().toISOString() });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole, admin_override: true } : u));
      syncCurrentUser(userId, { role: newRole });
      await logAdminAction('user.role_change', 'user', userId, { old_role: oldRole, new_role: newRole, email: user?.email });
    } catch (e: any) { alert(e.message); }
  };

  const handleTierChange = async (userId: string, newTier: string) => {
    if (!confirm(`Override subscription to ${newTier}? This will lock the tier so Stripe won't overwrite it.`)) return;
    try {
      const user = users.find(u => u.id === userId);
      const oldTier = user?.subscription_tier || 'free';
      const expires = newTier === 'free' ? null : new Date(Date.now() + 365 * 86400000).toISOString();
      const isOverride = newTier !== 'free'; // Only set override for paid tiers
      await updateProfile(userId, {
        subscription_tier: newTier,
        subscription_expires_at: expires,
        admin_override: isOverride,
        admin_override_at: isOverride ? new Date().toISOString() : null,
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: newTier, subscription_expires_at: expires, admin_override: isOverride } : u));
      syncCurrentUser(userId, { subscription_tier: newTier, subscription_expires_at: expires });
      await logAdminAction('user.tier_change', 'user', userId, { old_tier: oldTier, new_tier: newTier, email: user?.email });
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName || 'this user'}? This will permanently remove their account and all associated data.`)) return;
    if (!confirm('This action cannot be undone. Type OK to confirm.')) return;
    try {
      const user = users.find(u => u.id === userId);
      await deleteUserAccount(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      await logAdminAction('user.delete', 'user', userId, { email: user?.email });
    } catch (e: any) { alert('Failed to delete: ' + e.message); }
  };

  const handleBulkTierChange = async (newTier: string) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Change tier to ${newTier} for ${selectedIds.size} selected user(s)?`)) return;
    try {
      const expires = newTier === 'free' ? null : new Date(Date.now() + 365 * 86400000).toISOString();
      const isOverride = newTier !== 'free';
      for (const userId of selectedIds) {
        await updateProfile(userId, {
          subscription_tier: newTier,
          subscription_expires_at: expires,
          admin_override: isOverride,
          admin_override_at: isOverride ? new Date().toISOString() : null,
        });
      }
      setUsers(prev => prev.map(u => selectedIds.has(u.id) ? { ...u, subscription_tier: newTier, subscription_expires_at: expires, admin_override: isOverride } : u));
      await logAdminAction('user.bulk_tier_change', 'user', 'bulk', { count: selectedIds.size, new_tier: newTier });
      setSelectedIds(new Set());
      setBulkTierAction(null);
    } catch (e: any) { alert(e.message); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected user(s)? This action cannot be undone.`)) return;
    try {
      for (const userId of selectedIds) {
        await deleteUserAccount(userId);
      }
      setUsers(prev => prev.filter(u => !selectedIds.has(u.id)));
      await logAdminAction('user.bulk_delete', 'user', 'bulk', { count: selectedIds.size });
      setSelectedIds(new Set());
    } catch (e: any) { alert('Failed to delete: ' + e.message); }
  };

  const toggleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(u => u.id)));
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesTier = tierFilter === 'all' || u.subscription_tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="page-wide">
      <div className="mb-lg">
        <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
        <h1>User Accounts</h1>
        <p className="subtitle">{users.length} users</p>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." style={{ maxWidth: 400 }} />
        <select className="form-select" value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={{ width: 140, padding: '8px 12px' }}>
          <option value="all">All Tiers</option>
          <option value="free">Free</option>
          <option value="home">Home</option>
          <option value="pro">Pro</option>
          <option value="pro_plus">Pro+</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ background: '#E3F2FD', padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>{selectedIds.size} user(s) selected</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-select" value={bulkTierAction || ''} onChange={e => setBulkTierAction(e.target.value)} style={{ width: 120, padding: '4px 8px', fontSize: 12 }}>
              <option value="">Select tier...</option>
              <option value="free">Free</option>
              <option value="home">Home</option>
              <option value="pro">Pro</option>
              <option value="pro_plus">Pro+</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => bulkTierAction && handleBulkTierChange(bulkTierAction)} disabled={!bulkTierAction} style={{ padding: '4px 12px', fontSize: 12 }}>Change Tier</button>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} style={{ padding: '4px 12px', fontSize: 12 }}>Delete Selected</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center"><div className="spinner" /></div> : (
        <div className="card table-container">
          <table>
            <thead><tr><th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} /></th><th>Name</th><th>Email</th><th>Tier</th><th>Role</th><th>Override</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ background: selectedIds.has(u.id) ? '#F5F5F5' : undefined }}>
                  <td style={{ width: 40 }}><input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelectUser(u.id)} style={{ cursor: 'pointer' }} /></td>
                  <td className="fw-600">{u.full_name || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td>
                    <select className="form-select" value={u.subscription_tier || 'free'} onChange={e => handleTierChange(u.id, e.target.value)} style={{ width: 120, padding: '4px 8px', fontSize: 12 }}>
                      <option value="free">Free</option><option value="home">Home</option><option value="pro">Pro</option><option value="pro_plus">Pro+</option>
                    </select>
                  </td>
                  <td>
                    <select className="form-select" value={u.role || 'user'} onChange={e => handleRoleChange(u.id, e.target.value)} style={{ width: 120, padding: '4px 8px', fontSize: 12 }}>
                      <option value="user">User</option><option value="agent">Agent</option><option value="pro_provider">Pro Provider</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    {u.admin_override ? (
                      <span style={{ fontSize: 11, background: '#FFF3CD', color: '#856404', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>Admin Set</span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#999' }}>Stripe</span>
                    )}
                  </td>
                  <td className="text-sm text-gray">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    {u.role !== 'admin' && (
                      <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => handleDeleteUser(u.id, u.full_name)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center text-gray" style={{ padding: 32 }}>No users found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
