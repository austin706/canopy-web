// ═══════════════════════════════════════════════════════════════
// RecallAlertBanner — Prominent recall warning on Dashboard
// ═══════════════════════════════════════════════════════════════
// Shows active CPSC recall matches for the user's equipment.
// Each match shows the recall title, affected equipment, hazard,
// and links to the CPSC detail page. Users can dismiss matches.

import { useState, useEffect } from 'react';
import { getRecallMatches, dismissRecallMatch, type RecallMatch } from '@/services/recalls';
import { Colors } from '@/constants/theme';

export default function RecallAlertBanner() {
  const [matches, setMatches] = useState<RecallMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  useEffect(() => {
    getRecallMatches()
      .then(setMatches)
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = async (matchId: string) => {
    setDismissing(matchId);
    try {
      await dismissRecallMatch(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch {
      // non-fatal
    } finally {
      setDismissing(null);
    }
  };

  if (loading || matches.length === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      {matches.map((match) => {
        const recall = match.equipment_recalls;
        const equip = match.equipment;
        if (!recall) return null;

        return (
          <div
            key={match.id}
            style={{
              background: '#FFF3E0',
              border: `1px solid ${Colors.warning}`,
              borderRadius: 10,
              padding: '14px 16px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: Colors.warning,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 18,
                color: '#fff',
                fontWeight: 700,
              }}
            >
              !
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: Colors.warning,
                    background: `${Colors.warning}20`,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  Safety Recall
                </span>
                {match.match_confidence === 'high' && (
                  <span style={{ fontSize: 11, color: Colors.error, fontWeight: 600 }}>High confidence match</span>
                )}
                {match.match_confidence === 'medium' && (
                  <span style={{ fontSize: 11, color: Colors.warning, fontWeight: 600 }}>Possible match</span>
                )}
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>
                {recall.title}
              </p>
              {equip && (
                <p style={{ margin: '0 0 4px', fontSize: 13, color: Colors.medGray }}>
                  Affects your: <strong>{equip.name}</strong>
                  {equip.make ? ` (${equip.make}${equip.model ? ` ${equip.model}` : ''})` : ''}
                </p>
              )}
              {recall.hazard && (
                <p style={{ margin: '0 0 4px', fontSize: 13, color: Colors.error }}>
                  Hazard: {recall.hazard}
                </p>
              )}
              {recall.remedy && (
                <p style={{ margin: '0 0 6px', fontSize: 13, color: Colors.medGray }}>
                  Remedy: {recall.remedy}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {recall.url && (
                  <a
                    href={recall.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: Colors.copper,
                      textDecoration: 'none',
                    }}
                  >
                    View on CPSC.gov →
                  </a>
                )}
                <button
                  onClick={() => handleDismiss(match.id)}
                  disabled={dismissing === match.id}
                  style={{
                    fontSize: 12,
                    color: Colors.medGray,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  {dismissing === match.id ? 'Dismissing...' : 'Dismiss'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
