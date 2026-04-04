import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import { getMaintenanceLogs } from '@/services/supabase';
import { getPastVisits } from '@/services/proVisits';
import { calculateCompletenessScore } from '@/services/homeTransfer';
import type { MaintenanceLog, ProMonthlyVisit, Equipment, Home } from '@/types';
import { getErrorMessage } from '@/utils/errors';

// Format currency
const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HomeReport() {
  const { user, home, equipment } = useStore();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [visits, setVisits] = useState<ProMonthlyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completenessScore, setCompletenessScore] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!home?.id || !user?.id) return;
    const load = async () => {
      try {
        setLoading(true);
        const [logsData, visitsData, score] = await Promise.all([
          getMaintenanceLogs(home.id),
          getPastVisits(user.id, 100),
          calculateCompletenessScore(home.id).catch(() => null),
        ]);
        setLogs(logsData);
        setVisits(visitsData.filter(v => v.status === 'completed'));
        setCompletenessScore(score);
      } catch (err: any) {
        setError(getErrorMessage(err) || 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [home?.id, user?.id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner"></div>
        <p>Generating Home Report...</p>
      </div>
    );
  }

  const totalMaintCost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const equipmentList = equipment || [];
  const now = new Date();
  const reportDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Group logs by year
  const logsByYear: Record<string, MaintenanceLog[]> = {};
  logs.forEach(log => {
    const year = new Date(log.completed_date).getFullYear().toString();
    if (!logsByYear[year]) logsByYear[year] = [];
    logsByYear[year].push(log);
  });

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Home Report</h1>
          <p style={{ fontSize: 13, color: Colors.medGray }}>Comprehensive maintenance history for your home</p>
        </div>
        <button className="btn btn-primary" onClick={handlePrint}>
          Export / Print PDF
        </button>
      </div>

      {error && <div className="no-print" style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--color-error-muted, #E5393520)', color: 'var(--color-error)', fontSize: 14, marginBottom: 16 }}>{error}</div>}

      {/* Report content — printable */}
      <div ref={reportRef} id="home-report">
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .app-layout { display: block !important; }
            .sidebar { display: none !important; }
            .mobile-header { display: none !important; }
            body { background: white !important; }
            #home-report { max-width: 100% !important; padding: 0 !important; }
            .report-section { break-inside: avoid; page-break-inside: avoid; }
          }
        `}</style>

        {/* Report Header */}
        <div style={{
          background: `linear-gradient(135deg, var(--color-sage), var(--color-sage-dark, #7a8f73))`,
          color: 'white', borderRadius: 12, padding: 32, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: 'white' }}>
                Home Maintenance Report
              </h1>
              <p style={{ fontSize: 14, opacity: 0.9 }}>
                Prepared by Canopy Home Health — {reportDate}
              </p>
              {home?.agent_attested_at && (
                <p style={{ fontSize: 12, opacity: 0.85, marginTop: 6 }}>
                  ✓ Agent verified on {new Date(home.agent_attested_at).toLocaleDateString()}
                  {home.agent_attestation_note && ` — "${home.agent_attestation_note}"`}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🌿 Canopy</p>
              <p style={{ fontSize: 11, opacity: 0.8 }}>Home Health Platform</p>
              {/* Record Completeness Score */}
              {completenessScore !== null && (
                <div style={{ marginTop: 10 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 28, margin: '0 0 0 auto',
                    background: `conic-gradient(white ${completenessScore * 3.6}deg, rgba(255,255,255,0.2) 0deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 22,
                      background: 'var(--color-sage-dark, var(--color-sage))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{completenessScore}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>Record Score</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Property Overview */}
        <div className="report-section" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: Colors.charcoal, borderBottom: `2px solid ${Colors.sage}`, paddingBottom: 6 }}>
            Property Overview
          </h2>
          {home && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
                <div><span style={{ fontSize: 12, color: Colors.medGray }}>Address</span><p style={{ fontWeight: 600 }}>{home.address}, {home.city}, {home.state} {home.zip_code}</p></div>
                <div><span style={{ fontSize: 12, color: Colors.medGray }}>Year Built</span><p style={{ fontWeight: 600 }}>{home.year_built || 'N/A'}</p></div>
                <div><span style={{ fontSize: 12, color: Colors.medGray }}>Square Footage</span><p style={{ fontWeight: 600 }}>{home.square_footage ? home.square_footage.toLocaleString() + ' sq ft' : 'N/A'}</p></div>
                <div><span style={{ fontSize: 12, color: Colors.medGray }}>Bedrooms / Bathrooms</span><p style={{ fontWeight: 600 }}>{home.bedrooms} bed / {home.bathrooms} bath</p></div>
                <div><span style={{ fontSize: 12, color: Colors.medGray }}>Roof Type</span><p style={{ fontWeight: 600 }}>{home.roof_type?.replace(/_/g, ' ') || 'N/A'}{home.roof_age_years ? ` (${home.roof_age_years} years)` : ''}</p></div>
                <div><span style={{ fontSize: 12, color: Colors.medGray }}>Foundation</span><p style={{ fontWeight: 600 }}>{home.foundation_type?.replace(/_/g, ' ') || 'N/A'}</p></div>
                <div><span style={{ fontSize: 12, color: Colors.medGray }}>HVAC</span><p style={{ fontWeight: 600 }}>{home.heating_type?.replace(/_/g, ' ') || 'N/A'} / {home.cooling_type?.replace(/_/g, ' ') || 'N/A'}</p></div>
                <div><span style={{ fontSize: 12, color: Colors.medGray }}>Water / Sewer</span><p style={{ fontWeight: 600 }}>{home.water_source || 'N/A'} / {home.sewer_type || 'N/A'}</p></div>
              </div>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="report-section" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: Colors.charcoal, borderBottom: `2px solid ${Colors.sage}`, paddingBottom: 6 }}>
            Maintenance Summary
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Log Entries', value: logs.length.toString(), color: Colors.sage },
              { label: 'Total Invested', value: fmt(totalMaintCost), color: Colors.copper },
              { label: 'Pro Visits', value: visits.length.toString(), color: Colors.info },
              { label: 'Equipment Tracked', value: equipmentList.length.toString(), color: Colors.charcoal },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ padding: 16, textAlign: 'center', borderTop: `3px solid ${stat.color}` }}>
                <p style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</p>
                <p style={{ fontSize: 12, color: Colors.medGray }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Equipment Inventory */}
        {equipmentList.length > 0 && (
          <div className="report-section" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: Colors.charcoal, borderBottom: `2px solid ${Colors.sage}`, paddingBottom: 6 }}>
              Equipment Inventory
            </h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: Colors.cream, textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: Colors.charcoal }}>Name</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: Colors.charcoal }}>Category</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: Colors.charcoal }}>Make / Model</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: Colors.charcoal }}>Installed</th>
                    <th style={{ padding: '10px 14px', fontWeight: 600, color: Colors.charcoal }}>Warranty</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentList.map((eq: Equipment) => (
                    <tr key={eq.id} style={{ borderTop: `1px solid ${Colors.lightGray}` }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{eq.name}</td>
                      <td style={{ padding: '10px 14px', color: Colors.medGray }}>{eq.category.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '10px 14px' }}>{[eq.make, eq.model].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{eq.install_date ? new Date(eq.install_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {eq.warranty_expiry
                          ? <span style={{ color: new Date(eq.warranty_expiry) > now ? Colors.success : Colors.error }}>
                              {new Date(eq.warranty_expiry) > now ? 'Active' : 'Expired'} — {new Date(eq.warranty_expiry).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Maintenance History by Year */}
        {Object.keys(logsByYear).length > 0 && (
          <div className="report-section" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: Colors.charcoal, borderBottom: `2px solid ${Colors.sage}`, paddingBottom: 6 }}>
              Maintenance History
            </h2>
            {Object.entries(logsByYear)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, yearLogs]) => {
                const yearCost = yearLogs.reduce((s, l) => s + (l.cost || 0), 0);
                return (
                  <div key={year} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: Colors.charcoal }}>{year}</h3>
                      <span style={{ fontSize: 13, color: Colors.copper, fontWeight: 500 }}>
                        {yearLogs.length} entries • {fmt(yearCost)}
                      </span>
                    </div>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: Colors.cream, textAlign: 'left' }}>
                            <th style={{ padding: '8px 14px', fontWeight: 600, color: Colors.charcoal }}>Date</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, color: Colors.charcoal }}>Work Performed</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, color: Colors.charcoal }}>Category</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, color: Colors.charcoal }}>Done By</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, color: Colors.charcoal }}>Source</th>
                            <th style={{ padding: '8px 14px', fontWeight: 600, color: Colors.charcoal, textAlign: 'right' }}>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearLogs.map(log => {
                            const src = (log as any).source;
                            const srcLabel = src === 'pro_visit' ? 'Pro Verified' : src === 'agent' ? 'Agent' : src === 'system' ? 'System' : 'Self-Reported';
                            const srcColor = src === 'pro_visit' ? Colors.sage : src === 'agent' ? Colors.copper : Colors.medGray;
                            return (
                            <tr key={log.id} style={{ borderTop: `1px solid ${Colors.lightGray}` }}>
                              <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                                {new Date(log.completed_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </td>
                              <td style={{ padding: '8px 14px', fontWeight: 500 }}>{log.title}</td>
                              <td style={{ padding: '8px 14px', color: Colors.medGray }}>{log.category.replace(/_/g, ' ')}</td>
                              <td style={{ padding: '8px 14px' }}>{log.completed_by}</td>
                              <td style={{ padding: '8px 14px' }}>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 8, background: 'var(--color-' + (src === 'pro_visit' ? 'sage' : src === 'agent' ? 'copper' : 'text-secondary') + '-muted, rgba(' + (src === 'pro_visit' ? '139,158,126' : src === 'agent' ? '196,132,78' : '107,114,128') + ',0.125))', color: srcColor }}>{srcLabel}</span>
                              </td>
                              <td style={{ padding: '8px 14px', textAlign: 'right' }}>{log.cost ? fmt(log.cost) : '—'}</td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Pro Visit History */}
        {visits.length > 0 && (
          <div className="report-section" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: Colors.charcoal, borderBottom: `2px solid ${Colors.sage}`, paddingBottom: 6 }}>
              Professional Visit History
            </h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: Colors.cream, textAlign: 'left' }}>
                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>Provider</th>
                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>Duration</th>
                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>Condition</th>
                    <th style={{ padding: '8px 14px', fontWeight: 600 }}>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map(v => (
                    <tr key={v.id} style={{ borderTop: `1px solid ${Colors.lightGray}` }}>
                      <td style={{ padding: '8px 14px' }}>
                        {v.completed_at ? new Date(v.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '8px 14px' }}>{v.provider?.business_name || '—'}</td>
                      <td style={{ padding: '8px 14px' }}>{v.time_spent_minutes ? `${v.time_spent_minutes} min` : '—'}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: v.overall_condition === 'good' ? 'var(--color-success-muted, rgba(22,163,74,0.125))' : v.overall_condition === 'fair' ? 'var(--color-warning-muted, rgba(245,158,11,0.125))' : 'var(--color-error-muted, rgba(220,38,38,0.125))',
                          color: v.overall_condition === 'good' ? 'var(--color-success)' : v.overall_condition === 'fair' ? 'var(--color-warning)' : 'var(--color-error)',
                        }}>
                          {v.overall_condition?.replace(/_/g, ' ') || 'N/A'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        {v.homeowner_rating ? `${'★'.repeat(v.homeowner_rating)}${'☆'.repeat(5 - v.homeowner_rating)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* QR Code + Footer */}
        <div style={{
          textAlign: 'center', padding: '24px 0', borderTop: `1px solid ${Colors.lightGray}`,
          color: Colors.medGray, fontSize: 12,
        }}>
          {home && (
            <div style={{ marginBottom: 16 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`https://canopyhome.app/home-report?id=${home.id}`)}`}
                alt="QR Code"
                width={120}
                height={120}
                style={{ margin: '0 auto', display: 'block' }}
              />
              <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 8 }}>
                Scan to view this home's verified record
              </p>
            </div>
          )}
          <p>Generated by Canopy Home Health Platform • canopyhome.app</p>
          <p style={{ marginTop: 4 }}>This report is for informational purposes and reflects data entered by the homeowner.</p>
          {completenessScore !== null && (
            <p style={{ marginTop: 4, fontWeight: 500 }}>Record Completeness Score: {completenessScore}/100</p>
          )}
        </div>
      </div>
    </div>
  );
}
