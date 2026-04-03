import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { Colors, StatusColors } from '@/constants/theme';

interface SupportTicket {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  user_id?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

const categoryColors: Record<string, string> = {
  general: '#9E9E9E40',
  bug: '#E539354D',
  billing: '#FF98004D',
  pro_issue: '#8B9E7E4D',
  pro_service: '#8B9E7E4D',
  account: '#2196F34D',
  feature: '#C4844E4D',
  other: '#9E9E9E4D',
};

const categoryTextColors: Record<string, string> = {
  general: '#616161',
  bug: '#C62828',
  billing: '#E65100',
  pro_issue: '#558B2F',
  pro_service: '#558B2F',
  account: '#01579B',
  feature: '#BF360C',
  other: '#616161',
};

const statusColorMap: Record<string, string> = {
  open: Colors.info,
  in_progress: Colors.warning,
  resolved: Colors.success,
  closed: Colors.silver,
};

export default function AdminSupportTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'status'>('created_at');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*');

        if (error) throw error;
        setTickets(data || []);
      } catch (error) {
        console.error('Failed to fetch support tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      const oldStatus = ticket?.status;

      const { error } = await supabase
        .from('support_tickets')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      setTickets(prev => prev.map(t =>
        t.id === ticketId
          ? { ...t, status: newStatus as any, updated_at: new Date().toISOString() }
          : t
      ));

      // Log the action
      logAdminAction('ticket.status_change', 'support_ticket', ticketId, {
        old_status: oldStatus,
        new_status: newStatus,
        email: ticket?.email
      }).catch(() => {});
    } catch (error: any) {
      alert('Failed to update status: ' + error.message);
    }
  };

  function formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const created = new Date(timestamp);
    const secondsAgo = Math.floor((now.getTime() - created.getTime()) / 1000);

    if (secondsAgo < 60) return 'just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)}d ago`;
    return created.toLocaleDateString();
  }

  function formatDate(timestamp: string): string {
    return new Date(timestamp).toLocaleDateString();
  }

  // Apply filters
  const filtered = tickets.filter(t => {
    // Status filter
    const statusMatch = statusFilter === 'all' || t.status === statusFilter;

    // Category filter
    const categoryMatch = categoryFilter === 'all' || t.category === categoryFilter;

    // Search filter: match name, email, or subject
    let searchMatch = true;
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      searchMatch =
        t.name.toLowerCase().includes(searchLower) ||
        t.email.toLowerCase().includes(searchLower) ||
        t.subject.toLowerCase().includes(searchLower);
    }

    return statusMatch && categoryMatch && searchMatch;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'created_at') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else {
      const statusOrder = { open: 0, in_progress: 1, resolved: 2, closed: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    }
  });

  const countByStatus = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const categories = ['general', 'bug', 'billing', 'pro_issue', 'pro_service', 'account', 'feature', 'other'];

  return (
    <div className="page-wide">
      <div className="mb-lg">
        <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/admin')}>&larr; Back</button>
        <h1>Support Tickets</h1>
        <p className="subtitle">{tickets.length} total tickets</p>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex gap-md mb-lg" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>Search</label>
          <input
            type="text"
            className="form-input"
            placeholder="Name, email, or subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
          />
        </div>
        <div style={{ minWidth: 150 }}>
          <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>Status</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div style={{ minWidth: 150 }}>
          <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>Category</label>
          <select
            className="form-select"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div style={{ minWidth: 120 }}>
          <label className="text-xs text-gray" style={{ display: 'block', marginBottom: 4 }}>Sort By</label>
          <select
            className="form-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{ width: '100%', padding: '6px 8px', fontSize: 13 }}
          >
            <option value="created_at">Newest First</option>
            <option value="status">By Status</option>
          </select>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="tabs mb-lg">
        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
          <button
            key={s}
            className={`tab ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')} ({countByStatus[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center"><div className="spinner" /></div>
      ) : (
        <div className="flex-col gap-md">
          {sorted.map(ticket => (
            <div key={ticket.id} className="card">
              {/* Header Row - Always Visible */}
              <div
                onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                style={{ cursor: 'pointer', paddingBottom: 12, borderBottom: expandedId === ticket.id ? `1px solid ${Colors.lightGray}` : 'none' }}
              >
                <div className="flex items-center justify-between mb-sm">
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{ticket.subject}</p>
                    <div className="flex items-center gap-sm" style={{ marginBottom: 8 }}>
                      <span
                        className="badge"
                        style={{
                          background: categoryColors[ticket.category] || categoryColors.other,
                          color: categoryTextColors[ticket.category] || categoryTextColors.other,
                          padding: '2px 8px',
                          fontSize: 11,
                          borderRadius: 4,
                          fontWeight: 600
                        }}
                      >
                        {ticket.category.replace(/_/g, ' ')}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: statusColorMap[ticket.status] + '20',
                          color: statusColorMap[ticket.status],
                          padding: '2px 8px',
                          fontSize: 11,
                          borderRadius: 4,
                          fontWeight: 600
                        }}
                      >
                        {ticket.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray">{ticket.name} • {ticket.email}</p>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 100 }}>
                    <p className="text-xs text-gray">{formatTimeAgo(ticket.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === ticket.id && (
                <div style={{ paddingTop: 12 }}>
                  {/* Full Message */}
                  <div style={{ marginBottom: 16, padding: '10px 12px', backgroundColor: Colors.cream, borderRadius: 6, borderLeft: `3px solid ${Colors.medGray}` }}>
                    <p className="text-xs text-gray" style={{ marginBottom: 4, fontWeight: 600 }}>Message</p>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: Colors.charcoal, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {ticket.message}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div style={{ marginBottom: 16, padding: '10px 12px', backgroundColor: Colors.warmWhite, borderRadius: 6 }}>
                    <div className="flex gap-lg" style={{ fontSize: 12, flexWrap: 'wrap' }}>
                      <div>
                        <p className="text-xs text-gray" style={{ fontWeight: 600 }}>Created</p>
                        <p style={{ color: Colors.charcoal }}>{formatDate(ticket.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray" style={{ fontWeight: 600 }}>Last Updated</p>
                        <p style={{ color: Colors.charcoal }}>{formatDate(ticket.updated_at)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray" style={{ fontWeight: 600 }}>User ID</p>
                        <p style={{ color: Colors.charcoal, fontFamily: 'monospace', fontSize: 11 }}>{ticket.user_id || '(not linked)'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  <div style={{ borderTop: `1px solid ${Colors.lightGray}`, paddingTop: 12 }}>
                    <p className="text-xs text-gray" style={{ fontWeight: 600, marginBottom: 8 }}>Admin Actions</p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label className="text-xs text-gray" style={{ fontWeight: 600 }}>Change Status:</label>
                      <select
                        className="form-select"
                        value={ticket.status}
                        onChange={e => handleStatusChange(ticket.id, e.target.value)}
                        style={{ width: 140, padding: '6px 8px', fontSize: 12 }}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {sorted.length === 0 && (
            <div className="empty-state">
              <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div>
              <h3>No tickets found</h3>
              {search || statusFilter !== 'all' || categoryFilter !== 'all' ? (
                <p className="text-sm text-gray">Try adjusting your filters</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
