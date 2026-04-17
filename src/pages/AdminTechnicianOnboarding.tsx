import { useState, useEffect } from 'react';
import {
  supabase,
  getOnboardingSteps,
  getTrainingMaterials,
  getTechnicianOnboardingProgress,
  initTechnicianOnboarding,
  updateOnboardingStepStatus,
  getTechnicianDocuments,
  initiateBackgroundCheck,
  updateBackgroundCheckStatus,
} from '@/services/supabase';
import type { OnboardingStep, TrainingMaterial, TechnicianOnboarding, TechnicianDocument } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { logAdminAction } from '@/services/auditLog';
import { showToast } from '@/components/Toast';

interface Technician {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  certification_level: string;
  employee_id: string | null;
  training_completed_at: string | null;
  onboarding_completed_at: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean;
  background_check_status: string;
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
  const [selectedMaterial, setSelectedMaterial] = useState<TrainingMaterial | null>(null);
  const [selectedStep, setSelectedStep] = useState<OnboardingStep | null>(null);
  const [techProgressSummary, setTechProgressSummary] = useState<Record<string, { completed: number; total: number }>>({});
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [techDocuments, setTechDocuments] = useState<TechnicianDocument[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [techRes, stepsData, materialsData] = await Promise.all([
        supabase
          .from('pro_providers')
          .select('id, business_name, contact_name, email, certification_level, employee_id, training_completed_at, onboarding_completed_at, stripe_connect_account_id, stripe_connect_onboarding_complete, background_check_status')
          .eq('provider_type', 'canopy_technician'),
        getOnboardingSteps(),
        getTrainingMaterials(),
      ]);
      const techs = techRes.data || [];
      setTechnicians(techs);
      setSteps(stepsData);
      setMaterials(materialsData);

      // Load progress summaries for all technicians at-a-glance
      if (techs.length > 0) {
        const { data: allProgress } = await supabase
          .from('technician_onboarding')
          .select('provider_id, status')
          .in('provider_id', techs.map(t => t.id));
        if (allProgress) {
          const summary: Record<string, { completed: number; total: number }> = {};
          for (const row of allProgress) {
            if (!summary[row.provider_id]) summary[row.provider_id] = { completed: 0, total: 0 };
            summary[row.provider_id].total++;
            if (row.status === 'completed') summary[row.provider_id].completed++;
          }
          setTechProgressSummary(summary);
        }
      }
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
      const [progressData, docs] = await Promise.all([
        getTechnicianOnboardingProgress(tech.id).then(async (data) => {
          if (data.length === 0) {
            await initTechnicianOnboarding(tech.id);
            await logAdminAction('onboarding.init', 'technician_onboarding', tech.id, { contact_name: tech.contact_name });
            return getTechnicianOnboardingProgress(tech.id);
          }
          return data;
        }),
        getTechnicianDocuments(tech.id),
      ]);
      setProgress(progressData);
      setTechDocuments(docs);
    } catch (e) {
      console.error('Error loading progress:', e);
    } finally {
      setProgressLoading(false);
    }
  };

  const handleSaveNotes = async (stepId: string, notes: string, score?: number) => {
    if (!selectedTech) return;
    try {
      const item = progress.find(p => p.step_id === stepId);
      if (!item) return;
      const updated = await updateOnboardingStepStatus(selectedTech.id, stepId, item.status as any, notes, score);
      setProgress(prev => prev.map(p => p.step_id === stepId ? { ...p, ...updated } : p));
      setEditingNotes(null);
      setNotesDraft('');
      await logAdminAction('onboarding.update_notes', 'technician_onboarding', selectedTech.id, {
        step_id: stepId, notes, score, contact_name: selectedTech.contact_name,
      });
    } catch (e: any) {
      showToast({ message: e.message });
    }
  };

  const handleStatusChange = async (stepId: string, newStatus: 'pending' | 'in_progress' | 'completed' | 'skipped') => {
    if (!selectedTech) return;
    try {
      const item = progress.find(p => p.step_id === stepId);
      const updated = await updateOnboardingStepStatus(selectedTech.id, stepId, newStatus, item?.notes ?? undefined, item?.score ?? undefined);
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
      showToast({ message: e.message });
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
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
                    {/* Progress-at-a-glance badge */}
                    {techProgressSummary[tech.id] && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: Colors.lightGray }}>
                          <div style={{
                            width: `${Math.round((techProgressSummary[tech.id].completed / techProgressSummary[tech.id].total) * 100)}%`,
                            height: '100%', borderRadius: 2,
                            background: techProgressSummary[tech.id].completed === techProgressSummary[tech.id].total ? Colors.success : Colors.sage,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                          color: techProgressSummary[tech.id].completed === techProgressSummary[tech.id].total ? Colors.success : Colors.medGray,
                        }}>
                          {techProgressSummary[tech.id].completed}/{techProgressSummary[tech.id].total}
                        </span>
                      </div>
                    )}
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

              {/* Document & Integration Status */}
              <div style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Contractor Agreement', type: 'contractor_agreement' as const },
                  { label: 'Safety Acknowledgment', type: 'safety_acknowledgment' as const },
                  { label: 'W-9 Tax Form', type: 'w9' as const },
                  { label: 'Insurance', type: 'insurance_verification' as const },
                  { label: "Driver's License", type: 'drivers_license' as const },
                ].map(({ label, type }) => {
                  const doc = techDocuments.find(d => d.document_type === type);
                  const signed = doc && (doc.status === 'signed' || doc.status === 'verified');
                  return (
                    <div key={type} style={{
                      padding: '8px 12px', borderRadius: 6, fontSize: 12,
                      background: signed ? '#f0faf5' : '#fafafa',
                      border: `1px solid ${signed ? Colors.success + '30' : Colors.lightGray}`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ color: Colors.charcoal }}>{label}</span>
                      <span style={{
                        fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        background: signed ? '#e6f5ee' : '#fff3cd',
                        color: signed ? Colors.success : '#856404',
                      }}>{signed ? '✓ Signed' : 'Pending'}</span>
                    </div>
                  );
                })}
                {/* Stripe Connect */}
                <div style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 12,
                  background: selectedTech.stripe_connect_onboarding_complete ? '#f0faf5' : '#fafafa',
                  border: `1px solid ${selectedTech.stripe_connect_onboarding_complete ? Colors.success + '30' : Colors.lightGray}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: Colors.charcoal }}>Stripe Connect</span>
                  <span style={{
                    fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: selectedTech.stripe_connect_onboarding_complete ? '#e6f5ee'
                      : selectedTech.stripe_connect_account_id ? '#fff3cd' : '#f5f5f5',
                    color: selectedTech.stripe_connect_onboarding_complete ? Colors.success
                      : selectedTech.stripe_connect_account_id ? '#856404' : Colors.medGray,
                  }}>{selectedTech.stripe_connect_onboarding_complete ? '✓ Connected'
                    : selectedTech.stripe_connect_account_id ? 'Incomplete' : 'Not Started'}</span>
                </div>
                {/* Background Check */}
                <div style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 12,
                  background: selectedTech.background_check_status === 'cleared' ? '#f0faf5' : '#fafafa',
                  border: `1px solid ${selectedTech.background_check_status === 'cleared' ? Colors.success + '30' : Colors.lightGray}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: Colors.charcoal }}>Background Check</span>
                  {selectedTech.background_check_status === 'not_started' ? (
                    <button onClick={async () => {
                      try {
                        await initiateBackgroundCheck(selectedTech.id);
                        setSelectedTech({ ...selectedTech, background_check_status: 'pending' });
                      } catch (e: any) { showToast({ message: e.message }); }
                    }} style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                      background: Colors.copper, color: 'var(--color-white)', border: 'none', cursor: 'pointer',
                    }}>Initiate</button>
                  ) : (
                    <span style={{
                      fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: selectedTech.background_check_status === 'cleared' ? '#e6f5ee'
                        : selectedTech.background_check_status === 'failed' ? '#fde8e8' : '#fff3cd',
                      color: selectedTech.background_check_status === 'cleared' ? Colors.success
                        : selectedTech.background_check_status === 'failed' ? '#c53030' : '#856404',
                    }}>{selectedTech.background_check_status === 'cleared' ? '✓ Cleared'
                      : selectedTech.background_check_status === 'failed' ? '✗ Failed' : 'Pending'}</span>
                  )}
                </div>
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
                              padding: '12px 16px',
                              borderRadius: 8,
                              marginBottom: 6,
                              background: item.status === 'completed' ? '#f0faf5' : '#fff',
                              border: `1px solid ${item.status === 'completed' ? Colors.success + '30' : Colors.lightGray}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 3 }}>
                                  {item.step?.estimated_minutes && (
                                    <span style={{ fontSize: 11, color: Colors.silver }}>
                                      Est. {item.step.estimated_minutes >= 60
                                        ? `${Math.floor(item.step.estimated_minutes / 60)}h ${item.step.estimated_minutes % 60 > 0 ? `${item.step.estimated_minutes % 60}m` : ''}`
                                        : `${item.step.estimated_minutes}m`
                                      }
                                    </span>
                                  )}
                                  {item.completed_at && (
                                    <span style={{ fontSize: 11, color: Colors.success }}>
                                      Completed {new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                  )}
                                  {typeof item.score === 'number' && item.score !== null && (
                                    <span style={{
                                      fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                                      background: item.score >= 80 ? '#e6f5ee' : item.score >= 60 ? '#fff3cd' : '#fde8e8',
                                      color: item.score >= 80 ? '#1a6b4a' : item.score >= 60 ? '#856404' : '#c53030',
                                    }}>
                                      Score: {item.score}%
                                    </span>
                                  )}
                                </div>
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
                            {/* Notes section */}
                            <div style={{ marginTop: 8 }}>
                              {editingNotes === item.step_id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <textarea
                                    value={notesDraft}
                                    onChange={e => setNotesDraft(e.target.value)}
                                    placeholder="Add notes about this step..."
                                    style={{
                                      width: '100%', minHeight: 60, padding: 8, fontSize: 12,
                                      borderRadius: 6, border: `1px solid ${Colors.lightGray}`,
                                      fontFamily: 'inherit', resize: 'vertical',
                                    }}
                                  />
                                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <label style={{ fontSize: 11, color: Colors.medGray }}>Score (0-100):</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      defaultValue={item.score ?? ''}
                                      id={`score-${item.step_id}`}
                                      style={{
                                        width: 60, padding: '3px 6px', fontSize: 12,
                                        borderRadius: 4, border: `1px solid ${Colors.lightGray}`,
                                      }}
                                    />
                                    <div style={{ flex: 1 }} />
                                    <button
                                      onClick={() => { setEditingNotes(null); setNotesDraft(''); }}
                                      style={{
                                        padding: '4px 12px', fontSize: 11, borderRadius: 4,
                                        border: `1px solid ${Colors.lightGray}`, background: Colors.white,
                                        cursor: 'pointer', color: Colors.medGray,
                                      }}
                                    >Cancel</button>
                                    <button
                                      onClick={() => {
                                        const scoreEl = document.getElementById(`score-${item.step_id}`) as HTMLInputElement;
                                        const scoreVal = scoreEl?.value ? parseInt(scoreEl.value, 10) : undefined;
                                        handleSaveNotes(item.step_id, notesDraft, scoreVal);
                                      }}
                                      style={{
                                        padding: '4px 12px', fontSize: 11, borderRadius: 4,
                                        border: 'none', background: Colors.sage, color: 'var(--color-white)',
                                        cursor: 'pointer', fontWeight: 600,
                                      }}
                                    >Save</button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => { setEditingNotes(item.step_id); setNotesDraft(item.notes || ''); }}
                                  style={{ cursor: 'pointer', minHeight: 20 }}
                                >
                                  {item.notes ? (
                                    <p style={{ margin: 0, fontSize: 12, color: Colors.medGray, fontStyle: 'italic', lineHeight: 1.5 }}>
                                      {item.notes}
                                    </p>
                                  ) : (
                                    <p style={{ margin: 0, fontSize: 11, color: Colors.silver, fontStyle: 'italic' }}>
                                      + Add notes...
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
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
                <tr key={step.id} onClick={() => setSelectedStep(step)} style={{ cursor: 'pointer' }}
                    onMouseOver={e => (e.currentTarget.style.background = Colors.sageMuted)}
                    onMouseOut={e => (e.currentTarget.style.background = '')}>
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
            <div key={mat.id} onClick={() => setSelectedMaterial(mat)} style={{
              padding: 16, borderRadius: 8, border: `1px solid ${Colors.lightGray}`, background: Colors.white,
              cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = Colors.sage; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = Colors.lightGray; e.currentTarget.style.boxShadow = 'none'; }}>
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
                  <span key={level} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fff3cd', color: Colors.warning }}>
                    {level}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Training Material Detail Modal */}
      {selectedMaterial && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
        }} onClick={() => setSelectedMaterial(null)}>
          <div style={{
            background: Colors.white, borderRadius: 12, padding: 32, maxWidth: 560, width: '90%', maxHeight: '80vh', overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 28 }}>
                  {selectedMaterial.content_type === 'video' ? '🎬' : selectedMaterial.content_type === 'quiz' ? '📝' : selectedMaterial.content_type === 'checklist' ? '✅' : '📄'}
                </span>
                <h2 style={{ margin: 0, fontSize: 20, color: Colors.charcoal }}>{selectedMaterial.title}</h2>
              </div>
              <button onClick={() => setSelectedMaterial(null)} aria-label="Close modal" style={{
                background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: Colors.medGray, padding: 4,
              }}>✕</button>
            </div>

            {selectedMaterial.description && (
              <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{selectedMaterial.description}</p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: Colors.sageMuted, color: Colors.sage, fontWeight: 600 }}>
                {selectedMaterial.category}
              </span>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#f0f0f0', color: Colors.charcoal }}>
                {selectedMaterial.content_type}
              </span>
              {selectedMaterial.duration_minutes && (
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#f5f5f5', color: Colors.medGray }}>
                  {selectedMaterial.duration_minutes} min
                </span>
              )}
            </div>

            {(selectedMaterial.required_for_level || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal, marginBottom: 6 }}>Required for levels:</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(selectedMaterial.required_for_level || []).map(level => (
                    <span key={level} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#fff3cd', color: Colors.warning, fontWeight: 600 }}>
                      {level}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedMaterial.content_url && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal, marginBottom: 6 }}>Resource URL:</p>
                <a href={selectedMaterial.content_url} target="_blank" rel="noopener noreferrer" style={{
                  color: Colors.copper, fontSize: 13, wordBreak: 'break-all',
                }}>{selectedMaterial.content_url}</a>
              </div>
            )}

            {selectedMaterial.content_body && (
              <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 8, border: `1px solid ${Colors.lightGray}` }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal, marginBottom: 8 }}>Content:</p>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: Colors.charcoal, whiteSpace: 'pre-wrap' }}>
                  {selectedMaterial.content_body}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Onboarding Step Detail Modal */}
      {selectedStep && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
        }} onClick={() => setSelectedStep(null)}>
          <div style={{
            background: Colors.white, borderRadius: 12, padding: 32, maxWidth: 480, width: '90%', maxHeight: '80vh', overflow: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: Colors.charcoal }}>Step {selectedStep.sort_order}: {selectedStep.title}</h2>
              <button onClick={() => setSelectedStep(null)} aria-label="Close modal" style={{
                background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: Colors.medGray, padding: 4,
              }}>✕</button>
            </div>

            {selectedStep.description && (
              <p style={{ color: Colors.medGray, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>{selectedStep.description}</p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: Colors.sageMuted, color: Colors.sage, fontWeight: 600 }}>
                {STEP_CATEGORY_LABELS[selectedStep.category] || selectedStep.category}
              </span>
              {selectedStep.required && (
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#fde8e8', color: '#c53030', fontWeight: 600 }}>
                  Required
                </span>
              )}
              {selectedStep.estimated_minutes && (
                <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: '#f5f5f5', color: Colors.medGray }}>
                  Est. {selectedStep.estimated_minutes} min
                </span>
              )}
            </div>

            {selectedStep.training_material_id && (
              <div style={{ padding: 12, background: Colors.copperMuted, borderRadius: 8, border: `1px solid ${Colors.copper}30` }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: Colors.charcoal, margin: '0 0 4px' }}>Linked Training Material:</p>
                <button onClick={() => {
                  const mat = materials.find(m => m.id === selectedStep.training_material_id);
                  if (mat) { setSelectedStep(null); setSelectedMaterial(mat); }
                }} style={{
                  background: 'none', border: 'none', color: Colors.copper, cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0, textDecoration: 'underline',
                }}>
                  {materials.find(m => m.id === selectedStep.training_material_id)?.title || 'View material'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
