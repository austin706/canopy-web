import { useState, useEffect } from 'react';
import { getAllUsers, updateProfile, deleteUserAccount } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { logAdminAction } from '@/services/auditLog';

const TIER_COLORS: Record<string, string> = {
  free: '#6B7280',
  home: '#3B82F6',
  pro: '#8B5CF6',
  pro_plus: '#EC4899',
};

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  home: 'Home',
  pro: 'Pro',
  pro_plus: 'Pro+',
};

export default function AdminUsers() {
  const { user: currentUser, setUser } = useStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTierAction, setBulkTierAction] = useState<string | null>(null);

  useEffect(() => { getAllUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false)); }, []);

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
      const isOverride = newTier !== 'free';
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
      {/* Page Header */}
      <div className="admin-page-header mb-lg">
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Users</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{filtered.length} of {users.length} users</p>
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="admin-table-wrapper">
        <div className="admin-table-toolbar mb-md">
          <input
            className="admin-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
          />
          <select
            className="admin-filter-select"
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
          >
            <option value="all">All Tiers</option>
            <option value="free">Free</option>
            <option value="home">Home</option>
            <option value="pro">Pro</option>
            <option value="pro_plus">Pro+</option>
          </select>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="admin-bulk-bar mb-md">
            <span style={{ fontWeight: 600 }}>{selectedIds.size} user(s) selected</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="admin-filter-select"
                value={bulkTierAction || ''}
                onChange={e => setBulkTierAction(e.target.value)}
                style={{ fontSize: 13 }}
              >
                <option value="">Select tier...</option>
                <option value="free">Free</option>
                <option value="home">Home</option>
                <option value="pro">Pro</option>
                <option value="pro_plus">Pro+</option>
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => bulkTierAction && handleBulkTierChange(bulkTierAction)}
                disabled={!bulkTierAction}
              >
                Change Tier
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>Delete Selected</button>
            </div>
          </div>
        )}

        {/* Users Table */}
        {loading ? (
          <div className="text-center" style={{ padding: '32px 16px' }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <p>No users found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ width: 40, padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Tier</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Role</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Override</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Joined</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    background: selectedIds.has(u.id) ? 'var(--color-background)' : 'transparent',
                  }}
                >
                  <td style={{ width: 40, padding: '12px 16px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleSelectUser(u.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--charcoal)' }}>{u.full_name || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: TIER_COLORS[u.subscription_tier || 'free'] || TIER_COLORS.free,
                        }}
                      />
                      <select
                        className="admin-filter-select"
                        value={u.subscription_tier || 'free'}
                        onChange={e => handleTierChange(u.id, e.target.value)}
                        style={{ fontSize: 13 }}
                      >
                        <option value="free">Free</option>
                        <option value="home">Home</option>
                        <option value="pro">Pro</option>
                        <option value="pro_plus">Pro+</option>
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      className="admin-filter-select"
                      value={u.role || 'user'}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      style={{ fontSize: 13 }}
                    >
                      <option value="user">User</option>
                      <option value="agent">Agent</option>
                      <option value="pro_provider">Pro Provider</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.admin_override ? (
                      <span className="admin-status" style={{ background: 'var(--color-copper-muted, #FFF3E0)', color: 'var(--color-copper)' }}>
                        Admin Set
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Stripe</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {u.role !== 'admin' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteUser(u.id, u.full_name)}
                        style={{ fontSize: 12, padding: '4px 12px' }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
