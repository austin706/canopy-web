import { useState, useEffect } from 'react';
import {
  supabase,
  getOnboardingSteps,
  getTrainingMaterials,
  getTechnicianOnboardingProgress,
  initTechnicianOnboarding,
  updateOnboardingStepStatus,
} from '@/services/supabase';
import type { OnboardingStep, TrainingMaterial, TechnicianOnboarding } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { logAdminAction } from '@/services/auditLog';

interface Technician {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  certification_level: string;
  employee_id: string | null;
  training_completed_at: string | null;
  onboarding_completed_at: string | null;
}

const STEP_CATEGORY_LABELS: Record<string, string> = {
  paperwork: 'Paperwork',
  training: 'Training',
  equipment: 'Equipment',
  shadowing: 'Shadowing',
  certification: 'Certification',
  system_setup: 'System Setup',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: Colors.medGray, bg: '#f5f5f5' },
  in_progress: { label: 'In Progress', color: Colors.copper, bg: '#fdf3e6' },
  completed: { label: 'Complete', color: Colors.success, bg: '#e6f5ee' },
  skipped: { label: 'Skipped', color: Colors.silver, bg: '#f0f0f0' },
};

export default function AdminTechnicianOnboarding() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null);
  const [progress, setProgress] = useState<TechnicianOnboarding[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'technicians' | 'steps' | 'materials'>('technicians');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [techRes, stepsData, materialsData] = await Promise.all([
        supabase
          .from('pro_providers')
          .select('id, business_name, contact_name, email, certification_level, employee_id, training_completed_at, onboarding_completed_at')
          .eq('provider_type', 'canopy_technician'),
        getOnboardingSteps(),
        getTrainingMaterials(),
      ]);
      setTechnicians(techRes.data || []);
      setSteps(stepsData);
      setMaterials(materialsData);
    } catch (e) {
      console.error('Error loading onboarding data:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectTechnician = async (tech: Technician) => {
    setSelectedTech(tech);
    setProgressLoading(true);
    try {
      let data = await getTechnicianOnboardingProgress(tech.id);
      if (data.length === 0) {
        await initTechnicianOnboarding(tech.id);
        data = await getTechnicianOnboardingProgress(tech.id);
        await logAdminAction('onboarding.init', 'technician_onboarding', tech.id, { contact_name: tech.contact_name });
      }
      setProgress(data);
    } catch (e) {
      console.error('Error loading progress:', e);
    } finally {
      setProgressLoading(false);
    }
  };

  const handleStatusChange = async (stepId: string, newStatus: 'pending' | 'in_progress' | 'completed' | 'skipped') => {
    if (!selectedTech) return;
    try {
      const updated = await updateOnboardingStepStatus(selectedTech.id, stepId, newStatus);
      setProgress(prev => prev.map(p => p.step_id === stepId ? { ...p, ...updated } : p));
      await logAdminAction('onboarding.update_step', 'technician_onboarding', selectedTech.id, {
        step_id: stepId,
        status: newStatus,
        contact_name: selectedTech.contact_name,
      });

      // Check if all required steps are completed
      const updatedProgress = progress.map(p => p.step_id === stepId ? { ...p, status: newStatus } : p);
      const allComplete = updatedProgress.every(p => p.status === 'completed' || p.status === 'skipped');
      if (allComplete && !selectedTech.onboarding_completed_at) {
        await supabase.from('pro_providers').update({
          onboarding_completed_at: new Date().toISOString(),
          training_completed_at: new Date().toISOString(),
          certification_level: 'standard',
        }).eq('id', selectedTech.id);
        setSelectedTech({ ...selectedTech, onboarding_completed_at: new Date().toISOString() });
        await logAdminAction('onboarding.completed', 'pro_provider', selectedTech.id, { contact_name: selectedTech.contact_name });
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const completedCount = progress.filter(p => p.status === 'completed').length;
  const totalSteps = progress.length;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  // Group progress by category
  const groupedProgress = progress.reduce((acc, p) => {
    const cat = p.step?.category || 'unknown';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, TechnicianOnboarding[]>);

  return (
    <div style={{ padding: 24 }}>
      <div className="admin-page-header">
        <div>
          <h1 style={{ margin: '0 0 4px 0', fontSize: 28, fontWeight: 700 }}>Technician Onboarding</h1>
          <p style={{ margin: 0, fontSize: 14, color: Colors.medGray }}>
            Manage training and certification for Canopy technicians
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${Colors.lightGray}`, paddingBottom: 2 }}>
        {(['technicians', 'steps', 'materials'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer',
              background: activeTab === tab ? Colors.sage : 'transparent',
              color: activeTab === tab ? '#fff' : Colors.medGray,
              borderRadius: '6px 6px 0 0', fontWeight: 600, fontSize: 13,
            }}
          >
            {tab === 'technicians' ? 'Technicians' : tab === 'steps' ? 'Onboarding Steps' : 'Training Materials'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : activeTab === 'technicians' ? (
        <div style={{ display: 'grid', gridTemplateColumns: selectedTech ? '300px 1fr' : '1fr', gap: 24 }}>
          {/* Technician List */}
          <div>
            {technicians.length === 0 ? (
              <div className="admin-empty">
                <p>No Canopy technicians yet</p>
                <p style={{ fontSize: 12, color: Colors.medGray }}>
                  Approve a provider application as "Canopy Technician" type to get started
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {technicians.map(tech => (
                  <div
                    key={tech.id}
                    onClick={() => selectTechnician(tech)}
                    style={{
                      padding: 16, borderRadius: 8, cursor: 'pointer',
                      border: `2px solid ${selectedTech?.id === tech.id ? Colors.sage : Colors.lightGray}`,
                      background: selectedTech?.id === tech.id ? Colors.sage + '08' : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: 14 }}>
                      {tech.contact_name}
                    </p>
                    <p style={{ margin: '0 0 4px 0', fontSize: 12, color: Colors.medGray }}>
                      {tech.business_name}
                    </p>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                        background: tech.certification_level === 'trainee' ? '#fff3cd' : '#e6f5ee',
                        color: tech.certification_level === 'trainee' ? '#856404' : '#1a6b4a',
                      }}>
                        {tech.certification_level?.toUpperCase() || 'TRAINEE'}
                      </span>
                      {tech.employee_id && (
                        <span style={{ fontSize: 11, color: Colors.silver }}>{tech.employee_id}</span>
                      )}
                      {tech.onboarding_completed_at && (
                        <span style={{ fontSize: 10, color: Colors.success }}>✓ Onboarded</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Onboarding Progress */}
          {selectedTech && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700 }}>
                  {selectedTech.contact_name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: Colors.lightGray }}>
                    <div style={{
                      width: `${progressPct}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: progressPct === 100 ? Colors.success : Colors.sage,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: progressPct === 100 ? Colors.success : Colors.charcoal }}>
                    {progressPct}%
                  </span>
                </div>
                <p style={{ fontSize: 13, color: Colors.medGray }}>
                  {completedCount} of {totalSteps} steps completed
                </p>
              </div>

              {progressLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" /></div>
              ) : (
                Object.entries(groupedProgress)
                  .sort(([, a], [, b]) => (a[0]?.step?.sort_order || 0) - (b[0]?.step?.sort_order || 0))
                  .map(([category, items]) => (
                    <div key={category} style={{ marginBottom: 24 }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, color: Colors.charcoal, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {STEP_CATEGORY_LABELS[category] || category}
                      </h3>
                      {items
                        .sort((a, b) => (a.step?.sort_order || 0) - (b.step?.sort_order || 0))
                        .map(item => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '12px 16px',
                              borderRadius: 8,
                              marginBottom: 6,
                              background: item.status === 'completed' ? '#f0faf5' : '#fff',
                              border: `1px solid ${item.status === 'completed' ? Colors.success + '30' : Colors.lightGray}`,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <p style={{
                                margin: '0 0 2px 0',
                                fontSize: 14,
                                fontWeight: 500,
                                color: item.status === 'completed' ? Colors.medGray : Colors.charcoal,
                                textDecoration: item.status === 'completed' ? 'line-through' : 'none',
                              }}>
                                {item.step?.title || 'Unknown Step'}
                              </p>
                              {item.step?.description && (
                                <p style={{ margin: 0, fontSize: 12, color: Colors.silver }}>
                                  {item.step.description}
                                </p>
                              )}
                              {item.step?.estimated_minutes && (
                                <p style={{ margin: '2px 0 0 0', fontSize: 11, color: Colors.silver }}>
                                  Est. {item.step.estimated_minutes >= 60
                                    ? `${Math.floor(item.step.estimated_minutes / 60)}h ${item.step.estimated_minutes % 60 > 0 ? `${item.step.estimated_minutes % 60}m` : ''}`
                                    : `${item.step.estimated_minutes}m`
                                  }
                                </p>
                              )}
                            </div>
                            <select
                              value={item.status}
                              onChange={e => handleStatusChange(item.step_id, e.target.value as any)}
                              style={{
                                fontSize: 12, padding: '4px 8px', borderRadius: 6,
                                border: `1px solid ${STATUS_CONFIG[item.status]?.color || Colors.lightGray}`,
                                background: STATUS_CONFIG[item.status]?.bg || '#fff',
                                color: STATUS_CONFIG[item.status]?.color || Colors.charcoal,
                                fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="completed">Complete</option>
                              <option value="skipped">Skipped</option>
                            </select>
                          </div>
                        ))}
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'steps' ? (
        /* Onboarding Steps Overview */
        <div>
          <table className="admin-table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Title</th>
                <th>Category</th>
                <th>Required</th>
                <th>Est. Time</th>
              </tr>
            </thead>
            <tbody>
              {steps.map(step => (
                <tr key={step.id}>
                  <td style={{ fontFamily: 'monospace' }}>{step.sort_order}</td>
                  <td style={{ fontWeight: 500 }}>{step.title}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: Colors.sageMuted, color: Colors.sage }}>
                      {STEP_CATEGORY_LABELS[step.category] || step.category}
                    </span>
                  </td>
                  <td>{step.required ? '✓' : '—'}</td>
                  <td>{step.estimated_minutes ? `${step.estimated_minutes}m` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Training Materials */
        <div className="admin-card-grid">
          {materials.map(mat => (
            <div key={mat.id} style={{
              padding: 16, borderRadius: 8, border: `1px solid ${Colors.lightGray}`, background: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>
                  {mat.content_type === 'video' ? '🎬' : mat.content_type === 'quiz' ? '📝' : mat.content_type === 'checklist' ? '✅' : '📄'}
                </span>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: 14 }}>{mat.title}</p>
                  {mat.description && (
                    <p style={{ margin: 0, fontSize: 12, color: Colors.medGray }}>{mat.description}</p>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: Colors.sageMuted, color: Colors.sage, fontWeight: 600 }}>
                  {mat.category}
                </span>
                {mat.duration_minutes && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f5f5f5', color: Colors.medGray }}>
                    {mat.duration_minutes}m
                  </span>
                )}
                {(mat.required_for_level || []).map(level => (
                  <span key={level} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fff3cd', color: '#856404' }}>
                    {level}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
