import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { uploadPhoto, getDocuments, createDocument, deleteDocument, getSecureNotes, createSecureNote, deleteSecureNote, getVaultPin, upsertVaultPin } from '@/services/supabase';
import { canAccess } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';
import InspectionUploader from '@/components/InspectionUploader';
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
  const [vaultPinHash, setVaultPinHash] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(true); // Default unlocked; lock screen shows only when PIN exists
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinError, setPinError] = useState('');

  // Hash PIN with user ID as salt using Web Crypto API (SHA-256)
  const hashPin = async (pin: string, userId: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${userId}:vault:${pin}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

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
          getVaultPin(user.id),
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
        if (pinData?.pin_hash) {
          setVaultPinHash(pinData.pin_hash);
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
    if (pinInput.length < 4) {
      setPinError('PIN must be at least 4 digits.');
      return;
    }
    try {
      if (user?.id) {
        const hashed = await hashPin(pinInput, user.id);
        await upsertVaultPin(user.id, hashed);
        setVaultPinHash(hashed);
      }
      setIsPinUnlocked(true);
      setShowPinSetup(false);
      setPinInput('');
    } catch (err) {
      console.warn('Failed to save PIN:', err);
      setPinError('Failed to save PIN. Please try again.');
    }
  };

  const handleUnlockPin = async () => {
    setPinError('');
    if (!user?.id) return;
    const hashed = await hashPin(pinInput, user.id);
    if (hashed === vaultPinHash) {
      setIsPinUnlocked(true);
      setPinInput('');
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPinInput('');
    }
  };

  const handleAddSecureNote = async () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) {
      alert('Please enter both a title and content for your secure note.');
      return;
    }
    if (!home?.id) {
      alert('No home profile found. Please complete onboarding first.');
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
      alert('Failed to save note: ' + (err.message || 'Unknown error'));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      alert('No home profile found. Please complete onboarding first.');
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
      alert('Failed to upload: ' + (err.message || 'Unknown error'));
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
            background: Colors.copperMuted,
            border: `2px solid ${Colors.copper}`,
            textAlign: 'center',
            padding: 32
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 16, color: Colors.copper }}>DV</div>
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
        <div className="card mb-lg" style={{ borderLeft: `4px solid ${Colors.copper}` }}>
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

        {/* Secure Notes PIN Protection */}
        {hasSecureNotesAccess && vaultPinHash && !isPinUnlocked && (
          <div className="card" style={{
            background: Colors.copperMuted,
            border: `2px solid ${Colors.copper}`,
            marginBottom: 24,
            padding: 32,
            textAlign: 'center'
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 16, color: Colors.copper }}>PIN</div>
            <h3 style={{ color: Colors.charcoal, marginBottom: 8 }}>Vault Locked</h3>
            <p className="text-sm text-gray" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              Enter your PIN to access secure notes and sensitive information.
            </p>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
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
                fontSize: 20,
                letterSpacing: 8,
                textAlign: 'center',
                border: `1px solid ${Colors.lightGray}`,
                borderRadius: 4,
                fontFamily: 'monospace'
              }}
            />
            {pinError && (
              <p style={{ color: Colors.warning, fontSize: 12, marginBottom: 16 }}>{pinError}</p>
            )}
            <button
              className="btn btn-primary"
              onClick={handleUnlockPin}
              style={{ width: '100%' }}
            >
              Unlock
            </button>
          </div>
        )}

        {/* Set/Change PIN Button (when unlocked or no PIN) */}
        {hasSecureNotesAccess && isPinUnlocked && (
          <button
            onClick={() => {
              if (vaultPinHash) {
                if (confirm('Change your vault PIN?')) {
                  setPinInput('');
                  setShowPinSetup(true);
                }
              } else {
                setShowPinSetup(true);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 16,
              fontSize: 13,
              fontWeight: 600,
              color: Colors.copper,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0
            }}
          >
            {vaultPinHash ? 'Change Vault PIN' : 'Set Vault PIN'}
          </button>
        )}

        {/* PIN Setup Form */}
        {hasSecureNotesAccess && showPinSetup && isPinUnlocked && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ color: Colors.charcoal, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>
              {vaultPinHash ? 'Change' : 'Set'} Vault PIN
            </h3>
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
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: 8,
                fontSize: 16,
                letterSpacing: 6,
                textAlign: 'center',
                border: `1px solid ${Colors.lightGray}`,
                borderRadius: 4,
                fontFamily: 'monospace'
              }}
            />
            {pinError && (
              <p style={{ color: Colors.warning, fontSize: 12, marginBottom: 16 }}>{pinError}</p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowPinSetup(false);
                  setPinInput('');
                  setPinError('');
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSetPin}
                style={{ flex: 1 }}
              >
                Save PIN
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
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: Colors.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 16, color: Colors.copper }}>DOC</div>
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
                      color: Colors.copper,
                      width: 40,
                      height: 40,
                      borderRadius: 4,
                      background: Colors.cream,
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
                            alert('Failed to delete document. Please try again.');
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
                          border: `1px solid ${newNoteCategory === cat.value ? Colors.copper : Colors.lightGray}`,
                          background: newNoteCategory === cat.value ? Colors.copper : 'transparent',
                          color: newNoteCategory === cat.value ? Colors.white : Colors.charcoal,
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
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontWeight: 700, fontSize: 14, color: Colors.copper }}>SN</div>
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
                          background: Colors.copperMuted,
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
                            background: Colors.copperMuted,
                            color: Colors.copper,
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
                          background: Colors.cream,
                          padding: 12,
                          borderRadius: 4,
                          marginBottom: 12,
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontSize: 13,
                          color: Colors.charcoal,
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
                                alert('Failed to delete note. Please try again.');
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
