import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useStore } from '@/store/useStore';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { TASK_TEMPLATES } from '@/constants/maintenance';
import AdminPreviewBanner from '@/components/AdminPreviewBanner';
import type { ProMonthlyVisit, Home, Equipment, ProProvider } from '@/types';

interface Visit extends ProMonthlyVisit {
  home?: Home;
  homeowner?: { first_name: string; last_name: string };
  equipment?: Equipment[];
}

interface VisitStats {
  todaysVisits: number;
  completed: number;
  nextVisitTime: string | null;
}

export default function ProJobQueue() {
  const navigate = useNavigate();
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';

  const [visits, setVisits] = useState<Visit[]>([]);
  const [stats, setStats] = useState<VisitStats>({ todaysVisits: 0, completed: 0, nextVisitTime: null });
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState<ProProvider | null>(null);

  // Admin preview
  const [allProviders, setAllProviders] = useState<ProProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      navigate('/pro-login');
      return;
    }
    loadData();
  }, [selectedDate]);

  // Admin: reload when switching provider
  useEffect(() => {
    if (isAdmin && selectedProviderId) {
      const p = allProviders.find(p => p.id === selectedProviderId);
      if (p) {
        setProvider(p);
        loadVisitsForProvider(p.id);
      }
    }
  }, [selectedProviderId]);

  const loadVisitsForProvider = async (providerId: string) => {
    setLoading(true);
    try {
      const { data: visitsData, error: visitsError } = await supabase
        .from('pro_monthly_visits')
        .select(`*, home:homes(*), homeowner:profiles(first_name, last_name)`)
        .eq('pro_provider_id', providerId)
        .eq('visit_date', selectedDate)
        .order('created_at', { ascending: true });

      if (visitsError) throw visitsError;

      const enrichedVisits: Visit[] = await Promise.all(
        (visitsData || []).map(async (visit) => {
          const { data: equipmentData } = await supabase.from('equipment').select('*').eq('home_id', visit.home_id);
          return { ...visit, equipment: equipmentData || [] };
        })
      );

      setVisits(enrichedVisits);
      const completedCount = enrichedVisits.filter((v) => v.status === 'completed').length;
      setStats({
        todaysVisits: enrichedVisits.length,
        completed: completedCount,
        nextVisitTime: enrichedVisits.length - completedCount > 0 ? `${enrichedVisits.length - completedCount} left` : null,
      });
    } catch (error) {
      console.error('Error loading visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser?.user) {
        navigate('/pro-login');
        return;
      }

      // Admin: load all providers, preview the first one
      if (isAdmin) {
        const { data: providers } = await supabase.from('pro_providers').select('*').order('business_name');
        const list = (providers || []) as ProProvider[];
        setAllProviders(list);
        if (list.length > 0) {
          setSelectedProviderId(list[0].id);
          setProvider(list[0]);
          await loadVisitsForProvider(list[0].id);
        } else {
          setLoading(false);
        }
        return;
      }

      // Load provider info
      const { data: providerData } = await supabase
        .from('pro_providers')
        .select('*')
        .eq('user_id', authUser.user.id)
        .single();

      if (!providerData) {
        navigate('/pro-login');
        return;
      }

      setProvider(providerData);

      // Load visits for selected date — visit_date is a DATE column, use .eq()
      const { data: visitsData, error: visitsError } = await supabase
        .from('pro_monthly_visits')
        .select(
          `
          *,
          home:homes(*),
          homeowner:profiles(first_name, last_name)
        `
        )
        .eq('pro_provider_id', providerData.id)
        .eq('visit_date', selectedDate)
        .order('created_at', { ascending: true });

      if (visitsError) throw visitsError;

      // Enrich with equipment data
      const enrichedVisits: Visit[] = await Promise.all(
        (visitsData || []).map(async (visit) => {
          const { data: equipmentData } = await supabase
            .from('equipment')
            .select('*')
            .eq('home_id', visit.home_id);

          return {
            ...visit,
            equipment: equipmentData || [],
          };
        })
      );

      setVisits(enrichedVisits);

      // Calculate stats
      const todaysVisits = enrichedVisits.length;
      const completedCount = enrichedVisits.filter((v) => v.status === 'completed').length;
      const remaining = todaysVisits - completedCount;

      setStats({
        todaysVisits,
        completed: completedCount,
        nextVisitTime: remaining > 0 ? `${remaining} left` : null,
      });
    } catch (error) {
      console.error('Error loading job queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('pro_monthly_visits')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', visitId);

      if (error) throw error;

      // Generate inspections for this visit (simplified client-side)
      await generateInspections(visitId);

      navigate(`/pro-portal/inspection/${visitId}`);
    } catch (error) {
      console.error('Error starting visit:', error);
      alert('Failed to start visit');
    }
  };

  const generateInspections = async (visitId: string) => {
    const visit = visits.find((v) => v.id === visitId);
    if (!visit) return;

    try {
      // In a full implementation, this would call an edge function
      // For now, we'll assume inspections are created server-side when status is updated
      // The ProInspection page will generate them on mount if they don't exist
    } catch (error) {
      console.error('Error generating inspections:', error);
    }
  };

  const getEquipmentSummary = (equipment: Equipment[] | undefined): string => {
    if (!equipment || equipment.length === 0) return 'No equipment recorded';

    const categories: Record<string, number> = {};
    equipment.forEach((e) => {
      categories[e.category] = (categories[e.category] || 0) + 1;
    });

    return Object.entries(categories)
      .map(([cat, count]) => `${count} ${cat}`)
      .join(', ');
  };

  const getItemsToHaveOnHand = (equipment: Equipment[] | undefined): string[] => {
    if (!equipment) return [];

    const items = new Set<string>();
    equipment.forEach((eq) => {
      const templates = TASK_TEMPLATES.filter((t) => t.requires_equipment === eq.category);
      templates.forEach((t) => {
        if (t.items_to_have_on_hand) {
          t.items_to_have_on_hand.forEach((item) => items.add(item));
        }
      });
    });

    return Array.from(items).slice(0, 6); // Limit display
  };

  const formatTime = (timeStr: string | undefined): string => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const getStatusBadgeStyle = (status: string) => {
    const baseStyle: React.CSSProperties = {
      padding: '6px 12px',
      borderRadius: BorderRadius.full,
      fontSize: FontSize.sm,
      fontWeight: FontWeight.semibold,
      display: 'inline-block',
    };

    switch (status) {
      case 'confirmed':
        return {
          ...baseStyle,
          backgroundColor: 'var(--color-info)15',
          color: Colors.info,
        };
      case 'in_progress':
        return {
          ...baseStyle,
          backgroundColor: `${Colors.copper}20`,
          color: Colors.copper,
        };
      case 'completed':
        return {
          ...baseStyle,
          backgroundColor: 'var(--color-success)15',
          color: Colors.success,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: Colors.lightGray,
          color: Colors.medGray,
        };
    }
  };

  const toggleExpanded = (visitId: string) => {
    const newSet = new Set(expandedVisits);
    if (newSet.has(visitId)) {
      newSet.delete(visitId);
    } else {
      newSet.add(visitId);
    }
    setExpandedVisits(newSet);
  };

  const calculateAge = (installDate: string | undefined): string => {
    if (!installDate) return 'Unknown age';
    const install = new Date(installDate);
    const today = new Date();
    const ageMs = today.getTime() - install.getTime();
    const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));

    if (ageYears > 0) {
      return `${ageYears} years old`;
    }

    // For equipment less than 1 year old, show months
    const ageMonths = Math.floor(ageMs / (30.44 * 24 * 60 * 60 * 1000));
    if (ageMonths > 0) {
      return `${ageMonths} month${ageMonths === 1 ? '' : 's'} old`;
    }

    return 'New';
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <p>Loading today's jobs...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      {isAdmin && (
        <AdminPreviewBanner
          portalType="pro"
          providers={allProviders}
          selectedId={selectedProviderId}
          onSelect={setSelectedProviderId}
        />
      )}
      {/* Header */}
      <div className="page-header" style={{ marginBottom: Spacing.lg }}>
        <div>
          <h1>Today's Jobs</h1>
          <p className="subtitle">{provider?.business_name || 'Pro Portal'}</p>
        </div>
      </div>

      {/* Date Selector */}
      <div style={{ marginBottom: Spacing.lg }}>
        <label style={{ display: 'block', fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.sm, color: Colors.charcoal }}>
          Select Date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            padding: `${Spacing.sm}px ${Spacing.md}px`,
            borderRadius: BorderRadius.md,
            border: `1px solid ${Colors.lightGray}`,
            fontSize: FontSize.md,
            maxWidth: 200,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Stats Bar */}
      <div className="grid-3 mb-lg" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: Spacing.md }}>
        <div className="card" style={{ textAlign: 'center', padding: `${Spacing.md}px ${Spacing.sm}px` }}>
          <div style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.sage, marginBottom: Spacing.xs }}>
            {stats.todaysVisits}
          </div>
          <p style={{ margin: 0, fontSize: FontSize.sm, color: Colors.medGray }}>Scheduled Visits</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: `${Spacing.md}px ${Spacing.sm}px` }}>
          <div style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.success, marginBottom: Spacing.xs }}>
            {stats.completed}
          </div>
          <p style={{ margin: 0, fontSize: FontSize.sm, color: Colors.medGray }}>Completed</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: `${Spacing.md}px ${Spacing.sm}px` }}>
          <div style={{ fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.copper, marginBottom: Spacing.xs }}>
            {stats.nextVisitTime ? formatTime(stats.nextVisitTime) : '—'}
          </div>
          <p style={{ margin: 0, fontSize: FontSize.sm, color: Colors.medGray }}>Next Visit</p>
        </div>
      </div>

      {/* Visit Cards */}
      {visits.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: Spacing.xxl, color: Colors.medGray }}>
          <p style={{ fontSize: FontSize.md, margin: 0 }}>No visits scheduled for {selectedDate}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: Spacing.md }}>
          {visits.map((visit) => (
            <div
              key={visit.id}
              className="card"
              style={{
                borderLeft: `4px solid ${visit.status === 'completed' ? Colors.success : visit.status === 'in_progress' ? Colors.copper : Colors.info}`,
              }}
            >
              {/* Visit Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: Spacing.md,
                  paddingBottom: Spacing.md,
                  borderBottom: `1px solid ${Colors.lightGray}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>
                    {visit.homeowner ? `${visit.homeowner.first_name || ''} ${visit.homeowner.last_name || ''}`.trim() || 'Homeowner' : 'Homeowner'}
                  </div>
                  <div style={{ fontSize: FontSize.sm, color: Colors.medGray, marginTop: Spacing.xs }}>
                    {visit.home?.address}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: Spacing.sm }}>
                  <span style={getStatusBadgeStyle(visit.status)}>{visit.status.replace('_', ' ').toUpperCase()}</span>
                  {visit.status === 'completed' && (
                    <button
                      onClick={() => toggleExpanded(visit.id)}
                      style={{
                        padding: `${Spacing.xs}px ${Spacing.md}px`,
                        borderRadius: BorderRadius.sm,
                        border: `1px solid ${Colors.lightGray}`,
                        backgroundColor: Colors.white,
                        cursor: 'pointer',
                        fontSize: FontSize.sm,
                        fontWeight: FontWeight.medium,
                        color: Colors.charcoal,
                      }}
                    >
                      {expandedVisits.has(visit.id) ? '▼ Hide Summary' : '▶ View Summary'}
                    </button>
                  )}
                </div>
              </div>

              {/* Equipment Summary */}
              <div style={{ paddingTop: Spacing.md, paddingBottom: Spacing.md, borderBottom: `1px solid ${Colors.lightGray}` }}>
                <p style={{ margin: 0, fontSize: FontSize.sm, color: Colors.medGray, marginBottom: Spacing.xs }}>
                  <strong>Equipment:</strong> {getEquipmentSummary(visit.equipment)}
                </p>
              </div>

              {/* Selected Tasks */}
              {visit.selected_task_ids && visit.selected_task_ids.length > 0 && (
                <div style={{ paddingTop: Spacing.md, paddingBottom: Spacing.md, borderBottom: `1px solid ${Colors.lightGray}` }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>
                    Selected Tasks ({visit.selected_task_ids.length})
                  </p>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: Spacing.md,
                      fontSize: FontSize.sm,
                      color: Colors.medGray,
                    }}
                  >
                    {visit.selected_task_ids.slice(0, 3).map((taskId) => {
                      const template = TASK_TEMPLATES.find((t) => t.id === taskId);
                      return <li key={taskId}>{template?.title || taskId}</li>;
                    })}
                    {visit.selected_task_ids.length > 3 && <li>+ {visit.selected_task_ids.length - 3} more</li>}
                  </ul>
                </div>
              )}

              {/* Items to Have On Hand */}
              {getItemsToHaveOnHand(visit.equipment).length > 0 && (
                <div style={{ paddingTop: Spacing.md, paddingBottom: Spacing.md, borderBottom: `1px solid ${Colors.lightGray}` }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.charcoal }}>
                    Items to Have On Hand
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: Spacing.sm,
                    }}
                  >
                    {getItemsToHaveOnHand(visit.equipment).map((item, idx) => (
                      <span
                        key={item}
                        style={{
                          padding: `${Spacing.xs}px ${Spacing.sm}px`,
                          backgroundColor: Colors.cream,
                          borderRadius: BorderRadius.md,
                          fontSize: FontSize.xs,
                          color: Colors.charcoal,
                        }}
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ paddingTop: Spacing.md, display: 'flex', gap: Spacing.md }}>
                {visit.status === 'confirmed' && (
                  <button
                    onClick={() => handleStartVisit(visit.id)}
                    style={{
                      flex: 1,
                      padding: `${Spacing.sm}px ${Spacing.md}px`,
                      borderRadius: BorderRadius.md,
                      border: 'none',
                      backgroundColor: Colors.sage,
                      color: 'white',
                      fontSize: FontSize.md,
                      fontWeight: FontWeight.semibold,
                      cursor: 'pointer',
                    }}
                  >
                    Start Visit
                  </button>
                )}
                {visit.status === 'in_progress' && (
                  <button
                    onClick={() => navigate(`/pro-portal/inspection/${visit.id}`)}
                    style={{
                      flex: 1,
                      padding: `${Spacing.sm}px ${Spacing.md}px`,
                      borderRadius: BorderRadius.md,
                      border: 'none',
                      backgroundColor: Colors.copper,
                      color: 'white',
                      fontSize: FontSize.md,
                      fontWeight: FontWeight.semibold,
                      cursor: 'pointer',
                    }}
                  >
                    Continue Inspection
                  </button>
                )}
              </div>

              {/* Pre-visit Briefing (Expandable) */}
              {expandedVisits.has(visit.id) && visit.status === 'completed' && (
                <div
                  style={{
                    marginTop: Spacing.md,
                    paddingTop: Spacing.md,
                    borderTop: `1px solid ${Colors.lightGray}`,
                  }}
                >
                  <h4 style={{ margin: `0 0 ${Spacing.sm}px 0`, fontSize: FontSize.md, color: Colors.charcoal }}>
                    Visit Summary
                  </h4>
                  <div style={{ fontSize: FontSize.sm, color: Colors.medGray, lineHeight: 1.6 }}>
                    <p style={{ margin: `0 0 ${Spacing.sm}px 0` }}>
                      <strong>Duration:</strong> {visit.time_spent_minutes} minutes
                    </p>
                    {visit.pro_notes && (
                      <p style={{ margin: `0 0 ${Spacing.sm}px 0` }}>
                        <strong>Notes:</strong> {visit.pro_notes}
                      </p>
                    )}
                    {visit.equipment && visit.equipment.length > 0 && (
                      <div style={{ marginTop: Spacing.sm }}>
                        <p style={{ margin: `0 0 ${Spacing.xs}px 0`, fontWeight: FontWeight.semibold }}>Equipment Inventory:</p>
                        <ul style={{ margin: `0 0 0 ${Spacing.md}px`, paddingLeft: 0 }}>
                          {visit.equipment.map((eq) => (
                            <li key={eq.id}>
                              {eq.name} ({calculateAge(eq.install_date)})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
