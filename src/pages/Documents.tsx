import { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { uploadPhoto } from '@/services/supabase';
import { canAccess } from '@/services/subscriptionGate';
import { Colors } from '@/constants/theme';

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

export default function Documents() {
  const { user } = useStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tier = user?.subscription_tier || 'free';
  const hasAccess = canAccess(tier, 'document_vault');

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
      </div>
    </div>
  );
}
