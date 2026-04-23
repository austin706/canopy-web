import { useState, useEffect } from 'react';
import { getPendingVerifications, getAllVerifications, reviewOwnershipVerification, supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import type { Home } from '@/types';
import { useTabState } from '@/utils/useTabState';
import logger from '@/utils/logger';

const VERIFICATION_TABS = ['pending', 'all'] as const;
type Tab = typeof VERIFICATION_TABS[number];

// P2 #56 (2026-04-23): Minimal owner-profile snapshot so admin can cross-reference
// the uploaded documents against the account holder's name + email.
type OwnerSnapshot = {
  full_name: string | null;
  email: string | null;
  created_at?: string | null;
};

export default function AdminVerifications() {
  // P3 #77 (2026-04-23) — URL-sync tab so back-button + deep-link work.
  const [tab, setTab] = useTabState<Tab>(VERIFICATION_TABS, 'pending');
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  // P2 #56 (2026-04-23): map of userId -> owner profile for the diff panel.
  const [owners, setOwners] = useState<Record<string, OwnerSnapshot>>({});

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = tab === 'pending'
        ? await getPendingVerifications()
        : await getAllVerifications();
      setHomes(data);
      // P2 #56 (2026-04-23): batch-fetch owner profiles for the diff panel.
      const userIds = Array.from(new Set((data || []).map(h => h.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, full_name, email, created_at')
          .in('id', userIds);
        const map: Record<string, OwnerSnapshot> = {};
        for (const p of profileRows || []) {
          map[p.id] = {
            full_name: p.full_name || null,
            email: p.email || null,
            created_at: p.created_at || null,
          };
        }
        setOwners(map);
      }
    } catch (err: any) {
      logger.error('Failed to load verifications:', err);
      setMessage('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (homeId: string, decision: 'verified' | 'rejected') => {
    setActionId(homeId);
    try {
      await reviewOwnershipVerification(homeId, decision, reviewNotes || undefined);
      setMessage(`Home ${decision === 'verified' ? 'approved' : 'rejected'} successfully.`);
      setReviewingId(null);
      setReviewNotes('');
      // Refresh data
      await loadData();
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      setMessage('Failed to review: ' + (err.message || 'Unknown error'));
    } finally {
      setActionId(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(139,158,126,0.15)', color: Colors.sageDark }}>Verified</span>;
      case 'pending':
        return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: Colors.warning }}>Pending</span>;
      case 'rejected':
        return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(220,38,38,0.1)', color: Colors.error }}>Rejected</span>;
      default:
        return null;
    }
  };

  const getDocUrls = (home: Home): string[] => {
    const raw = (home as any).ownership_documents_url;
    if (!raw) return [];
    return raw.split(',').filter(Boolean);
  };

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1>Ownership Verifications</h1>
          <p className="subtitle">Review homeowner identity and address verification documents</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('pending')}
        >
          Pending Review
        </button>
        <button
          className={`btn ${tab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('all')}
        >
          All Verifications
        </button>
      </div>

      {message && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          background: message.includes('Failed') ? 'rgba(220,38,38,0.08)' : Colors.sageMuted,
          color: message.includes('Failed') ? '#dc2626' : Colors.sageDark,
          fontSize: 14,
          marginBottom: 16,
          border: `1px solid ${message.includes('Failed') ? 'rgba(220,38,38,0.2)' : Colors.sage}`,
        }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p className="text-gray">Loading...</p>
        </div>
      ) : homes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>&#x2713;</p>
          <p className="text-gray">
            {tab === 'pending' ? 'No pending verifications' : 'No verifications submitted yet'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {homes.map(home => (
            <div
              key={home.id}
              className="card"
              style={{
                padding: 20,
                borderLeft: `4px solid ${
                  home.ownership_verification_status === 'verified' ? Colors.sage
                  : home.ownership_verification_status === 'rejected' ? '#dc2626'
                  : Colors.copper
                }`,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                    {home.address || 'No address'}
                  </p>
                  <p className="text-sm text-gray">
                    {home.city}, {home.state} {home.zip_code}
                  </p>
                </div>
                {statusBadge(home.ownership_verification_status || 'none')}
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12, fontSize: 13 }}>
                <div>
                  <span className="text-gray">Method: </span>
                  <span style={{ fontWeight: 500 }}>
                    {home.ownership_verification_method === 'document_upload' ? 'Document Upload'
                      : home.ownership_verification_method === 'title_company' ? 'Title Company'
                      : home.ownership_verification_method === 'manual' ? 'Manual'
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray">Submitted: </span>
                  <span style={{ fontWeight: 500 }}>
                    {home.ownership_verification_date
                      ? new Date(home.ownership_verification_date).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray">Home ID: </span>
                  <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 11 }}>
                    {home.id.slice(0, 8)}...
                  </span>
                </div>
                <div>
                  <span className="text-gray">User ID: </span>
                  <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 11 }}>
                    {home.user_id?.slice(0, 8)}...
                  </span>
                </div>
              </div>

              {/* Admin notes (if any) */}
              {home.ownership_verification_notes && (
                <div style={{ padding: 10, background: 'var(--color-background)', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                  <span className="text-gray">Notes: </span>{home.ownership_verification_notes}
                </div>
              )}

              {/* P2 #56 (2026-04-23): Verification snapshot — what the admin must
                  cross-reference against the uploaded documents. Surfaces owner
                  identity, claimed property details, and temporal flags (e.g.,
                  home was created <7 days before verification request, or user
                  account is brand new) so admins catch fraud vectors at a glance. */}
              {(() => {
                const owner = home.user_id ? owners[home.user_id] : undefined;
                const verDate = home.ownership_verification_date
                  ? new Date(home.ownership_verification_date)
                  : null;
                const homeCreated = home.created_at ? new Date(home.created_at as string) : null;
                const ownerCreated = owner?.created_at ? new Date(owner.created_at) : null;
                const daysBetween = (a: Date | null, b: Date | null) =>
                  a && b ? Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)) : null;
                const homeAgeDays = daysBetween(verDate, homeCreated);
                const accountAgeDays = daysBetween(verDate, ownerCreated);
                const flags: string[] = [];
                if (homeAgeDays !== null && homeAgeDays < 7) {
                  flags.push(`Home record was created only ${homeAgeDays} day${homeAgeDays === 1 ? '' : 's'} before verification.`);
                }
                if (accountAgeDays !== null && accountAgeDays < 14) {
                  flags.push(`User account is ${accountAgeDays} day${accountAgeDays === 1 ? '' : 's'} old.`);
                }
                if (!owner?.full_name) {
                  flags.push('Homeowner has no full_name on profile — match name on documents to email domain.');
                }
                return (
                  <div
                    style={{
                      padding: 12,
                      background: 'rgba(139,158,126,0.06)',
                      borderRadius: 8,
                      border: `1px solid ${Colors.sageMuted}`,
                      marginBottom: 12,
                      fontSize: 13,
                    }}
                  >
                    <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.sageDark }}>
                      Verify Against Documents
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>
                        <span className="text-gray">Homeowner: </span>
                        <span style={{ fontWeight: 500 }}>
                          {owner?.full_name || <em style={{ color: Colors.warning }}>(no name on profile)</em>}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray">Email: </span>
                        <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 12 }}>
                          {owner?.email || '—'}
                        </span>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span className="text-gray">Full address: </span>
                        <span style={{ fontWeight: 500 }}>
                          {home.address || '—'}{home.address ? ', ' : ''}
                          {home.city}, {home.state} {home.zip_code}
                        </span>
                      </div>
                      {(home as any).google_place_id && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span className="text-gray">Google Place ID: </span>
                          <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: 11 }}>
                            {(home as any).google_place_id}
                          </span>
                        </div>
                      )}
                      {home.year_built && (
                        <div>
                          <span className="text-gray">Year built: </span>
                          <span style={{ fontWeight: 500 }}>{home.year_built}</span>
                        </div>
                      )}
                      {home.square_footage && (
                        <div>
                          <span className="text-gray">Sq ft: </span>
                          <span style={{ fontWeight: 500 }}>{home.square_footage.toLocaleString()}</span>
                        </div>
                      )}
                      {homeAgeDays !== null && (
                        <div>
                          <span className="text-gray">Home record age: </span>
                          <span style={{ fontWeight: 500 }}>
                            {homeAgeDays} day{homeAgeDays === 1 ? '' : 's'} at submit
                          </span>
                        </div>
                      )}
                      {accountAgeDays !== null && (
                        <div>
                          <span className="text-gray">Account age: </span>
                          <span style={{ fontWeight: 500 }}>
                            {accountAgeDays} day{accountAgeDays === 1 ? '' : 's'} at submit
                          </span>
                        </div>
                      )}
                    </div>
                    {flags.length > 0 && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 8,
                          background: 'rgba(245,158,11,0.08)',
                          borderLeft: `3px solid ${Colors.warning}`,
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        <p style={{ fontWeight: 600, color: Colors.warning, marginBottom: 4 }}>
                          ⚠ Review carefully
                        </p>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {flags.map((f, i) => (
                            <li key={i} style={{ marginBottom: 2 }}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Document links */}
              {getDocUrls(home).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p className="text-xs text-gray" style={{ marginBottom: 6 }}>Documents:</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {getDocUrls(home).map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 12 }}
                      >
                        View Document {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Review actions (only for pending) */}
              {home.ownership_verification_status === 'pending' && (
                <>
                  {reviewingId === home.id ? (
                    <div style={{ marginTop: 8 }}>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 12 }}>Review Notes (optional)</label>
                        <textarea
                          className="form-input"
                          rows={2}
                          value={reviewNotes}
                          onChange={e => setReviewNotes(e.target.value)}
                          placeholder="Reason for decision (required for rejections, optional for approvals)"
                          style={{ fontSize: 13 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleReview(home.id, 'verified')}
                          disabled={actionId === home.id}
                          style={{ flex: 1, background: Colors.sage }}
                        >
                          {actionId === home.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleReview(home.id, 'rejected')}
                          disabled={actionId === home.id || !reviewNotes.trim()}
                          style={{ flex: 1, color: Colors.error, borderColor: Colors.error }}
                        >
                          Reject
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => { setReviewingId(null); setReviewNotes(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                      {!reviewNotes.trim() && (
                        <p className="text-xs text-gray" style={{ marginTop: 4 }}>
                          Notes are required when rejecting
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setReviewingId(home.id)}
                      style={{ marginTop: 8 }}
                    >
                      Review
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
