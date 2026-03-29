import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { TASK_TEMPLATES } from '@/constants/maintenance';
import type { ProMonthlyVisit, Home, Equipment } from '@/types';

interface VisitInspection {
  id: string;
  visit_id: string;
  equipment_id?: string;
  equipment_name: string;
  equipment_category: string;
  overall_condition?: 'good' | 'fair' | 'needs_attention' | 'critical';
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  inspector_notes?: string;
  created_at: string;
  updated_at: string;
}

interface VisitInspectionItem {
  id: string;
  inspection_id: string;
  item_label: string;
  item_description?: string;
  status: 'pass' | 'attention' | 'fail' | 'na';
  notes?: string;
  photos: { url: string; caption?: string }[];
  created_at: string;
  updated_at: string;
}

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Photo upload references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null);

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

      // Load inspections
      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from('visit_inspections')
        .select('*')
        .eq('visit_id', visitId);

      if (inspectionsError) throw inspectionsError;

      // If no inspections exist, generate them
      if (!inspectionsData || inspectionsData.length === 0) {
        await generateInspections(visitData, equipmentData || []);
      } else {
        // Load items for each inspection
        const enriched = await Promise.all(
          (inspectionsData || []).map(async (inspection) => {
            const { data: itemsData } = await supabase
              .from('visit_inspection_items')
              .select('*')
              .eq('inspection_id', inspection.id);

            return {
              ...inspection,
              items: itemsData || [],
            };
          })
        );

        setInspections(enriched);
        if (enriched.length > 0) {
          setActiveTabId(enriched[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading inspection data:', error);
      alert('Failed to load inspection data');
      navigate('/pro-portal/job-queue');
    } finally {
      setLoading(false);
    }
  };

  const generateInspections = async (visitData: ProMonthlyVisit, equipmentList: Equipment[]) => {
    try {
      // Create inspection for each equipment category + general home
      const categories = new Set(equipmentList.map((e) => e.category));
      const inspectionCategories = ['general_home', ...Array.from(categories)];

      const newInspections = await Promise.all(
        inspectionCategories.map(async (category) => {
          const equipmentForCategory = equipmentList.filter((e) => e.category === category);
          const displayName =
            category === 'general_home'
              ? 'General Home'
              : category
                  .split('_')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');

          // Insert inspection
          const { data: inspectionData, error: inspectionError } = await supabase
            .from('visit_inspections')
            .insert({
              visit_id: visitId,
              equipment_id: equipmentForCategory[0]?.id || null,
              equipment_name: displayName,
              equipment_category: category,
              status: 'not_started',
            })
            .select();

          if (inspectionError) throw inspectionError;
          const newInspection = inspectionData?.[0];

          // Generate checklist items from templates
          if (newInspection) {
            const templates =
              category === 'general_home'
                ? TASK_TEMPLATES.filter((t) => t.category === 'general' || t.category === 'seasonal')
                : TASK_TEMPLATES.filter((t) => t.category === category);

            const items = templates.map((template) => ({
              inspection_id: newInspection.id,
              item_label: template.title,
              item_description: template.description,
              status: 'na',
              notes: '',
              photos: [],
            }));

            if (items.length > 0) {
              const { error: itemsError } = await supabase
                .from('visit_inspection_items')
                .insert(items);

              if (itemsError) throw itemsError;
            }

            return {
              ...newInspection,
              items: items.map((item, idx) => ({
                id: `temp-${idx}`,
                ...item,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })),
            };
          }

          return null;
        })
      );

      const validInspections = newInspections.filter((i): i is EnrichedInspection => i !== null);
      setInspections(validInspections);
      if (validInspections.length > 0) {
        setActiveTabId(validInspections[0].id);
      }

      // Reload to get actual IDs from database
      setTimeout(() => loadData(), 500);
    } catch (error) {
      console.error('Error generating inspections:', error);
    }
  };

  const handleItemStatusChange = async (inspectionId: string, itemId: string, newStatus: 'pass' | 'attention' | 'fail' | 'na') => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('visit_inspection_items')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) throw error;

      // Update local state
      setInspections((prev) =>
        prev.map((insp) =>
          insp.id === inspectionId
            ? {
                ...insp,
                items: insp.items.map((item) =>
                  item.id === itemId
                    ? { ...item, status: newStatus }
                    : item
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

  const handleItemNotesChange = (inspectionId: string, itemId: string, notes: string) => {
    // Debounce the save
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
              items: insp.items.map((item) =>
                item.id === itemId
                  ? { ...item, notes }
                  : item
              ),
            }
          : insp
      )
    );

    // Debounce the database save
    debounceRef.current[debounceKey] = setTimeout(async () => {
      try {
        await supabase
          .from('visit_inspection_items')
          .update({ notes, updated_at: new Date().toISOString() })
          .eq('id', itemId);
      } catch (error) {
        console.error('Error saving notes:', error);
      }
    }, 500);
  };

  const handlePhotoUpload = async (inspectionId: string, itemId: string, file: File) => {
    if (!file) return;

    try {
      setUploadingPhotoFor(itemId);

      // Upload to Supabase Storage
      const fileName = `${visitId}/${itemId}/${Date.now()}-${file.name}`;
      const { error: uploadError, data } = await supabase.storage
        .from('visit-inspections')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from('visit-inspections')
        .getPublicUrl(fileName);

      // Get current item
      const currentInspection = inspections.find((i) => i.id === inspectionId);
      const currentItem = currentInspection?.items.find((it) => it.id === itemId);

      if (currentItem) {
        const updatedPhotos = [...(currentItem.photos || []), { url: publicUrl.publicUrl, caption: '' }];

        await supabase
          .from('visit_inspection_items')
          .update({ photos: updatedPhotos, updated_at: new Date().toISOString() })
          .eq('id', itemId);

        // Update local state
        setInspections((prev) =>
          prev.map((insp) =>
            insp.id === inspectionId
              ? {
                  ...insp,
                  items: insp.items.map((item) =>
                    item.id === itemId
                      ? { ...item, photos: updatedPhotos }
                      : item
                  ),
                }
              : insp
          )
        );
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo');
    } finally {
      setUploadingPhotoFor(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCompleteInspection = async (inspectionId: string) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('visit_inspections')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', inspectionId);

      if (error) throw error;

      setInspections((prev) =>
        prev.map((insp) =>
          insp.id === inspectionId
            ? { ...insp, status: 'completed' }
            : insp
        )
      );
    } catch (error) {
      console.error('Error completing inspection:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteVisit = async () => {
    if (!visit) return;

    try {
      setSaving(true);

      // Calculate actual time spent
      const startTime = new Date(visit.started_at || new Date()).getTime();
      const endTime = new Date().getTime();
      const timeSpentMinutes = Math.round((endTime - startTime) / (1000 * 60));

      // Update visit
      const { error } = await supabase
        .from('pro_monthly_visits')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          time_spent_minutes: timeSpentMinutes,
          pro_notes: finalNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', visitId);

      if (error) throw error;

      // TODO: Call generate-visit-summary edge function if generateAISummary is true

      setShowCompleteModal(false);
      navigate('/pro-portal/job-queue', { state: { success: 'Visit completed successfully' } });
    } catch (error) {
      console.error('Error completing visit:', error);
      alert('Failed to complete visit');
    } finally {
      setSaving(false);
    }
  };

  const allInspectionsComplete = inspections.length > 0 && inspections.every((i) => i.status === 'completed' || i.status === 'skipped');

  const formatElapsedTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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
    <div className="page" style={{ maxWidth: 1200, paddingBottom: Spacing.xxl }}>
      {/* Visit Header */}
      <div style={{ position: 'sticky', top: 0, backgroundColor: Colors.white, zIndex: 10, paddingBottom: Spacing.md, marginBottom: Spacing.lg, borderBottom: `1px solid ${Colors.lightGray}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <div>
            <h1 style={{ margin: 0, marginBottom: Spacing.xs }}>
              {home.address}
            </h1>
            <p style={{ margin: 0, fontSize: FontSize.sm, color: Colors.medGray }}>
              {visit.confirmed_date} • Started {visit.started_at ? new Date(visit.started_at).toLocaleTimeString() : '—'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.sage }}>
              {formatElapsedTime(elapsedSeconds)}
            </div>
            <p style={{ margin: 0, fontSize: FontSize.xs, color: Colors.medGray }}>Elapsed</p>
          </div>
        </div>

        {/* Tab Bar */}
        <div
          style={{
            display: 'flex',
            gap: Spacing.sm,
            overflowX: 'auto',
            paddingBottom: Spacing.sm,
          }}
        >
          {inspections.map((insp) => {
            const itemCount = insp.items.length;
            const completedCount = insp.items.filter((item) => item.status !== 'na').length;
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
                {insp.equipment_name}
                <span style={{ backgroundColor: 'rgba(255,255,255,0.3)', padding: '2px 6px', borderRadius: BorderRadius.sm, fontSize: FontSize.xs }}>
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
            {activeInspection.items.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${
                    item.status === 'pass' ? Colors.success : item.status === 'attention' ? '#FF9800' : item.status === 'fail' ? Colors.error : Colors.lightGray
                  }`,
                }}
              >
                {/* Item Header */}
                <div style={{ marginBottom: Spacing.md }}>
                  <h4 style={{ margin: `0 0 ${Spacing.xs}px 0`, fontSize: FontSize.md, color: Colors.charcoal }}>
                    {item.item_label}
                  </h4>
                  {item.item_description && (
                    <p style={{ margin: 0, fontSize: FontSize.sm, color: Colors.medGray }}>
                      {item.item_description}
                    </p>
                  )}
                </div>

                {/* Status Buttons */}
                <div style={{ display: 'flex', gap: Spacing.sm, marginBottom: Spacing.md }}>
                  {(['pass', 'attention', 'fail', 'na'] as const).map((status) => {
                    const isActive = item.status === status;
                    let bgColor = Colors.lightGray;
                    let textColor = Colors.medGray;
                    let label = status === 'na' ? '— N/A' : status === 'attention' ? '⚠ Attention' : status === 'pass' ? '✓ Pass' : '✗ Fail';

                    if (isActive) {
                      if (status === 'pass') {
                        bgColor = Colors.success;
                        textColor = 'white';
                      } else if (status === 'attention') {
                        bgColor = '#FF9800';
                        textColor = 'white';
                      } else if (status === 'fail') {
                        bgColor = Colors.error;
                        textColor = 'white';
                      } else {
                        bgColor = Colors.medGray;
                        textColor = 'white';
                      }
                    }

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
                          backgroundColor: bgColor,
                          color: textColor,
                          cursor: 'pointer',
                          fontSize: FontSize.sm,
                          fontWeight: FontWeight.semibold,
                          minHeight: 44,
                          transition: 'all 0.2s',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Notes */}
                {(item.status === 'attention' || item.status === 'fail') && (
                  <div style={{ marginBottom: Spacing.md }}>
                    <label style={{ display: 'block', fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.xs, color: Colors.charcoal }}>
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
                  </div>
                )}

                {/* Photos */}
                <div>
                  <label style={{ display: 'block', fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.sm, color: Colors.charcoal }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: Spacing.sm }}>
                      {item.photos.map((photo, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                          <img
                            src={photo.url}
                            alt={`Photo ${idx + 1}`}
                            style={{
                              width: '100%',
                              height: 100,
                              objectFit: 'cover',
                              borderRadius: BorderRadius.md,
                            }}
                          />
                          {photo.caption && (
                            <p style={{ margin: `${Spacing.xs}px 0 0 0`, fontSize: FontSize.xs, color: Colors.medGray, textAlign: 'center' }}>
                              {photo.caption}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Overall Condition */}
          <div className="card" style={{ marginBottom: Spacing.lg }}>
            <label style={{ display: 'block', fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Spacing.md, color: Colors.charcoal }}>
              Overall Condition — {activeInspection.equipment_name}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: Spacing.sm }}>
              {(['good', 'fair', 'needs_attention', 'critical'] as const).map((condition) => {
                const isActive = activeInspection.overall_condition === condition;
                const colors: Record<string, { bg: string; text: string }> = {
                  good: { bg: Colors.success, text: 'white' },
                  fair: { bg: '#FF9800', text: 'white' },
                  needs_attention: { bg: Colors.warning, text: 'white' },
                  critical: { bg: Colors.error, text: 'white' },
                };

                return (
                  <button
                    key={condition}
                    onClick={async () => {
                      await supabase
                        .from('visit_inspections')
                        .update({ overall_condition: condition, updated_at: new Date().toISOString() })
                        .eq('id', activeInspection.id);

                      setInspections((prev) =>
                        prev.map((insp) =>
                          insp.id === activeInspection.id
                            ? { ...insp, overall_condition: condition }
                            : insp
                        )
                      );
                    }}
                    style={{
                      padding: `${Spacing.md}px ${Spacing.sm}px`,
                      borderRadius: BorderRadius.md,
                      border: 'none',
                      backgroundColor: isActive ? colors[condition].bg : Colors.lightGray,
                      color: isActive ? colors[condition].text : Colors.medGray,
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
            <label style={{ display: 'block', fontSize: FontSize.md, fontWeight: FontWeight.semibold, marginBottom: Spacing.md, color: Colors.charcoal }}>
              Inspection Notes
            </label>
            <textarea
              value={activeInspection.inspector_notes || ''}
              onChange={(e) => {
                const notes = e.target.value;
                const debounceKey = `notes-${activeInspection.id}`;
                if (debounceRef.current[debounceKey]) {
                  clearTimeout(debounceRef.current[debounceKey]);
                }

                setInspections((prev) =>
                  prev.map((insp) =>
                    insp.id === activeInspection.id
                      ? { ...insp, inspector_notes: notes }
                      : insp
                  )
                );

                debounceRef.current[debounceKey] = setTimeout(async () => {
                  await supabase
                    .from('visit_inspections')
                    .update({ inspector_notes: notes, updated_at: new Date().toISOString() })
                    .eq('id', activeInspection.id);
                }, 500);
              }}
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
            {activeInspection.status === 'completed' ? '✓ Inspection Complete' : 'Mark Inspection Complete'}
          </button>
        </div>
      )}

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0] && activeInspection && uploadingPhotoFor) {
            handlePhotoUpload(activeInspection.id, uploadingPhotoFor, e.target.files[0]);
          }
        }}
      />

      {/* Bottom Bar — Sticky */}
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
          Save & Exit
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
            style={{
              width: '90%',
              maxWidth: 500,
              padding: Spacing.lg,
              backgroundColor: Colors.white,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: `0 0 ${Spacing.md}px 0`, color: Colors.charcoal }}>Complete Visit</h2>

            <label style={{ display: 'block', fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.sm, color: Colors.charcoal }}>
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

            <label style={{ display: 'flex', alignItems: 'center', gap: Spacing.sm, cursor: 'pointer', marginBottom: Spacing.lg }}>
              <input
                type="checkbox"
                checked={generateAISummary}
                onChange={(e) => setGenerateAISummary(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: FontSize.sm, color: Colors.charcoal }}>Generate AI Summary</span>
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
    </div>
  );
}
