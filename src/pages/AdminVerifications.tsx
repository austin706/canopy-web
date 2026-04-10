import { useState, useEffect } from 'react';
import { getPendingVerifications, getAllVerifications, reviewOwnershipVerification } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import type { Home } from '@/types';

type Tab = 'pending' | 'all';

export default function AdminVerifications() {
  const [tab, setTab] = useState<Tab>('pending');
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

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
    } catch (err: any) {
      console.error('Failed to load verifications:', err);
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
        return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>Pending</span>;
      case 'rejected':
        return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>Rejected</span>;
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
                          style={{ flex: 1, color: '#dc2626', borderColor: '#dc2626' }}
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
