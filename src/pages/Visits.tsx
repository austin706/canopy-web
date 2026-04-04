import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { isProOrHigher } from '@/services/subscriptionGate';
import { Colors, StatusColors } from '@/constants/theme';
import { getItemsToHaveOnHand, getUpcomingVisits, getPastVisits, confirmVisit, cancelVisit, rescheduleVisit, rateVisit } from '@/services/proVisits';
import { uploadInspectionDoc, getVisitDocuments, deleteInspectionDoc, type InspectionDocument } from '@/services/inspectionDocs';
import { getEquipmentTrends, type EquipmentTrend } from '@/services/equipmentTrending';
import type { ProMonthlyVisit, VisitAllocation } from '@/types';

export default function Visits() {
  const { user, home } = useStore();
  const [upcomingVisit, setUpcomingVisit] = useState<ProMonthlyVisit | null>(null);
  const [pastVisits, setPastVisits] = useState<ProMonthlyVisit[]>([]);
  const [allocation, setAllocation] = useState<VisitAllocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [preparedItems, setPreparedItems] = useState<Set<string>>(new Set());
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [ratingVisitId, setRatingVisitId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingReview, setRatingReview] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [visitDocuments, setVisitDocuments] = useState<Map<string, InspectionDocument[]>>(new Map());
  const [loadingDocs, setLoadingDocs] = useState<Set<string>>(new Set());
  const [expandedDocVisit, setExpandedDocVisit] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<Set<string>>(new Set());
  const [trends, setTrends] = useState<EquipmentTrend[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [expandedTrend, setExpandedTrend] = useState<string | null>(null);

  const tier = user?.subscription_tier || 'free';
  const hasPro = isProOrHigher(tier);

  useEffect(() => {
    if (user && hasPro) {
      loadVisits();
    } else {
      setLoading(false);
    }
  }, [user, hasPro]);

  const loadVisits = async () => {
    try {
      setLoading(true);
      const upcoming = await getUpcomingVisits(user!.id);
      const past = await getPastVisits(user!.id);
      setUpcomingVisit(upcoming.length > 0 ? upcoming[0] : null);
      setPastVisits(past);
      setAllocation({
        id: '',
        homeowner_id: user!.id,
        visit_month: new Date().toISOString().slice(0, 7),
        allocated_visits: 1,
        used_visits: past.filter(v => {
          const d = new Date(v.visit_month);
          const now = new Date();
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length,
        forfeited_visits: 0,
        created_at: new Date().toISOString(),
      });
      setError('');

      // Load equipment trends
      if (home?.id) {
        setTrendsLoading(true);
        try {
          const t = await getEquipmentTrends(home.id);
          setTrends(t);
        } catch (err) {
          console.warn('Failed to load trends:', err);
        } finally {
          setTrendsLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load visits');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!upcomingVisit) return;
    try {
      await confirmVisit(upcomingVisit.id);
      await loadVisits();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm visit');
    }
  };

  const handleCancel = async () => {
    if (!upcomingVisit) return;
    setCanceling(true);
    try {
      const { rebookable } = await cancelVisit(upcomingVisit.id, 'Cancelled by homeowner');
      setShowCancelModal(false);
      if (rebookable) {
        alert('Visit cancelled. Since you cancelled 48+ hours in advance, you can rebook for this month.');
      } else {
        alert('Visit cancelled. Since this was within 48 hours of your visit, this month\'s visit has been forfeited.');
      }
      await loadVisits();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel visit');
    } finally {
      setCanceling(false);
    }
  };

  const handleReschedule = async () => {
    if (!upcomingVisit || !newDate) return;
    setRescheduling(true);
    try {
      await rescheduleVisit(upcomingVisit.id, newDate, '');
      setShowRescheduleModal(false);
      setNewDate('');
      await loadVisits();
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule visit');
    } finally {
      setRescheduling(false);
    }
  };

  const handleRate = async () => {
    if (!ratingVisitId || ratingValue === 0) return;
    setSubmittingRating(true);
    try {
      await rateVisit(ratingVisitId, ratingValue, ratingReview);
      setRatingVisitId(null);
      setRatingValue(0);
      setRatingReview('');
      await loadVisits();
    } catch (err: any) {
      setError(err.message || 'Failed to submit rating');
    } finally {
      setSubmittingRating(false);
    }
  };

  const loadVisitDocuments = async (visitId: string) => {
    if (visitDocuments.has(visitId)) return;
    setLoadingDocs(prev => new Set(prev).add(visitId));
    try {
      const docs = await getVisitDocuments(visitId);
      setVisitDocuments(prev => new Map(prev).set(visitId, docs));
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoadingDocs(prev => {
        const next = new Set(prev);
        next.delete(visitId);
        return next;
      });
    }
  };

  const handleDocumentUpload = async (visitId: string, event: any) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploadingDoc(prev => new Set(prev).add(visitId));
    try {
      await uploadInspectionDoc(visitId, file, user.id);
      await loadVisitDocuments(visitId);
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(prev => {
        const next = new Set(prev);
        next.delete(visitId);
        return next;
      });
    }
  };

  const handleDeleteDocument = async (docId: string, visitId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await deleteInspectionDoc(docId);
      setVisitDocuments(prev => {
        const next = new Map(prev);
        const docs = next.get(visitId) || [];
        next.set(visitId, docs.filter(d => d.id !== docId));
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!hasPro) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Pro Visits</h1></div>
        <div className="card text-center" style={{ padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-copper-muted, #FFF3E0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 20, color: 'var(--color-copper)' }}>PRO</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Pro Visits Locked</h2>
          <p className="text-gray mb-lg">Upgrade to a Pro plan to book monthly maintenance visits with qualified professionals.</p>
          <button className="btn btn-primary" onClick={() => window.location.href = '/subscription'}>View Plans</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner"></div>
        <p>Loading visits...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <h1>Pro Monthly Visits</h1>
      </div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--color-error-muted, #E5393520)', color: 'var(--color-error)', fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {/* Upcoming Visit Section */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Upcoming Visit</h2>

        {upcomingVisit && (
          <div
            className="card"
            style={{
              background: 'var(--color-copper-muted, #FFF3E0)',
              borderLeft: `4px solid var(--color-copper)`,
              marginBottom: 16,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 24 }}>🛒</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: Colors.charcoal, marginBottom: 4 }}>
                  Prepare for Your Visit
                </h3>
                <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12 }}>
                  <strong>{formatDate(upcomingVisit.confirmed_date || upcomingVisit.proposed_date || '')}</strong> • Your pro provider will be working on scheduled items. Please have these supplies ready:
                </p>

                {(() => {
                  const items = getItemsToHaveOnHand(upcomingVisit.selected_task_ids || []);
                  return items.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map((item) => (
                        <label
                          key={item}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            cursor: 'pointer',
                            color: preparedItems.has(item) ? Colors.medGray : Colors.charcoal,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={preparedItems.has(item)}
                            onChange={(e) => {
                              const newItems = new Set(preparedItems);
                              if (e.target.checked) {
                                newItems.add(item);
                              } else {
                                newItems.delete(item);
                              }
                              setPreparedItems(newItems);
                            }}
                            style={{
                              width: 18,
                              height: 18,
                              cursor: 'pointer',
                            }}
                          />
                          <span
                            style={{
                              textDecoration: preparedItems.has(item) ? 'line-through' : 'none',
                            }}
                          >
                            {item}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: Colors.medGray, fontStyle: 'italic' }}>
                      No supplies needed for your scheduled tasks
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {upcomingVisit ? (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 4 }}>Scheduled for</p>
                <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{formatDate(upcomingVisit.confirmed_date || upcomingVisit.proposed_date || '')}</p>
                <p style={{ fontSize: 14, color: Colors.medGray }}>{upcomingVisit.confirmed_start_time || upcomingVisit.proposed_time_slot}</p>
              </div>
              <span className="badge" style={{ background: (StatusColors[upcomingVisit.status] || '#ccc') + '20', color: StatusColors[upcomingVisit.status] || '#ccc' }}>
                {upcomingVisit.status}
              </span>
            </div>

            <div style={{ padding: 12, background: Colors.cream, borderRadius: 8, marginBottom: 16 }}>
              <p className="text-xs fw-600 text-copper mb-xs">Provider</p>
              <p style={{ fontWeight: 500, fontSize: 13 }}>{upcomingVisit.provider?.business_name}</p>
            </div>

            {upcomingVisit.pro_notes && (
              <p className="text-sm text-gray mb-lg">{upcomingVisit.pro_notes}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {upcomingVisit.status === 'proposed' && (
                <>
                  <button className="btn btn-primary" onClick={handleConfirm} style={{ flex: 1 }}>Confirm</button>
                  <button className="btn btn-secondary" onClick={() => setShowRescheduleModal(true)} style={{ flex: 1 }}>Reschedule</button>
                  <button className="btn btn-secondary" onClick={() => setShowCancelModal(true)} style={{ flex: 1 }}>Cancel</button>
                </>
              )}
              {upcomingVisit.status === 'confirmed' && (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowRescheduleModal(true)} style={{ flex: 1 }}>Reschedule</button>
                  <button className="btn btn-secondary" onClick={() => setShowCancelModal(true)} style={{ flex: 1 }}>Cancel</button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div>
            <h3>No upcoming visits</h3>
            <p>Your next Pro visit will appear here once scheduled.</p>
          </div>
        )}
      </div>

      {/* Visit Allocation */}
      {allocation && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Monthly Allocation</h2>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 14 }}>{allocation.used_visits} of {allocation.allocated_visits} visits used this month</p>
              <span className="badge" style={{ background: allocation.forfeited_visits > 0 ? '#dc354520' : '#8B9E7E20', color: allocation.forfeited_visits > 0 ? '#dc3545' : '#8B9E7E' }}>
                {allocation.forfeited_visits > 0 ? 'Forfeited' : 'Active'}
              </span>
            </div>
            <div style={{ height: 8, background: Colors.lightGray, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: Colors.sage, width: `${(allocation.used_visits / allocation.allocated_visits) * 100}%`, transition: 'width 0.3s' }}></div>
            </div>
            <p className="text-xs text-gray mt-sm">{allocation.visit_month}</p>
          </div>
        </div>
      )}

      {/* Past Visits */}
      <div>
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Past Visits</h2>
        {pastVisits.length === 0 ? (
          <div className="empty-state">
            <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>--</div>
            <h3>No past visits</h3>
            <p>Completed visits will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pastVisits.map(visit => (
              <div key={visit.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{formatDate(visit.confirmed_date || visit.proposed_date || '')}</p>
                    <p className="text-xs text-gray">{visit.provider?.business_name}</p>
                  </div>
                  <span className="badge" style={{ background: '#4CAF5020', color: '#2E7D32' }}>Completed</span>
                </div>
                {visit.selected_task_ids && visit.selected_task_ids.length > 0 && (
                  <p className="text-sm text-gray mb-sm">Tasks: {visit.selected_task_ids.length} completed</p>
                )}
                {visit.time_spent_minutes && (
                  <p className="text-sm text-gray mb-sm">Duration: {visit.time_spent_minutes} minutes</p>
                )}
                {visit.pro_notes && (
                  <p className="text-sm text-gray">Notes: {visit.pro_notes}</p>
                )}
                {/* AI Summary Section */}
                {visit.ai_summary && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      onClick={() => setExpandedSummary(expandedSummary === visit.id ? null : visit.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: `1px solid ${Colors.sage}`,
                        backgroundColor: expandedSummary === visit.id ? Colors.sage : 'transparent',
                        color: expandedSummary === visit.id ? 'white' : Colors.sage,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        width: '100%',
                        justifyContent: 'center',
                      }}
                    >
                      <span>{expandedSummary === visit.id ? '▼' : '▶'}</span>
                      <span>{expandedSummary === visit.id ? 'Hide' : 'View'} AI Visit Summary</span>
                    </button>
                    {expandedSummary === visit.id && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 16,
                          backgroundColor: '#f8faf8',
                          borderRadius: 8,
                          border: `1px solid ${Colors.sage}30`,
                          fontSize: 14,
                          lineHeight: 1.7,
                          color: Colors.charcoal,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${Colors.sage}20` }}>
                          <span style={{ fontSize: 18 }}>🌿</span>
                          <span style={{ fontWeight: 600, color: Colors.sage }}>Canopy Home Health Report</span>
                          {visit.ai_summary_generated_at && (
                            <span style={{ fontSize: 11, color: Colors.medGray, marginLeft: 'auto' }}>
                              Generated {new Date(visit.ai_summary_generated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {visit.ai_summary}
                      </div>
                    )}
                  </div>
                )}

                {/* Rating Section */}
                {visit.status === 'completed' && (
                  <div style={{ marginTop: 12 }}>
                    {visit.homeowner_rating ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: Colors.cream, borderRadius: 8 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} style={{ color: star <= visit.homeowner_rating! ? Colors.copper : '#ddd', fontSize: 16 }}>★</span>
                          ))}
                        </div>
                        <span style={{ fontSize: 12, color: Colors.medGray }}>Your rating</span>
                        {visit.homeowner_review && (
                          <span style={{ fontSize: 12, color: Colors.charcoal, marginLeft: 'auto', fontStyle: 'italic' }}>"{visit.homeowner_review}"</span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRatingVisitId(visit.id); setRatingValue(0); setRatingReview(''); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          padding: '8px 16px', borderRadius: 8, border: `1px solid ${Colors.copper}`,
                          backgroundColor: 'transparent', color: Colors.copper, cursor: 'pointer',
                          fontSize: 13, fontWeight: 600, width: '100%',
                        }}
                      >
                        <span>★</span>
                        <span>Rate This Visit</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspection Documents */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Inspection Reports</h2>
        {pastVisits.length === 0 ? (
          <div className="empty-state">
            <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }}>📄</div>
            <h3>No documents</h3>
            <p>Inspection documents will appear here as they are uploaded.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pastVisits.map(visit => (
              <div key={visit.id} className="card">
                <button
                  onClick={() => {
                    setExpandedDocVisit(expandedDocVisit === visit.id ? null : visit.id);
                    if (expandedDocVisit !== visit.id) {
                      loadVisitDocuments(visit.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{formatDate(visit.confirmed_date || visit.proposed_date || '')}</p>
                    <p className="text-xs text-gray">{visit.provider?.business_name}</p>
                  </div>
                  <span style={{ fontSize: 14, color: Colors.medGray }}>{expandedDocVisit === visit.id ? '▼' : '▶'}</span>
                </button>

                {expandedDocVisit === visit.id && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${Colors.lightGray}` }}>
                    {loadingDocs.has(visit.id) ? (
                      <div style={{ padding: 16, textAlign: 'center', color: Colors.medGray }}>
                        <p className="text-sm">Loading documents...</p>
                      </div>
                    ) : (
                      <>
                        {((visitDocuments.get(visit.id) || []).length > 0) ? (
                          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(visitDocuments.get(visit.id) || []).map(doc => (
                              <div
                                key={doc.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                  padding: 12,
                                  background: Colors.cream,
                                  borderRadius: 8,
                                  justifyContent: 'space-between',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                                  <span style={{ fontSize: 18 }}>
                                    {doc.file_type === 'pdf' ? '📄' : '🖼️'}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, wordBreak: 'break-word' }}>
                                      {doc.file_name}
                                    </p>
                                    <p className="text-xs text-gray">
                                      {(doc.file_size_bytes / 1024).toFixed(1)} KB • {formatDate(doc.created_at)}
                                    </p>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    onClick={() => window.open(doc.file_url, '_blank')}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: 4,
                                      border: `1px solid ${Colors.sage}`,
                                      background: 'transparent',
                                      color: Colors.sage,
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 600,
                                    }}
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDocument(doc.id, visit.id)}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: 4,
                                      border: `1px solid #dc3545`,
                                      background: 'transparent',
                                      color: '#dc3545',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontWeight: 600,
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray mb-md" style={{ fontStyle: 'italic' }}>No documents for this visit yet.</p>
                        )}

                        <div style={{ position: 'relative' }}>
                          <input
                            key={`${visit.id}-upload`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                            onChange={(e) => handleDocumentUpload(visit.id, e)}
                            disabled={uploadingDoc.has(visit.id)}
                            style={{
                              display: 'none',
                            }}
                            id={`doc-upload-${visit.id}`}
                          />
                          <button
                            onClick={() => document.getElementById(`doc-upload-${visit.id}`)?.click()}
                            disabled={uploadingDoc.has(visit.id)}
                            style={{
                              width: '100%',
                              padding: '10px 16px',
                              borderRadius: 8,
                              border: `1px dashed ${Colors.copper}`,
                              background: 'transparent',
                              color: Colors.copper,
                              cursor: uploadingDoc.has(visit.id) ? 'not-allowed' : 'pointer',
                              fontSize: 13,
                              fontWeight: 600,
                              opacity: uploadingDoc.has(visit.id) ? 0.6 : 1,
                            }}
                          >
                            {uploadingDoc.has(visit.id) ? '📤 Uploading...' : '+ Upload Document'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment Health Trends */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>Equipment Health Trends</h2>
        {trendsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
            <div className="spinner"></div>
          </div>
        ) : trends.length === 0 ? (
          <div className="empty-state">
            <div className="icon" style={{ fontSize: 32, fontWeight: 700, color: 'var(--copper)' }} role="img" aria-label="Chart">📊</div>
            <h3>No trend data yet</h3>
            <p>Equipment trends will appear after your first completed visit with inspections.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trends.map(trend => {
              const conditionColor = {
                good: Colors.sage,
                fair: Colors.copper,
                needs_attention: '#FFC107',
                critical: '#E74C3C',
              }[trend.currentCondition] || Colors.medGray;

              const riskColors = {
                low: Colors.sage,
                medium: Colors.copper,
                high: '#E74C3C',
              };

              const trendArrow = {
                improving: '↑',
                stable: '→',
                declining: '↓',
              }[trend.trendDirection];

              const trendColor = {
                improving: Colors.sage,
                stable: Colors.copper,
                declining: '#E74C3C',
              }[trend.trendDirection];

              return (
                <div key={trend.equipmentId} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{trend.equipmentName}</h3>
                      <p className="text-xs text-gray" style={{ textTransform: 'capitalize' }}>{trend.equipmentCategory}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span
                        className="badge"
                        style={{
                          background: conditionColor + '20',
                          color: conditionColor,
                          textTransform: 'capitalize',
                        }}
                      >
                        {trend.currentCondition.replace(/_/g, ' ')}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: riskColors[trend.riskLevel] + '20',
                          color: riskColors[trend.riskLevel],
                          textTransform: 'capitalize',
                        }}
                      >
                        {trend.riskLevel} risk
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: Colors.cream, borderRadius: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18, color: trendColor, fontWeight: 700 }}>{trendArrow}</span>
                    <span style={{ fontSize: 13, color: Colors.charcoal, fontWeight: 500 }}>
                      {trend.trendDirection.charAt(0).toUpperCase() + trend.trendDirection.slice(1)}
                    </span>
                  </div>

                  <button
                    onClick={() => setExpandedTrend(expandedTrend === trend.equipmentId ? null : trend.equipmentId)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${Colors.lightGray}`,
                      backgroundColor: expandedTrend === trend.equipmentId ? Colors.cream : 'transparent',
                      color: Colors.sage,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <span>{expandedTrend === trend.equipmentId ? '▼' : '▶'}</span>
                    <span>
                      {expandedTrend === trend.equipmentId ? 'Hide' : 'Show'} Visit History ({trend.snapshots.length})
                    </span>
                  </button>

                  {expandedTrend === trend.equipmentId && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${Colors.lightGray}` }}>
                      {trend.snapshots.map((snapshot, idx) => (
                        <div key={idx} style={{ padding: 10, background: Colors.cream, borderRadius: 6, marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal }}>
                              {new Date(snapshot.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <span
                              className="badge"
                              style={{
                                background: conditionColor + '20',
                                color: conditionColor,
                                fontSize: 11,
                              }}
                            >
                              {snapshot.condition.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: Colors.medGray, marginBottom: 6 }}>
                            <span>✓ {snapshot.itemsPassed} Passed</span>
                            <span>⚠ {snapshot.itemsAttention} Attention</span>
                            <span>✕ {snapshot.itemsFailed} Failed</span>
                          </div>
                          {snapshot.proNotes && (
                            <p style={{ fontSize: 12, color: Colors.charcoal, fontStyle: 'italic', marginTop: 6 }}>
                              {snapshot.proNotes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 400, padding: 24 }}>
            <h2 style={{ marginBottom: 16 }}>Cancel Visit?</h2>
            <div style={{ padding: 12, background: '#FFF3CD', borderRadius: 8, marginBottom: 16, borderLeft: `4px solid #FFC107` }}>
              <p className="text-sm" style={{ margin: 0, color: '#856404' }}>
                <strong>Cancellation Policy:</strong> If cancelled 48+ hours before your visit, you can rebook in the same month. Cancellations within 48 hours may forfeit this month's visit.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowCancelModal(false)} style={{ flex: 1 }}>Keep Visit</button>
              <button className="btn" style={{ flex: 1, background: '#dc3545', color: 'white' }} onClick={handleCancel} disabled={canceling}>
                {canceling ? 'Cancelling...' : 'Cancel Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 400, padding: 24 }}>
            <h2 style={{ marginBottom: 16 }}>Reschedule Visit</h2>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>New Date</label>
              <input
                className="form-input"
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setShowRescheduleModal(false); setNewDate(''); }} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleReschedule} disabled={!newDate || rescheduling} style={{ flex: 1 }}>
                {rescheduling ? 'Rescheduling...' : 'Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingVisitId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 420, padding: 24 }}>
            <h2 style={{ marginBottom: 4 }}>Rate Your Visit</h2>
            <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 20 }}>How was your experience with this pro visit?</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    fontSize: 32, color: star <= ratingValue ? Colors.copper : '#ddd',
                    transition: 'color 0.15s, transform 0.15s',
                    transform: star <= ratingValue ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            {ratingValue > 0 && (
              <p style={{ textAlign: 'center', fontSize: 13, color: Colors.charcoal, marginBottom: 16, fontWeight: 500 }}>
                {ratingValue === 5 ? 'Excellent!' : ratingValue === 4 ? 'Great!' : ratingValue === 3 ? 'Good' : ratingValue === 2 ? 'Fair' : 'Poor'}
              </p>
            )}

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13 }}>Comments (optional)</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Tell us about your experience..."
                value={ratingReview}
                onChange={e => setRatingReview(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setRatingVisitId(null); setRatingValue(0); setRatingReview(''); }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRate}
                disabled={ratingValue === 0 || submittingRating}
                style={{ flex: 1 }}
              >
                {submittingRating ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
