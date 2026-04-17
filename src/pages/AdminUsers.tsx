import { useState, useEffect } from 'react';
import { getAllUsers, updateProfile, deleteUserAccount, getUserDetailData, supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { logAdminAction } from '@/services/auditLog';
import { PageSkeleton } from '@/components/Skeleton';
import { showToast } from '@/components/Toast';
import logger from '@/utils/logger';

type BillingAction = 'refund' | 'credit';
type RefundReason = 'duplicate' | 'fraudulent' | 'requested_by_customer';

interface BillingModalState {
  userId: string;
  userLabel: string;
  action: BillingAction;
  amount: string;          // raw dollar input, e.g. "12.50"
  reason: string;
  chargeId: string;
  refundReason: RefundReason;
  submitting: boolean;
}

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

interface UserDetail {
  homes: { id: string; address: string; city: string; state: string; zip_code: string; year_built: number | null; square_footage: number | null; bedrooms: number; bathrooms: number }[];
  equipmentCount: number;
  taskCount: number;
  logCount: number;
  phone: string | null;
  agent: { name: string; brokerage: string } | null;
  giftCode: string | null;
  giftCodeDetails: { code: string; tier: string; agent_id: string } | null;
  recentTasks?: Array<{
    id: string;
    home_id: string;
    title: string;
    status: string;
    priority: string;
    category: string;
    due_date: string;
    completed_date: string | null;
    completed_by: string | null;
    created_by_pro_id: string | null;
    estimated_cost: number | null;
  }>;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  completed: { bg: 'var(--color-sage-muted, #E8F0EA)', fg: 'var(--color-sage, #5B7E5A)' },
  overdue: { bg: '#FEE2E2', fg: '#B91C1C' },
  upcoming: { bg: 'var(--color-border)', fg: 'var(--text-secondary)' },
  due: { bg: '#FEF3C7', fg: '#92400E' },
  skipped: { bg: 'var(--color-border)', fg: 'var(--text-secondary)' },
};

export default function AdminUsers() {
  const { user: currentUser, setUser } = useStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTierAction, setBulkTierAction] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, UserDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [billingModal, setBillingModal] = useState<BillingModalState | null>(null);
  const PAGE_SIZE = 50;

  useEffect(() => { getAllUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false)); }, []);

  const syncCurrentUser = (userId: string, updates: Record<string, any>) => {
    if (currentUser && currentUser.id === userId) {
      setUser({ ...currentUser, ...updates } as any);
    }
  };

  const handleExpandToggle = async (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    if (!detailCache[userId]) {
      setDetailLoading(userId);
      try {
        const detail = await getUserDetailData(userId);
        setDetailCache(prev => ({ ...prev, [userId]: detail }));
      } catch (e: any) {
        logger.error('Failed to load user detail:', e.message);
      } finally {
        setDetailLoading(null);
      }
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
    } catch (e: any) { showToast({ message: e?.message || 'Failed to change role' }); }
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
    } catch (e: any) { showToast({ message: e?.message || 'Failed to change tier' }); }
  };

  const openBillingModal = (userId: string, userLabel: string, action: BillingAction) => {
    setBillingModal({
      userId,
      userLabel,
      action,
      amount: '',
      reason: '',
      chargeId: '',
      refundReason: 'requested_by_customer',
      submitting: false,
    });
  };

  const closeBillingModal = () => setBillingModal(null);

  const submitBillingAction = async () => {
    if (!billingModal) return;
    const { userId, action, amount, reason, chargeId, refundReason } = billingModal;

    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      showToast({ message: 'Enter a positive dollar amount' });
      return;
    }
    const amountCents = Math.round(parsed * 100);
    if (amountCents > 1_000_000) {
      showToast({ message: 'Amount exceeds the $10,000 safety cap. Escalate to finance.' });
      return;
    }
    if (reason.trim().length < 4) {
      showToast({ message: 'Reason must be at least 4 characters' });
      return;
    }
    if (!confirm(`${action === 'refund' ? 'Refund' : 'Credit'} $${(amountCents / 100).toFixed(2)} to ${billingModal.userLabel}?`)) return;

    setBillingModal({ ...billingModal, submitting: true });
    try {
      const payload: Record<string, unknown> = {
        target_user_id: userId,
        action,
        amount_cents: amountCents,
        reason: reason.trim(),
      };
      if (action === 'refund') {
        payload.refund_reason = refundReason;
        if (chargeId.trim()) payload.charge_id = chargeId.trim();
      }
      const { data, error } = await supabase.functions.invoke('admin-refund-credit', { body: payload });
      if (error) throw error;
      const stripeRef = (data as { stripe_ref?: string } | null)?.stripe_ref;
      await logAdminAction(`user.billing_${action}`, 'user', userId, {
        amount_cents: amountCents,
        reason: reason.trim(),
        stripe_ref: stripeRef,
      });
      showToast({
        message: action === 'refund'
          ? `Refund issued (${stripeRef ?? 'ok'})`
          : `Credit applied (${stripeRef ?? 'ok'})`,
      });
      setBillingModal(null);
    } catch (e: any) {
      logger.error('admin-refund-credit failed:', e?.message || e);
      showToast({ message: e?.message || `Failed to ${action}` });
      setBillingModal(billingModal ? { ...billingModal, submitting: false } : null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName || 'this user'}? This will permanently remove their account and all associated data.`)) return;
    if (!confirm('This action cannot be undone. Type OK to confirm.')) return;
    try {
      const user = users.find(u => u.id === userId);
      await deleteUserAccount(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      await logAdminAction('user.delete', 'user', userId, { email: user?.email });
    } catch (e: any) { showToast({ message: 'Failed to delete: ' + (e?.message || 'Unknown error') }); }
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
    } catch (e: any) { showToast({ message: e?.message || 'Failed to change tier' }); }
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
    } catch (e: any) { showToast({ message: 'Failed to delete: ' + (e?.message || 'Unknown error') }); }
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
    if (selectedIds.size === paginated.length && paginated.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map(u => u.id)));
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesTier = tierFilter === 'all' || u.subscription_tier === tierFilter;
    const matchesRole = roleFilter === 'all' || (u.role || 'user') === roleFilter;
    return matchesSearch && matchesTier && matchesRole;
  });

  // Reset to first page when filters change
  useEffect(() => { setPage(0); }, [search, tierFilter, roleFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const colCount = 8;

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
          <select
            className="admin-filter-select"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="agent">Agent</option>
            <option value="pro_provider">Pro Provider</option>
            <option value="admin">Admin</option>
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
          <div className="page-wide">
            <PageSkeleton rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <p>No users found</p>
          </div>
        ) : (
          <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ width: 40, padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paginated.length && paginated.length > 0}
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
              {paginated.map(u => {
                const isExpanded = expandedId === u.id;
                const detail = detailCache[u.id];
                const isLoadingDetail = detailLoading === u.id;

                return (
                  <>
                    {/* Main row */}
                    <tr
                      key={u.id}
                      onClick={() => handleExpandToggle(u.id)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid var(--color-border)',
                        background: selectedIds.has(u.id) ? 'var(--color-background)' : isExpanded ? 'var(--color-background)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ width: 40, padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelectUser(u.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--charcoal)' }}>
                        <span style={{ marginRight: 6 }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                        {u.full_name || '\u2014'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{u.email || '\u2014'}</td>
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
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
                      <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
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
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '\u2014'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => window.open(`/admin/users/${u.id}/view`, '_blank')}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            title="Open this user's account in a read-only snapshot for support triage"
                          >
                            View As
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => openBillingModal(u.id, u.full_name || u.email || u.id, 'refund')}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            title="Issue a Stripe refund against a charge"
                          >
                            Refund
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => openBillingModal(u.id, u.full_name || u.email || u.id, 'credit')}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            title="Add a balance credit to next invoice"
                          >
                            Credit
                          </button>
                          {u.role !== 'admin' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteUser(u.id, u.full_name)}
                              style={{ fontSize: 12, padding: '4px 12px' }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${u.id}-detail`} style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-background)' }}>
                        <td colSpan={colCount} style={{ padding: '0 16px 20px 56px' }}>
                          {isLoadingDetail ? (
                            <div style={{ padding: '16px 0' }}>
                              <div className="spinner" style={{ width: 20, height: 20 }} />
                            </div>
                          ) : detail ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 40px', paddingTop: 8 }}>
                              {/* Left column: Contact & Agent */}
                              <div>
                                <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>Contact &amp; Agent</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)' }}>Phone: </span>
                                    <span style={{ fontWeight: 500 }}>{detail.phone || 'Not set'}</span>
                                  </div>
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)' }}>Agent: </span>
                                    <span style={{ fontWeight: 500 }}>
                                      {detail.agent ? `${detail.agent.name} (${detail.agent.brokerage})` : 'None'}
                                    </span>
                                  </div>
                                  <div>
                                    <span style={{ color: 'var(--text-secondary)' }}>Gift Code: </span>
                                    <span style={{ fontWeight: 500 }}>
                                      {detail.giftCode ? (
                                        <>
                                          <code style={{ background: 'var(--color-border)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{detail.giftCode}</code>
                                          {detail.giftCodeDetails && (
                                            <span style={{ marginLeft: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                                              ({TIER_LABELS[detail.giftCodeDetails.tier] || detail.giftCodeDetails.tier})
                                            </span>
                                          )}
                                        </>
                                      ) : 'None'}
                                    </span>
                                  </div>
                                </div>

                                {/* Stats row */}
                                <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                                  <StatBadge label="Equipment" value={detail.equipmentCount} />
                                  <StatBadge label="Tasks" value={detail.taskCount} />
                                  <StatBadge label="Logs" value={detail.logCount} />
                                </div>
                              </div>

                              {/* Right column: Homes */}
                              <div>
                                <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                                  Homes ({detail.homes.length})
                                </h4>
                                {detail.homes.length === 0 ? (
                                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>No homes registered</p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {detail.homes.map(h => (
                                      <div
                                        key={h.id}
                                        style={{
                                          background: 'var(--color-surface, white)',
                                          border: '1px solid var(--color-border)',
                                          borderRadius: 8,
                                          padding: '10px 14px',
                                          fontSize: 13,
                                        }}
                                      >
                                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{h.address}</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                          {h.city}, {h.state} {h.zip_code}
                                          {h.year_built && <> &middot; Built {h.year_built}</>}
                                          {h.square_footage && <> &middot; {h.square_footage.toLocaleString()} sqft</>}
                                          {h.bedrooms > 0 && <> &middot; {h.bedrooms}bd/{h.bathrooms}ba</>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Tasks panel (spans both columns) */}
                              {detail.recentTasks && detail.recentTasks.length > 0 && (
                                <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                                  <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                                    Recent Tasks ({detail.recentTasks.length}{detail.taskCount > detail.recentTasks.length ? ` of ${detail.taskCount}` : ''})
                                  </h4>
                                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr 0.8fr 0.8fr 0.6fr', padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', background: 'var(--color-background)', borderBottom: '1px solid var(--color-border)' }}>
                                      <span>Title</span>
                                      <span>Category</span>
                                      <span>Status</span>
                                      <span>Due / Done</span>
                                      <span style={{ textAlign: 'right' }}>Cost</span>
                                    </div>
                                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                                      {detail.recentTasks.map(t => {
                                        const sc = STATUS_COLORS[t.status] || STATUS_COLORS.upcoming;
                                        const date = t.completed_date || t.due_date;
                                        const completedByPro = t.completed_by === 'pro' || !!t.created_by_pro_id;
                                        return (
                                          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 0.8fr 0.8fr 0.8fr 0.6fr', padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface, white)' }}>
                                            <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                              {t.title}
                                              {completedByPro && (
                                                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'var(--color-sage-muted, #E8F0EA)', color: 'var(--color-sage, #5B7E5A)' }}>Pro</span>
                                              )}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{t.category}</span>
                                            <span>
                                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.fg, textTransform: 'capitalize' }}>
                                                {t.status}
                                              </span>
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                              {date ? new Date(date).toLocaleDateString() : '\u2014'}
                                            </span>
                                            <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                                              {t.estimated_cost ? `$${t.estimated_cost}` : '\u2014'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '12px 0' }}>Failed to load details</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--color-border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ minWidth: 70 }}>Previous</button>
                <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ minWidth: 70 }}>Next</button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Refund / Credit Modal */}
      {billingModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="billing-modal-title"
          onClick={closeBillingModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-surface, white)',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
          >
            <h3 id="billing-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {billingModal.action === 'refund' ? 'Issue Refund' : 'Apply Credit'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 16px' }}>
              {billingModal.userLabel}
              {billingModal.action === 'refund'
                ? ' — refunds are processed by Stripe against the latest successful charge if no Charge ID is provided.'
                : ' — credit is applied to the customer\u2019s Stripe balance and consumed by the next invoice.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>Amount (USD)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={billingModal.amount}
                  onChange={e => setBillingModal({ ...billingModal, amount: e.target.value })}
                  style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 14 }}
                />
              </label>

              {billingModal.action === 'refund' && (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Charge ID (optional)</span>
                    <input
                      type="text"
                      placeholder="ch_... (leave blank to use latest successful charge)"
                      value={billingModal.chargeId}
                      onChange={e => setBillingModal({ ...billingModal, chargeId: e.target.value })}
                      style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 14 }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>Refund Reason</span>
                    <select
                      value={billingModal.refundReason}
                      onChange={e => setBillingModal({ ...billingModal, refundReason: e.target.value as RefundReason })}
                      style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 14 }}
                    >
                      <option value="requested_by_customer">Requested by customer</option>
                      <option value="duplicate">Duplicate charge</option>
                      <option value="fraudulent">Fraudulent</option>
                    </select>
                  </label>
                </>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>Internal Reason</span>
                <textarea
                  rows={3}
                  placeholder="What prompted this? (visible in audit log)"
                  value={billingModal.reason}
                  onChange={e => setBillingModal({ ...billingModal, reason: e.target.value })}
                  style={{ padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-sm" onClick={closeBillingModal} disabled={billingModal.submitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={submitBillingAction}
                disabled={billingModal.submitting}
              >
                {billingModal.submitting
                  ? 'Working\u2026'
                  : billingModal.action === 'refund' ? 'Issue Refund' : 'Apply Credit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: 'var(--color-surface, white)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: '6px 14px',
      textAlign: 'center',
      minWidth: 64,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--charcoal)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{label}</div>
    </div>
  );
}
