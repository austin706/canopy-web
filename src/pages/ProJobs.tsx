import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

interface Job {
  id: string;
  user_id: string;
  provider_id?: string;
  category: string;
  description: string;
  urgency: string;
  status: 'pending' | 'matched' | 'scheduled' | 'completed';
  scheduled_date?: string;
  created_at: string;
  user?: { full_name: string; email: string };
  home?: { address: string; city: string; state: string };
}

type FilterTab = 'all' | 'pending' | 'scheduled' | 'completed';

export default function ProJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [providerId, setProviderId] = useState<string | null>(null);

  useEffect(() => {
    loadProviderAndJobs();
  }, []);

  const loadProviderAndJobs = async () => {
    try {
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      const { data: provider } = await supabase
        .from('pro_providers')
        .select('id, service_categories')
        .eq('user_id', authUser.user.id)
        .single();

      if (provider) {
        setProviderId(provider.id);
        await loadJobs(provider.id, provider.service_categories || []);
      }
    } catch (err) {
      console.error('Error loading provider:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async (provId: string, categories: string[]) => {
    try {
      const { data: assignedJobs } = await supabase
        .from('pro_requests')
        .select('*, user:user_id(full_name, email), home:home_id(address, city, state)')
        .eq('provider_id', provId)
        .order('created_at', { ascending: false });

      let availableQuery = supabase
        .from('pro_requests')
        .select('*, user:user_id(full_name, email), home:home_id(address, city, state)')
        .eq('status', 'pending')
        .is('provider_id', null)
        .order('created_at', { ascending: false });

      if (categories.length > 0) {
        availableQuery = availableQuery.in('category', categories);
      }

      const { data: availableJobs } = await availableQuery;

      const allJobs = [...(assignedJobs || []), ...(availableJobs || [])];
      const uniqueJobs = allJobs.filter((job, index, self) => self.findIndex(j => j.id === job.id) === index);

      setJobs(uniqueJobs);
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  };

  const handleAcceptJob = async (jobId: string) => {
    if (!providerId) return;
    if (!window.confirm('Accept this service request?')) return;

    try {
      const { error } = await supabase
        .from('pro_requests')
        .update({ provider_id: providerId, status: 'matched' })
        .eq('id', jobId);

      if (!error) {
        setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, provider_id: providerId, status: 'matched' } : j)));
        alert('You have been matched with this job.');
      }
    } catch (err) {
      alert('Failed to accept job');
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    if (!window.confirm('Mark this job as completed?')) return;

    try {
      const { error } = await supabase.from('pro_requests').update({ status: 'completed' }).eq('id', jobId);

      if (!error) {
        setJobs(prev => prev.map(j => (j.id === jobId ? { ...j, status: 'completed' } : j)));
        alert('Job marked as completed.');
      }
    } catch (err) {
      alert('Failed to complete job');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'matched':
        return Colors.info;
      case 'scheduled':
        return Colors.sage;
      case 'completed':
        return Colors.success;
      default:
        return Colors.medGray;
    }
  };

  const getUrgencyColor = (urgency: string): string => {
    switch (urgency) {
      case 'urgent':
        return Colors.error;
      case 'soon':
        return Colors.warning;
      case 'routine':
        return Colors.info;
      default:
        return Colors.medGray;
    }
  };

  const filteredJobs = jobs.filter(job => {
    switch (activeTab) {
      case 'all':
        return true;
      case 'pending':
        return job.status === 'pending';
      case 'scheduled':
        return ['matched', 'scheduled'].includes(job.status);
      case 'completed':
        return job.status === 'completed';
      default:
        return true;
    }
  });

  const tabCounts = {
    all: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    scheduled: jobs.filter(j => ['matched', 'scheduled'].includes(j.status)).length,
    completed: jobs.filter(j => j.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm mb-sm" onClick={() => navigate('/pro-portal')}>
            ← Back
          </button>
          <h1>Service Jobs</h1>
          <p className="subtitle">{jobs.length} total jobs</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs mb-lg">
        {(['all', 'pending', 'scheduled', 'completed'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
          </button>
        ))}
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="empty-state">
          <div className="icon">💼</div>
          <h3>No {activeTab} jobs</h3>
          <p>Service requests matching your categories will appear here.</p>
        </div>
      ) : (
        <div className="grid-1" style={{ gap: 16 }}>
          {filteredJobs.map(job => (
            <div key={job.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: Colors.sage,
                        color: 'white',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {job.category.toUpperCase()}
                    </span>
                    {job.urgency && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: getUrgencyColor(job.urgency) + '20',
                          color: getUrgencyColor(job.urgency),
                          fontSize: 11,
                        }}
                      >
                        {job.urgency}
                      </span>
                    )}
                  </div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 16 }}>{job.description}</h3>
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: getStatusColor(job.status) + '20',
                    color: getStatusColor(job.status),
                    fontSize: 11,
                  }}
                >
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
              </div>

              <div style={{ fontSize: 13, color: Colors.medGray, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${Colors.lightGray}` }}>
                {job.user?.full_name && <p style={{ margin: '0 0 4px 0' }}>👤 {job.user.full_name}</p>}
                {job.home && (
                  <p style={{ margin: '0 0 4px 0' }}>
                    📍 {job.home.address}, {job.home.city}, {job.home.state}
                  </p>
                )}
                <p style={{ margin: 0 }}>📅 Requested {new Date(job.created_at).toLocaleDateString()}</p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {job.status === 'pending' && !job.provider_id && (
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAcceptJob(job.id)}
                    style={{ flex: 1 }}
                  >
                    Accept Job
                  </button>
                )}
                {['matched', 'scheduled'].includes(job.status) && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleCompleteJob(job.id)}
                    style={{ flex: 1 }}
                  >
                    Complete Job
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
