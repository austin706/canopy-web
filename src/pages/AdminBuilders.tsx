import { useEffect, useState } from 'react';
import { Colors } from '@/constants/theme';
import {
  getBuilderApplications,
  reviewBuilderApplication,
  getBuilders,
  type BuilderApplication,
  type Builder,
} from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { showToast } from '@/components/Toast';
import { useTabState } from '@/utils/useTabState';
import logger from '@/utils/logger';

const BUILDER_TABS = ['applications', 'active'] as const;
type Tab = typeof BUILDER_TABS[number];

export default function AdminBuilders() {
  const { user } = useStore();
  // P3 #77 (2026-04-23) — URL-sync tab so back-button + deep-link work.
  const [tab, setTab] = useTabState<Tab>(BUILDER_TABS, 'applications');
  const [applications, setApplications] = useState<BuilderApplication[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const load = async () => {
    setLoading(true);
    try {
      const [apps, blds] = await Promise.all([
        getBuilderApplications(statusFilter || undefined),
        getBuilders(),
      ]);
      setApplications(apps);
      setBuilders(blds);
    } catch (err) {
      logger.error('Failed to load builder data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const handleReview = async (id: string, decision: 'approved' | 'rejected') => {
    if (!user?.id) return;
    if (!confirm(`${decision === 'approved' ? 'Approve' : 'Reject'} this application?`)) return;
    try {
      await reviewBuilderApplication(id, decision, user.id, notes || undefined);
      setReviewing(null);
      setNotes('');
      await load();
    } catch (err: any) {
      showToast({ message: `Review failed: ${err.message || err}` });
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: Colors.charcoal, margin: '0 0 8px 0' }}>
          Builder Partners
        </h1>
        <p style={{ color: Colors.medGray, margin: 0 }}>
          Review applications and manage active home-builder partners.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${Colors.lightGray}`, marginBottom: 24 }}>
        {(['applications', 'active'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '12px 20px',
              border: 'none',
              backgroundColor: 'transparent',
              color: tab === t ? Colors.sage : Colors.medGray,
              borderBottom: tab === t ? `3px solid ${Colors.sage}` : '3px solid transparent',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {t === 'applications' ? `Applications (${applications.length})` : `Active Builders (${builders.length})`}
          </button>
        ))}
      </div>

      {tab === 'applications' && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: Colors.medGray, display: 'flex', alignItems: 'center', gap: 8 }}>
              Status:
              <select
                className="form-input"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ maxWidth: 160 }}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p style={{ color: Colors.medGray }}>Loading…</p>
          ) : applications.length === 0 ? (
            <EmptyState message="No applications match the current filter." />
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {applications.map(app => (
                <div key={app.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: Colors.charcoal }}>
                        {app.company_name}
                      </h3>
                      <p style={{ margin: '4px 0 0 0', color: Colors.medGray, fontSize: 14 }}>
                        {app.full_name} · {app.email}{app.phone ? ` · ${app.phone}` : ''}
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 13, color: Colors.charcoal }}>
                    {app.license_number && <Cell label="License" value={`${app.license_number}${app.license_state ? ` (${app.license_state})` : ''}`} />}
                    {app.years_in_business != null && <Cell label="Years" value={String(app.years_in_business)} />}
                    {app.annual_home_volume != null && <Cell label="Homes/yr" value={String(app.annual_home_volume)} />}
                    {app.price_range && <Cell label="Price" value={app.price_range} />}
                    {app.primary_markets && <Cell label="Markets" value={app.primary_markets} />}
                    {app.service_area_zips && app.service_area_zips.length > 0 && (
                      <Cell label="ZIPs" value={app.service_area_zips.slice(0, 6).join(', ') + (app.service_area_zips.length > 6 ? '…' : '')} />
                    )}
                  </div>

                  {app.home_types && app.home_types.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {app.home_types.map(t => (
                        <span key={t} style={chipStyle}>{t.replace('_', ' ')}</span>
                      ))}
                    </div>
                  )}

                  {app.bio && (
                    <p style={{ marginTop: 12, marginBottom: 0, color: Colors.medGray, fontSize: 13, lineHeight: 1.5 }}>
                      {app.bio}
                    </p>
                  )}

                  {app.status === 'pending' && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${Colors.lightGray}` }}>
                      {reviewing === app.id ? (
                        <div>
                          <textarea
                            className="form-input"
                            placeholder="Review notes (optional)"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            style={{ width: '100%', marginBottom: 12, fontFamily: 'inherit', resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" onClick={() => handleReview(app.id, 'approved')}>
                              Approve
                            </button>
                            <button
                              className="btn"
                              style={{ backgroundColor: Colors.error, color: 'var(--color-white)' }}
                              onClick={() => handleReview(app.id, 'rejected')}
                            >
                              Reject
                            </button>
                            <button className="btn btn-secondary" onClick={() => { setReviewing(null); setNotes(''); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn btn-primary" onClick={() => setReviewing(app.id)}>
                          Review
                        </button>
                      )}
                    </div>
                  )}

                  {app.review_notes && (
                    <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: Colors.medGray, fontStyle: 'italic' }}>
                      Notes: {app.review_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'active' && (
        <>
          {loading ? (
            <p style={{ color: Colors.medGray }}>Loading…</p>
          ) : builders.length === 0 ? (
            <EmptyState message="No active builders yet. Approve an application to create one." />
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {builders.map(b => (
                <div key={b.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: Colors.charcoal }}>
                        {b.company_name}
                      </h3>
                      <p style={{ margin: '4px 0 0 0', color: Colors.medGray, fontSize: 14 }}>
                        {b.contact_name ? `${b.contact_name} · ` : ''}{b.email}
                      </p>
                      {b.slug && (
                        <p style={{ margin: '4px 0 0 0', color: Colors.sage, fontSize: 13, fontFamily: 'monospace' }}>
                          canopyhome.app/b/{b.slug}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  border: `1px solid ${Colors.lightGray}`,
  borderRadius: 12,
  padding: 20,
};

const chipStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 10px',
  borderRadius: 12,
  backgroundColor: Colors.copper + '20',
  color: Colors.copper,
  textTransform: 'capitalize',
  fontWeight: 500,
};

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: Colors.medGray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: Colors.charcoal, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    pending: { bg: '#fef3c7', fg: '#b45309' },
    approved: { bg: '#d1fae5', fg: '#047857' },
    rejected: { bg: '#fee2e2', fg: '#b91c1c' },
    withdrawn: { bg: '#e5e7eb', fg: '#4b5563' },
    active: { bg: '#d1fae5', fg: '#047857' },
    paused: { bg: '#fef3c7', fg: '#b45309' },
    offboarded: { bg: '#e5e7eb', fg: '#4b5563' },
  };
  const c = map[status] || { bg: '#e5e7eb', fg: '#4b5563' };
  return (
    <span style={{
      fontSize: 11,
      padding: '4px 10px',
      borderRadius: 12,
      backgroundColor: c.bg,
      color: c.fg,
      textTransform: 'uppercase',
      fontWeight: 700,
      letterSpacing: 0.5,
    }}>
      {status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding: '60px 20px',
      textAlign: 'center',
      color: Colors.medGray,
      backgroundColor: '#fff',
      border: `1px dashed ${Colors.lightGray}`,
      borderRadius: 12,
    }}>
      {message}
    </div>
  );
}
