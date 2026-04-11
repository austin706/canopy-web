import { useState, useEffect } from 'react';
import {
  getAffiliateProducts,
  upsertAffiliateProduct,
  deleteAffiliateProduct,
  type AffiliateProduct,
} from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';

const CONSUMABLE_TYPES = [
  'filter',
  'anode_rod',
  'belt',
  'battery',
  'bulb',
  'cartridge',
  'chemical',
  'gasket',
  'membrane',
  'motor',
  'pump',
  'valve',
  'other',
];

const EQUIPMENT_CATEGORIES = [
  '', // any
  'hvac',
  'water_heater',
  'refrigerator',
  'washer',
  'dryer',
  'dishwasher',
  'oven',
  'pool',
  'garage_door',
  'water_softener',
  'sump_pump',
];

const emptyProduct: Partial<AffiliateProduct> = {
  consumable_type: 'filter',
  spec_pattern: '',
  product_name: '',
  affiliate_url: '',
  equipment_category: '',
  priority: 0,
  active: true,
  notes: '',
};

export default function AdminAffiliateProducts() {
  const { user } = useStore();
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AffiliateProduct> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getAffiliateProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load affiliate products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editing || !editing.consumable_type || !editing.product_name || !editing.affiliate_url) return;
    setSaving(true);
    try {
      const payload = {
        ...editing,
        spec_pattern: editing.spec_pattern || null,
        equipment_category: editing.equipment_category || null,
        notes: editing.notes || null,
        created_by: editing.id ? undefined : user?.id,
      };
      await upsertAffiliateProduct(payload as any);
      await logAdminAction(
        editing.id ? 'affiliate_product_updated' : 'affiliate_product_created',
        'affiliate_products',
        editing.id || 'new',
        { product_name: editing.product_name, consumable_type: editing.consumable_type }
      );
      setEditing(null);
      await loadProducts();
    } catch (err) {
      console.error('Failed to save affiliate product:', err);
      alert('Failed to save. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: AffiliateProduct) => {
    if (!confirm(`Delete "${product.product_name}"? This cannot be undone.`)) return;
    try {
      await deleteAffiliateProduct(product.id);
      await logAdminAction('affiliate_product_deleted', 'affiliate_products', product.id, {
        product_name: product.product_name,
      });
      await loadProducts();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!showInactive && !p.active) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      p.consumable_type.toLowerCase().includes(q) ||
      p.product_name.toLowerCase().includes(q) ||
      (p.spec_pattern || '').toLowerCase().includes(q) ||
      (p.equipment_category || '').toLowerCase().includes(q)
    );
  });

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${Colors.lightGray}`,
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600 as const,
    color: Colors.medGray,
    marginBottom: 4,
    display: 'block' as const,
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: Colors.charcoal, margin: 0 }}>
            Affiliate Products
          </h1>
          <p style={{ fontSize: 14, color: Colors.medGray, marginTop: 4 }}>
            Manage Canopy affiliate links. Matched to consumables by type + spec to auto-populate purchase URLs.
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...emptyProduct })}
          style={{
            padding: '10px 20px',
            backgroundColor: Colors.sage,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by type, name, spec, or category..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...inputStyle, maxWidth: 360 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: Colors.medGray, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <span style={{ fontSize: 13, color: Colors.silver, marginLeft: 'auto' }}>
          {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEditing(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 28,
              width: '100%',
              maxWidth: 540,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, marginBottom: 20 }}>
              {editing.id ? 'Edit' : 'New'} Affiliate Product
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Consumable Type *</label>
                <select
                  value={editing.consumable_type || ''}
                  onChange={(e) => setEditing({ ...editing, consumable_type: e.target.value })}
                  style={inputStyle}
                >
                  {CONSUMABLE_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Spec Pattern (e.g., "20x25x1" for filter size — leave blank for generic fallback)</label>
                <input
                  type="text"
                  value={editing.spec_pattern || ''}
                  onChange={(e) => setEditing({ ...editing, spec_pattern: e.target.value })}
                  placeholder="Optional — exact match against consumable spec"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Equipment Category (optional — narrows which equipment this applies to)</label>
                <select
                  value={editing.equipment_category || ''}
                  onChange={(e) => setEditing({ ...editing, equipment_category: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Any equipment</option>
                  {EQUIPMENT_CATEGORIES.filter(Boolean).map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Product Name *</label>
                <input
                  type="text"
                  value={editing.product_name || ''}
                  onChange={(e) => setEditing({ ...editing, product_name: e.target.value })}
                  placeholder="e.g., Filtrete 20x25x1 MPR 1500 (3-pack)"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Canopy Affiliate URL *</label>
                <input
                  type="url"
                  value={editing.affiliate_url || ''}
                  onChange={(e) => setEditing({ ...editing, affiliate_url: e.target.value })}
                  placeholder="https://www.amazon.com/dp/...?tag=canopy-20"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Priority (higher wins)</label>
                  <input
                    type="number"
                    value={editing.priority ?? 0}
                    onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value) || 0 })}
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', paddingBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={editing.active !== false}
                      onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Admin Notes (internal only)</label>
                <textarea
                  value={editing.notes || ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Commission rate, seasonal notes, etc."
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditing(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: `1px solid ${Colors.lightGray}`,
                  background: '#fff',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.product_name || !editing.affiliate_url}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: saving ? Colors.silver : Colors.sage,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ color: Colors.medGray, padding: 20 }}>Loading...</p>
      ) : filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: Colors.medGray }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No affiliate products yet.</p>
          <p style={{ fontSize: 13 }}>Add your first Canopy affiliate link to start auto-populating purchase URLs on consumables.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${Colors.lightGray}`, textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }}>Type</th>
                <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }}>Spec</th>
                <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }}>Equipment</th>
                <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }}>Product Name</th>
                <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }}>URL</th>
                <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }}>Priority</th>
                <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: `1px solid ${Colors.lightGray}`,
                    opacity: p.active ? 1 : 0.5,
                  }}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: Colors.sageMuted,
                      color: Colors.sage,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {p.consumable_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: p.spec_pattern ? Colors.charcoal : Colors.silver }}>
                    {p.spec_pattern || '(any)'}
                  </td>
                  <td style={{ padding: '10px 12px', color: p.equipment_category ? Colors.charcoal : Colors.silver }}>
                    {p.equipment_category?.replace(/_/g, ' ') || '(any)'}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: Colors.charcoal, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.product_name}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a
                      href={p.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: Colors.copper, textDecoration: 'none' }}
                      title={p.affiliate_url}
                    >
                      {p.affiliate_url.replace(/https?:\/\/(www\.)?/, '').slice(0, 30)}...
                    </a>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{p.priority}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: p.active ? '#E8F5E9' : '#FBE9E7',
                      color: p.active ? '#2E7D32' : '#C62828',
                    }}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setEditing({ ...p })}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: `1px solid ${Colors.lightGray}`,
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 12,
                          borderRadius: 4,
                          border: '1px solid #FFCDD2',
                          background: '#FFF5F5',
                          color: '#C62828',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
