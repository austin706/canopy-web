import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
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
}

interface JobStats {
  activeJobs: number;
  completedJobs: number;
  pendingJobs: number;
}

export default function ProPortal() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState<ProProvider | null>(null);
  const [stats, setStats] = useState<JobStats>({
    activeJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
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
          onClick={() => navigate('/pro-portal/jobs')}
          style={{
            backgroundColor: Colors.sage,
            color: 'white',
            border: 'none',
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          View All Jobs
        </button>
        <button
          className="card btn"
          onClick={() => navigate('/pro-portal/visit-schedule')}
          style={{
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          Visit Schedule
        </button>
        <button
          className="card btn"
          onClick={() => navigate('/pro-portal/quotes-invoices')}
          style={{
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          Quotes & Invoices
        </button>
      </div>
      <div className="grid-3 mb-lg" style={{ gap: 16 }}>
        <button
          className="card btn"
          onClick={() => navigate('/pro-portal/availability')}
          style={{
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          Set Availability
        </button>
        <button
          className="card btn"
          onClick={() => navigate('/pro-portal/profile')}
          style={{
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          Edit Profile
        </button>
      </div>
    </div>
  );
}
