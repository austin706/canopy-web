import { useState, useEffect, useMemo } from 'react';
import {
  getAffiliateProducts,
  upsertAffiliateProduct,
  deleteAffiliateProduct,
  type AffiliateProduct,
} from '@/services/supabase';
import { logAdminAction } from '@/services/auditLog';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { showToast } from '@/components/Toast';
import logger from '@/utils/logger';

const CONSUMABLE_TYPES = [
  'filter', 'anode_rod', 'belt', 'battery', 'bulb', 'cartridge',
  'chemical', 'gasket', 'membrane', 'motor', 'pump', 'valve', 'other',
];

const EQUIPMENT_CATEGORIES = [
  '', 'hvac', 'water_heater', 'refrigerator', 'washer', 'dryer',
  'dishwasher', 'oven', 'pool', 'garage_door', 'water_softener', 'sump_pump',
  'fireplace', 'roof', 'solar', 'ventilation', 'water_treatment',
];

const QUALITY_TIERS = [
  { value: '', label: 'Default (no tier)' },
  { value: 'budget', label: 'Budget' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'premium', label: 'Premium' },
];

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  budget: { bg: '#E3F2FD', text: '#1565C0' },
  recommended: { bg: '#E8F5E9', text: '#2E7D32' },
  premium: { bg: '#FFF3E0', text: '#E65100' },
};

type TabType = 'consumables' | 'items_on_hand';

const emptyConsumableProduct: Partial<AffiliateProduct> = {
  consumable_type: 'filter',
  spec_pattern: '',
  product_name: '',
  affiliate_url: '',
  equipment_category: '',
  priority: 0,
  active: true,
  notes: '',
  link_type: 'consumable',
  quality_tier: null,
  price_estimate: null,
  item_key: null,
};

const emptyItemProduct: Partial<AffiliateProduct> = {
  consumable_type: '',
  spec_pattern: null,
  product_name: '',
  affiliate_url: '',
  equipment_category: null,
  priority: 0,
  active: true,
  notes: '',
  link_type: 'item_on_hand',
  quality_tier: 'recommended',
  price_estimate: null,
  item_key: '',
};

export default function AdminAffiliateProducts() {
  const { user } = useStore();
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AffiliateProduct> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('items_on_hand');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getAffiliateProducts();
      setProducts(data);
    } catch (err) {
      logger.error('Failed to load affiliate products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editing || !editing.product_name || !editing.affiliate_url) return;
    setSaving(true);
    try {
      const payload = {
        ...editing,
        spec_pattern: editing.spec_pattern || null,
        equipment_category: editing.equipment_category || null,
        notes: editing.notes || null,
        item_key: editing.item_key || null,
        quality_tier: editing.quality_tier || null,
        price_estimate: editing.price_estimate || null,
        created_by: editing.id ? undefined : user?.id,
      };
      await upsertAffiliateProduct(payload as any);
      await logAdminAction(
        editing.id ? 'affiliate_product_updated' : 'affiliate_product_created',
        'affiliate_products',
        editing.id || 'new',
        { product_name: editing.product_name, link_type: editing.link_type }
      );
      setEditing(null);
      await loadProducts();
    } catch (err) {
      logger.error('Failed to save affiliate product:', err);
      showToast({ message: 'Failed to save. Check console for details.' });
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
      logger.error('Failed to delete:', err);
    }
  };

  // Filter products by tab and search
  // Items on Hand tab: always show all items (including inactive/unlinked seeds) so admin can populate URLs
  // Consumables tab: respect showInactive toggle
  const filteredProducts = useMemo(() => {
    const tabType = activeTab === 'consumables' ? 'consumable' : 'item_on_hand';
    return products.filter((p) => {
      if ((p.link_type || 'consumable') !== tabType) return false;
      // Always show seeded placeholders (empty URL) so admin can populate them
      // For items with real URLs, respect the showInactive toggle
      const isUnlinkedSeed = !p.affiliate_url;
      if (!isUnlinkedSeed && !showInactive && !p.active) return false;
      if (!filter) return true;
      const q = filter.toLowerCase();
      return (
        p.product_name.toLowerCase().includes(q) ||
        (p.consumable_type || '').toLowerCase().includes(q) ||
        (p.spec_pattern || '').toLowerCase().includes(q) ||
        (p.equipment_category || '').toLowerCase().includes(q) ||
        (p.item_key || '').toLowerCase().includes(q) ||
        (p.quality_tier || '').toLowerCase().includes(q)
      );
    });
  }, [products, activeTab, filter, showInactive]);

  // Group items_on_hand products by item_key for the grouped view
  const groupedItems = useMemo(() => {
    if (activeTab !== 'items_on_hand') return {};
    const groups: Record<string, AffiliateProduct[]> = {};
    for (const p of filteredProducts) {
      const key = p.item_key || '(unknown)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    // Sort groups by whether they have active linked products (unlinked first)
    return groups;
  }, [filteredProducts, activeTab]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => {
      const aHasLinks = groupedItems[a].some((p) => p.affiliate_url && p.active);
      const bHasLinks = groupedItems[b].some((p) => p.affiliate_url && p.active);
      if (aHasLinks !== bHasLinks) return aHasLinks ? 1 : -1; // unlinked first
      return a.localeCompare(b);
    });
  }, [groupedItems]);

  const stats = useMemo(() => {
    const itemProducts = products.filter((p) => p.link_type === 'item_on_hand');
    const uniqueItems = new Set(itemProducts.map((p) => p.item_key));
    const linkedItems = new Set(
      itemProducts.filter((p) => p.affiliate_url && p.active).map((p) => p.item_key)
    );
    const consumableProducts = products.filter((p) => (p.link_type || 'consumable') === 'consumable');
    return {
      totalItems: uniqueItems.size,
      linkedItems: linkedItems.size,
      totalConsumables: consumableProducts.filter((p) => p.active).length,
    };
  }, [products]);

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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: Colors.charcoal, margin: 0 }}>
            Affiliate Products
          </h1>
          <p style={{ fontSize: 14, color: Colors.medGray, marginTop: 4 }}>
            Manage Amazon affiliate links for task supplies and equipment consumables.
          </p>
        </div>
        <button
          onClick={() => setEditing(activeTab === 'consumables' ? { ...emptyConsumableProduct } : { ...emptyItemProduct })}
          style={{
            padding: '10px 20px',
            backgroundColor: Colors.sage,
            color: 'var(--color-white)',
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

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ padding: '12px 20px', background: Colors.sageMuted, borderRadius: 8, flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: Colors.sage }}>{stats.linkedItems}/{stats.totalItems}</div>
          <div style={{ fontSize: 12, color: Colors.medGray }}>Items on Hand Linked</div>
        </div>
        <div style={{ padding: '12px 20px', background: Colors.copperMuted, borderRadius: 8, flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: Colors.copper }}>{stats.totalConsumables}</div>
          <div style={{ fontSize: 12, color: Colors.medGray }}>Active Consumable Links</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `2px solid ${Colors.lightGray}` }}>
        {([
          { key: 'items_on_hand' as TabType, label: 'Items on Hand', count: stats.totalItems },
          { key: 'consumables' as TabType, label: 'Consumables', count: stats.totalConsumables },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setFilter(''); }}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              borderBottom: activeTab === tab.key ? `3px solid ${Colors.copper}` : '3px solid transparent',
              background: 'transparent',
              color: activeTab === tab.key ? Colors.copper : Colors.medGray,
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder={activeTab === 'items_on_hand' ? 'Search items...' : 'Search by type, name, spec, or category...'}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...inputStyle, maxWidth: 360 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: Colors.medGray, cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
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
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setEditing(null)}
        >
          <div
            style={{
              background: Colors.white, borderRadius: 12, padding: 28,
              width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: Colors.charcoal, marginBottom: 20 }}>
              {editing.id ? 'Edit' : 'New'} {editing.link_type === 'item_on_hand' ? 'Item' : 'Consumable'} Product
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editing.link_type === 'item_on_hand' ? (
                <>
                  <div>
                    <label style={labelStyle}>Item Name (matched against items_to_have_on_hand) *</label>
                    <input
                      type="text"
                      value={editing.item_key || ''}
                      onChange={(e) => setEditing({ ...editing, item_key: e.target.value.toLowerCase().trim() })}
                      placeholder="e.g., gutter scoop or trowel"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Quality Tier</label>
                    <select
                      value={editing.quality_tier || ''}
                      onChange={(e) => setEditing({ ...editing, quality_tier: (e.target.value || null) as any })}
                      style={inputStyle}
                    >
                      {QUALITY_TIERS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Estimated Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editing.price_estimate ?? ''}
                      onChange={(e) => setEditing({ ...editing, price_estimate: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="e.g., 14.99"
                      style={inputStyle}
                    />
                  </div>
                </>
              ) : (
                <>
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
                    <label style={labelStyle}>Spec Pattern (e.g., "20x25x1")</label>
                    <input
                      type="text"
                      value={editing.spec_pattern || ''}
                      onChange={(e) => setEditing({ ...editing, spec_pattern: e.target.value })}
                      placeholder="Optional — exact match against consumable spec"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Equipment Category</label>
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
                    <label style={labelStyle}>Quality Tier</label>
                    <select
                      value={editing.quality_tier || ''}
                      onChange={(e) => setEditing({ ...editing, quality_tier: (e.target.value || null) as any })}
                      style={inputStyle}
                    >
                      {QUALITY_TIERS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Estimated Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editing.price_estimate ?? ''}
                      onChange={(e) => setEditing({ ...editing, price_estimate: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="e.g., 14.99"
                      style={inputStyle}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={labelStyle}>Product Name *</label>
                <input
                  type="text"
                  value={editing.product_name || ''}
                  onChange={(e) => setEditing({ ...editing, product_name: e.target.value })}
                  placeholder="e.g., Amerimax Gutter Scoop — Heavy Duty"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Amazon Affiliate URL *</label>
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
                  padding: '10px 20px', borderRadius: 8,
                  border: `1px solid ${Colors.lightGray}`, background: Colors.white,
                  fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editing.product_name || !editing.affiliate_url}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none',
                  background: saving ? Colors.silver : Colors.sage,
                  color: 'var(--color-white)', fontWeight: 600, fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p style={{ color: Colors.medGray, padding: 20 }}>Loading...</p>
      ) : activeTab === 'items_on_hand' ? (
        /* ── Items on Hand: Grouped View ── */
        sortedGroupKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: Colors.medGray }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No items found.</p>
            <p style={{ fontSize: 13 }}>Run the migration to seed items from task templates, then add affiliate URLs here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedGroupKeys.map((itemKey) => {
              const itemProducts = groupedItems[itemKey];
              const hasActiveLink = itemProducts.some((p) => p.affiliate_url && p.active);
              const displayName = itemProducts[0]?.product_name || itemKey;

              return (
                <div
                  key={itemKey}
                  style={{
                    border: `1px solid ${hasActiveLink ? Colors.sage + '40' : Colors.lightGray}`,
                    borderRadius: 10,
                    padding: 16,
                    background: hasActiveLink ? '#FAFFF8' : '#fff',
                  }}
                >
                  {/* Item header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasActiveLink ? 10 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: hasActiveLink ? Colors.sage : Colors.silver,
                        flexShrink: 0,
                      }} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>
                        {displayName}
                      </span>
                      {!hasActiveLink && (
                        <span style={{
                          fontSize: 11, color: Colors.silver, background: Colors.lightGray,
                          padding: '1px 8px', borderRadius: 4,
                        }}>
                          needs link
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setEditing({
                        ...emptyItemProduct,
                        item_key: itemKey,
                      })}
                      style={{
                        padding: '4px 12px', fontSize: 12, borderRadius: 6,
                        border: `1px solid ${Colors.copper}40`, background: Colors.copperMuted,
                        color: Colors.copper, cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      + Add Option
                    </button>
                  </div>

                  {/* Product options for this item */}
                  {itemProducts.filter((p) => p.affiliate_url).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', marginTop: 6,
                        background: p.active ? '#fff' : '#f9f9f9',
                        border: `1px solid ${Colors.lightGray}`,
                        borderRadius: 6, opacity: p.active ? 1 : 0.5,
                      }}
                    >
                      {p.quality_tier && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: TIER_COLORS[p.quality_tier]?.bg || '#f0f0f0',
                          color: TIER_COLORS[p.quality_tier]?.text || '#666',
                          textTransform: 'capitalize',
                        }}>
                          {p.quality_tier}
                        </span>
                      )}
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: Colors.charcoal }}>
                        {p.product_name}
                      </span>
                      {p.price_estimate && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: Colors.sage }}>
                          ${p.price_estimate.toFixed(2)}
                        </span>
                      )}
                      <a
                        href={p.affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: Colors.copper, textDecoration: 'none' }}
                        title={p.affiliate_url}
                      >
                        link
                      </a>
                      <button
                        onClick={() => setEditing({ ...p })}
                        style={{
                          padding: '2px 8px', fontSize: 11, borderRadius: 4,
                          border: `1px solid ${Colors.lightGray}`, background: Colors.white,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        style={{
                          padding: '2px 8px', fontSize: 11, borderRadius: 4,
                          border: '1px solid #FFCDD2', background: Colors.cream,
                          color: '#C62828', cursor: 'pointer',
                        }}
                      >
                        Del
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Consumables: Table View (existing pattern) ── */
        filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: Colors.medGray }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No consumable products yet.</p>
            <p style={{ fontSize: 13 }}>Add affiliate links for equipment consumables (filters, anode rods, etc.).</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${Colors.lightGray}`, textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Type</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Spec</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Equipment</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Product</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Tier</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Price</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">URL</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Pri</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Status</th>
                  <th style={{ padding: '10px 12px', color: Colors.medGray, fontWeight: 600 }} scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${Colors.lightGray}`, opacity: p.active ? 1 : 0.5 }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: Colors.sageMuted, color: Colors.sage,
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      }}>
                        {(p.consumable_type || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: p.spec_pattern ? Colors.charcoal : Colors.silver }}>
                      {p.spec_pattern || '(any)'}
                    </td>
                    <td style={{ padding: '10px 12px', color: p.equipment_category ? Colors.charcoal : Colors.silver }}>
                      {p.equipment_category?.replace(/_/g, ' ') || '(any)'}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: Colors.charcoal, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.product_name}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.quality_tier ? (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: TIER_COLORS[p.quality_tier]?.bg || '#f0f0f0',
                          color: TIER_COLORS[p.quality_tier]?.text || '#666',
                          textTransform: 'capitalize',
                        }}>
                          {p.quality_tier}
                        </span>
                      ) : (
                        <span style={{ color: Colors.silver, fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: p.price_estimate ? Colors.charcoal : Colors.silver }}>
                      {p.price_estimate ? `$${p.price_estimate.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={p.affiliate_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: Colors.copper, textDecoration: 'none' }} title={p.affiliate_url}>
                        {p.affiliate_url.replace(/https?:\/\/(www\.)?/, '').slice(0, 25)}...
                      </a>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{p.priority}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                        background: p.active ? '#E8F5E9' : '#FBE9E7',
                        color: p.active ? '#2E7D32' : '#C62828',
                      }}>
                        {p.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditing({ ...p })} style={{
                          padding: '4px 10px', fontSize: 12, borderRadius: 4,
                          border: `1px solid ${Colors.lightGray}`, background: Colors.white, cursor: 'pointer',
                        }}>Edit</button>
                        <button onClick={() => handleDelete(p)} style={{
                          padding: '4px 10px', fontSize: 12, borderRadius: 4,
                          border: '1px solid #FFCDD2', background: Colors.cream, color: '#C62828', cursor: 'pointer',
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
