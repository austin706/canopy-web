import { useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import { CHANGELOG } from '@/data/changelog';

const TAG_COLORS: Record<string, { bg: string; fg: string }> = {
  new: { bg: '#E8F4EC', fg: '#1F7A4C' },
  improved: { bg: '#FFF3E0', fg: '#B45309' },
  fixed: { bg: '#EEF2FF', fg: '#3730A3' },
};

export default function WhatsNew() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'transparent',
          border: 'none',
          color: Colors.copper,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
        }}
      >
        ← Back
      </button>
      <h1 style={{ color: Colors.charcoal, marginBottom: 4 }}>What's New</h1>
      <p style={{ color: Colors.medGray, marginTop: 0, marginBottom: 24 }}>
        Recent updates to Canopy. We ship improvements every week.
      </p>

      {CHANGELOG.map((entry) => {
        const tagStyle = entry.tag ? TAG_COLORS[entry.tag] : null;
        return (
          <section
            key={entry.version}
            style={{
              background: Colors.cardBackground,
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: Colors.medGray, fontWeight: 600 }}>
                v{entry.version} · {entry.date}
              </span>
              {tagStyle && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: tagStyle.bg,
                    color: tagStyle.fg,
                  }}
                >
                  {entry.tag}
                </span>
              )}
            </div>
            <h2 style={{ margin: '4px 0 12px', color: Colors.charcoal, fontSize: 18 }}>{entry.title}</h2>
            <ul style={{ margin: 0, paddingLeft: 20, color: Colors.charcoal, lineHeight: 1.55 }}>
              {entry.highlights.map((h, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{h}</li>
              ))}
            </ul>
          </section>
        );
      })}

      <p style={{ color: Colors.medGray, fontSize: 13, textAlign: 'center', marginTop: 24 }}>
        Have a request? <a href="/support" style={{ color: Colors.copper }}>Send us feedback</a>.
      </p>
    </div>
  );
}
