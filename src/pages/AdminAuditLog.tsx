import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
  admin_email?: string;
}

type DateRange = 'today' | 'last7d' | 'last30d' | 'all';

const ACTION_COLOR_MAP: Record<string, string> = {
  'user.tier_change': Colors.copper,
  'user.delete': Colors.error,
  'user.create': Colors.info,
  'agent.create': '#9C27B0',
  'agent.update': '#9C27B0',
  'agent.delete': Colors.error,
  'code.generate': Colors.info,
  'code.redeem': Colors.success,
  'provider.update': '#FF9800',
  'provider.delete': Colors.error,
  'notification.broadcast': '#00BCD4',
  'request.assign': '#8BC34A',
};

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('last30d');
  const [actionFilter, setActionFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 50;

  useEffect(() => {
    fetchLogs();
  }, [dateRange, offset]);

  async function fetchLogs() {
    try {
      setLoading(true);

      // Calculate date range
      const now = new Date();
      let fromDate = new Date();
      switch (dateRange) {
        case 'today':
          fromDate.setHours(0, 0, 0, 0);
          break;
        case 'last7d':
          fromDate.setDate(fromDate.getDate() - 7);
          break;
        case 'last30d':
          fromDate.setDate(fromDate.getDate() - 30);
          break;
        case 'all':
          fromDate = new Date('2000-01-01');
          break;
      }

      let query = supabase
        .from('admin_audit_log')
        .select('*')
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      const { data, error } = await query;

      if (error) throw error;

      // Fetch admin profiles and map emails
      if (data && data.length > 0) {
        const adminIds = [...new Set(data.map((log) => log.admin_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', adminIds);

        const emailMap = new Map(
          (profiles || []).map((p: any) => [p.id, { email: p.email, name: p.full_name }])
        );

        const enrichedLogs = data.map((log) => ({
          ...log,
          admin_email: emailMap.get(log.admin_id)?.email || 'Unknown',
          admin_name: emailMap.get(log.admin_id)?.name || 'Unknown',
        })) as (AuditLog & { admin_name: string })[];

        if (offset === 0) {
          setLogs(enrichedLogs as AuditLog[]);
        } else {
          setLogs((prev) => [...prev, ...(enrichedLogs as AuditLog[])]);
        }

        setHasMore(data.length === pageSize);
      } else {
        if (offset === 0) setLogs([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function getActionColor(action: string): string {
    return ACTION_COLOR_MAP[action] || Colors.charcoal;
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function filterLogs(): AuditLog[] {
    return logs.filter((log) => {
      const matchesSearch =
        !searchTerm ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.admin_email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction = !actionFilter || log.action === actionFilter;

      return matchesSearch && matchesAction;
    });
  }

  const filteredLogs = filterLogs();
  const uniqueActions = [...new Set(logs.map((l) => l.action))].sort();

  return (
    <div className="page-wide">
      {/* Page Header */}
      <div className="admin-page-header">
        <h1>Audit Log</h1>
      </div>

      {/* Toolbar */}
      <div className="admin-table-toolbar">
        {/* Search Input */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1 }}>
          <input
            type="text"
            aria-label="Search audit log"
            placeholder="Search action, entity, admin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-search"
            style={{ flex: 1 }}
          />
        </div>

        {/* Date Range Buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'last7d', label: '7d' },
              { id: 'last30d', label: '30d' },
              { id: 'all', label: 'All' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setDateRange(opt.id);
                setOffset(0);
                setExpandedId(null);
              }}
              style={{
                padding: '8px 12px',
                border: dateRange === opt.id ? `2px solid ${Colors.copper}` : `1px solid ${Colors.lightGray}`,
                background: dateRange === opt.id ? Colors.copper + '10' : 'transparent',
                color: dateRange === opt.id ? Colors.copper : Colors.charcoal,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Action Type Filter */}
        {uniqueActions.length > 0 && (
          <select
            aria-label="Filter by action type"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="admin-filter-select"
            style={{
              padding: '8px 12px',
              border: `1px solid ${Colors.lightGray}`,
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            <option value="">All Actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {loading && offset === 0 ? (
        <div className="page-wide">
          <PageSkeleton rows={6} />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="admin-empty">
          <p>No audit logs found</p>
        </div>
      ) : (
        <>
          <div className="admin-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>Timestamp</th>
                  <th style={{ width: '140px' }}>Admin</th>
                  <th style={{ width: '140px' }}>Action</th>
                  <th style={{ width: '100px' }}>Entity Type</th>
                  <th style={{ width: '120px' }}>Entity ID</th>
                  <th style={{ flex: 1 }}>Details</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <>
                    <tr key={log.id} style={{ cursor: 'pointer' }}>
                      <td style={{ fontSize: 12 }}>
                        {formatTimestamp(log.created_at)}
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 500 }}>
                        {log.admin_email}
                      </td>
                      <td>
                        <span
                          className="admin-status"
                          style={{
                            background: getActionColor(log.action) + '20',
                            color: getActionColor(log.action),
                            padding: '4px 10px',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {log.entity_type}
                      </td>
                      <td style={{ fontSize: 12, color: Colors.medGray, fontFamily: 'monospace' }}>
                        {log.entity_id ? log.entity_id.substring(0, 12) + '...' : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: Colors.medGray }}>
                        {Object.keys(log.details).length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {Object.entries(log.details).slice(0, 2).map(([key]) => (
                              <span
                                key={key}
                                style={{
                                  background: Colors.charcoal + '08',
                                  padding: '2px 6px',
                                  borderRadius: 3,
                                  fontSize: 11,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {key}
                              </span>
                            ))}
                            {Object.keys(log.details).length > 2 && (
                              <span style={{ fontSize: 11, color: Colors.medGray }}>
                                +{Object.keys(log.details).length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 16,
                            color: Colors.medGray,
                            padding: '4px 8px',
                          }}
                        >
                          {expandedId === log.id ? '−' : '+'}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {expandedId === log.id && (
                      <tr style={{ background: Colors.charcoal + '02' }}>
                        <td colSpan={7} style={{ padding: 16 }}>
                          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 600 }}>
                              Full Details
                            </h4>
                            <pre
                              style={{
                                background: Colors.charcoal + '05',
                                padding: 12,
                                borderRadius: 4,
                                fontSize: 11,
                                margin: 0,
                                overflow: 'auto',
                                fontFamily: 'monospace',
                              }}
                            >
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button
                onClick={() => setOffset(offset + pageSize)}
                disabled={loading}
                className="btn btn-secondary"
                style={{
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
