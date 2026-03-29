import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';

interface ProProvider {
  id: string;
  user_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  service_categories: string[];
  service_area_miles: number;
  is_available: boolean;
  rating?: number;
  total_reviews: number;
}

interface JobStats {
  activeJobs: number;
  completedJobs: number;
  pendingJobs: number;
}

export default function ProPortal() {
  const navigate = useNavigate();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';

  // Provider mode (single provider logged in)
  const [provider, setProvider] = useState<ProProvider | null>(null);
  const [stats, setStats] = useState<JobStats>({ activeJobs: 0, completedJobs: 0, pendingJobs: 0 });

  // Admin mode (overview of all providers)
  const [allProviders, setAllProviders] = useState<ProProvider[]>([]);
  const [adminStats, setAdminStats] = useState({ totalProviders: 0, availableProviders: 0, totalRequests: 0, pendingRequests: 0 });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      loadAdminDashboard();
    } else {
      loadProviderDashboard();
    }
  }, []);

  // ─── Admin: load overview of all providers ───
  const loadAdminDashboard = async () => {
    try {
      const [providersRes, requestsRes, pendingRes] = await Promise.all([
        supabase.from('pro_providers').select('*'),
        supabase.from('pro_requests').select('*', { count: 'exact', head: true }),
        supabase.from('pro_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const providers = providersRes.data || [];
      setAllProviders(providers);
      setAdminStats({
        totalProviders: providers.length,
        availableProviders: providers.filter(p => p.is_available).length,
        totalRequests: requestsRes.count || 0,
        pendingRequests: pendingRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Provider: load own dashboard ───
  const loadProviderDashboard = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      const { data: providerData, error: providerError } = await supabase
        .from('pro_providers')
        .select('*')
        .eq('user_id', authUser.user.id)
        .single();

      if (providerError || !providerData) {
        navigate('/pro-login');
        return;
      }

      setProvider(providerData);

      const [activeRes, completedRes, pendingRes] = await Promise.all([
        supabase
          .from('pro_requests')
          .select('*', { count: 'exact', head: true })
          .eq('provider_id', providerData.id)
          .in('status', ['matched', 'scheduled']),
        supabase
          .from('pro_requests')
          .select('*', { count: 'exact', head: true })
          .eq('provider_id', providerData.id)
          .eq('status', 'completed'),
        supabase
          .from('pro_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .in('category', providerData.service_categories || []),
      ]);

      setStats({
        activeJobs: activeRes.count || 0,
        completedJobs: completedRes.count || 0,
        pendingJobs: pendingRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/pro-login');
  };

  const toggleAvailability = async () => {
    if (!provider) return;
    try {
      const newStatus = !provider.is_available;
      const { error } = await supabase
        .from('pro_providers')
        .update({ is_available: newStatus })
        .eq('id', provider.id);

      if (!error) {
        setProvider({ ...provider, is_available: newStatus });
        alert(`You are now ${newStatus ? 'available' : 'unavailable'} for new jobs.`);
      }
    } catch (err) {
      alert('Failed to update availability');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Loading...</p>
      </div>
    );
  }

  // ═══ Admin View ═══
  if (isAdmin) {
    return (
      <div className="page" style={{ maxWidth: 900 }}>
        <div className="page-header">
          <div>
            <h1>Pro Portal — Admin</h1>
            <p className="subtitle">Manage all service providers and requests</p>
          </div>
        </div>

        {/* Admin Stats */}
        <div className="grid-3 mb-lg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: Colors.sage, marginBottom: 6 }}>
              {adminStats.totalProviders}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>Total Providers</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: Colors.success, marginBottom: 6 }}>
              {adminStats.availableProviders}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>Available</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: Colors.copper, marginBottom: 6 }}>
              {adminStats.totalRequests}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>Total Requests</p>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: Colors.warning, marginBottom: 6 }}>
              {adminStats.pendingRequests}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: Colors.medGray }}>Pending</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid-3 mb-lg" style={{ gap: 16 }}>
          <button
            className="card btn btn-primary"
            onClick={() => navigate('/pro-portal/job-queue')}
            style={{ backgroundColor: Colors.sage, color: 'white', border: 'none', padding: '24px', textAlign: 'center', cursor: 'pointer', fontSize: 16 }}
          >
            All Jobs
          </button>
          <button
            className="card btn"
            onClick={() => navigate('/pro-portal/visit-schedule')}
            style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', fontSize: 16 }}
          >
            Visit Schedule
          </button>
          <button
            className="card btn"
            onClick={() => navigate('/pro-portal/quotes-invoices')}
            style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', fontSize: 16 }}
          >
            Quotes & Invoices
          </button>
        </div>

        {/* Provider List */}
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Registered Providers</h2>
        {allProviders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: Colors.medGray }}>
            <p>No providers registered yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allProviders.map(p => (
              <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{p.business_name}</div>
                  <div style={{ fontSize: 13, color: Colors.medGray, marginTop: 2 }}>
                    {p.contact_name} · {p.email} · {p.phone}
                  </div>
                  <div style={{ fontSize: 12, color: Colors.medGray, marginTop: 4 }}>
                    Categories: {p.service_categories?.join(', ') || 'None'} · {p.service_area_miles} mi radius
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: p.is_available ? '#e8f5e9' : '#fce4ec',
                    color: p.is_available ? Colors.success : Colors.error,
                  }}
                >
                  {p.is_available ? 'Available' : 'Unavailable'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ═══ Provider View ═══
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <h1>{provider?.business_name || 'Pro Portal'}</h1>
          <p className="subtitle">{provider?.contact_name}</p>
        </div>
        <div className="flex gap-sm">
          <button
            className="btn btn-secondary"
            onClick={toggleAvailability}
            style={{
              backgroundColor: provider?.is_available ? Colors.success : Colors.error,
              color: 'white',
              border: 'none',
            }}
          >
            {provider?.is_available ? '● Available' : '● Unavailable'}
          </button>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid-3 mb-lg">
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: Colors.sage, marginBottom: 8 }}>
            {stats.activeJobs}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: Colors.medGray }}>Active Jobs</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: Colors.warning, marginBottom: 8 }}>
            {stats.pendingJobs}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: Colors.medGray }}>Available</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: Colors.copper, marginBottom: 8 }}>
            {stats.completedJobs}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: Colors.medGray }}>Completed</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid-3 mb-lg" style={{ gap: 16 }}>
        <button
          className="card btn btn-primary"
          onClick={() => navigate('/pro-portal/job-queue')}
          style={{ backgroundColor: Colors.sage, color: 'white', border: 'none', padding: '24px', textAlign: 'center', cursor: 'pointer', fontSize: 16 }}
        >
          View All Jobs
        </button>
        <button
          className="card btn"
          onClick={() => navigate('/pro-portal/visit-schedule')}
          style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', fontSize: 16 }}
        >
          Visit Schedule
        </button>
        <button
          className="card btn"
          onClick={() => navigate('/pro-portal/quotes-invoices')}
          style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', fontSize: 16 }}
        >
          Quotes & Invoices
        </button>
      </div>
      <div className="grid-3 mb-lg" style={{ gap: 16 }}>
        <button
          className="card btn"
          onClick={() => navigate('/pro-portal/availability')}
          style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', fontSize: 16 }}
        >
          Set Availability
        </button>
        <button
          className="card btn"
          onClick={() => navigate('/pro-portal/profile')}
          style={{ padding: '24px', textAlign: 'center', cursor: 'pointer', fontSize: 16 }}
        >
          Edit Profile
        </button>
      </div>
    </div>
  );
}
