/**
 * TechnicianOnboarding.tsx
 * Tech-facing onboarding portal: sign documents, upload W-9, set up Stripe Connect,
 * view training materials, and track progress. Distinct from AdminTechnicianOnboarding.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { showToast } from '@/components/Toast';
import {
  supabase,
  getTechnicianDocuments,
  signTechnicianDocument,
  uploadTechnicianDocument,
  getOnboardingSteps,
  getTrainingMaterials,
  getTechnicianOnboardingProgress,
  createStripeConnectAccount,
  getStripeConnectStatus,
  initiateBackgroundCheck,
} from '@/services/supabase';
import type {
  TechnicianDocument,
  TechDocumentType,
  OnboardingStep,
  TrainingMaterial,
  TechnicianOnboarding as TechOnboardingRecord,
} from '@/services/supabase';
import { Colors } from '@/constants/theme';
import {
  CONTRACTOR_AGREEMENT_TEXT,
  CONTRACTOR_AGREEMENT_VERSION,
  SAFETY_ACKNOWLEDGMENT_TEXT,
} from '@/constants/contractorAgreement';
import SignaturePad from '@/components/SignaturePad';
import logger from '@/utils/logger';

type OnboardingPhase = 'paperwork' | 'training' | 'field' | 'complete';

interface ProviderInfo {
  id: string;
  contact_name: string;
  business_name: string;
  email: string;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean;
  background_check_status: string;
  certification_level: string;
  onboarding_completed_at: string | null;
}

// Simple SHA-256 hash for agreement text verification
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function TechnicianOnboardingPage() {
  const { user } = useStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [documents, setDocuments] = useState<TechnicianDocument[]>([]);
  const [progress, setProgress] = useState<TechOnboardingRecord[]>([]);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);

  // Signing state
  const [signingDoc, setSigningDoc] = useState<'contractor_agreement' | 'safety_acknowledgment' | null>(null);
  const [signerName, setSignerName] = useState('');
  const [agreementRead, setAgreementRead] = useState(false);
  const [signing, setSigning] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState<TechDocumentType | null>(null);

  // Stripe Connect state
  const [stripeLoading, setStripeLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Find the provider record for this user
      const { data: provData } = await supabase
        .from('pro_providers')
        .select('id, contact_name, business_name, email, stripe_connect_account_id, stripe_connect_onboarding_complete, background_check_status, certification_level, onboarding_completed_at')
        .eq('user_id', user.id)
        .eq('provider_type', 'canopy_technician')
        .single();

      if (!provData) {
        setLoading(false);
        return;
      }
      setProvider(provData);
      setSignerName(provData.contact_name || '');

      const [docs, stepsData, mats, prog] = await Promise.all([
        getTechnicianDocuments(provData.id),
        getOnboardingSteps(),
        getTrainingMaterials(),
        getTechnicianOnboardingProgress(provData.id),
      ]);

      setDocuments(docs);
      setSteps(stepsData);
      setMaterials(mats);
      setProgress(prog);
    } catch (e) {
      logger.error('Error loading onboarding data:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Document helpers
  const getDoc = (type: TechDocumentType) => documents.find(d => d.document_type === type);
  const isDocSigned = (type: TechDocumentType) => {
    const doc = getDoc(type);
    return doc && (doc.status === 'signed' || doc.status === 'verified');
  };

  // Determine current phase
  const getPhase = (): OnboardingPhase => {
    if (provider?.onboarding_completed_at) return 'complete';
    const contractorSigned = isDocSigned('contractor_agreement');
    const safetySigned = isDocSigned('safety_acknowledgment');
    if (!contractorSigned || !safetySigned) return 'paperwork';
    const completedSteps = progress.filter(p => p.status === 'completed' || p.status === 'skipped').length;
    const trainingSteps = progress.filter(p => ['training', 'system_setup'].includes(p.step?.category || ''));
    const trainingDone = trainingSteps.every(p => p.status === 'completed' || p.status === 'skipped');
    if (!trainingDone) return 'training';
    return 'field';
  };

  const phase = loading ? 'paperwork' : getPhase();
  const completedCount = progress.filter(p => p.status === 'completed').length;
  const totalSteps = progress.length;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  // Sign a document
  const handleSign = async (signatureDataUrl: string) => {
    if (!provider || !signingDoc || !signerName.trim()) return;
    setSigning(true);
    try {
      const text = signingDoc === 'contractor_agreement' ? CONTRACTOR_AGREEMENT_TEXT : SAFETY_ACKNOWLEDGMENT_TEXT;
      const textHash = await hashText(text);
      const doc = await signTechnicianDocument(
        provider.id,
        signingDoc,
        signatureDataUrl,
        signerName.trim(),
        CONTRACTOR_AGREEMENT_VERSION,
        textHash,
      );
      setDocuments(prev => {
        const filtered = prev.filter(d => d.document_type !== signingDoc);
        return [...filtered, doc];
      });
      setSigningDoc(null);
      setAgreementRead(false);
    } catch (e: any) {
      showToast({ message: `Error signing document: ${e.message}` });
    } finally {
      setSigning(false);
    }
  };

  // Upload a file document (W-9, insurance, license)
  const handleUpload = async (type: TechDocumentType, file: File) => {
    if (!provider) return;
    setUploading(type);
    try {
      const doc = await uploadTechnicianDocument(provider.id, type, file);
      setDocuments(prev => {
        const filtered = prev.filter(d => d.document_type !== type);
        return [...filtered, doc];
      });
    } catch (e: any) {
      showToast({ message: `Upload error: ${e.message}` });
    } finally {
      setUploading(null);
    }
  };

  // Stripe Connect
  const handleStripeConnect = async () => {
    if (!provider) return;
    setStripeLoading(true);
    try {
      const { onboardingUrl } = await createStripeConnectAccount(provider.id);
      window.open(onboardingUrl, '_blank');
    } catch (e: any) {
      showToast({ message: `Stripe Connect error: ${e.message}. This feature requires the stripe-connect-onboard edge function to be deployed.` });
    } finally {
      setStripeLoading(false);
    }
  };

  // Background check
  const handleBackgroundCheck = async () => {
    if (!provider) return;
    try {
      await initiateBackgroundCheck(provider.id);
      setProvider({ ...provider, background_check_status: 'pending' });
    } catch (e: any) {
      showToast({ message: e.message });
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="page" style={{ maxWidth: 600, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: Colors.charcoal, marginBottom: 8 }}>Not a Canopy Technician</h2>
        <p style={{ color: Colors.medGray, marginBottom: 24 }}>Your account is not set up as a Canopy technician. If you believe this is an error, please contact your supervisor.</p>
        <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 24px', background: Colors.sage, color: 'var(--color-white)', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  // ─── Document Signing Modal ───
  if (signingDoc) {
    const isContractor = signingDoc === 'contractor_agreement';
    const docText = isContractor ? CONTRACTOR_AGREEMENT_TEXT : SAFETY_ACKNOWLEDGMENT_TEXT;
    const docTitle = isContractor ? 'Independent Contractor Agreement' : 'Safety Manual Acknowledgment';

    return (
      <div className="page" style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <button onClick={() => { setSigningDoc(null); setAgreementRead(false); }} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: Colors.medGray, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ← Back to Onboarding
        </button>

        <h1 style={{ fontSize: 24, color: Colors.charcoal, marginBottom: 4 }}>{docTitle}</h1>
        <p style={{ color: Colors.medGray, fontSize: 13, marginBottom: 20 }}>
          Please read the entire document below, then sign at the bottom.
        </p>

        {/* Agreement Text */}
        <div
          style={{
            maxHeight: 400, overflowY: 'auto', padding: 24,
            background: '#fafafa', border: `1px solid ${Colors.lightGray}`,
            borderRadius: 8, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap',
            color: Colors.charcoal, fontFamily: 'Georgia, serif', marginBottom: 16,
          }}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
              setAgreementRead(true);
            }
          }}
        >
          {docText}
        </div>

        {!agreementRead && (
          <p style={{ color: Colors.copper, fontSize: 12, fontStyle: 'italic', marginBottom: 16 }}>
            Please scroll to the bottom of the document to continue.
          </p>
        )}

        {agreementRead && (
          <>
            {/* Signer Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: Colors.charcoal, marginBottom: 4 }}>
                Full Legal Name
              </label>
              <input
                type="text"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                placeholder="Enter your full legal name"
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 8,
                  border: `1px solid ${Colors.lightGray}`, outline: 'none',
                }}
              />
            </div>

            {/* Confirmation checkbox */}
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" id="confirm-read" style={{ marginTop: 3 }} />
              <span style={{ fontSize: 13, color: Colors.charcoal, lineHeight: 1.5 }}>
                I, <strong>{signerName || '[your name]'}</strong>, confirm that I have read and understand the {docTitle} in its entirety.
                {isContractor && ' I understand that I am entering into this agreement as an independent contractor and not as an employee of Canopy Home or Oak & Sage Home Services LLC.'}
              </span>
            </label>

            {/* Signature Pad */}
            <SignaturePad
              label="Sign below"
              onSave={handleSign}
            />

            {signing && (
              <div style={{ textAlign: 'center', padding: 16 }}>
                <div className="spinner" />
                <p style={{ color: Colors.medGray, fontSize: 13, marginTop: 8 }}>Saving your signature...</p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── Main Onboarding View ───
  return (
    <div className="page" style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: Colors.charcoal, margin: '0 0 4px' }}>
          Welcome, {provider.contact_name}
        </h1>
        <p style={{ color: Colors.medGray, fontSize: 14, margin: 0 }}>
          Canopy Technician Onboarding
        </p>
      </div>

      {/* Overall Progress */}
      <div style={{
        background: Colors.white, borderRadius: 12, padding: 20, marginBottom: 24,
        border: `1px solid ${Colors.lightGray}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>Overall Progress</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: progressPct === 100 ? Colors.success : Colors.sage }}>
            {progressPct}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: Colors.lightGray }}>
          <div style={{
            width: `${progressPct}%`, height: '100%', borderRadius: 4,
            background: progressPct === 100 ? Colors.success : Colors.sage, transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          {(['paperwork', 'training', 'field', 'complete'] as OnboardingPhase[]).map((p, i) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                background: phase === p ? Colors.sage : ((['paperwork', 'training', 'field', 'complete'].indexOf(phase) > i) ? Colors.success : Colors.lightGray),
                color: phase === p || ['paperwork', 'training', 'field', 'complete'].indexOf(phase) > i ? '#fff' : Colors.medGray,
              }}>
                {['paperwork', 'training', 'field', 'complete'].indexOf(phase) > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: phase === p ? Colors.charcoal : Colors.medGray, fontWeight: phase === p ? 600 : 400 }}>
                {p === 'paperwork' ? 'Paperwork' : p === 'training' ? 'Training' : p === 'field' ? 'Field Work' : 'Certified'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ SECTION 1: PAPERWORK ═══ */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>📋</span> Paperwork & Documents
        </h2>

        {/* Contractor Agreement */}
        <DocumentCard
          title="Independent Contractor Agreement"
          description="Review and sign the Canopy technician contractor agreement"
          status={isDocSigned('contractor_agreement') ? 'signed' : 'pending'}
          signedAt={getDoc('contractor_agreement')?.signed_at}
          actionLabel="Review & Sign"
          onAction={() => setSigningDoc('contractor_agreement')}
        />

        {/* Safety Acknowledgment */}
        <DocumentCard
          title="Safety Manual Acknowledgment"
          description="Confirm you have read and understand the Canopy Safety Manual"
          status={isDocSigned('safety_acknowledgment') ? 'signed' : 'pending'}
          signedAt={getDoc('safety_acknowledgment')?.signed_at}
          actionLabel="Review & Sign"
          onAction={() => setSigningDoc('safety_acknowledgment')}
        />

        {/* W-9 Upload */}
        <UploadCard
          title="W-9 Tax Form"
          description="Upload your completed W-9 for 1099-NEC tax reporting"
          status={isDocSigned('w9') ? 'signed' : 'pending'}
          uploadedAt={getDoc('w9')?.signed_at || getDoc('w9')?.created_at}
          uploading={uploading === 'w9'}
          onUpload={(file) => handleUpload('w9', file)}
          accept=".pdf,.jpg,.jpeg,.png"
          helpText="Download a blank W-9 from irs.gov, fill it out, and upload a photo or scan."
        />

        {/* Insurance Verification */}
        <UploadCard
          title="Vehicle Insurance"
          description="Upload proof of current auto insurance (you'll drive to visits)"
          status={isDocSigned('insurance_verification') ? 'signed' : 'pending'}
          uploadedAt={getDoc('insurance_verification')?.signed_at || getDoc('insurance_verification')?.created_at}
          uploading={uploading === 'insurance_verification'}
          onUpload={(file) => handleUpload('insurance_verification', file)}
          accept=".pdf,.jpg,.jpeg,.png"
        />

        {/* Driver's License */}
        <UploadCard
          title="Driver's License"
          description="Upload a photo of your valid driver's license"
          status={isDocSigned('drivers_license') ? 'signed' : 'pending'}
          uploadedAt={getDoc('drivers_license')?.signed_at || getDoc('drivers_license')?.created_at}
          uploading={uploading === 'drivers_license'}
          onUpload={(file) => handleUpload('drivers_license', file)}
          accept=".jpg,.jpeg,.png,.pdf"
        />

        {/* Stripe Connect (W-9 + Direct Deposit via Stripe) */}
        <div style={{
          padding: 16, borderRadius: 10, marginBottom: 10,
          background: Colors.white, border: `1px solid ${Colors.lightGray}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>
              Payment Setup (Stripe Connect)
            </p>
            <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>
              Set up your bank account for direct deposit. Stripe handles W-9 verification and 1099 filing.
            </p>
          </div>
          {provider.stripe_connect_onboarding_complete ? (
            <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: Colors.sageMuted, color: Colors.success, fontWeight: 700 }}>
              ✓ Connected
            </span>
          ) : (
            <button
              onClick={handleStripeConnect}
              disabled={stripeLoading}
              style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                background: '#635bff', color: 'var(--color-white)', border: 'none', cursor: 'pointer',
                opacity: stripeLoading ? 0.6 : 1,
              }}
            >
              {stripeLoading ? 'Loading...' : provider.stripe_connect_account_id ? 'Continue Setup' : 'Set Up Payments'}
            </button>
          )}
        </div>

        {/* Background Check */}
        <div style={{
          padding: 16, borderRadius: 10, marginBottom: 10,
          background: Colors.white, border: `1px solid ${Colors.lightGray}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>
              Background Check
            </p>
            <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>
              {provider.background_check_status === 'not_started' && 'Required before your first visit. Your admin will initiate this.'}
              {provider.background_check_status === 'pending' && 'Background check is in progress. You\'ll be notified when it clears.'}
              {provider.background_check_status === 'cleared' && 'Background check cleared.'}
              {provider.background_check_status === 'failed' && 'Background check issue. Please contact your supervisor.'}
            </p>
          </div>
          <span style={{
            fontSize: 12, padding: '4px 10px', borderRadius: 6, fontWeight: 700,
            background: provider.background_check_status === 'cleared' ? '#e6f5ee'
              : provider.background_check_status === 'failed' ? '#fde8e8'
              : provider.background_check_status === 'pending' ? '#fff3cd' : '#f5f5f5',
            color: provider.background_check_status === 'cleared' ? Colors.success
              : provider.background_check_status === 'failed' ? '#c53030'
              : provider.background_check_status === 'pending' ? '#856404' : Colors.medGray,
          }}>
            {provider.background_check_status === 'not_started' ? 'Not Started' :
             provider.background_check_status === 'pending' ? 'In Progress' :
             provider.background_check_status === 'cleared' ? '✓ Cleared' : '✗ Failed'}
          </span>
        </div>
      </div>

      {/* ═══ SECTION 2: TRAINING ═══ */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>📚</span> Training Materials
        </h2>
        <p style={{ color: Colors.medGray, fontSize: 13, marginBottom: 16 }}>
          Complete these training materials before your shadow rides. Click each to view the content.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {materials.map(mat => {
            const linkedStep = progress.find(p => p.step?.training_material_id === mat.id);
            const isComplete = linkedStep?.status === 'completed';
            return (
              <div key={mat.id} style={{
                padding: 14, borderRadius: 10, background: Colors.white,
                border: `1px solid ${isComplete ? Colors.success + '40' : Colors.lightGray}`,
                cursor: mat.content_body || mat.content_url ? 'pointer' : 'default',
                transition: 'border-color 0.15s',
              }}
              onClick={() => {
                if (mat.content_url) window.open(mat.content_url, '_blank');
              }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18 }}>
                    {mat.content_type === 'video' ? '🎬' : mat.content_type === 'quiz' ? '📝' : '📄'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 13, color: Colors.charcoal }}>{mat.title}</p>
                    <p style={{ margin: 0, fontSize: 11, color: Colors.medGray }}>
                      {mat.duration_minutes ? `${mat.duration_minutes} min` : ''} {mat.content_type}
                    </p>
                  </div>
                  {isComplete && <span style={{ fontSize: 14, color: Colors.success }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ SECTION 3: ONBOARDING STEPS PROGRESS ═══ */}
      {progress.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>✅</span> Onboarding Checklist
          </h2>

          {progress
            .sort((a, b) => (a.step?.sort_order || 0) - (b.step?.sort_order || 0))
            .map(item => {
              const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                pending: { label: 'Pending', color: Colors.medGray, bg: '#f5f5f5' },
                in_progress: { label: 'In Progress', color: Colors.copper, bg: '#fdf3e6' },
                completed: { label: 'Complete', color: Colors.success, bg: '#e6f5ee' },
                skipped: { label: 'Skipped', color: Colors.silver, bg: '#f0f0f0' },
              };
              const cfg = statusConfig[item.status] || statusConfig.pending;

              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  borderRadius: 8, marginBottom: 4, background: Colors.white,
                  border: `1px solid ${item.status === 'completed' ? Colors.success + '30' : Colors.lightGray}`,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700,
                  }}>
                    {item.status === 'completed' ? '✓' : item.step?.sort_order ? Math.floor(item.step.sort_order / 10) : '·'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 500, color: item.status === 'completed' ? Colors.medGray : Colors.charcoal,
                      textDecoration: item.status === 'completed' ? 'line-through' : 'none',
                    }}>
                      {item.step?.title || 'Step'}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                    background: cfg.bg, color: cfg.color,
                  }}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {phase === 'complete' && (
        <div style={{
          textAlign: 'center', padding: 32, background: Colors.sageMuted, borderRadius: 12,
          border: `1px solid ${Colors.success}30`, marginBottom: 24,
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
          <h2 style={{ color: Colors.success, marginBottom: 8 }}>Onboarding Complete!</h2>
          <p style={{ color: Colors.charcoal, marginBottom: 16 }}>
            You are now a certified Canopy technician. Head to the Pro Portal to view your assignments.
          </p>
          <button onClick={() => navigate('/pro-portal')} style={{
            padding: '10px 24px', background: Colors.sage, color: 'var(--color-white)', border: 'none',
            borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}>
            Go to Pro Portal
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function DocumentCard({ title, description, status, signedAt, actionLabel, onAction }: {
  title: string;
  description: string;
  status: 'pending' | 'signed';
  signedAt?: string | null;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div style={{
      padding: 16, borderRadius: 10, marginBottom: 10,
      background: Colors.white, border: `1px solid ${status === 'signed' ? Colors.success + '40' : Colors.lightGray}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>
          {status === 'signed' && signedAt
            ? `Signed ${new Date(signedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            : description}
        </p>
      </div>
      {status === 'signed' ? (
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: Colors.sageMuted, color: Colors.success, fontWeight: 700 }}>
          ✓ Signed
        </span>
      ) : (
        <button onClick={onAction} style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
          background: Colors.sage, color: 'var(--color-white)', border: 'none', cursor: 'pointer',
        }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function UploadCard({ title, description, status, uploadedAt, uploading, onUpload, accept, helpText }: {
  title: string;
  description: string;
  status: 'pending' | 'signed';
  uploadedAt?: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  accept: string;
  helpText?: string;
}) {
  return (
    <div style={{
      padding: 16, borderRadius: 10, marginBottom: 10,
      background: Colors.white, border: `1px solid ${status === 'signed' ? Colors.success + '40' : Colors.lightGray}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>
          {status === 'signed' && uploadedAt
            ? `Uploaded ${new Date(uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            : description}
        </p>
        {helpText && status !== 'signed' && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: Colors.silver, fontStyle: 'italic' }}>{helpText}</p>
        )}
      </div>
      {status === 'signed' ? (
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: Colors.sageMuted, color: Colors.success, fontWeight: 700 }}>
          ✓ Uploaded
        </span>
      ) : (
        <label style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 6,
          background: Colors.copper, color: 'var(--color-white)', cursor: uploading ? 'wait' : 'pointer',
          opacity: uploading ? 0.6 : 1,
        }}>
          {uploading ? 'Uploading...' : 'Upload'}
          <input
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
