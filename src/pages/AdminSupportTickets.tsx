import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { Colors, StatusColors } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';
import { showToast } from '@/components/Toast';

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
  device_info?: {
    browser?: string;
    os?: string;
    platform?: string;
    screen?: string;
    viewport?: string;
    pixel_ratio?: number;
    user_agent?: string;
    os_version?: string;
    app_version?: string;
    device_model?: string;
    sdk_version?: string;
  } | null;
  screenshot_url?: string | null;
  steps_to_reproduce?: string | null;
  app_version?: string | null;
  priority?: string | null;
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

      logAdminAction('ticket.status_change', 'support_ticket', ticketId, {
        old_status: oldStatus,
        new_status: newStatus,
        email: ticket?.email
      }).catch(() => {});
    } catch (error: any) {
      showToast({ message: 'Failed to update status: ' + error.message });
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
    const statusMatch = statusFilter === 'all' || t.status === statusFilter;

    let searchMatch = true;
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      searchMatch =
        t.name.toLowerCase().includes(searchLower) ||
        t.email.toLowerCase().includes(searchLower) ||
        t.subject.toLowerCase().includes(searchLower);
    }

    return statusMatch && searchMatch;
  });

  // Sort by created date
  const sorted = [...filtered].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const countByStatus = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h1>Support Tickets</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: Colors.medGray }}>
            View and manage customer support tickets.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="admin-table-toolbar" style={{ marginBottom: 24 }}>
        <input
          type="text"
          aria-label="Search support tickets"
          className="admin-search"
          placeholder="Search by name, email, or subject..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Status Tabs */}
      <div className="admin-tabs" style={{ marginBottom: 24 }}>
        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
          <button
            key={s}
            className={`admin-tab ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ').charAt(0).toUpperCase() + s.replace(/_/g, ' ').slice(1)} ({countByStatus[s]})
          </button>
        ))}
      </div>

      {/* Tickets Table */}
      {loading ? (
        <div className="page-wide"><PageSkeleton rows={6} /></div>
      ) : sorted.length === 0 ? (
        <div className="admin-empty" style={{ textAlign: 'center', padding: 40 }}>
          <p>No tickets found.</p>
          {search || statusFilter !== 'all' ? (
            <p style={{ fontSize: 13, color: Colors.medGray }}>Try adjusting your filters.</p>
          ) : null}
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table style={{ width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border-color)` }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: Colors.medGray, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Name
                </th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: Colors.medGray, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Subject
                </th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: Colors.medGray, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Category
                </th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: Colors.medGray, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Status
                </th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, color: Colors.medGray, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ticket, idx) => (
                <tr
                  key={ticket.id}
                  onClick={() => setExpandedId(expandedId === ticket.id ? null : ticket.id)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: `1px solid var(--border-color)`,
                    background: expandedId === ticket.id ? Colors.cream : 'transparent',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{ticket.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{ticket.subject}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>
                    <span
                      className="admin-status"
                      style={{
                        background: categoryColors[ticket.category] || categoryColors.other,
                        color: categoryTextColors[ticket.category] || categoryTextColors.other,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                        display: 'inline-block',
                      }}
                    >
                      {ticket.category.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12 }}>
                    <span
                      className="admin-status"
                      style={{
                        background: statusColorMap[ticket.status] + '20',
                        color: statusColorMap[ticket.status],
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                        display: 'inline-block',
                      }}
                    >
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: Colors.medGray }}>
                    {formatTimeAgo(ticket.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expanded Details Modal/Drawer */}
      {expandedId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 24,
            maxWidth: 600,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            {(() => {
              const ticket = tickets.find(t => t.id === expandedId);
              if (!ticket) return null;
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                      {ticket.subject}
                    </h2>
                    <button
                      onClick={() => setExpandedId(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 20,
                        cursor: 'pointer',
                        color: Colors.silver,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Full Message */}
                  <div style={{ marginBottom: 16, padding: '12px', backgroundColor: Colors.copperMuted, borderRadius: 6, borderLeft: `3px solid ${Colors.copper}` }}>
                    <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                      Message
                    </p>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: Colors.charcoal, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                      {ticket.message}
                    </p>
                  </div>

                  {/* Steps to Reproduce (bug reports) */}
                  {ticket.steps_to_reproduce && (
                    <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#FFF8E1', borderRadius: 6, borderLeft: '3px solid #FFE082' }}>
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                        Steps to Reproduce
                      </p>
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: Colors.charcoal, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                        {ticket.steps_to_reproduce}
                      </p>
                    </div>
                  )}

                  {/* Screenshot (bug reports) */}
                  {ticket.screenshot_url && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 8px 0', fontWeight: 600 }}>
                        Screenshot
                      </p>
                      <div style={{ fontSize: 12, color: Colors.medGray, background: Colors.lightGray, padding: 8, borderRadius: 4 }}>
                        Stored at: <code style={{ fontSize: 11 }}>{ticket.screenshot_url}</code>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div style={{ marginBottom: 16, padding: '12px', backgroundColor: Colors.lightGray, borderRadius: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 12 }}>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          Created
                        </p>
                        <p style={{ color: Colors.charcoal, margin: 0 }}>{formatDate(ticket.created_at)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          Last Updated
                        </p>
                        <p style={{ color: Colors.charcoal, margin: 0 }}>{ticket.updated_at ? formatDate(ticket.updated_at) : '—'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          User ID
                        </p>
                        <p style={{ color: Colors.charcoal, margin: 0, fontFamily: 'monospace', fontSize: 11 }}>
                          {ticket.user_id || '(not linked)'}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                          Email
                        </p>
                        <p style={{ color: Colors.charcoal, margin: 0, fontSize: 12 }}>{ticket.email}</p>
                      </div>
                      {ticket.app_version && (
                        <div>
                          <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                            App Version
                          </p>
                          <p style={{ color: Colors.charcoal, margin: 0 }}>{ticket.app_version}</p>
                        </div>
                      )}
                      {ticket.priority && ticket.priority !== 'normal' && (
                        <div>
                          <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 4px 0', fontWeight: 600 }}>
                            Priority
                          </p>
                          <p style={{ color: ticket.priority === 'urgent' || ticket.priority === 'high' ? Colors.error : Colors.charcoal, margin: 0, fontWeight: 600 }}>
                            {ticket.priority.toUpperCase()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Device Info (bug reports) */}
                  {ticket.device_info && (
                    <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#E8F5E9', borderRadius: 6, borderLeft: '3px solid #81C784' }}>
                      <p style={{ fontSize: 11, color: Colors.medGray, margin: '0 0 8px 0', fontWeight: 600 }}>
                        Device Info
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 12 }}>
                        {ticket.device_info.browser && (
                          <div><span style={{ color: Colors.medGray }}>Browser:</span> {ticket.device_info.browser}</div>
                        )}
                        {ticket.device_info.os && (
                          <div><span style={{ color: Colors.medGray }}>OS:</span> {ticket.device_info.os}</div>
                        )}
                        {ticket.device_info.platform && (
                          <div><span style={{ color: Colors.medGray }}>Platform:</span> {ticket.device_info.platform}</div>
                        )}
                        {ticket.device_info.screen && (
                          <div><span style={{ color: Colors.medGray }}>Screen:</span> {ticket.device_info.screen}</div>
                        )}
                        {ticket.device_info.viewport && (
                          <div><span style={{ color: Colors.medGray }}>Viewport:</span> {ticket.device_info.viewport}</div>
                        )}
                        {ticket.device_info.device_model && (
                          <div><span style={{ color: Colors.medGray }}>Device:</span> {ticket.device_info.device_model}</div>
                        )}
                        {ticket.device_info.os_version && (
                          <div><span style={{ color: Colors.medGray }}>OS Version:</span> {ticket.device_info.os_version}</div>
                        )}
                      </div>
                      {ticket.device_info.user_agent && (
                        <div style={{ marginTop: 8, fontSize: 10, color: Colors.medGray, wordBreak: 'break-all' }}>
                          UA: {ticket.device_info.user_agent}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Actions */}
                  <div style={{ borderTop: `1px solid var(--border-color)`, paddingTop: 12 }}>
                    <label style={{ fontSize: 11, color: Colors.medGray, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                      Change Status
                    </label>
                    <select
                      className="form-select"
                      value={ticket.status}
                      onChange={e => handleStatusChange(ticket.id, e.target.value)}
                      style={{ width: '100%', padding: '8px', fontSize: 13, marginBottom: 16 }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>

                    <button
                      className="btn btn-ghost"
                      onClick={() => setExpandedId(null)}
                      style={{ width: '100%' }}
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
