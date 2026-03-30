import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import {
  getActiveTransfer,
  getIncomingTransfers,
  initiateTransfer,
  cancelTransfer,
  acceptTransfer,
  declineTransfer,
  notifyBuyerOfTransfer,
  type HomeTransfer as HomeTransferType,
} from '@/services/homeTransfer';

export default function HomeTransfer() {
  const { user, home } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTransfer, setActiveTransfer] = useState<HomeTransferType | null>(null);
  const [incomingTransfers, setIncomingTransfers] = useState<HomeTransferType[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check if arriving via accept link
  const acceptToken = searchParams.get('token');

  useEffect(() => {
    loadData();
  }, [home?.id, user?.email]);

  const loadData = async () => {
    if (!home?.id || !user?.email) { setLoading(false); return; }
    try {
      setLoading(true);
      const [active, incoming] = await Promise.all([
        getActiveTransfer(home.id),
        getIncomingTransfers(user.email),
      ]);
      setActiveTransfer(active);
      setIncomingTransfers(incoming);
    } catch (err: any) {
      setError(err.message || 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiate = async () => {
    if (!home?.id || !user?.id || !buyerEmail) return;
    if (buyerEmail.toLowerCase() === user.email?.toLowerCase()) {
      setError("You can't transfer to yourself");
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const transfer = await initiateTransfer(home.id, user.id, buyerEmail, transferNotes);
      await notifyBuyerOfTransfer(buyerEmail, user.full_name || 'A Canopy user', home.address || 'their home', transfer.transfer_token || transfer.id);
      setActiveTransfer(transfer);
      setBuyerEmail('');
      setTransferNotes('');
      setSuccess('Transfer initiated! The buyer will be notified.');
    } catch (err: any) {
      setError(err.message || 'Failed to initiate transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeTransfer) return;
    try {
      await cancelTransfer(activeTransfer.id);
      setActiveTransfer(null);
      setSuccess('Transfer cancelled.');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel transfer');
    }
  };

  const handleAccept = async (transfer: HomeTransferType) => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      await acceptTransfer(transfer.id, user.id);
      setSuccess('Home record transferred to you! Refresh to see your new home.');
      setIncomingTransfers(prev => prev.filter(t => t.id !== transfer.id));
      // Reload the page after a short delay to refresh home data
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to accept transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async (transfer: HomeTransferType) => {
    try {
      await declineTransfer(transfer.id);
      setIncomingTransfers(prev => prev.filter(t => t.id !== transfer.id));
      setSuccess('Transfer declined.');
    } catch (err: any) {
      setError(err.message || 'Failed to decline transfer');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header"><h1>Home Token Transfer</h1></div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 8, background: '#E5393520', color: '#C62828', fontSize: 14, marginBottom: 16 }}>{error}</div>}
      {success && <div style={{ padding: '10px 16px', borderRadius: 8, background: Colors.sageMuted, color: Colors.sageDark, fontSize: 14, marginBottom: 16, border: `1px solid ${Colors.sage}` }}>{success}</div>}

      {/* Incoming transfers — shown to buyers */}
      {incomingTransfers.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Incoming Transfers</h2>
          {incomingTransfers.map(t => (
            <div key={t.id} className="card" style={{ padding: 20, marginBottom: 12, borderLeft: `4px solid ${Colors.copper}` }}>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>A home record has been sent to you</p>
              <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 4 }}>
                From: {t.from_user_id}
              </p>
              {t.notes && <p style={{ fontSize: 13, color: Colors.charcoal, fontStyle: 'italic', marginBottom: 12 }}>"{t.notes}"</p>}
              <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 16 }}>
                Expires: {t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'N/A'}
              </p>
              <div style={{
                padding: 12, background: Colors.cream, borderRadius: 8, marginBottom: 16, fontSize: 13, color: Colors.charcoal, lineHeight: 1.6,
              }}>
                Accepting this transfer will give you full ownership of the home's maintenance record, including equipment inventory, maintenance history, pro visit reports, and documents. Secure notes (alarm codes, passwords) are cleared during transfer for safety.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleAccept(t)}
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  {submitting ? 'Accepting...' : 'Accept Transfer'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleDecline(t)}
                  style={{ flex: 1 }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active outgoing transfer */}
      {activeTransfer && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Active Transfer</h2>
          <div className="card" style={{ padding: 20, borderLeft: `4px solid ${Colors.sage}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Transfer Pending</p>
                <p style={{ fontSize: 13, color: Colors.medGray }}>To: {activeTransfer.to_email}</p>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                background: Colors.warning + '20', color: Colors.warning,
              }}>Pending</span>
            </div>
            <p style={{ fontSize: 12, color: Colors.medGray, marginBottom: 16 }}>
              Initiated: {new Date(activeTransfer.initiated_at).toLocaleDateString()} •
              Expires: {activeTransfer.expires_at ? new Date(activeTransfer.expires_at).toLocaleDateString() : 'N/A'}
            </p>
            <button className="btn btn-secondary" onClick={handleCancel} style={{ width: '100%' }}>
              Cancel Transfer
            </button>
          </div>
        </div>
      )}

      {/* Initiate new transfer — only if no active transfer */}
      {!activeTransfer && home && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Transfer Your Home Record</h2>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ fontSize: 32 }}>🏡</div>
              <div>
                <p style={{ fontWeight: 600, color: Colors.charcoal }}>{home.address}</p>
                <p style={{ fontSize: 13, color: Colors.medGray }}>{home.city}, {home.state} {home.zip_code}</p>
              </div>
            </div>

            <div style={{
              padding: 14, background: Colors.cream, borderRadius: 8, marginBottom: 20,
              fontSize: 13, color: Colors.charcoal, lineHeight: 1.6,
            }}>
              <strong>What gets transferred:</strong> Your complete home maintenance record — equipment inventory,
              maintenance logs, pro visit history with inspection reports, and uploaded documents.
              This is your Home Token — the verified history that adds value for the next owner.
              <br /><br />
              <strong>What does NOT transfer:</strong> Your Canopy account, subscription, or secure notes
              (alarm codes, wifi passwords — these are cleared automatically).
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13 }}>Buyer's email address</label>
              <input
                className="form-input"
                type="email"
                placeholder="buyer@example.com"
                value={buyerEmail}
                onChange={e => setBuyerEmail(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13 }}>Note to buyer (optional)</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Any notes about the home, quirks to know about, etc."
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleInitiate}
              disabled={!buyerEmail || submitting}
              style={{ width: '100%', padding: '12px 24px' }}
            >
              {submitting ? 'Initiating...' : 'Send Home Token to Buyer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
