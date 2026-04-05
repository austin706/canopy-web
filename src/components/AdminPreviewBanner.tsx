import { Colors } from '@/constants/theme';

interface Provider {
  id: string;
  business_name?: string;
  contact_name?: string;
  email?: string;
}

interface Agent {
  id: string;
  name?: string;
  email?: string;
}

interface AdminPreviewBannerProps {
  portalType: 'pro' | 'agent';
  providers?: Provider[];
  agents?: Agent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  backTo?: string;
}

export default function AdminPreviewBanner({ portalType, providers, agents, selectedId, onSelect, backTo }: AdminPreviewBannerProps) {
  const items = portalType === 'pro'
    ? (providers || []).map(p => ({ id: p.id, label: p.business_name || p.contact_name || p.email || p.id }))
    : (agents || []).map(a => ({ id: a.id, label: a.name || a.email || a.id }));

  const adminLink = backTo || (portalType === 'pro' ? '/admin/pro-providers' : '/admin/agents');

  return (
    <div style={{
      background: Colors.copper + '12',
      border: `1px solid ${Colors.copper}40`,
      borderRadius: 10,
      padding: '12px 20px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          background: Colors.copper,
          color: 'white',
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          Admin Preview
        </span>
        <span style={{ fontSize: 13, color: Colors.charcoal }}>
          Viewing as {portalType === 'pro' ? 'provider' : 'agent'}:
        </span>
      </div>

      {items.length > 0 ? (
        <select
          value={selectedId || ''}
          onChange={e => onSelect(e.target.value)}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${Colors.lightGray}`,
            fontSize: 13,
            color: Colors.charcoal,
            background: 'white',
            cursor: 'pointer',
            minWidth: 200,
          }}
        >
          {items.map(item => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      ) : (
        <span style={{ fontSize: 13, color: Colors.medGray, fontStyle: 'italic' }}>
          No {portalType === 'pro' ? 'providers' : 'agents'} found
        </span>
      )}

      <a
        href={adminLink}
        style={{
          marginLeft: 'auto',
          fontSize: 13,
          color: Colors.copper,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Back to Admin
      </a>
    </div>
  );
}
