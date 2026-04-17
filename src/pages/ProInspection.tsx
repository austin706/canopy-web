import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';
import { ImageViewer } from '@/components/ImageViewer';
import { SignaturePad } from '@/components/SignaturePad';
import { showToast } from '@/components/Toast';
import type { ProMonthlyVisit, Home, Equipment } from '@/types';
import type {
  VisitInspection,
  VisitInspectionItem,
  ChecklistItemStatus,
  OverallCondition,
} from '@/types/inspection';
import {
  generateInspectionsForVisit,
  getVisitInspections,
  updateInspectionItemStatus as updateItemStatus,
  completeInspection as completeInspectionService,
  uploadVisitPhoto,
} from '@/services/inspections';
import { createNextDynamicTask } from '@/services/taskEngine';
import { createTask } from '@/services/supabase';
import { proposeNextVisit } from '@/services/proEnrollment';
import type { MaintenanceTask, TaskPriority } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

// ─── Enriched inspection with items loaded ───
interface EnrichedInspection extends VisitInspection {
  items: VisitInspectionItem[];
}

export default function ProInspection() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { user } = useStore();

  const [visit, setVisit] = useState<ProMonthlyVisit | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [inspections, setInspections] = useState<EnrichedInspection[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [finalNotes, setFinalNotes] = useState('');
  const [generateAISummary, setGenerateAISummary] = useState(true);
  const [homeownerSignature, setHomeownerSignature] = useState<string | null>(null);
  const [homeownerName, setHomeownerName] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);

  // Image viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  // Debounce for notes auto-save
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!visitId) {
      navigate('/pro-portal/job-queue');
      return;
    }
    loadData();
  }, [visitId]);

  // Timer for elapsed time
  useEffect(() => {
    if (!visit?.started_at) return;

    timerRef.current = setInterval(() => {
      const startTime = new Date(visit.started_at!).getTime();
      const now = new Date().getTime();
      setElapsedSeconds(Math.floor((now - startTime) / 1000));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visit?.started_at]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load visit
      const { data: visitData, error: visitError } = await supabase
        .from('pro_monthly_visits')
        .select('*')
        .eq('id', visitId)
        .single();

      if (visitError || !visitData) throw new Error('Visit not found');
      setVisit(visitData);

      // Load home
      const { data: homeData } = await supabase
        .from('homes')
        .select('*')
        .eq('id', visitData.home_id)
        .single();

      if (homeData) setHome(homeData);

      // Load equipment
      const { data: equipmentData } = await supabase
        .from('equipment')
        .select('*')
        .eq('home_id', visitData.home_id);

      setEquipment(equipmentData || []);

      // Load inspections via service layer
      const existingInspections = await getVisitInspections(visitId!);

      if (existingInspections.length === 0) {
        // Generate inspections from DB templates
        await generateInspectionsForVisit(visitId!, visitData.home_id);
        // Re-fetch with items populated
        const freshInspections = await getVisitInspections(visitId!);
        setInspections(freshInspections as EnrichedInspection[]);
        if (freshInspections.length > 0) {
          setActiveTabId(freshInspections[0].id);
        }
      } else {
        setInspections(existingInspections as EnrichedInspection[]);
        if (existingInspections.length > 0) {
          setActiveTabId(existingInspections[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading inspection data:', error);
      showToast({ message: 'Failed to load inspection data' });
      navigate('/pro-portal/job-queue');
    } finally {
      setLoading(false);
    }
  };

  // ─── Status Change (immediate save) ───
  const handleItemStatusChange = async (inspectionId: string, itemId: string, newStatus: ChecklistItemStatus) => {
    try {
      setSaving(true);
      await updateItemStatus(itemId, newStatus);

      // Update local state
      setInspections((prev) =>
        prev.map((insp) =>
          insp.id === inspectionId
            ? {
                ...insp,
                items: (insp.items || []).map((item) =>
                  item.id === itemId ? { ...item, status: newStatus } : item
                ),
              }
            : insp
        )
      );
    } catch (error) {
      console.error('Error updating item status:', error);
    } finally {
      setSaving(false);
    }
  };

  // ─── Notes Change (debounced save) ───
  const handleItemNotesChange = (inspectionId: string, itemId: string, notes: string) => {
    const debounceKey = `${inspectionId}-${itemId}`;
    if (debounceRef.current[debounceKey]) {
      clearTimeout(debounceRef.current[debounceKey]);
    }

    // Update local state immediately
    setInspections((prev) =>
      prev.map((insp) =>
        insp.id === inspectionId
          ? {
              ...insp,
              items: (insp.items || []).map((item) =>
                item.id === itemId ? { ...item, notes } : item
              ),
            }
          : insp
      )
    );

    // Debounce the database save
    debounceRef.current[debounceKey] = setTimeout(async () => {
      try {
        await updateItemStatus(itemId, undefined as any, notes);
      } catch (error) {
        console.error('Error saving notes:', error);
      }
    }, 500);
  };

  // ─── Track which items have had tasks created from them so we can
  //     grey-out the button after the Pro clicks it. Keyed by inspection
  //     item id; value is the created task id for optional future linking.
  const [tasksFromFindings, setTasksFromFindings] = useState<Record<string, string>>({});
  const [creatingTaskForItem, setCreatingTaskForItem] = useState<string | null>(null);

  // ─── Create a maintenance task from an inspection finding ────────────
  //     The Pro clicks "Add as task" when they find something that needs
  //     follow-up. We mark it is_custom=true + created_by_pro_id so it
  //     shows up in the homeowner's calendar with a Pro badge.
  const handleCreateTaskFromFinding = async (
    inspectionId: string,
    item: VisitInspectionItem,
    priority: TaskPriority = 'medium',
  ) => {
    if (!user || !visit || !home) {
      showToast({ message: 'Missing visit context — cannot add task.' });
      return;
    }
    if (tasksFromFindings[item.id]) {
      showToast({ message: 'Already added as a task.' });
      return;
    }
    try {
      setCreatingTaskForItem(item.id);
      const inspection = inspections.find((i) => i.id === inspectionId);
      const equipmentLabel = inspection?.equipment_name ? ` — ${inspection.equipment_name}` : '';
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // default 2-week window for follow-up
      const description = [
        item.notes?.trim(),
        `Flagged during Pro inspection on ${new Date().toLocaleDateString()}.`,
      ].filter(Boolean).join(' ');

      // Map inspection category (HVAC/plumbing/etc.) to MaintenanceTask category.
      type TaskCat = MaintenanceTask['category'];
      const guessedCategory = (inspection?.equipment_name || 'general').toLowerCase();
      const categoryMap: Record<string, TaskCat> = {
        hvac: 'hvac',
        furnace: 'hvac',
        'air conditioner': 'hvac',
        plumbing: 'plumbing',
        electrical: 'electrical',
        roof: 'roof',
        outdoor: 'outdoor',
        appliance: 'appliance',
        appliances: 'appliance',
        pool: 'pool',
        fireplace: 'fireplace',
        water_heater: 'water_heater',
        safety: 'safety',
      };
      const resolvedCategory: TaskCat = (Object.entries(categoryMap).find(
        ([k]) => guessedCategory.includes(k)
      )?.[1]) || 'general';

      const newTask: Partial<MaintenanceTask> = {
        home_id: home.id,
        title: `${item.label}${equipmentLabel}`,
        description,
        category: resolvedCategory,
        priority,
        status: 'upcoming',
        frequency: 'as_needed',
        due_date: dueDate.toISOString(),
        is_weather_triggered: false,
        applicable_months: [],
        is_custom: true,
        created_by_pro_id: user.id,
      };

      const created = await createTask(newTask);
      if (created?.id) {
        setTasksFromFindings((prev) => ({ ...prev, [item.id]: created.id }));
        showToast({ message: `Task added to homeowner's calendar: ${item.label}` });
      }
    } catch (err) {
      console.error('Failed to create task from finding:', err);
      showToast({ message: 'Could not add task. Please try again.' });
    } finally {
      setCreatingTaskForItem(null);
    }
  };

  // ─── Photo Upload (uses service layer → visit-photos bucket + visit_photos table) ───
  const handlePhotoUpload = async (inspectionId: string, itemId: string, file: File) => {
    if (!file) return;

    try {
      setUploadingPhotoFor(itemId);
      const publicUrl = await uploadVisitPhoto(visitId!, inspectionId, file);

      // Update local state to show the photo
      setInspections((prev) =>
        prev.map((insp) =>
          insp.id === inspectionId
            ? {
                ...insp,
                items: (insp.items || []).map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        photos: [...(item.photos || []), { url: publicUrl, caption: '' }],
                      }
                    : item
                ),
              }
            : insp
        )
      );
    } catch (error) {
      console.error('Error uploading photo:', error);
      showToast({ message: 'Failed to upload photo' });
    } finally {
      setUploadingPhotoFor(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ─── Complete Individual Inspection ───
  const handleCompleteInspection = async (inspectionId: string) => {
    try {
      setSaving(true);
      const inspection = inspections.find((i) => i.id === inspectionId);
      await completeInspectionService(
        inspectionId,
        inspection?.overall_condition || 'good',
        inspection?.pro_notes || ''
      );

      setInspections((prev) =>
        prev.map((insp) =>
          insp.id === inspectionId ? { ...insp, status: 'completed' } : insp
        )
      );
    } catch (error) {
      console.error('Error completing inspection:', error);
    } finally {
      setSaving(false);
    }
  };

  // ─── Complete Entire Visit + Trigger AI Summary ───
  const handleCompleteVisit = async () => {
    if (!visit) return;

    try {
      setSaving(true);

      // Calculate actual time spent
      const startTime = new Date(visit.started_at || new Date()).getTime();
      const endTime = new Date().getTime();
      const timeSpentMinutes = Math.round((endTime - startTime) / (1000 * 60));

      // Update visit status
      const { error } = await supabase
        .from('pro_monthly_visits')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          time_spent_minutes: timeSpentMinutes,
          pro_notes: finalNotes,
          homeowner_signature_data_url: homeownerSignature,
          homeowner_signature_name: homeownerSignature ? homeownerName.trim() : null,
          homeowner_signed_at: homeownerSignature ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', visitId);

      if (error) throw error;

      // ─── Mark homeowner's selected tasks as completed by pro ───
      if (visit.selected_task_ids && visit.selected_task_ids.length > 0 && visit.home_id) {
        try {
          // Find matching maintenance_tasks for this home that are still pending
          const { data: matchingTasks } = await supabase
            .from('maintenance_tasks')
            .select('*')
            .eq('home_id', visit.home_id)
            .in('template_id', visit.selected_task_ids)
            .in('status', ['upcoming', 'due', 'overdue']);

          if (matchingTasks && matchingTasks.length > 0) {
            const now = new Date().toISOString();
            const taskIds = matchingTasks.map((t: any) => t.id);

            // Batch update tasks to completed
            await supabase
              .from('maintenance_tasks')
              .update({
                status: 'completed',
                completed_date: now,
                completed_by: 'pro',
                completion_notes: `Completed during pro visit on ${new Date().toLocaleDateString()}`,
              })
              .in('id', taskIds);

            // Create maintenance log entries for each completed task
            const logEntries = matchingTasks.map((task: any) => ({
              home_id: visit.home_id,
              task_id: task.id,
              title: task.title,
              description: task.description,
              category: task.category,
              completed_date: now,
              completed_by: 'pro',
              notes: `Completed by pro provider during bimonthly visit`,
              photos: [],
              created_at: now,
            }));
            await supabase.from('maintenance_logs').insert(logEntries);

            // Generate next occurrences for dynamic tasks
            for (const task of matchingTasks) {
              const nextTask = createNextDynamicTask(task, now);
              if (nextTask) {
                try { await createTask(nextTask); } catch (e) { /* non-blocking */ }
              }
            }
          }
        } catch (taskError) {
          console.warn('Pro task completion failed (non-blocking):', taskError);
          // Don't fail the visit completion if task marking fails
        }
      }

      // Call AI summary edge function if checkbox is checked
      if (generateAISummary && SUPABASE_URL) {
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;

          await fetch(`${SUPABASE_URL}/functions/v1/generate-visit-summary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              visit_id: visitId,
              mode: 'generate',
            }),
          });
        } catch (aiError) {
          console.warn('AI summary generation failed (non-blocking):', aiError);
          // Don't fail the visit completion if AI summary fails
        }
      }

      // Auto-propose the next bimonthly visit
      try {
        const { nextVisitId } = await proposeNextVisit(visitId!);
        if (nextVisitId) {
          // Next bimonthly visit auto-proposed
        }
      } catch (nextErr) {
        console.warn('Auto-propose next visit failed (non-blocking):', nextErr);
      }

      setShowCompleteModal(false);
      navigate('/pro-portal/job-queue', { state: { success: 'Visit completed successfully. Next visit has been auto-proposed.' } });
    } catch (error) {
      console.error('Error completing visit:', error);
      showToast({ message: 'Failed to complete visit' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Overall Condition Change ───
  const handleOverallConditionChange = async (inspectionId: string, condition: OverallCondition) => {
    try {
      await supabase
        .from('visit_inspections')
        .update({ overall_condition: condition, updated_at: new Date().toISOString() })
        .eq('id', inspectionId);

      setInspections((prev) =>
        prev.map((insp) =>
          insp.id === inspectionId ? { ...insp, overall_condition: condition } : insp
        )
      );
    } catch (error) {
      console.error('Error updating overall condition:', error);
    }
  };

  // ─── Inspector Notes Change (debounced) ───
  const handleInspectorNotesChange = (inspectionId: string, notes: string) => {
    const debounceKey = `notes-${inspectionId}`;
    if (debounceRef.current[debounceKey]) {
      clearTimeout(debounceRef.current[debounceKey]);
    }

    setInspections((prev) =>
      prev.map((insp) =>
        insp.id === inspectionId ? { ...insp, pro_notes: notes } : insp
      )
    );

    debounceRef.current[debounceKey] = setTimeout(async () => {
      await supabase
        .from('visit_inspections')
        .update({ pro_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', inspectionId);
    }, 500);
  };

  const allInspectionsComplete =
    inspections.length > 0 && inspections.every((i) => i.status === 'completed' || i.status === 'skipped');

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // ─── Status button helpers ───
  const STATUS_CONFIG: Record<ChecklistItemStatus, { label: string; activeColor: string }> = {
    pass: { label: '\u2713 Pass', activeColor: Colors.success },
    needs_attention: { label: '\u26A0 Attention', activeColor: '#FF9800' },
    fail: { label: '\u2717 Fail', activeColor: Colors.error },
    na: { label: '\u2014 N/A', activeColor: Colors.medGray },
    pending: { label: 'Pending', activeColor: Colors.lightGray },
  };

  const CONDITION_COLORS: Record<OverallCondition, string> = {
    good: Colors.success,
    fair: '#FF9800',
    needs_attention: Colors.warning,
    critical: Colors.error,
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Loading inspection...</p>
      </div>
    );
  }

  if (!visit || !home) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Visit data not found</p>
      </div>
    );
  }

  const activeInspection = inspections.find((i) => i.id === activeTabId);

  return (
    <SectionErrorBoundary sectionName="ProInspection">
      <div className="page" style={{ maxWidth: 1200, paddingBottom: Spacing.xxl }}>
      {/* Visit Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          backgroundColor: Colors.white,
          zIndex: 10,
          paddingBottom: Spacing.md,
          marginBottom: Spacing.lg,
          borderBottom: `1px solid ${Colors.lightGray}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <div>
            <h1 style={{ margin: 0, marginBottom: Spacing.xs }}>{home.address}</h1>
            <p style={{ margin: 0, fontSize: FontSize.sm, color: Colors.medGray }}>
              {visit.confirmed_date} &bull; Started{' '}
              {visit.started_at ? new Date(visit.started_at).toLocaleTimeString() : '\u2014'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.sage }}>
              {formatElapsedTime(elapsedSeconds)}
            </div>
            <p style={{ margin: 0, fontSize: FontSize.xs, color: Colors.medGray }}>Elapsed</p>
          </div>
        </div>

        {/* First Visit Orientation Banner (for provider) */}
        {(visit as any).is_first_visit && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: Spacing.md,
            background: `linear-gradient(135deg, var(--color-success)15, ${Colors.sageMuted})`,
            border: `1px solid ${Colors.sage}40`,
          }}>
            <p style={{ fontWeight: 700, fontSize: FontSize.sm, color: Colors.sage, margin: '0 0 4px' }}>
              First Visit — Orientation
            </p>
            <p style={{ fontSize: FontSize.sm, color: Colors.charcoal, margin: 0, lineHeight: 1.5 }}>
              This is this homeowner's first Pro visit. Please do a thorough walkthrough of all systems,
              document equipment details and conditions, and set a maintenance baseline.
              Take extra time to explain what you're checking and why — this sets the tone for the relationship.
            </p>
          </div>
        )}

        {/* Homeowner Notes (if any) */}
        {visit.homeowner_notes && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: Spacing.md,
            backgroundColor: Colors.copperMuted || '#FDF0E6', border: `1px solid ${Colors.copper}40`,
          }}>
            <p style={{ fontWeight: 600, fontSize: FontSize.sm, color: Colors.copper, margin: '0 0 4px' }}>
              Homeowner Notes
            </p>
            <p style={{ fontSize: FontSize.sm, color: Colors.charcoal, margin: 0, whiteSpace: 'pre-wrap' }}>
              {visit.homeowner_notes}
            </p>
          </div>
        )}

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: Spacing.sm, overflowX: 'auto', paddingBottom: Spacing.sm }}>
          {inspections.map((insp) => {
            const items = insp.items || [];
            const itemCount = items.length;
            const completedCount = items.filter((item) => item.status !== 'pending').length;
            const isActive = insp.id === activeTabId;

            return (
              <button
                key={insp.id}
                onClick={() => setActiveTabId(insp.id)}
                style={{
                  padding: `${Spacing.sm}px ${Spacing.md}px`,
                  borderRadius: BorderRadius.md,
                  border: 'none',
                  backgroundColor: isActive ? Colors.sage : Colors.lightGray,
                  color: isActive ? 'white' : Colors.medGray,
                  cursor: 'pointer',
                  fontSize: FontSize.sm,
                  fontWeight: FontWeight.semibold,
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: Spacing.xs,
                }}
              >
                {insp.equipment_name || insp.checklist_name}
                <span
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    padding: '2px 6px',
                    borderRadius: BorderRadius.sm,
                    fontSize: FontSize.xs,
                  }}
                >
                  {completedCount}/{itemCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Inspection Checklist */}
      {activeInspection && (
        <div style={{ marginBottom: Spacing.lg }}>
          {/* Checklist Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: Spacing.md, marginBottom: Spacing.lg }}>
            {(activeInspection.items || []).map((item) => {
              const borderColor =
                item.status === 'pass'
                  ? Colors.success
                  : item.status === 'needs_attention'
                  ? '#FF9800'
                  : item.status === 'fail'
                  ? Colors.error
                  : Colors.lightGray;

              return (
                <div
                  key={item.id}
                  className="card"
                  style={{ borderLeft: `4px solid ${borderColor}` }}
                >
                  {/* Item Header */}
                  <div style={{ marginBottom: Spacing.md }}>
                    <h4 style={{ margin: `0 0 ${Spacing.xs}px 0`, fontSize: FontSize.md, color: Colors.charcoal }}>
                      {item.label}
                    </h4>
                    {item.description && (
                      <p style={{ margin: 0, fontSize: FontSize.sm, color: Colors.medGray }}>{item.description}</p>
                    )}
                  </div>

                  {/* Status Buttons */}
                  <div style={{ display: 'flex', gap: Spacing.sm, marginBottom: Spacing.md }}>
                    {(['pass', 'needs_attention', 'fail', 'na'] as ChecklistItemStatus[]).map((status) => {
                      const isActive = item.status === status;
                      const config = STATUS_CONFIG[status];

                      return (
                        <button
                          key={status}
                          onClick={() => handleItemStatusChange(activeInspection.id, item.id, status)}
                          disabled={saving}
                          style={{
                            flex: 1,
                            padding: `${Spacing.md}px ${Spacing.sm}px`,
                            borderRadius: BorderRadius.md,
                            border: 'none',
                            backgroundColor: isActive ? config.activeColor : Colors.lightGray,
                            color: isActive ? 'white' : Colors.medGray,
                            cursor: 'pointer',
                            fontSize: FontSize.sm,
                            fontWeight: FontWeight.semibold,
                            minHeight: 44,
                            transition: 'all 0.2s',
                          }}
                        >
                          {config.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Notes (shown for attention/fail items) */}
                  {(item.status === 'needs_attention' || item.status === 'fail') && (
                    <div style={{ marginBottom: Spacing.md }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: FontSize.sm,
                          fontWeight: FontWeight.medium,
                          marginBottom: Spacing.xs,
                          color: Colors.charcoal,
                        }}
                      >
                        Notes
                      </label>
                      <textarea
                        value={item.notes || ''}
                        onChange={(e) => handleItemNotesChange(activeInspection.id, item.id, e.target.value)}
                        placeholder="Add details about this issue..."
                        style={{
                          width: '100%',
                          padding: Spacing.md,
                          borderRadius: BorderRadius.md,
                          border: `1px solid ${Colors.lightGray}`,
                          fontSize: FontSize.sm,
                          fontFamily: 'inherit',
                          minHeight: 80,
                          resize: 'vertical',
                        }}
                      />

                      {/* Pro → Task: add this finding to the homeowner's calendar */}
                      <div style={{ marginTop: Spacing.sm, display: 'flex', gap: Spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                        {tasksFromFindings[item.id] ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: `6px 12px`,
                              borderRadius: BorderRadius.full,
                              background: Colors.sageMuted,
                              color: Colors.sage,
                              fontSize: FontSize.xs,
                              fontWeight: FontWeight.semibold,
                            }}
                          >
                            ✓ Task added to calendar
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleCreateTaskFromFinding(activeInspection.id, item, 'medium')}
                              disabled={creatingTaskForItem === item.id}
                              style={{
                                padding: `${Spacing.sm}px ${Spacing.md}px`,
                                borderRadius: BorderRadius.md,
                                border: `1px solid ${Colors.copper}`,
                                background: Colors.copper,
                                color: Colors.white,
                                cursor: 'pointer',
                                fontSize: FontSize.sm,
                                fontWeight: FontWeight.semibold,
                                opacity: creatingTaskForItem === item.id ? 0.6 : 1,
                              }}
                              title="Add this finding as a maintenance task on the homeowner's calendar"
                            >
                              {creatingTaskForItem === item.id ? 'Adding…' : '+ Add as task'}
                            </button>
                            <button
                              onClick={() => handleCreateTaskFromFinding(activeInspection.id, item, 'high')}
                              disabled={creatingTaskForItem === item.id}
                              style={{
                                padding: `${Spacing.sm}px ${Spacing.md}px`,
                                borderRadius: BorderRadius.md,
                                border: `1px solid ${Colors.error}`,
                                background: 'transparent',
                                color: Colors.error,
                                cursor: 'pointer',
                                fontSize: FontSize.sm,
                                fontWeight: FontWeight.semibold,
                                opacity: creatingTaskForItem === item.id ? 0.6 : 1,
                              }}
                              title="Add this finding as a HIGH-priority task"
                            >
                              {creatingTaskForItem === item.id ? 'Adding…' : '+ Add as urgent'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Photos */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: FontSize.sm,
                        fontWeight: FontWeight.medium,
                        marginBottom: Spacing.sm,
                        color: Colors.charcoal,
                      }}
                    >
                      Photos
                    </label>
                    <button
                      onClick={() => {
                        setUploadingPhotoFor(item.id);
                        fileInputRef.current?.click();
                      }}
                      disabled={uploadingPhotoFor === item.id}
                      style={{
                        padding: `${Spacing.sm}px ${Spacing.md}px`,
                        borderRadius: BorderRadius.md,
                        border: `1px solid ${Colors.lightGray}`,
                        backgroundColor: Colors.cream,
                        cursor: 'pointer',
                        fontSize: FontSize.sm,
                        fontWeight: FontWeight.medium,
                        marginBottom: Spacing.sm,
                      }}
                    >
                      {uploadingPhotoFor === item.id ? 'Uploading...' : 'Add Photo'}
                    </button>

                    {item.photos && item.photos.length > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                          gap: Spacing.sm,
                        }}
                      >
                        {item.photos.map((photo, idx) => (
                          <div key={photo.url || `photo-${idx}`} style={{ position: 'relative' }}>
                            <img
                              src={photo.url}
                              alt={`Photo ${idx + 1}`}
                              onClick={() => {
                                setViewerImages(item.photos.map(p => p.url));
                                setViewerInitialIndex(idx);
                                setViewerOpen(true);
                              }}
                              style={{
                                width: '100%',
                                height: 100,
                                objectFit: 'cover',
                                borderRadius: BorderRadius.md,
                                cursor: 'pointer',
                                transition: 'opacity 0.2s',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                            />
                            {photo.caption && (
                              <p
                                style={{
                                  margin: `${Spacing.xs}px 0 0 0`,
                                  fontSize: FontSize.xs,
                                  color: Colors.medGray,
                                  textAlign: 'center',
                                }}
                              >
                                {photo.caption}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall Condition */}
          <div className="card" style={{ marginBottom: Spacing.lg }}>
            <label
              style={{
                display: 'block',
                fontSize: FontSize.md,
                fontWeight: FontWeight.semibold,
                marginBottom: Spacing.md,
                color: Colors.charcoal,
              }}
            >
              Overall Condition &mdash; {activeInspection.equipment_name}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: Spacing.sm }}>
              {(['good', 'fair', 'needs_attention', 'critical'] as OverallCondition[]).map((condition) => {
                const isActive = activeInspection.overall_condition === condition;
                const color = CONDITION_COLORS[condition];

                return (
                  <button
                    key={condition}
                    onClick={() => handleOverallConditionChange(activeInspection.id, condition)}
                    style={{
                      padding: `${Spacing.md}px ${Spacing.sm}px`,
                      borderRadius: BorderRadius.md,
                      border: 'none',
                      backgroundColor: isActive ? color : Colors.lightGray,
                      color: isActive ? 'white' : Colors.medGray,
                      cursor: 'pointer',
                      fontSize: FontSize.sm,
                      fontWeight: FontWeight.semibold,
                      minHeight: 44,
                      textTransform: 'capitalize',
                    }}
                  >
                    {condition.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inspector Notes */}
          <div className="card" style={{ marginBottom: Spacing.lg }}>
            <label
              style={{
                display: 'block',
                fontSize: FontSize.md,
                fontWeight: FontWeight.semibold,
                marginBottom: Spacing.md,
                color: Colors.charcoal,
              }}
            >
              Inspection Notes
            </label>
            <textarea
              value={activeInspection.pro_notes || ''}
              onChange={(e) => handleInspectorNotesChange(activeInspection.id, e.target.value)}
              placeholder="Add notes for this inspection..."
              style={{
                width: '100%',
                padding: Spacing.md,
                borderRadius: BorderRadius.md,
                border: `1px solid ${Colors.lightGray}`,
                fontSize: FontSize.sm,
                fontFamily: 'inherit',
                minHeight: 100,
                resize: 'vertical',
              }}
            />
          </div>

          {/* Mark Complete Button */}
          <button
            onClick={() => handleCompleteInspection(activeInspection.id)}
            disabled={saving || activeInspection.status === 'completed'}
            style={{
              width: '100%',
              padding: `${Spacing.md}px ${Spacing.lg}px`,
              borderRadius: BorderRadius.md,
              border: 'none',
              backgroundColor: activeInspection.status === 'completed' ? Colors.lightGray : Colors.success,
              color: activeInspection.status === 'completed' ? Colors.medGray : 'white',
              cursor: activeInspection.status === 'completed' ? 'default' : 'pointer',
              fontSize: FontSize.md,
              fontWeight: FontWeight.semibold,
              marginBottom: Spacing.lg,
            }}
          >
            {activeInspection.status === 'completed' ? '\u2713 Inspection Complete' : 'Mark Inspection Complete'}
          </button>
        </div>
      )}

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        aria-label="Upload inspection photo"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0] && activeInspection && uploadingPhotoFor) {
            handlePhotoUpload(activeInspection.id, uploadingPhotoFor, e.target.files[0]);
          }
        }}
      />

      {/* Bottom Bar (Sticky) */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Colors.white,
          borderTop: `1px solid ${Colors.lightGray}`,
          padding: Spacing.lg,
          display: 'flex',
          gap: Spacing.md,
        }}
      >
        <button
          onClick={() => navigate('/pro-portal/job-queue')}
          style={{
            flex: 1,
            padding: `${Spacing.md}px ${Spacing.lg}px`,
            borderRadius: BorderRadius.md,
            border: `1px solid ${Colors.lightGray}`,
            backgroundColor: Colors.white,
            color: Colors.charcoal,
            cursor: 'pointer',
            fontSize: FontSize.md,
            fontWeight: FontWeight.semibold,
          }}
        >
          Save &amp; Exit
        </button>
        <button
          onClick={() => setShowCompleteModal(true)}
          disabled={!allInspectionsComplete || saving}
          style={{
            flex: 1,
            padding: `${Spacing.md}px ${Spacing.lg}px`,
            borderRadius: BorderRadius.md,
            border: 'none',
            backgroundColor: allInspectionsComplete ? Colors.sage : Colors.lightGray,
            color: allInspectionsComplete ? 'white' : Colors.medGray,
            cursor: allInspectionsComplete ? 'pointer' : 'not-allowed',
            fontSize: FontSize.md,
            fontWeight: FontWeight.semibold,
          }}
        >
          Complete Visit
        </button>
      </div>

      {/* Complete Visit Modal */}
      {showCompleteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 100,
          }}
          onClick={() => setShowCompleteModal(false)}
        >
          <div
            className="card"
            style={{ width: '90%', maxWidth: 500, padding: Spacing.lg, backgroundColor: Colors.white }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: `0 0 ${Spacing.md}px 0`, color: Colors.charcoal }}>Complete Visit</h2>

            <label
              style={{
                display: 'block',
                fontSize: FontSize.sm,
                fontWeight: FontWeight.medium,
                marginBottom: Spacing.sm,
                color: Colors.charcoal,
              }}
            >
              Final Notes
            </label>
            <textarea
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
              placeholder="Any final observations or recommendations..."
              style={{
                width: '100%',
                padding: Spacing.md,
                borderRadius: BorderRadius.md,
                border: `1px solid ${Colors.lightGray}`,
                fontSize: FontSize.sm,
                fontFamily: 'inherit',
                minHeight: 80,
                marginBottom: Spacing.md,
                resize: 'vertical',
              }}
            />

            <label
              style={{
                display: 'block',
                fontSize: FontSize.sm,
                fontWeight: FontWeight.medium,
                marginBottom: Spacing.sm,
                color: Colors.charcoal,
              }}
            >
              Homeowner Signature <span style={{ color: Colors.medGray, fontWeight: 400 }}>(optional — if homeowner is present)</span>
            </label>
            <input
              type="text"
              value={homeownerName}
              onChange={(e) => setHomeownerName(e.target.value)}
              placeholder="Homeowner's printed name"
              style={{
                width: '100%',
                padding: Spacing.sm,
                borderRadius: BorderRadius.md,
                border: `1px solid ${Colors.lightGray}`,
                fontSize: FontSize.sm,
                fontFamily: 'inherit',
                marginBottom: Spacing.sm,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ marginBottom: Spacing.md }}>
              <SignaturePad
                label="Homeowner sign here"
                height={140}
                onSave={(dataUrl) => setHomeownerSignature(dataUrl)}
                onClear={() => setHomeownerSignature(null)}
              />
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: Spacing.sm,
                cursor: 'pointer',
                marginBottom: Spacing.lg,
              }}
            >
              <input
                type="checkbox"
                checked={generateAISummary}
                onChange={(e) => setGenerateAISummary(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: FontSize.sm, color: Colors.charcoal }}>Generate AI Summary for Homeowner</span>
            </label>

            <div style={{ display: 'flex', gap: Spacing.md }}>
              <button
                onClick={() => setShowCompleteModal(false)}
                style={{
                  flex: 1,
                  padding: `${Spacing.md}px ${Spacing.lg}px`,
                  borderRadius: BorderRadius.md,
                  border: `1px solid ${Colors.lightGray}`,
                  backgroundColor: Colors.white,
                  color: Colors.charcoal,
                  cursor: 'pointer',
                  fontSize: FontSize.sm,
                  fontWeight: FontWeight.semibold,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteVisit}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: `${Spacing.md}px ${Spacing.lg}px`,
                  borderRadius: BorderRadius.md,
                  border: 'none',
                  backgroundColor: Colors.sage,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: FontSize.sm,
                  fontWeight: FontWeight.semibold,
                }}
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewerOpen && (
        <ImageViewer
          images={viewerImages}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
      </div>
    </SectionErrorBoundary>
  );
}
