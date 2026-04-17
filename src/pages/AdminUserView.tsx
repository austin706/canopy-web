/**
 * Admin "View As" — read-only snapshot of a homeowner's account for support triage.
 *
 * Not true impersonation (no auth swap — that would require RLS changes).
 * Instead, admin-authenticated queries (which already bypass owner RLS via
 * admin policies) load the target user's data and render a mirror of the
 * homeowner dashboard. Purpose: debug support tickets without asking the user
 * to share their screen.
 *
 * Actions limited to read + admin-originated writes (flag, note, reset). Any
 * homeowner-originated write here would be misleading, so CTAs are disabled.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase, getUserDetailData } from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { Colors } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { PageSkeleton } from '@/components/Skeleton';
import logger from '@/utils/logger';

interface TargetUser {
  id: string;
  email: string;
  full_name: string | null;
  subscription_tier: string;
  role: string;
  created_at: string;
  phone: string | null;
  last_active_at: string | null;
}

interface UserDetail {
  homes: Array<{ id: string; address: string; city: string; state: string; zip_code: string; year_built: number | null; square_footage: number | null; bedrooms: number; bathrooms: number }>;
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

export default function AdminUserView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: adminUser } = useStore();

  const [target, setTarget] = useState<TargetUser | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentVisits, setRecentVisits] = useState<Array<{ id: string; scheduled_date: string; status: string; home_id: string }>>([]);
  const [recentDocs, setRecentDocs] = useState<Array<{ id: string; title: string; type: string; created_at: string }>>([]);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      try {
        const [{ data: prof, error: profErr }, det] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, full_name, subscription_tier, role, created_at, phone, last_active_at')
            .eq('id', userId)
            .single(),
          getUserDetailData(userId),
        ]);
        if (profErr) throw profErr;
        setTarget(prof as TargetUser);
        setDetail(det);

        // Recent visits + recent documents across all the user's homes
        const homeIds = (det?.homes || []).map((h: any) => h.id);
        if (homeIds.length) {
          const [{ data: vs }, { data: ds }] = await Promise.all([
            supabase
              .from('service_visits')
              .select('id, scheduled_date, status, home_id')
              .in('home_id', homeIds)
              .order('scheduled_date', { ascending: false })
              .limit(10),
            supabase
              .from('documents')
              .select('id, title, type, created_at')
              .in('home_id', homeIds)
              .order('created_at', { ascending: false })
              .limit(10),
          ]);
          setRecentVisits((vs || []) as any);
          setRecentDocs((ds || []) as any);
        }

        // Audit: record that an admin viewed this user's snapshot.
        if (adminUser?.id) {
          logAdminAction('user_view_as', 'user', userId, { surface: 'AdminUserView' })
            .catch((e) => logger.warn('admin audit log failed', e));
        }
      } catch (err: any) {
        logger.error('AdminUserView load failed', err);
        showToast({ message: err?.message || 'Failed to load user snapshot' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, adminUser?.id]);

  if (loading) return <PageSkeleton />;

  if (!target) {
    return (
      <div style={{ padding: 24 }}>
        <p>User not found.</p>
        <Link to="/admin/users">← Back to users</Link>
      </div>
    );
  }

  const tierPill = (tier: string) => (
    <span style={{
      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: tier === 'free' ? Colors.lightGray : Colors.sage + '22',
      color: tier === 'free' ? Colors.medGray : Colors.sage,
      textTransform: 'uppercase',
    }}>{tier}</span>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* View-As banner */}
      <div
        style={{
          background: Colors.warning + '15',
          border: `1px dashed ${Colors.warning}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: Colors.charcoal }}>
            Viewing as {target.full_name || target.email} (read-only)
          </div>
          <div style={{ fontSize: 12, color: Colors.medGray }}>
            Admin snapshot — writes are disabled. All views here are audited.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/users')}>
            ← Back to users
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/admin/users?focus=${target.id}`)}
          >
            Open in AdminUsers
          </button>
        </div>
      </div>

      {/* Profile */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ margin: 0, marginBottom: 12 }}>{target.full_name || '(no name)'}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="Email" value={target.email} />
          <Field label="Phone" value={target.phone || '—'} />
          <Field label="Role" value={target.role || 'user'} />
          <Field label="Tier" value={tierPill(target.subscription_tier || 'free')} />
          <Field label="Signed up" value={new Date(target.created_at).toLocaleDateString()} />
          <Field label="Last active" value={target.last_active_at ? new Date(target.last_active_at).toLocaleDateString() : '—'} />
          <Field label="Linked agent" value={detail?.agent ? `${detail.agent.name} (${detail.agent.brokerage})` : 'None'} />
          <Field label="Gift code" value={detail?.giftCodeDetails?.code || detail?.giftCode || 'None'} />
        </div>
      </div>

      {/* Homes */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 12 }}>Homes ({detail?.homes.length || 0})</h3>
        {detail?.homes.length === 0 ? (
          <p style={{ color: Colors.medGray, margin: 0 }}>No homes on file.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {detail?.homes.map((h) => (
              <div key={h.id} style={{ padding: 12, border: `1px solid ${Colors.lightGray}`, borderRadius: 8 }}>
                <div style={{ fontWeight: 600 }}>{h.address}</div>
                <div style={{ color: Colors.medGray, fontSize: 13 }}>
                  {h.city}, {h.state} {h.zip_code} · Built {h.year_built || '—'} · {h.square_footage?.toLocaleString() || '—'} sqft · {h.bedrooms} bed / {h.bathrooms} bath
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, color: Colors.medGray, fontSize: 13 }}>
          {detail?.equipmentCount || 0} equipment · {detail?.taskCount || 0} tasks · {detail?.logCount || 0} logs
        </div>
      </div>

      {/* Recent tasks */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 12 }}>
          Recent tasks ({detail?.recentTasks?.length || 0}{detail && detail.taskCount > (detail.recentTasks?.length || 0) ? ` of ${detail.taskCount}` : ''})
        </h3>
        {!detail?.recentTasks?.length ? (
          <p style={{ color: Colors.medGray, margin: 0 }}>No tasks found.</p>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${Colors.lightGray}` }}>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Priority</th>
                <th style={thStyle}>Due</th>
                <th style={thStyle}>Completed</th>
              </tr>
            </thead>
            <tbody>
              {detail.recentTasks.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${Colors.lightGray}` }}>
                  <td style={tdStyle}>{t.title}</td>
                  <td style={tdStyle}>{t.status}</td>
                  <td style={tdStyle}>{t.priority}</td>
                  <td style={tdStyle}>{t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</td>
                  <td style={tdStyle}>{t.completed_date ? new Date(t.completed_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent visits */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 12 }}>Recent visits ({recentVisits.length})</h3>
        {!recentVisits.length ? (
          <p style={{ color: Colors.medGray, margin: 0 }}>No visits scheduled.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {recentVisits.map((v) => (
              <li key={v.id} style={{ marginBottom: 4 }}>
                {new Date(v.scheduled_date).toLocaleDateString()} — {v.status}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent documents */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 12 }}>Recent documents ({recentDocs.length})</h3>
        {!recentDocs.length ? (
          <p style={{ color: Colors.medGray, margin: 0 }}>No documents uploaded.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {recentDocs.map((d) => (
              <li key={d.id} style={{ marginBottom: 4 }}>
                <strong>{d.title}</strong> <span style={{ color: Colors.medGray }}>({d.type}) · {new Date(d.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 6px', fontSize: 12, color: Colors.medGray, textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '6px', verticalAlign: 'top' };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: Colors.medGray, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500, color: Colors.charcoal }}>{value}</div>
    </div>
  );
}
