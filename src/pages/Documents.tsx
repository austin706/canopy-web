import { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { uploadPhoto } from '@/services/supabase';
import { canAccess } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';
import type { SecureNote } from '@/types';

interface Document {
  id: string;
  name: string;
  category: 'warranty' | 'manual' | 'receipt' | 'inspection' | 'insurance' | 'other';
  uploadDate: string;
  url: string;
}

const CATEGORIES: { value: Document['category']; label: string; icon: string }[] = [
  { value: 'warranty', label: 'Warranty', icon: '🛡️' },
  { value: 'manual', label: 'Manual', icon: '📖' },
  { value: 'receipt', label: 'Receipt', icon: '🧾' },
  { value: 'inspection', label: 'Inspection', icon: '📋' },
  { value: 'insurance', label: 'Insurance', icon: '📄' },
  { value: 'other', label: 'Other', icon: '📁' },
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
  const { user } = useStore();
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

  // PIN Protection state
  const [vaultPin, setVaultPin] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pinError, setPinError] = useState('');

  const tier = user?.subscription_tier || 'free';
  const hasAccess = canAccess(tier, 'document_vault');
  const hasSecureNotesAccess = canAccess(tier, 'secure_notes');

  const handleSetPin = () => {
    setPinError('');
    if (pinInput.length < 4) {
      setPinError('PIN must be at least 4 digits.');
      return;
    }
    setVaultPin(pinInput);
    setIsPinUnlocked(true);
    setShowPinSetup(false);
    setPinInput('');
  };

  const handleUnlockPin = () => {
    setPinError('');
    if (pinInput === vaultPin) {
      setIsPinUnlocked(true);
      setPinInput('');
    } else {
      setPinError('Incorrect PIN. Try again.');
      setPinInput('');
    }
  };

  const handleAddSecureNote = () => {
    if (!newNoteTitle.trim() || !newNoteContent.trim()) {
      alert('Please enter both a title and content for your secure note.');
      return;
    }
    const newNote: SecureNote = {
      id: Date.now().toString(),
      home_id: user?.id || '',
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      category: newNoteCategory,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSecureNotes([newNote, ...secureNotes]);
    setNewNoteTitle('');
    setNewNoteContent('');
    setNewNoteCategory('other');
    setShowAddNote(false);
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

    setUploading(true);
    try {
      const fileName = `${user?.id}/${Date.now()}-${file.name}`;
      const publicUrl = await uploadPhoto('documents', fileName, file);

      const newDoc: Document = {
        id: Date.now().toString(),
        name: file.name,
        category,
        uploadDate: new Date().toISOString(),
        url: publicUrl,
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
            <p style={{ fontSize: 32, marginBottom: 16 }}>🔒</p>
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
        {/* Secure Notes PIN Protection */}
        {hasSecureNotesAccess && vaultPin && !isPinUnlocked && (
          <div className="card" style={{
            background: Colors.copperMuted,
            border: `2px solid ${Colors.copper}`,
            marginBottom: 24,
            padding: 32,
            textAlign: 'center'
          }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>🔒</p>
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
              if (vaultPin) {
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
            🔐 {vaultPin ? 'Change Vault PIN' : 'Set Vault PIN'}
          </button>
        )}

        {/* PIN Setup Form */}
        {hasSecureNotesAccess && showPinSetup && isPinUnlocked && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ color: Colors.charcoal, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>
              {vaultPin ? 'Change' : 'Set'} Vault PIN
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
                  {cat.icon} {cat.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Documents List */}
        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>📁</p>
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
                      fontSize: 24,
                      width: 40,
                      height: 40,
                      borderRadius: 4,
                      background: Colors.cream,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {catLabel?.icon}
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
                      onClick={() => {
                        if (confirm('Delete this document?')) {
                          setDocuments(prev => prev.filter(d => d.id !== doc.id));
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
              🔐 Secure Notes
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
                <p style={{ fontSize: 28, marginBottom: 12 }}>🔑</p>
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
                          🔑
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
                          onClick={() => {
                            if (confirm('Delete this secure note?')) {
                              setSecureNotes(prev => prev.filter(n => n.id !== note.id));
                              if (expandedNoteId === note.id) setExpandedNoteId(null);
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
