import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getClientHome, upsertClientHome, getProfile, updateProfile } from '@/services/supabase';
import { attestHomeRecord, calculateCompletenessScore } from '@/services/homeTransfer';
import { Colors } from '@/constants/theme';
import MessageBanner from '@/components/MessageBanner';

export default function AgentClientHome() {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<any>(null);
  const [home, setHome] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [attestNote, setAttestNote] = useState('');
  const [attesting, setAttesting] = useState(false);
  const [completenessScore, setCompletenessScore] = useState<number | null>(null);
  const [form, setForm] = useState({
    address: '', city: '', state: '', zip_code: '',
    year_built: '', square_footage: '',
    stories: '1', bedrooms: '3', bathrooms: '2', garage_spaces: '2',
    roof_type: '', roof_age_years: '',
    heating_type: '', cooling_type: '',
    has_pool: false, has_deck: false, has_sprinkler_system: false, has_fireplace: false,
    lawn_type: 'none',
  });

  useEffect(() => {
    if (!clientId) return;
    const load = async () => {
      try {
        const [profileData, homeData] = await Promise.all([
          getProfile(clientId),
          getClientHome(clientId),
        ]);
        setClient(profileData);
        if (homeData) {
          setHome(homeData);
          if (homeData.agent_attestation_note) setAttestNote(homeData.agent_attestation_note);
          // Load completeness score
          try { const s = await calculateCompletenessScore(homeData.id); setCompletenessScore(s); } catch {}
          setForm({
            address: homeData.address || '', city: homeData.city || '', state: homeData.state || '', zip_code: homeData.zip_code || '',
            year_built: homeData.year_built?.toString() || '', square_footage: homeData.square_footage?.toString() || '',
            stories: homeData.stories?.toString() || '1', bedrooms: homeData.bedrooms?.toString() || '3',
            bathrooms: homeData.bathrooms?.toString() || '2', garage_spaces: homeData.garage_spaces?.toString() || '2',
            roof_type: homeData.roof_type || '', roof_age_years: homeData.roof_age_years?.toString() || '',
            heating_type: homeData.heating_type || '', cooling_type: homeData.cooling_type || '',
            has_pool: homeData.has_pool || false, has_deck: homeData.has_deck || false,
            has_sprinkler_system: homeData.has_sprinkler_system || false, has_fireplace: homeData.has_fireplace || false,
            lawn_type: homeData.lawn_type || 'none',
          });
        }
      } catch (e: any) {
        setMessage('Failed to load client data');
      } finally { setLoading(false); }
    };
    load();
  }, [clientId]);

  const handleSave = async () => {
    if (!clientId || !form.address) return;
    setSaving(true);
    try {
      const homeData: any = {
        id: home?.id || crypto.randomUUID(),
        user_id: clientId,
        ...form,
        year_built: form.year_built ? parseInt(form.year_built) : null,
        square_footage: form.square_footage ? parseInt(form.square_footage) : null,
        stories: parseInt(form.stories) || 1,
        bedrooms: parseInt(form.bedrooms) || 3,
        bathrooms: parseInt(form.bathrooms) || 2,
        garage_spaces: parseInt(form.garage_spaces) || 0,
        roof_age_years: form.roof_age_years ? parseInt(form.roof_age_years) : null,
        created_at: home?.created_at || new Date().toISOString(),
      };
      const saved = await upsertClientHome(homeData);
      setHome(saved);
      // Mark onboarding complete for the client if this is their first home
      if (!home) {
        try { await updateProfile(clientId, { onboarding_complete: true }); } catch {}
      }
      setMessage('Home saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (e: any) {
      setMessage('Failed to save: ' + e.message);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page text-center" style={{ paddingTop: 100 }}><div className="spinner" style={{ width: 40, height: 40 }} /></div>;

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/agent-portal')}>&larr; Back to Agent Portal</button>
          <h1>{home ? 'Edit' : 'Set Up'} Home</h1>
          {client && <p className="subtitle">For {client.full_name || client.email}</p>}
        </div>
      </div>

      {message && (
        <MessageBanner message={message} />
      )}

      <div className="card">
        <h2 style={{ fontSize: 18, marginBottom: 20 }}>{home ? 'Edit Home Details' : 'Set Up Client Home'}</h2>
        <div className="form-group"><label>Address *</label><input className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
        <div className="grid-3">
          <div className="form-group"><label>City</label><input className="form-input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
          <div className="form-group"><label>State</label><input className="form-input" value={form.state} onChange={e => setForm({...form, state: e.target.value})} /></div>
          <div className="form-group"><label>Zip</label><input className="form-input" value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label>Year Built</label><input className="form-input" type="number" value={form.year_built} onChange={e => setForm({...form, year_built: e.target.value})} /></div>
          <div className="form-group"><label>Sq Ft</label><input className="form-input" type="number" value={form.square_footage} onChange={e => setForm({...form, square_footage: e.target.value})} /></div>
        </div>
        <div className="grid-4">
          <div className="form-group"><label>Stories</label><input className="form-input" type="number" value={form.stories} onChange={e => setForm({...form, stories: e.target.value})} /></div>
          <div className="form-group"><label>Beds</label><input className="form-input" type="number" value={form.bedrooms} onChange={e => setForm({...form, bedrooms: e.target.value})} /></div>
          <div className="form-group"><label>Baths</label><input className="form-input" type="number" value={form.bathrooms} onChange={e => setForm({...form, bathrooms: e.target.value})} /></div>
          <div className="form-group"><label>Garage</label><input className="form-input" type="number" value={form.garage_spaces} onChange={e => setForm({...form, garage_spaces: e.target.value})} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>Roof Type</label>
            <select className="form-select" value={form.roof_type} onChange={e => setForm({...form, roof_type: e.target.value})}>
              <option value="">Select...</option>
              {['asphalt_shingle','metal','tile','slate','flat','wood_shake'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Roof Age (years)</label><input className="form-input" type="number" value={form.roof_age_years} onChange={e => setForm({...form, roof_age_years: e.target.value})} /></div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>Heating</label>
            <select className="form-select" value={form.heating_type} onChange={e => setForm({...form, heating_type: e.target.value})}>
              <option value="">Select...</option>
              {['forced_air','heat_pump','radiant','boiler','baseboard'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Cooling</label>
            <select className="form-select" value={form.cooling_type} onChange={e => setForm({...form, cooling_type: e.target.value})}>
              <option value="">Select...</option>
              {['central_ac','heat_pump','window_units','mini_split','none'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>Lawn Type</label>
            <select className="form-select" value={form.lawn_type} onChange={e => setForm({...form, lawn_type: e.target.value as any})}>
              <option value="none">None</option>
              {['bermuda','fescue','zoysia','st_augustine','bluegrass','buffalo','mixed'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="form-group"><label>&nbsp;</label><p className="text-xs text-gray" style={{ padding: '10px 0' }}>Used for seasonal lawn care tasks</p></div>
        </div>
        <div className="grid-2 mt-md">
          {(['has_pool','has_deck','has_sprinkler_system','has_fireplace'] as const).map(key => (
            <label key={key} className="flex items-center gap-sm" style={{ cursor: 'pointer', padding: '8px 0' }}>
              <input type="checkbox" checked={form[key] as boolean} onChange={e => setForm({...form, [key]: e.target.checked})} />
              <span style={{ fontSize: 14 }}>{key.replace(/has_/,'').replace(/_/g,' ')}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-sm mt-lg">
          <button className="btn btn-ghost" onClick={() => navigate('/agent-portal')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.address}>{saving ? 'Saving...' : 'Save Home'}</button>
        </div>
      </div>

      {/* Agent Attestation Section */}
      {home && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Record Verification</h2>

          {/* Completeness Score */}
          {completenessScore !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: 16, background: 'var(--color-copper-muted, #FFF3E0)', borderRadius: 8 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 30,
                background: `conic-gradient(${completenessScore >= 70 ? Colors.sage : completenessScore >= 40 ? Colors.warning : Colors.error} ${completenessScore * 3.6}deg, var(--color-border) 0deg)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 24, background: 'var(--color-copper-muted, #FFF3E0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: Colors.charcoal }}>{completenessScore}</span>
                </div>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: Colors.charcoal }}>Record Completeness: {completenessScore}/100</p>
                <p style={{ fontSize: 13, color: Colors.medGray }}>
                  {completenessScore >= 80 ? 'Excellent — ready for transfer' : completenessScore >= 50 ? 'Good — consider adding more details' : 'Needs attention — key fields are missing'}
                </p>
              </div>
            </div>
          )}

          {/* Current attestation status */}
          {home.agent_attested_at ? (
            <div style={{ padding: 14, background: 'var(--color-sage)', opacity: 0.15, borderRadius: 8, border: `1px solid var(--color-sage)`, marginBottom: 16 }}>
              <p style={{ fontWeight: 600, color: Colors.charcoal, marginBottom: 4 }}>
                ✓ You attested to this record on {new Date(home.agent_attested_at).toLocaleDateString()}
              </p>
              {home.agent_attestation_note && (
                <p style={{ fontSize: 13, color: Colors.medGray, fontStyle: 'italic' }}>"{home.agent_attestation_note}"</p>
              )}
            </div>
          ) : null}

          <p style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12, lineHeight: 1.6 }}>
            As the listing agent, you can attest that this home's maintenance record is accurate and complete.
            This adds a verification badge to the Home Token, increasing buyer confidence.
          </p>

          <div className="form-group">
            <label style={{ fontSize: 13 }}>Attestation Note (optional)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g., Verified all equipment and maintenance records during listing..."
              value={attestNote}
              onChange={e => setAttestNote(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={async () => {
              setAttesting(true);
              try {
                await attestHomeRecord(home.id, attestNote);
                setHome({ ...home, agent_attested_at: new Date().toISOString(), agent_attestation_note: attestNote });
                // Recalculate score
                try { const s = await calculateCompletenessScore(home.id); setCompletenessScore(s); } catch {}
                setMessage('Record attested successfully!');
                setTimeout(() => setMessage(''), 3000);
              } catch (e: any) {
                setMessage('Failed to attest: ' + e.message);
              } finally { setAttesting(false); }
            }}
            disabled={attesting}
            style={{ width: '100%' }}
          >
            {attesting ? 'Attesting...' : home.agent_attested_at ? 'Update Attestation' : 'Attest to Record Accuracy'}
          </button>
        </div>
      )}
    </div>
  );
}
