import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { getWarrantiesForHome, deleteWarranty, upsertWarranty } from '@/services/supabase';
import { Colors, Spacing } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { WarrantyForm } from '@/components/WarrantyForm';
import type { Warranty } from '@/types';

export default function Warranties() {
  const navigate = useNavigate();
  const { user, home } = useStore();
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddWarranty, setShowAddWarranty] = useState(false);
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring_soon' | 'expired'>('all');

  useEffect(() => {
    if (!home) return;
    setLoading(true);
    getWarrantiesForHome(home.id)
      .then(setWarranties)
      .catch(err => {
        console.error('Error loading warranties:', err);
        showToast({ message: 'Error loading warranties' });
      })
      .finally(() => setLoading(false));
  }, [home]);

  if (!user || !home) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Warranties</h1>
        </div>
        <p className="text-center">Loading...</p>
      </div>
    );
  }

  const getFilteredWarranties = () => {
    return warranties.filter(w => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return w.status === 'active' && (w.days_until_expiry ?? 0) >= 0;
      if (filterStatus === 'expiring_soon') return w.status === 'active' && (w.days_until_expiry ?? 0) >= 0 && (w.days_until_expiry ?? 0) <= 60;
      if (filterStatus === 'expired') return w.status === 'expired' || (w.days_until_expiry ?? 0) < 0;
      return true;
    }).sort((a, b) => {
      const aExpiry = a.days_until_expiry ?? 999999;
      const bExpiry = b.days_until_expiry ?? 999999;
      return aExpiry - bExpiry;
    });
  };

  const handleSaveWarranty = async (warranty: Warranty) => {
    try {
      const saved = await upsertWarranty(warranty);
      setWarranties(prev => {
        const idx = prev.findIndex(w => w.id === warranty.id);
        if (idx >= 0) {
          return [...prev.slice(0, idx), saved, ...prev.slice(idx + 1)];
        }
        return [...prev, saved];
      });
      setShowAddWarranty(false);
      setEditingWarranty(null);
      showToast({ message: warranty.id && warranties.find(w => w.id === warranty.id) ? 'Warranty updated' : 'Warranty added' });
    } catch (err: any) {
      showToast({ message: 'Error saving warranty: ' + (err.message || 'Unknown error') });
    }
  };

  const handleDeleteWarranty = async (warrantyId: string) => {
    if (!confirm('Delete this warranty permanently?')) return;
    try {
      await deleteWarranty(warrantyId);
      setWarranties(prev => prev.filter(w => w.id !== warrantyId));
      showToast({ message: 'Warranty deleted' });
    } catch (err: any) {
      showToast({ message: 'Error deleting warranty: ' + (err.message || 'Unknown error') });
    }
  };

  const filteredWarranties = getFilteredWarranties();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
            &larr; Home
          </button>
          <h1>Warranties</h1>
          <p className="subtitle">Track warranty coverage for your home systems and equipment</p>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Add Warranty Section */}
        {!showAddWarranty && !editingWarranty && (
          <div style={{ marginBottom: Spacing.lg }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddWarranty(true)}
              style={{ width: '100%' }}
            >
              + Add Warranty
            </button>
          </div>
        )}

        {(showAddWarranty || editingWarranty) && (
          <WarrantyForm
            warranty={editingWarranty || undefined}
            homeId={home.id}
            onSave={handleSaveWarranty}
            onCancel={() => {
              setShowAddWarranty(false);
              setEditingWarranty(null);
            }}
          />
        )}

        {/* Filter Tabs */}
        {!showAddWarranty && !editingWarranty && (
          <div style={{ display: 'flex', gap: 8, marginBottom: Spacing.lg, borderBottom: `1px solid ${Colors.lightGray}`, paddingBottom: Spacing.md }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'expiring_soon', label: 'Expiring Soon' },
              { key: 'expired', label: 'Expired' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key as any)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: `${Spacing.sm} ${Spacing.md}`,
                  fontWeight: filterStatus === tab.key ? 700 : 500,
                  color: filterStatus === tab.key ? Colors.sage : Colors.medGray,
                  borderBottom: filterStatus === tab.key ? `3px solid ${Colors.sage}` : 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Warranties List */}
        {loading && !showAddWarranty && !editingWarranty && (
          <p className="text-center text-gray">Loading warranties...</p>
        )}

        {!loading && !showAddWarranty && !editingWarranty && filteredWarranties.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: Spacing.lg }}>
            <p className="text-gray">
              {warranties.length === 0
                ? 'No warranties recorded yet. Add your first warranty!'
                : 'No warranties match the selected filter'}
            </p>
          </div>
        )}

        {!showAddWarranty && !editingWarranty && filteredWarranties.length > 0 && (
          <div className="flex-col gap-md">
            {filteredWarranties.map(warranty => {
              const daysLeft = warranty.days_until_expiry ?? 0;
              const isExpired = warranty.status === 'expired' || daysLeft < 0;
              const isExpiringSoon = daysLeft >= 0 && daysLeft <= 60;

              return (
                <div
                  key={warranty.id}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${isExpired ? Colors.error : isExpiringSoon ? Colors.warning : Colors.sage}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => setEditingWarranty(warranty)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 4px', color: Colors.charcoal }}>{warranty.title}</h3>
                      {warranty.provider && (
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: Colors.medGray }}>
                          {warranty.provider}
                          {warranty.category && ` • ${warranty.category}`}
                        </p>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 12 }}>
                        <div>
                          <p className="text-xs text-gray">Expires</p>
                          <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal }}>
                            {new Date(warranty.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray">Status</p>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {isExpired ? (
                              <span className="badge" style={{ background: 'rgba(244, 67, 54, 0.1)', color: Colors.error }}>
                                Expired
                              </span>
                            ) : isExpiringSoon ? (
                              <span className="badge" style={{ background: 'rgba(255, 152, 0, 0.1)', color: Colors.warning }}>
                                {daysLeft} days
                              </span>
                            ) : (
                              <span className="badge" style={{ background: Colors.sageMuted, color: Colors.sage }}>
                                {daysLeft} days
                              </span>
                            )}
                          </div>
                        </div>
                        {warranty.coverage_type && (
                          <div>
                            <p className="text-xs text-gray">Coverage</p>
                            <p style={{ fontSize: 13, fontWeight: 600, color: Colors.charcoal }}>
                              {warranty.coverage_type.replace(/_/g, ' ')}
                            </p>
                          </div>
                        )}
                      </div>

                      {warranty.policy_number && (
                        <p className="text-xs" style={{ margin: '8px 0 0', color: Colors.medGray }}>
                          Policy: {warranty.policy_number}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginLeft: Spacing.md }}>
                      <button
                        className="btn btn-xs btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingWarranty(warranty);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-xs btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWarranty(warranty.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
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
