import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { uploadPhoto, getDocuments, createDocument, deleteDocument, getSecureNotes, createSecureNote, deleteSecureNote, hasVaultPin, setVaultPin, verifyVaultPin, removeVaultPin } from '@/services/supabase';
import { canAccess } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';
import InspectionUploader from '@/components/InspectionUploader';
import { showToast } from '@/components/Toast';
import type { SecureNote } from '@/types';

interface Document {
  id: string;
  name: string;
  category: 'warranty' | 'manual' | 'receipt' | 'inspection' | 'insurance' | 'other';
  uploadDate: string;
  url: string;
}

const CATEGORIES: { value: Document['category']; label: string; abbr: string }[] = [
  { value: 'warranty', label: 'Warranty', abbr: 'WR' },
  { value: 'manual', label: 'Manual', abbr: 'MN' },
  { value: 'receipt', label: 'Receipt', abbr: 'RC' },
  { value: 'inspection', label: 'Inspection', abbr: 'IN' },
  { value: 'insurance', label: 'Insurance', abbr: 'IS' },
  { value: 'other', label: 'Other', abbr: 'OT' },
];

const SECURE_NOTE_CATEGORIES: { label: string; value: SecureNote['category'] }[] = [
  { label: 'Alarm Code', value: 'alarm_code' },
  { label: 'Door Code', value: 'door_code' },
  { label: 'Gate Code', value: 'gate_code' },
  { label: 'WiFi Password', value: 'wifi_password' },
  { label: 'Safe Combination', value: 'safe_combination' },
  { label: 'Utility Account', value: 'utility_account' },
  { label: 'Other', value: 'other' },
];

export default function Documents() {
  const { user, home } = useStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Secure Notes state
  const [secureNotes, setSecureNotes] = useState<SecureNote[]>([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<SecureNote['category']>('other');
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  // PIN Protection state
  const [hasPinSet, setHasPinSet] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(true); // Default unlocked; lock screen shows only when PIN exists
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinMode, setPinMode] = useState<'setup' | 'change' | 'unlock' | null>(null); // Track PIN operation mode
  const [oldPinInput, setOldPinInput] = useState(''); // For Change PIN: store old PIN entry

  // PIN hashing is now handled server-side via pgcrypto bcrypt RPCs

  const tier = user?.subscription_tier || 'free';
  const hasAccess = canAccess(tier, 'document_vault');
  const hasSecureNotesAccess = canAccess(tier, 'secure_notes');

  // Fetch documents, secure notes, and vault PIN on mount
  useEffect(() => {
    const loadData = async () => {
      if (!home?.id || !user?.id) return;
      setNotesLoading(true);
      try {
        const [docs, notes, pinData] = await Promise.all([
          getDocuments(home.id),
          getSecureNotes(home.id),
          hasVaultPin(user.id),
        ]);
        // Map DB rows to local Document shape
        setDocuments(docs.map((row: any) => ({
          id: row.id,
          name: row.title,
          category: row.category,
          uploadDate: row.created_at,
          url: row.file_url || '',
        })));
        setSecureNotes(notes);
        if (pinData === true) {
          setHasPinSet(true);
          setIsPinUnlocked(false); // Lock vault when PIN exists
        }
      } catch (err) {
        console.warn('Failed to load documents/notes/PIN:', err);
      } finally {
        setNotesLoading(false);
      }
    };
    loadData();
  }, [home?.id, user?.id]);

  const handleSetPin = async () => {
    setPinError('');
    // For Change mode: verify old PIN first
    if (pinMode === 'change') {
      if (oldPinInput.length === 0) {
        setPinError('Please enter your current PIN to change it.');
        return;
      }
      if (!user?.id) return;
      const oldValid = await verifyVaultPin(user.id, oldPinInput);
      if (!oldValid) {
        setPinError('The PIN you entered does not match your current PIN.');
        setOldPinInput('');
        return;
      }
    }

    if (pinInput.length < 4) {
      setPinError('PIN must be at least 4 digits.');
      return;
    }
    try {
      if (user?.id) {
        await setVaultPin(user.id, pinInput);
        setHasPinSet(true);
      }
      setIsPinUnlocked(true);
      setShowPinSetup(false);
      setPinInput('');
      setOldPinInput('');
      setPinMode(null);
    } catch (err) {
      console.warn('Failed to save PIN:', err);
      setPinError('Failed to save PIN. Please try again.');
    }
  };

  const handleUnlockPin = async () => {
    setPinError('');
    if (!user?.id) return;
    const valid = await verifyVaultPin(user.id, pinInput);
    if (valid) {
      setIsPinUnlocked(true);
      setPinMode(null);
      setPinInput('');
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPinInput('');
    }
  };

  const handleAddSecureNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) {
      showToast({ message: 'Please enter both a title and content for your secure note.' });
      return;
    }
    if (!home?.id) {
      showToast({ message: 'No home profile found. Please complete onboarding first.' });
      return;
    }
    try {
      const saved = await createSecureNote({
        home_id: home.id,
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        category: newNoteCategory,
      });
      setSecureNotes([saved, ...secureNotes]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setNewNoteCategory('other');
      setShowAddNote(false);
    } catch (err: any) {
      console.error('Failed to save secure note:', err);
      showToast({ message: 'Failed to save note: ' + (err.message || 'Unknown error') });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size validation (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = Math.round(file.size / 1024 / 1024);
      showToast({ message: `File too large (${fileSizeMB}MB). Maximum file size is 10MB. Please choose a smaller file.` });
      return;
    }

    const categoryPrompt = prompt('Select document category:\n1. Warranty\n2. Manual\n3. Receipt\n4. Inspection\n5. Insurance\n6. Other\n\nEnter number (1-6):');
    if (!categoryPrompt) return;

    const categoryMap: Record<string, Document['category']> = {
      '1': 'warranty',
      '2': 'manual',
      '3': 'receipt',
      '4': 'inspection',
      '5': 'insurance',
      '6': 'other',
    };

    const category = categoryMap[categoryPrompt] || 'other';

    if (!home?.id || !user?.id) {
      showToast({ message: 'No home profile found. Please complete onboarding first.' });
      return;
    }

    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const publicUrl = await uploadPhoto('documents', fileName, file);

      // Persist metadata to Supabase
      const saved = await createDocument({
        home_id: home.id,
        user_id: user.id,
        title: file.name,
        category,
        file_url: publicUrl,
      });

      const newDoc: Document = {
        id: saved.id,
        name: saved.title,
        category: saved.category,
        uploadDate: saved.created_at,
        url: saved.file_url || publicUrl,
      };

      setDocuments(prev => [newDoc, ...prev]);
    } catch (err: any) {
      showToast({ message: 'Failed to upload: ' + (err.message || 'Unknown error') });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filtered = filter === 'all' ? documents : documents.filter(d => d.category === filter);

  if (!hasAccess) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Document Vault</h1>
            <p className="subtitle">Store and organize your home documents</p>
          </div>
        </div>

        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="card" style={{
            background: 'var(--color-copper-muted, #FFF3E0)',
            border: `2px solid var(--color-copper)`,
            textAlign: 'center',
            padding: 32
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-copper-muted, #FFF3E0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 16, color: 'var(--color-copper)' }}>DV</div>
            <h3 style={{ color: Colors.charcoal, marginBottom: 8 }}>Document Vault is Locked</h3>
            <p className="text-sm text-gray" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              Store and organize all your home documents in one secure place. Upgrade to Home plan or higher to access this feature.
            </p>
            <button className="btn btn-primary" onClick={() => window.location.href = '/subscription'}>
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Document Vault</h1>
          <p className="subtitle">Warranties, manuals, insurance documents</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          + {uploading ? 'Uploading...' : 'Add Document'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        />
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Home Inspection AI Analysis */}
        <div className="card mb-lg" style={{ borderLeft: `4px solid var(--color-copper)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Home Inspection Analysis</h3>
              <p style={{ fontSize: 13, color: Colors.medGray, margin: '4px 0 0 0' }}>
                Upload your home inspection report and our AI will extract maintenance tasks automatically.
              </p>
            </div>
          </div>
          <InspectionUploader />
        </div>

        {/* PIN Protection — Distinct modals per operation */}
        {pinMode === 'unlock' && hasSecureNotesAccess && hasPinSet && !isPinUnlocked && (
          <div className="card" style={{
            borderLeft: `4px solid var(--color-copper)`,
            marginBottom: 24,
            padding: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 24 }}>🔓</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: Colors.charcoal, marginBottom: 4, fontSize: 16, fontWeight: 600 }}>Unlock Vault</h3>
                <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>Enter your PIN to access documents</p>
              </div>
            </div>
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ''));
                setPinError('');
              }}
              maxLength={8}
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: 8,
                fontSize: 20,
                letterSpacing: 8,
                textAlign: 'center',
                border: `1px solid var(--color-border)`,
                borderRadius: 4,
                fontFamily: 'monospace'
              }}
            />
            {pinError && (
              <p style={{ color: 'var(--color-warning)', fontSize: 12, marginBottom: 16 }}>{pinError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setPinMode(null); setPinInput(''); }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUnlockPin}
                style={{ flex: 1 }}
              >
                Unlock
              </button>
            </div>
          </div>
        )}

        {/* Locked state card */}
        {hasSecureNotesAccess && hasPinSet && !isPinUnlocked && pinMode !== 'unlock' && (
          <div className="card" style={{
            background: 'var(--color-copper-muted, #FFF3E0)',
            border: `2px solid var(--color-copper)`,
            marginBottom: 24,
            padding: 32,
            textAlign: 'center'
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-copper-muted, #FFF3E0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 16, color: 'var(--color-copper)' }}>🔒</div>
            <h3 style={{ color: Colors.charcoal, marginBottom: 8 }}>Vault Locked</h3>
            <p className="text-sm text-gray" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              Documents are locked until you unlock with your PIN.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => { setPinMode('unlock'); setPinInput(''); }}
              style={{ width: '100%' }}
            >
              🔓 Unlock Vault
            </button>
          </div>
        )}

        {/* Set/Change PIN Button (when unlocked or no PIN) */}
        {hasSecureNotesAccess && isPinUnlocked && (
          <button
            onClick={() => {
              if (hasPinSet) {
                setPinMode('change');
                setPinInput('');
                setOldPinInput('');
                setPinError('');
              } else {
                setPinMode('setup');
                setPinInput('');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-copper)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0
            }}
          >
            {hasPinSet ? 'Change Vault PIN' : 'Set Vault PIN'}
          </button>
        )}

        {/* Set PIN Modal */}
        {pinMode === 'setup' && hasSecureNotesAccess && (
          <div className="card" style={{ marginBottom: 24, borderLeft: `4px solid var(--color-sage)` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 24 }}>🔒</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: Colors.charcoal, marginBottom: 4, fontSize: 16, fontWeight: 600 }}>Set Up Security</h3>
                <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>Create a 4+ digit PIN for your vault</p>
              </div>
            </div>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter 4+ digit PIN"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ''));
                setPinError('');
              }}
              maxLength={8}
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: 8,
                fontSize: 16,
                letterSpacing: 6,
                textAlign: 'center',
                border: `1px solid var(--color-border)`,
                borderRadius: 4,
                fontFamily: 'monospace'
              }}
            />
            {pinError && (
              <p style={{ color: 'var(--color-warning)', fontSize: 12, marginBottom: 16 }}>{pinError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setPinMode(null); setPinInput(''); setPinError(''); }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSetPin}
                style={{ flex: 1 }}
              >
                Set PIN
              </button>
            </div>
          </div>
        )}

        {/* Change PIN Modal */}
        {pinMode === 'change' && hasSecureNotesAccess && (
          <div className="card" style={{ marginBottom: 24, borderLeft: `4px solid var(--color-info)` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 24 }}>🔄</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ color: Colors.charcoal, marginBottom: 4, fontSize: 16, fontWeight: 600 }}>Change PIN</h3>
                <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>Enter your current PIN, then your new PIN</p>
              </div>
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>Current PIN</label>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter current PIN"
              value={oldPinInput}
              onChange={(e) => {
                setOldPinInput(e.target.value.replace(/\D/g, ''));
                setPinError('');
              }}
              maxLength={8}
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: 12,
                fontSize: 14,
                letterSpacing: 4,
                textAlign: 'center',
                border: `1px solid var(--color-border)`,
                borderRadius: 4,
                fontFamily: 'monospace'
              }}
            />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter new PIN"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ''));
                setPinError('');
              }}
              maxLength={8}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: 8,
                fontSize: 14,
                letterSpacing: 4,
                textAlign: 'center',
                border: `1px solid var(--color-border)`,
                borderRadius: 4,
                fontFamily: 'monospace'
              }}
            />
            {pinError && (
              <p style={{ color: 'var(--color-warning)', fontSize: 12, marginBottom: 16 }}>{pinError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => { setPinMode(null); setPinInput(''); setOldPinInput(''); setPinError(''); }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSetPin}
                style={{ flex: 1 }}
              >
                Change PIN
              </button>
            </div>
          </div>
        )}

        {/* Category Filter */}
        {documents.length > 0 && (
          <div className="tabs mb-lg" style={{ overflow: 'auto' }}>
            <button
              className={`tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({documents.length})
            </button>
            {CATEGORIES.map(cat => {
              const count = documents.filter(d => d.category === cat.value).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.value}
                  className={`tab ${filter === cat.value ? 'active' : ''}`}
                  onClick={() => setFilter(cat.value)}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Documents List */}
        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-background)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 16, color: 'var(--color-copper)' }}>DOC</div>
            <h3 style={{ color: Colors.charcoal, marginBottom: 8 }}>No documents yet</h3>
            <p className="text-sm text-gray" style={{ marginBottom: 16 }}>
              Upload documents to organize warranties, manuals, receipts, and more.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              Add Your First Document
            </button>
          </div>
        ) : (
          <div className="grid-2">
            {filtered.map(doc => {
              const catLabel = CATEGORIES.find(c => c.value === doc.category);
              return (
                <div key={doc.id} className="card">
                  <div style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    marginBottom: 12
                  }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-copper)',
                      width: 40,
                      height: 40,
                      borderRadius: 4,
                      background: 'var(--color-background)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {catLabel?.abbr}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: Colors.charcoal,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {doc.name}
                      </p>
                      <p className="text-xs text-gray">
                        {catLabel?.label} • {new Date(doc.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
                    >
                      Open
                    </a>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={async () => {
                        if (confirm('Delete this document?')) {
                          try {
                            await deleteDocument(doc.id);
                            setDocuments(prev => prev.filter(d => d.id !== doc.id));
                          } catch (err) {
                            console.error('Failed to delete document:', err);
                            showToast({ message: 'Failed to delete document. Please try again.' });
                          }
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Secure Notes Section */}
        {hasSecureNotesAccess && isPinUnlocked && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: Colors.charcoal, marginBottom: 8 }}>
              Secure Notes
            </h2>
            <p className="text-sm text-gray" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              Store sensitive info like alarm codes, door codes, WiFi passwords, and more.
            </p>

            <button
              className="btn btn-primary"
              onClick={() => setShowAddNote(!showAddNote)}
              style={{ marginBottom: 16 }}
            >
              + {showAddNote ? 'Cancel' : 'Add Secure Note'}
            </button>

            {/* Add Note Form */}
            {showAddNote && (
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ color: Colors.charcoal, marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
                  New Secure Note
                </h3>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: Colors.charcoal, marginBottom: 6 }}>
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Front Door Code"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${Colors.lightGray}`,
                      borderRadius: 4,
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: Colors.charcoal, marginBottom: 6 }}>
                    Content
                  </label>
                  <textarea
                    placeholder="e.g., 1234#"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${Colors.lightGray}`,
                      borderRadius: 4,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      minHeight: 80,
                      resize: 'vertical'
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>
                    Category
                  </label>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    {SECURE_NOTE_CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setNewNoteCategory(cat.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 500,
                          border: `1px solid ${newNoteCategory === cat.value ? 'var(--color-copper)' : 'var(--color-border)'}`,
                          background: newNoteCategory === cat.value ? 'var(--color-copper)' : 'transparent',
                          color: newNoteCategory === cat.value ? 'white' : 'var(--color-text)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setShowAddNote(false);
                      setNewNoteTitle('');
                      setNewNoteContent('');
                      setNewNoteCategory('other');
                    }}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddSecureNote}
                    style={{ flex: 1 }}
                  >
                    Save Note
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            {secureNotes.length === 0 && !showAddNote ? (
              <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-copper-muted, #FFF3E0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontWeight: 700, fontSize: 14, color: 'var(--color-copper)' }}>SN</div>
                <h3 style={{ color: Colors.charcoal, marginBottom: 8 }}>No secure notes yet</h3>
                <p className="text-sm text-gray">
                  Add alarm codes, door codes, WiFi passwords, and other sensitive info here.
                </p>
              </div>
            ) : secureNotes.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16
              }}>
                {secureNotes.map(note => {
                  const catLabel = SECURE_NOTE_CATEGORIES.find(c => c.value === note.category);
                  const isExpanded = expandedNoteId === note.id;
                  return (
                    <div
                      key={note.id}
                      className="card"
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <div style={{
                          fontSize: 20,
                          width: 36,
                          height: 36,
                          borderRadius: 4,
                          background: 'var(--color-copper-muted, #FFF3E0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          SN
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontWeight: 600,
                            fontSize: 14,
                            color: Colors.charcoal,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {note.title}
                          </p>
                          <div style={{
                            display: 'inline-block',
                            background: 'var(--color-copper-muted, #FFF3E0)',
                            color: 'var(--color-copper)',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 500,
                            marginTop: 6
                          }}>
                            {catLabel?.label}
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{
                          background: 'var(--color-background)',
                          padding: 12,
                          borderRadius: 4,
                          marginBottom: 12,
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontSize: 13,
                          color: 'var(--color-text)',
                          fontFamily: 'monospace'
                        }}>
                          {note.content}
                        </div>
                      )}
                      <p className="text-xs text-gray" style={{ marginBottom: 12 }}>
                        {new Date(note.created_at).toLocaleDateString()}
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                          style={{ flex: 1 }}
                        >
                          {isExpanded ? 'Hide' : 'View'}
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={async () => {
                            if (confirm('Delete this secure note?')) {
                              try {
                                await deleteSecureNote(note.id);
                                setSecureNotes(prev => prev.filter(n => n.id !== note.id));
                                if (expandedNoteId === note.id) setExpandedNoteId(null);
                              } catch (err) {
                                console.error('Failed to delete note:', err);
                                showToast({ message: 'Failed to delete note. Please try again.' });
                              }
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
