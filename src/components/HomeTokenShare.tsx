import { useState, useEffect, useRef } from 'react';
// @ts-ignore — qrcode.react ships without types
import QRCode from 'qrcode.react';
import { Colors } from '@/constants/theme';
import {
  getHomeTokenAttestations,
  addHomeTokenAttestation,
  generateHomeTokenShareUrl,
  type HomeTokenAttestation,
} from '@/services/homeTransfer';
import { getErrorMessage } from '@/utils/errors';

interface HomeTokenShareProps {
  homeId: string;
  transferToken: string;
  isAgent?: boolean;
  agentName?: string;
  agentBrokerage?: string;
}

export default function HomeTokenShare({
  homeId,
  transferToken,
  isAgent = false,
  agentName,
  agentBrokerage,
}: HomeTokenShareProps) {
  const [attestations, setAttestations] = useState<HomeTokenAttestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [attestationNote, setAttestationNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAttestationForm, setShowAttestationForm] = useState(false);

  const shareUrl = generateHomeTokenShareUrl(transferToken);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAttestations();
  }, [homeId]);

  const loadAttestations = async () => {
    try {
      setLoading(true);
      const data = await getHomeTokenAttestations(homeId);
      setAttestations(data);
    } catch (err: any) {
      console.warn('Failed to load attestations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttestation = async () => {
    if (!attestationNote.trim() || !isAgent) return;
    setSubmitting(true);
    setError('');
    try {
      await addHomeTokenAttestation(homeId, attestationNote, 'agent');
      setAttestationNote('');
      setShowAttestationForm(false);
      setSuccess('Attestation added to Home Token.');
      await loadAttestations();
    } catch (err: any) {
      setError(getErrorMessage(err) || 'Failed to add attestation');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadQR = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `home-token-${homeId.slice(0, 8)}.png`;
    link.click();
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setSuccess('Share link copied to clipboard!');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="page-header"><h1>Share Home Token</h1></div>

      {error && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          background: 'var(--color-error-muted, #E5393520)',
          color: 'var(--color-error)',
          fontSize: 14,
          marginBottom: 16,
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          background: Colors.sageMuted,
          color: Colors.sageDark,
          fontSize: 14,
          marginBottom: 16,
          border: `1px solid ${Colors.sage}`,
        }}>
          {success}
        </div>
      )}

      {/* QR Code Section */}
      <div className="card" style={{ padding: 24, marginBottom: 24, textAlign: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Quick Share</h2>
        <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 16 }}>
          Scan this QR code to share your Home Token with agents or buyers at open houses.
        </p>

        {/* ASSET-PLACEHOLDER: HOME-TOKEN-QR — QR code container with border + badge */}
        <div ref={qrRef} style={{
          padding: 16,
          background: 'white',
          border: `2px solid ${Colors.sage}`,
          borderRadius: 12,
          marginBottom: 16,
          display: 'inline-block',
          position: 'relative',
        }}>
          <QRCode value={shareUrl} size={256} level="H" includeMargin={true} />
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: '4px 8px',
            background: Colors.sage,
            color: 'white',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
          }}>
            HOME TOKEN
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={downloadQR}
            style={{ flex: 1, padding: '10px 16px', fontSize: 13 }}
          >
            ⬇ Download QR
          </button>
          <button
            className="btn btn-secondary"
            onClick={copyShareLink}
            style={{ flex: 1, padding: '10px 16px', fontSize: 13 }}
          >
            🔗 Copy Link
          </button>
        </div>
      </div>

      {/* Share Link (for manual sharing) */}
      <div className="card" style={{ padding: 20, marginBottom: 24, background: Colors.cream, border: `1px solid ${Colors.sage}` }}>
        <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 8 }}>Share Link:</p>
        <div style={{
          padding: 12,
          background: 'white',
          borderRadius: 8,
          fontSize: 12,
          fontFamily: 'monospace',
          wordBreak: 'break-all',
          color: Colors.charcoal,
          border: `1px solid ${Colors.lightGray}`,
        }}>
          {shareUrl}
        </div>
      </div>

      {/* Agent Attestation Section */}
      {isAgent && (
        <div className="card" style={{ padding: 24, marginBottom: 24, borderLeft: `4px solid ${Colors.copper}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Verify This Home</h3>
              <p style={{ fontSize: 13, color: Colors.medGray }}>
                Add your professional attestation to increase buyer confidence.
              </p>
            </div>
            {agentName && (
              <div style={{
                padding: '4px 10px',
                background: 'rgba(139,158,126,0.15)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: Colors.sageDark,
              }}>
                {agentName}{agentBrokerage ? ` · ${agentBrokerage}` : ''}
              </div>
            )}
          </div>

          {!showAttestationForm ? (
            <button
              className="btn btn-primary"
              onClick={() => setShowAttestationForm(true)}
              style={{ width: '100%' }}
            >
              + Add Attestation
            </button>
          ) : (
            <div>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Describe your verification of this home's records. E.g., 'I have reviewed the home's maintenance history and equipment inventory. The records are accurate and complete as of [date].'"
                value={attestationNote}
                onChange={e => setAttestationNote(e.target.value)}
                style={{ marginBottom: 12, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleAddAttestation}
                  disabled={!attestationNote.trim() || submitting}
                  style={{ flex: 1 }}
                >
                  {submitting ? 'Submitting...' : 'Sign & Submit'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAttestationForm(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Existing Attestations */}
      {attestations.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Verification History</h3>
          {attestations.map(att => (
            <div key={att.id} className="card" style={{ padding: 16, marginBottom: 8, background: Colors.cream }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>
                    {att.attestor_name}
                  </p>
                  <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 8 }}>
                    {att.attestor_role === 'agent' ? 'Real Estate Agent' : att.attestor_role === 'inspector' ? 'Inspector' : 'Professional'}
                    {' '}• {new Date(att.signed_at).toLocaleDateString()}
                  </p>
                </div>
                <span style={{
                  padding: '4px 8px',
                  background: 'rgba(139,158,126,0.15)',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: Colors.sageDark,
                }}>
                  ✓ Verified
                </span>
              </div>
              <p style={{ fontSize: 13, color: Colors.charcoal, lineHeight: 1.6 }}>
                {att.statement}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: Colors.medGray }}>
          Loading attestations...
        </div>
      )}
    </div>
  );
}
