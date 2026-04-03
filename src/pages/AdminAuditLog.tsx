import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

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
  'user.tier_change': '#A0826D',
  'user.delete': '#D32F2F',
  'user.create': '#2196F3',
  'agent.create': '#9C27B0',
  'agent.update': '#9C27B0',
  'agent.delete': '#D32F2F',
  'code.generate': '#2196F3',
  'code.redeem': '#4CAF50',
  'provider.update': '#FF9800',
  'provider.delete': '#D32F2F',
  'notification.broadcast': '#00BCD4',
  'request.assign': '#8BC34A',
};

export default function AdminAuditLog() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('last30d');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 200;

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
          .select('id, email')
          .in('id', adminIds);

        const emailMap = new Map(
          (profiles || []).map((p: any) => [p.id, p.email]),
        );

        const enrichedLogs = data.map((log) => ({
          ...log,
          admin_email: emailMap.get(log.admin_id) || 'Unknown',
        }));

        if (offset === 0) {
          setLogs(enrichedLogs);
        } else {
          setLogs((prev) => [...prev, ...enrichedLogs]);
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
    return ACTION_COLOR_MAP[action] || '#616161';
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function filterLogs(): AuditLog[] {
    if (!searchTerm) return logs;

    const term = searchTerm.toLowerCase();
    return logs.filter((log) => {
      return (
        log.action.toLowerCase().includes(term) ||
        log.entity_type.toLowerCase().includes(term) ||
        JSON.stringify(log.details).toLowerCase().includes(term) ||
        log.admin_email?.toLowerCase().includes(term)
      );
    });
  }

  const filteredLogs = filterLogs();

  return (
    <div style={{ padding: '20px', backgroundColor: '#fafafa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Admin Audit Log</h1>
        <button
          onClick={() => navigate('/admin')}
          style={{
            padding: '8px 16px',
            backgroundColor: Colors.copper,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Back to Admin
        </button>
      </div>

      {/* Controls */}
      <div
        style={{
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Search */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '500', color: '#666' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search action, entity, admin, or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          </div>

          {/* Date Range */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: '500', color: '#666' }}>
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value as DateRange);
                setOffset(0);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              <option value="today">Today</option>
              <option value="last7d">Last 7 Days</option>
              <option value="last30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: '#999' }}>
          Showing {filteredLogs.length} of {logs.length} logs
        </div>
      </div>

      {/* Table */}
      {loading && offset === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Loading...</div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No audit logs found</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#666',
                      backgroundColor: '#f5f5f5',
                      borderBottom: '2px solid #ddd',
                    }}
                  >
                    Timestamp
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#666',
                      backgroundColor: '#f5f5f5',
                      borderBottom: '2px solid #ddd',
                    }}
                  >
                    Admin
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#666',
                      backgroundColor: '#f5f5f5',
                      borderBottom: '2px solid #ddd',
                    }}
                  >
                    Action
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#666',
                      backgroundColor: '#f5f5f5',
                      borderBottom: '2px solid #ddd',
                    }}
                  >
                    Entity
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: '#666',
                      backgroundColor: '#f5f5f5',
                      borderBottom: '2px solid #ddd',
                    }}
                  >
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #eee', '&:hover': { backgroundColor: '#fafafa' } }}>
                    <td style={{ padding: '12px', color: '#333' }}>{formatTimestamp(log.created_at)}</td>
                    <td style={{ padding: '12px', color: '#333' }}>{log.admin_email}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          backgroundColor: getActionColor(log.action),
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: '#333' }}>
                      <div>
                        <div style={{ fontWeight: '500' }}>{log.entity_type}</div>
                        {log.entity_id && <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{log.entity_id}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {Object.entries(log.details).map(([key, value]) => (
                          <span
                            key={key}
                            style={{
                              backgroundColor: '#e8f5e9',
                              color: '#2e7d32',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '11px',
                              whiteSpace: 'nowrap',
                            }}
                            title={`${key}: ${JSON.stringify(value)}`}
                          >
                            {key}: {String(value).substring(0, 15)}
                            {String(value).length > 15 ? '...' : ''}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load More */}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                onClick={() => setOffset(offset + pageSize)}
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  backgroundColor: Colors.copper,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: loading ? 0.6 : 1,
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
