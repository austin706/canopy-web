// ═══════════════════════════════════════════════════════════════════════════
// AgentPreOnboard — agent-side property pre-fill for a gift code
// ═══════════════════════════════════════════════════════════════════════════
//
// 2026-05-07 (Phase 1, AGENT_PREONBOARD_LIVE_SCAN_SPEC_2026-05-07.md):
// agent collects property details for a gift code BEFORE the buyer redeems.
// On redemption, the existing pending_home flow in services/agents.ts creates
// the home record automatically and the buyer lands on a dashboard with the
// home set up (skipping onboarding).
//
// ARCHITECTURE NOTE: original spec called for shadow-home rows the agent
// would own and transfer at redemption. During implementation we found that
// gift_codes already has a pending_home JSONB column with a working
// redemption path (lines 67-77 of services/agents.ts). Pivoting to extend
// that pattern was a strict simplification: no migration, no edge function,
// no RLS policy work, smaller code surface, same agent UX. Equipment scan
// in Phase 2 will still need shadow-home work — that's where the bigger
// architecture lives. For now, Phase 1 is just "extend pending_home with
// the fields agents have at hand."
//
// RLS NOTE: gift_codes.UPDATE policy is `redeemed_by IS NULL OR redeemed_by
// = auth.uid()`. Agents can update their own unredeemed codes.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import { Colors, FontSize, Spacing, BorderRadius, FontWeight } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import logger from '@/utils/logger';

// Match the shapes used elsewhere in the agent flow.
interface PendingHome {
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  year_built?: number;
  square_footage?: number;
  stories?: number;
  bedrooms?: number;
  bathrooms?: number;
  garage_spaces?: number;
  foundation_type?: string;
  roof_type?: string;
  roof_install_year?: number;
  heating_type?: string;
  cooling_type?: string;
  lawn_type?: string;
  has_pool?: boolean;
  has_deck?: boolean;
  has_sprinkler_system?: boolean;
  has_fireplace?: boolean;
  google_place_id?: string | null;
}

interface GiftCode {
  id: string;
  code: string;
  tier: string;
  duration_months: number;
  agent_id: string;
  client_name?: string | null;
  client_email?: string | null;
  redeemed_by?: string | null;
  redeemed_at?: string | null;
  expires_at?: string | null;
  pending_home?: PendingHome | null;
}

export default function AgentPreOnboard() {
  const navigate = useNavigate();
  const { codeId } = useParams<{ codeId: string }>();
  const { user } = useStore();

  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<GiftCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state — mirrors AgentPortal handleCreateClient field set, plus
  // foundation_type and stories which were missing there.
  const [form, setForm] = useState<PendingHome>({
    address: '',
    city: '',
    state: '',
    zip_code: '',
    year_built: undefined,
    square_footage: undefined,
    stories: 1,
    bedrooms: 3,
    bathrooms: 2,
    garage_spaces: 2,
    foundation_type: '',
    roof_type: '',
    roof_install_year: undefined,
    heating_type: '',
    cooling_type: '',
    lawn_type: 'none',
    has_pool: false,
    has_deck: false,
    has_sprinkler_system: false,
    has_fireplace: false,
    google_place_id: null,
  });

  // Role gate — agents and admins only.
  useEffect(() => {
    if (user && !['agent', 'admin'].includes(user.role || '')) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Load the gift code + any existing pending_home.
  useEffect(() => {
    if (!codeId || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('gift_codes')
          .select('id, code, tier, duration_months, agent_id, client_name, client_email, redeemed_by, redeemed_at, expires_at, pending_home')
          .eq('id', codeId)
          .single();
        if (fetchErr) throw fetchErr;
        if (cancelled) return;
        setCode(data as GiftCode);
        // Hydrate the form with any existing pre-onboard data so the agent
        // can edit a partial entry without losing fields.
        if (data?.pending_home && typeof data.pending_home === 'object') {
          setForm((prev) => ({ ...prev, ...(data.pending_home as PendingHome) }));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Could not load this code.';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [codeId, user?.id]);

  const update = <K extends keyof PendingHome>(key: K, value: PendingHome[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!code) return;
    if (!form.address?.trim()) {
      showToast({ message: 'Street address is required.' });
      return;
    }
    if (!form.city?.trim() || !form.state?.trim() || !form.zip_code?.trim()) {
      showToast({ message: 'City, state, and ZIP are required.' });
      return;
    }
    setSaving(true);
    try {
      // Strip empty strings before persisting so JSONB stays clean.
      const cleaned: PendingHome = {};
      (Object.keys(form) as Array<keyof PendingHome>).forEach((k) => {
        const v = form[k];
        if (v === '' || v === undefined || v === null) return;
        // narrow assignment — we know the shape matches
        (cleaned as Record<string, unknown>)[k] = v;
      });
      const { error: updateErr } = await supabase
        .from('gift_codes')
        .update({ pending_home: cleaned })
        .eq('id', code.id);
      if (updateErr) throw updateErr;
      showToast({ message: 'Home pre-onboarded. Your client will land on a ready-to-use dashboard when they redeem.' });
      navigate('/agent-portal/purchase-codes');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed.';
      logger.error('[AgentPreOnboard] save failed', e);
      showToast({ message: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: Spacing.xl, textAlign: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !code) {
    return (
      <div style={{ padding: Spacing.xl }} className="card">
        <h2>Couldn't load this code</h2>
        <p className="text-gray">{error ?? 'Code not found.'}</p>
        <button className="btn btn-primary mt-md" onClick={() => navigate('/agent-portal/purchase-codes')}>
          Back to codes
        </button>
      </div>
    );
  }

  const codeIsRedeemed = !!code.redeemed_by;
  const clientLabel = code.client_name || code.client_email || 'your client';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: Spacing.xl }}>
      <button
        onClick={() => navigate('/agent-portal/purchase-codes')}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: Spacing.md }}
      >
        ← Back to codes
      </button>

      <header style={{ marginBottom: Spacing.lg }}>
        <p style={{
          fontSize: FontSize.xs, fontWeight: FontWeight.bold,
          letterSpacing: 1.2, textTransform: 'uppercase', color: Colors.copper,
          margin: '0 0 4px 0',
        }}>
          Pre-onboard the home
        </p>
        <h1 style={{ fontSize: FontSize.xxl, fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.2 }}>
          For {clientLabel}
        </h1>
        <p className="text-gray" style={{ margin: 0 }}>
          Code <code style={{ color: Colors.copper, fontWeight: 600 }}>{code.code}</code>{' '}
          · {code.tier === 'pro' ? 'Pro' : 'Home'} plan, {code.duration_months} months
        </p>
        {codeIsRedeemed && (
          <div className="card" style={{ marginTop: Spacing.md, background: Colors.warning + '15', borderColor: Colors.warning + '40' }}>
            This code has already been redeemed. Editing the pre-fill won't change the existing home.
          </div>
        )}
      </header>

      {/* Property Address */}
      <section className="card" style={{ marginBottom: Spacing.lg, padding: Spacing.lg }}>
        <h2 style={{ fontSize: FontSize.lg, marginBottom: Spacing.md }}>Property Address</h2>
        <div className="form-group">
          <label>Street Address *</label>
          <AddressAutocomplete
            value={form.address ?? ''}
            onChange={(v) => update('address', v)}
            onPlaceSelected={(d) => {
              if (d.address) update('address', d.address);
              if (d.city) update('city', d.city);
              if (d.state) update('state', d.state);
              if (d.zipCode) update('zip_code', d.zipCode.split('-')[0]);
              if (d.placeId) update('google_place_id', d.placeId);
            }}
            placeholder="3003 W 77th St"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>City *</label>
            <input
              className="form-input"
              autoComplete="address-level2"
              value={form.city ?? ''}
              onChange={(e) => update('city', e.target.value)}
              placeholder="Tulsa"
            />
          </div>
          <div className="form-group">
            <label>State *</label>
            <input
              className="form-input"
              autoComplete="address-level1"
              value={form.state ?? ''}
              onChange={(e) => update('state', e.target.value.toUpperCase())}
              placeholder="OK"
              maxLength={2}
            />
          </div>
          <div className="form-group">
            <label>ZIP *</label>
            <input
              className="form-input"
              autoComplete="postal-code"
              inputMode="numeric"
              value={form.zip_code ?? ''}
              onChange={(e) => update('zip_code', e.target.value)}
              placeholder="74103"
              maxLength={5}
            />
          </div>
        </div>
      </section>

      {/* Property Basics */}
      <section className="card" style={{ marginBottom: Spacing.lg, padding: Spacing.lg }}>
        <h2 style={{ fontSize: FontSize.lg, marginBottom: Spacing.md }}>Basics</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Year Built</label>
            <input
              className="form-input"
              type="number"
              value={form.year_built ?? ''}
              onChange={(e) => update('year_built', e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="1998"
            />
          </div>
          <div className="form-group">
            <label>Square Footage</label>
            <input
              className="form-input"
              type="number"
              value={form.square_footage ?? ''}
              onChange={(e) => update('square_footage', e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="2400"
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Stories</label>
            <input
              className="form-input"
              type="number"
              value={form.stories ?? ''}
              onChange={(e) => update('stories', e.target.value ? parseInt(e.target.value, 10) : 1)}
            />
          </div>
          <div className="form-group">
            <label>Bedrooms</label>
            <input
              className="form-input"
              type="number"
              value={form.bedrooms ?? ''}
              onChange={(e) => update('bedrooms', e.target.value ? parseInt(e.target.value, 10) : 0)}
            />
          </div>
          <div className="form-group">
            <label>Bathrooms</label>
            <input
              className="form-input"
              type="number"
              step={0.5}
              value={form.bathrooms ?? ''}
              onChange={(e) => update('bathrooms', e.target.value ? parseFloat(e.target.value) : 0)}
            />
          </div>
          <div className="form-group">
            <label>Garage Spaces</label>
            <input
              className="form-input"
              type="number"
              value={form.garage_spaces ?? ''}
              onChange={(e) => update('garage_spaces', e.target.value ? parseInt(e.target.value, 10) : 0)}
            />
          </div>
        </div>
      </section>

      {/* Roof + HVAC + Foundation */}
      <section className="card" style={{ marginBottom: Spacing.lg, padding: Spacing.lg }}>
        <h2 style={{ fontSize: FontSize.lg, marginBottom: Spacing.md }}>Systems</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Roof Type</label>
            <select
              className="form-select"
              value={form.roof_type ?? ''}
              onChange={(e) => update('roof_type', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="asphalt_shingle">Asphalt Shingle</option>
              <option value="metal">Metal</option>
              <option value="tile">Tile</option>
              <option value="slate">Slate</option>
              <option value="flat">Flat</option>
              <option value="wood_shake">Wood Shake</option>
            </select>
          </div>
          <div className="form-group">
            <label>Roof Install Year</label>
            <input
              className="form-input"
              type="number"
              value={form.roof_install_year ?? ''}
              onChange={(e) => update('roof_install_year', e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="2015"
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Heating</label>
            <select
              className="form-select"
              value={form.heating_type ?? ''}
              onChange={(e) => update('heating_type', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="central_gas">Central Gas</option>
              <option value="central_electric">Central Electric</option>
              <option value="heat_pump">Heat Pump</option>
              <option value="boiler">Boiler</option>
              <option value="radiant">Radiant</option>
              <option value="none">None</option>
            </select>
          </div>
          <div className="form-group">
            <label>Cooling</label>
            <select
              className="form-select"
              value={form.cooling_type ?? ''}
              onChange={(e) => update('cooling_type', e.target.value)}
            >
              <option value="">Select...</option>
              <option value="central_ac">Central AC</option>
              <option value="heat_pump">Heat Pump</option>
              <option value="window_units">Window Units</option>
              <option value="evaporative">Evaporative</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Foundation Type</label>
          <select
            className="form-select"
            value={form.foundation_type ?? ''}
            onChange={(e) => update('foundation_type', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="slab">Slab</option>
            <option value="crawlspace">Crawlspace</option>
            <option value="basement">Basement</option>
            <option value="pier">Pier</option>
          </select>
        </div>
      </section>

      {/* Features */}
      <section className="card" style={{ marginBottom: Spacing.lg, padding: Spacing.lg }}>
        <h2 style={{ fontSize: FontSize.lg, marginBottom: Spacing.md }}>Features</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([
            ['has_pool', 'Pool'],
            ['has_deck', 'Deck'],
            ['has_sprinkler_system', 'Sprinkler system'],
            ['has_fireplace', 'Fireplace'],
          ] as const).map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={(e) => update(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="form-group" style={{ marginTop: Spacing.md }}>
          <label>Lawn Type</label>
          <select
            className="form-select"
            value={form.lawn_type ?? 'none'}
            onChange={(e) => update('lawn_type', e.target.value)}
          >
            <option value="none">None</option>
            <option value="bermuda">Bermuda</option>
            <option value="fescue">Fescue</option>
            <option value="bluegrass">Bluegrass</option>
            <option value="zoysia">Zoysia</option>
            <option value="st_augustine">St. Augustine</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
      </section>

      {/* Save */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', marginTop: Spacing.lg }}>
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/agent-portal/purchase-codes')}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || codeIsRedeemed}
          aria-label="Save pre-onboard"
        >
          {saving ? 'Saving...' : codeIsRedeemed ? 'Code already redeemed' : 'Save pre-onboard'}
        </button>
      </div>
      <p className="text-gray text-sm" style={{ textAlign: 'center', marginTop: Spacing.md, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', borderRadius: BorderRadius.md }}>
        When your client redeems this code, this property data will create their home automatically. They'll land on a ready-to-use dashboard with a maintenance plan generated for the address.
      </p>
    </div>
  );
}
