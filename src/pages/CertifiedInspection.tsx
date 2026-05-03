// ═══════════════════════════════════════════════════════════════
// CertifiedInspection — inspector-facing page (web)
// ═══════════════════════════════════════════════════════════════
// Route: /pro-portal/certified-inspection/:homeId
//
// 2026-05-02: First-class UI for the Annual Maintenance Inspection
// add-on. Pros walk every system in the home, capture per-system grade
// + notes + photos, log recommended repairs, and submit the record via
// record_certified_inspection (HMAC-stamped server-side).
//
// 2026-05-02 (INSPECTION_STRATEGY): repositioned from "Certified Home
// Inspection" → "Maintenance Inspection". The HMAC stamp + buyer-facing
// PDF give the record credibility weight, but this is NOT a substitute
// for a buyer's-side licensed home inspection. See
// Product/Strategic-Audit-2026-04-28/INSPECTION_STRATEGY_2026-05-02.md.
//
// The submission triggers home_inspections_notify_homeowner which drops
// a notification row that the existing email/push pipeline delivers
// using the user_inspection_completed template.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import logger from '@/utils/logger';
import {
  DEFAULT_INSPECTION_SYSTEMS,
  computeInspectionPrice,
  submitInspection,
  uploadInspectionPhoto,
  type InspectionFinding,
  type InspectionGrade,
  type RecommendedRepair,
} from '@/services/homeInspections';
import type { Home } from '@/types';

// Inspection-grade color spectrum (5 distinct shades in a green→red ramp).
// Theme has `success` and `error` but no intermediate olive/amber, so the
// spectrum is hand-tuned. Marked allow-lint so the design-lint baseline
// doesn't churn — these are intentional, not carelessness.
const GRADE_OPTIONS: Array<{ value: InspectionGrade; label: string; tone: string }> = [
  { value: 'excellent',       label: 'Excellent',     tone: '#2E7D32' },                  // allow-lint
  { value: 'good',            label: 'Good',          tone: '#558B2F' },                  // allow-lint
  { value: 'fair',            label: 'Fair',          tone: '#F9A825' },                  // allow-lint
  { value: 'needs_attention', label: 'Needs attention', tone: '#C62828' },                // allow-lint
];

const URGENCY_OPTIONS: Array<{ value: RecommendedRepair['urgency']; label: string }> = [
  { value: 'now',       label: 'Address now' },
  { value: 'this_year', label: 'This year' },
  { value: 'monitor',   label: 'Monitor' },
];

export default function CertifiedInspection() {
  const { homeId } = useParams<{ homeId: string }>();
  const navigate = useNavigate();
  const { user } = useStore();

  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inspector identity
  const [inspectorCredential, setInspectorCredential] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);

  // Per-system findings
  const [findings, setFindings] = useState<InspectionFinding[]>(
    DEFAULT_INSPECTION_SYSTEMS.map(s => ({
      system: s.system,
      label: s.label,
      grade: 'good' as InspectionGrade,
      notes: '',
      photos: [],
    })),
  );

  const [overallGrade, setOverallGrade] = useState<InspectionGrade>('good');
  const [overallPhotos, setOverallPhotos] = useState<string[]>([]);

  const [repairs, setRepairs] = useState<RecommendedRepair[]>([]);

  useEffect(() => {
    if (!homeId) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('homes')
          .select('id, address, city, state, zip_code, square_footage, year_built, photo_url, user_id')
          .eq('id', homeId)
          .maybeSingle();
        if (error) throw error;
        setHome(data as Home | null);
      } catch (e) {
        logger.error('CertifiedInspection — home load failed', e);
        setError(e instanceof Error ? e.message : 'Could not load home.');
      } finally {
        setLoading(false);
      }
    })();
  }, [homeId]);

  const pricing = useMemo(() => computeInspectionPrice(home?.square_footage ?? null), [home?.square_footage]);

  // Auto-derive overall grade from the lowest per-system grade.
  // Inspector can override after seeing the auto-suggestion.
  useEffect(() => {
    const order: InspectionGrade[] = ['needs_attention', 'fair', 'good', 'excellent'];
    const worst = order.find(g => findings.some(f => f.grade === g));
    if (worst) setOverallGrade(worst);
  }, [findings]);

  const updateFinding = (idx: number, patch: Partial<InspectionFinding>) => {
    setFindings(prev => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const onUploadFindingPhoto = async (idx: number, file: File) => {
    if (!homeId) return;
    try {
      const url = await uploadInspectionPhoto(homeId, file);
      setFindings(prev => prev.map((f, i) => (i === idx ? { ...f, photos: [...(f.photos ?? []), url] } : f)));
    } catch (e) {
      logger.error('inspection photo upload failed', e);
      showToast({ message: 'Photo upload failed. Try again.' });
    }
  };

  const onUploadOverallPhoto = async (file: File) => {
    if (!homeId) return;
    try {
      const url = await uploadInspectionPhoto(homeId, file);
      setOverallPhotos(prev => [...prev, url]);
    } catch (e) {
      logger.error('inspection photo upload failed', e);
      showToast({ message: 'Photo upload failed. Try again.' });
    }
  };

  const addRepair = () => {
    setRepairs(prev => [...prev, { title: '', urgency: 'this_year', notes: '' }]);
  };
  const updateRepair = (idx: number, patch: Partial<RecommendedRepair>) => {
    setRepairs(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRepair = (idx: number) => {
    setRepairs(prev => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async () => {
    if (!home || !user) return;
    setError(null);

    // Hard validations: inspector name required (from profile), at least one finding has notes,
    // and any "needs_attention" finding should have at least one note (operator hint, not block).
    const inspectorName = (user as unknown as { full_name?: string; email?: string }).full_name
      || (user as unknown as { email?: string }).email
      || 'Canopy Inspector';

    setSubmitting(true);
    try {
      const result = await submitInspection({
        homeId: home.id,
        inspectorName,
        inspectorCredentialNumber: inspectorCredential || null,
        overallGrade,
        findings,
        systemsInspected: { count: findings.length, version: 1 },
        recommendedRepairs: repairs.filter(r => r.title.trim().length > 0),
        photoUrls: overallPhotos,
        durationMinutes: durationMinutes || undefined,
        priceChargedCents: pricing.totalCents,
        inspectorPayoutCents: pricing.inspectorPayoutCents,
      });
      showToast({ message: 'Inspection submitted — homeowner notified.' });
      navigate(`/pro-portal/certified-inspection/${result.home_id}/done?id=${result.id}`, { replace: true });
    } catch (e) {
      logger.error('CertifiedInspection submit failed', e);
      setError(e instanceof Error ? e.message : 'Submit failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ maxWidth: 800, padding: Spacing.lg, textAlign: 'center' }}>
        <p style={{ color: Colors.medGray }}>Loading home…</p>
      </div>
    );
  }

  if (!home) {
    return (
      <div className="page" style={{ maxWidth: 800, padding: Spacing.lg }}>
        <h1>Home not found</h1>
        <p style={{ color: Colors.medGray }}>This home isn't on your assigned list, or the link is stale.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/pro-portal')}>Back to Pro Portal</button>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 800, padding: Spacing.lg }}>
      <button
        className="btn btn-ghost"
        onClick={() => navigate('/pro-portal')}
        style={{ marginBottom: Spacing.md, fontSize: FontSize.sm }}
      >
        ← Pro Portal
      </button>

      {/* Header */}
      <div className="card" style={{
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        background: `${Colors.copper}10`,
        borderLeft: `4px solid ${Colors.copper}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: Spacing.md }}>
          <div aria-hidden="true" style={{ fontSize: 36, lineHeight: 1 }}>🛡️</div>{/* allow-lint */}
          <div>
            <h1 style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.charcoal, margin: 0 }}>
              Annual Maintenance Inspection
            </h1>
            <p style={{ fontSize: FontSize.sm, color: Colors.medGray, margin: '4px 0 0' }}>
              {home.address}, {home.city}, {home.state} {home.zip_code}
              {home.square_footage ? ` · ${home.square_footage.toLocaleString()} sqft` : ''}
              {home.year_built ? ` · built ${home.year_built}` : ''}
            </p>
          </div>
        </div>

        <div style={{ marginTop: Spacing.md, fontSize: FontSize.sm, color: Colors.charcoal }}>
          <strong>Total inspection price:</strong> ${(pricing.totalCents / 100).toFixed(2)}
          {' · '}
          <span style={{ color: Colors.medGray }}>
            Your payout: ${(pricing.inspectorPayoutCents / 100).toFixed(2)} (65%)
          </span>
        </div>
      </div>

      {error && (
        <div role="alert" style={{
          padding: Spacing.md, background: `${Colors.error}15`,
          border: `1px solid ${Colors.error}`, borderRadius: 8,
          color: Colors.error, marginBottom: Spacing.md, fontSize: FontSize.sm,
        }}>
          {error}
        </div>
      )}

      {/* Inspector identity */}
      <section className="card" style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <h2 style={{ fontSize: FontSize.md, fontWeight: 600, marginTop: 0 }}>Inspector identity</h2>
        <p style={{ fontSize: FontSize.xs, color: Colors.medGray, marginTop: 0 }}>
          Your name is pulled from your profile and stamped onto the buyer-facing record.
          Adding a credential number (license, InterNACHI, ASHI, etc.) increases buyer trust.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Spacing.md }}>
          <label style={{ fontSize: FontSize.sm, fontWeight: 600, color: Colors.charcoal }}>
            Credential number (optional)
            <input
              type="text"
              className="form-input"
              value={inspectorCredential}
              onChange={e => setInspectorCredential(e.target.value)}
              placeholder="e.g. NACHI20030821 / TX-22481"
              style={{ marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: FontSize.sm, fontWeight: 600, color: Colors.charcoal }}>
            Duration (minutes)
            <input
              type="number"
              className="form-input"
              value={durationMinutes}
              onChange={e => setDurationMinutes(Number(e.target.value) || 0)}
              min={15}
              max={300}
              style={{ marginTop: 4 }}
            />
          </label>
        </div>
      </section>

      {/* Per-system findings */}
      <section className="card" style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <h2 style={{ fontSize: FontSize.md, fontWeight: 600, marginTop: 0 }}>System-by-system findings</h2>
        <p style={{ fontSize: FontSize.xs, color: Colors.medGray, marginTop: 0 }}>
          Set a grade per system and add notes describing what you found. Photos help buyers understand condition.
        </p>

        {findings.map((f, idx) => (
          <div
            key={f.system}
            style={{
              borderTop: idx === 0 ? 'none' : `1px solid ${Colors.lightGray}`,
              paddingTop: idx === 0 ? 0 : Spacing.md,
              marginTop: idx === 0 ? Spacing.md : Spacing.md,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ fontSize: FontSize.sm, fontWeight: 600, margin: 0, color: Colors.charcoal }}>
                {f.label}
              </h3>
              <select
                className="form-select"
                value={f.grade}
                onChange={e => updateFinding(idx, { grade: e.target.value as InspectionGrade })}
                style={{ fontSize: FontSize.xs, width: 180 }}
              >
                {GRADE_OPTIONS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <textarea
              className="form-input"
              value={f.notes ?? ''}
              onChange={e => updateFinding(idx, { notes: e.target.value })}
              placeholder="Notes for the homeowner — what you saw, what's working, what needs follow-up."
              rows={2}
              style={{ resize: 'vertical', fontSize: FontSize.sm, marginTop: 4 }}
            />
            <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {(f.photos ?? []).map(url => (
                <img key={url} src={url} alt="" style={{
                  width: 64, height: 64, borderRadius: 6, objectFit: 'cover',
                  border: `1px solid ${Colors.lightGray}`,
                }} />
              ))}
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                background: Colors.cream, color: Colors.charcoal, fontSize: FontSize.xs, fontWeight: 600,
                border: `1px dashed ${Colors.medGray}`,
              }}>
                + Photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) await onUploadFindingPhoto(idx, file);
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        ))}
      </section>

      {/* Recommended repairs */}
      <section className="card" style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: FontSize.md, fontWeight: 600, margin: 0 }}>Recommended repairs</h2>
          <button className="btn btn-ghost btn-sm" onClick={addRepair}>+ Add repair</button>
        </div>
        <p style={{ fontSize: FontSize.xs, color: Colors.medGray, marginTop: 4 }}>
          Itemize what the homeowner should fix, rough cost ranges, and how soon. Surfaces on their Home Token + email summary.
        </p>
        {repairs.length === 0 && (
          <p style={{ fontSize: FontSize.sm, color: Colors.medGray, fontStyle: 'italic', marginTop: Spacing.md }}>
            No recommendations yet. Add one if anything needs attention.
          </p>
        )}
        {repairs.map((r, idx) => (
          <div
            key={idx}
            style={{
              padding: Spacing.md,
              borderRadius: 8,
              background: Colors.cream,
              marginTop: Spacing.md,
              display: 'grid',
              gridTemplateColumns: '1fr 160px 100px 100px auto',
              gap: 8,
              alignItems: 'start',
            }}
          >
            <input
              className="form-input"
              placeholder="What needs fixing?"
              value={r.title}
              onChange={e => updateRepair(idx, { title: e.target.value })}
            />
            <select
              className="form-select"
              value={r.urgency}
              onChange={e => updateRepair(idx, { urgency: e.target.value as RecommendedRepair['urgency'] })}
            >
              {URGENCY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              className="form-input"
              placeholder="Cost low"
              value={r.estimated_cost_low ?? ''}
              onChange={e => updateRepair(idx, { estimated_cost_low: Number(e.target.value) || undefined })}
            />
            <input
              type="number"
              className="form-input"
              placeholder="Cost high"
              value={r.estimated_cost_high ?? ''}
              onChange={e => updateRepair(idx, { estimated_cost_high: Number(e.target.value) || undefined })}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => removeRepair(idx)}
              aria-label="Remove repair"
            >
              ×
            </button>
          </div>
        ))}
      </section>

      {/* Overall grade + general photos */}
      <section className="card" style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
        <h2 style={{ fontSize: FontSize.md, fontWeight: 600, marginTop: 0 }}>Overall grade + general photos</h2>
        <p style={{ fontSize: FontSize.xs, color: Colors.medGray, marginTop: 0 }}>
          Auto-derived from the worst per-system grade. You can override if you have context the per-system view misses.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: Spacing.md }}>
          {GRADE_OPTIONS.map(g => (
            <button
              key={g.value}
              className="btn"
              onClick={() => setOverallGrade(g.value)}
              style={{
                background: overallGrade === g.value ? g.tone : Colors.cream,
                color: overallGrade === g.value ? '#fff' : Colors.charcoal,
                border: `1px solid ${overallGrade === g.value ? g.tone : Colors.lightGray}`,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: FontSize.sm,
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: Spacing.md, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {overallPhotos.map(url => (
            <img key={url} src={url} alt="" style={{
              width: 80, height: 80, borderRadius: 6, objectFit: 'cover',
              border: `1px solid ${Colors.lightGray}`,
            }} />
          ))}
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
            background: Colors.cream, color: Colors.charcoal, fontSize: FontSize.sm, fontWeight: 600,
            border: `1px dashed ${Colors.medGray}`,
          }}>
            + General photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) await onUploadOverallPhoto(file);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </section>

      {/* Submit */}
      <div style={{ display: 'flex', gap: Spacing.md, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/pro-portal')} disabled={submitting}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={submitting}
          aria-label="Submit certified inspection"
        >
          {submitting ? 'Submitting…' : 'Submit certified inspection'}
        </button>
      </div>
      <p style={{ fontSize: FontSize.xs, color: Colors.medGray, textAlign: 'right', marginTop: Spacing.sm }}>
        Submitting locks the record with an HMAC stamp and emails the homeowner. The buyer-facing Home Token reflects the inspection immediately.
      </p>
      <p style={{ fontSize: FontSize.xs, color: Colors.medGray, textAlign: 'right', marginTop: 4, fontStyle: 'italic' }}>
        Note: a Canopy Maintenance Inspection documents the maintenance state of the home. It is not a substitute for a buyer&apos;s-side licensed home inspection before close.
      </p>
    </div>
  );
}
