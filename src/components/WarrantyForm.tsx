import { useState } from 'react';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import type { Warranty } from '@/types';

interface WarrantyFormProps {
  warranty?: Warranty;
  equipmentId?: string;
  homeId?: string;
  onSave: (warranty: Warranty) => Promise<void>;
  onCancel: () => void;
}

const CATEGORIES = [
  'appliance', 'hvac', 'water_heater', 'roof', 'siding', 'windows', 'doors',
  'plumbing', 'electrical', 'foundation', 'flooring', 'pool', 'other'
] as const;

const COVERAGE_TYPES = ['manufacturer', 'extended', 'home_warranty', 'builder', 'service_plan', 'other'] as const;

export function WarrantyForm({ warranty, equipmentId, homeId, onSave, onCancel }: WarrantyFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<Partial<Warranty>>({
    id: warranty?.id || crypto.randomUUID(),
    title: warranty?.title || '',
    provider: warranty?.provider || '',
    category: warranty?.category || 'appliance',
    coverage_type: warranty?.coverage_type || 'manufacturer',
    start_date: warranty?.start_date || new Date().toISOString().split('T')[0],
    end_date: warranty?.end_date || '',
    cost_cents: warranty?.cost_cents || undefined,
    claim_phone: warranty?.claim_phone || '',
    claim_email: warranty?.claim_email || '',
    claim_url: warranty?.claim_url || '',
    policy_number: warranty?.policy_number || '',
    document_urls: warranty?.document_urls || [],
    notes: warranty?.notes || '',
    status: warranty?.status || 'active',
    equipment_id: equipmentId,
    home_id: homeId,
  });

  const handleSave = async () => {
    if (!form.title?.trim()) {
      showToast({ message: 'Warranty title is required' });
      return;
    }
    if (!form.end_date) {
      showToast({ message: 'Expiration date is required' });
      return;
    }

    setIsSaving(true);
    try {
      const warranty_obj: Warranty = {
        id: form.id!,
        user_id: '', // Will be set by RLS
        title: form.title,
        provider: form.provider || null,
        category: form.category as any,
        coverage_type: form.coverage_type as any,
        start_date: form.start_date!,
        end_date: form.end_date,
        cost_cents: form.cost_cents || null,
        claim_phone: form.claim_phone || null,
        claim_email: form.claim_email || null,
        claim_url: form.claim_url || null,
        policy_number: form.policy_number || null,
        document_urls: form.document_urls || [],
        notes: form.notes || null,
        status: form.status as any,
        transferred_with_home: form.transferred_with_home ?? false,
        equipment_id: form.equipment_id,
        home_id: form.home_id,
        created_at: warranty?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await onSave(warranty_obj);
      showToast({ message: warranty ? 'Warranty updated' : 'Warranty added' });
    } catch (err: any) {
      showToast({ message: 'Error saving warranty: ' + (err.message || 'Unknown error') });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ background: Colors.cream, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg }}>
      <h3 style={{ marginTop: 0, marginBottom: Spacing.md, color: Colors.charcoal }}>
        {warranty ? 'Edit Warranty' : 'Add Warranty'}
      </h3>

      <div className="flex-col gap-md">
        <div className="form-group">
          <label>Warranty Title *</label>
          <input
            className="form-input"
            placeholder="e.g. Furnace 10-year warranty"
            value={form.title || ''}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Spacing.md }}>
          <div className="form-group">
            <label>Provider</label>
            <input
              className="form-input"
              placeholder="e.g. Carrier, Homeowners Inc"
              value={form.provider || ''}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Policy Number</label>
            <input
              className="form-input"
              value={form.policy_number || ''}
              onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Spacing.md }}>
          <div className="form-group">
            <label>Category</label>
            <select
              className="form-select"
              value={form.category || 'appliance'}
              onChange={(e) => setForm({ ...form, category: e.target.value as any })}
            >
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Coverage Type</label>
            <select
              className="form-select"
              value={form.coverage_type || 'manufacturer'}
              onChange={(e) => setForm({ ...form, coverage_type: e.target.value as any })}
            >
              {COVERAGE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Spacing.md }}>
          <div className="form-group">
            <label>Start Date</label>
            <input
              className="form-input"
              type="date"
              value={form.start_date || ''}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Expiration Date *</label>
            <input
              className="form-input"
              type="date"
              value={form.end_date || ''}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Spacing.md }}>
          <div className="form-group">
            <label>Claim Phone</label>
            <input
              className="form-input"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={form.claim_phone || ''}
              onChange={(e) => setForm({ ...form, claim_phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Claim Email</label>
            <input
              className="form-input"
              type="email"
              value={form.claim_email || ''}
              onChange={(e) => setForm({ ...form, claim_email: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Claim URL</label>
          <input
            className="form-input"
            type="url"
            placeholder="https://..."
            value={form.claim_url || ''}
            onChange={(e) => setForm({ ...form, claim_url: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label>Notes</label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Any additional details..."
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: Spacing.md }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Warranty'}
          </button>
        </div>
      </div>
    </div>
  );
}
