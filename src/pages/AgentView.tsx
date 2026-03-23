import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

export default function AgentView() {
  const { agent } = useStore();

  if (!agent) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Your Agent</h1></div>
        <div className="card text-center" style={{ padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: Colors.copper + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 20, color: Colors.copper }}>AG</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>No Agent Connected</h2>
          <p className="text-gray">Redeem a gift code from your real estate agent to connect with them and unlock premium features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header"><h1>Your Agent</h1></div>
      <div className="card">
        <div className="flex items-center gap-lg mb-lg">
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: agent.accent_color || Colors.copper, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 700 }}>
            {agent.name.charAt(0)}
          </div>
          <div>
            <h2 style={{ fontSize: 20 }}>{agent.name}</h2>
            <p className="text-sm text-gray">{agent.brokerage}</p>
          </div>
        </div>
        <div className="flex-col gap-md">
          <div className="flex items-center gap-md" style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: Colors.copper }}>@</span>
            <div><p className="text-xs text-gray">Email</p><p style={{ fontSize: 14, fontWeight: 500 }}>{agent.email}</p></div>
          </div>
          <div className="flex items-center gap-md" style={{ padding: '12px 0', borderBottom: '1px solid var(--light-gray)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: Colors.copper }}>Tel</span>
            <div><p className="text-xs text-gray">Phone</p><p style={{ fontSize: 14, fontWeight: 500 }}>{agent.phone}</p></div>
          </div>
        </div>
        <div className="flex gap-sm mt-lg">
          <a href={`mailto:${agent.email}`} className="btn btn-primary" style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}>Email Agent</a>
          <a href={`tel:${agent.phone}`} className="btn btn-sage" style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}>Call Agent</a>
        </div>
      </div>
    </div>
  );
}
