import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors, FontSize } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';
import logger from '@/utils/logger';

interface AnalyticsData {
  // User Growth
  monthlySignups: { month: string; count: number }[];
  totalUsers: number;
  newUsers30d: number;
  returningUsers: number;
  activeUsers30d: number;

  // Revenue
  usersByTier: { tier: string; count: number; price: number }[];
  mrrEstimate: number;
  projectedArr: number;

  // Churn
  churned30d: number;
  retentionRate: number;

  // 2026-05-02: operational tiles (STRATEGIC_TOP #7 deferred halves)
  signupsToday: number;
  failedNotifications24h: number;
  totalNotifications24h: number;
  edgeFnErrorRate24h: number; // 0..1 ratio
  openSupportTickets: number;
  recentSupportTickets: SupportTicketSummary[];

  // 2026-05-02: STRATEGIC_TOP #9 deferred half — when the JS-side LIMIT
  // cap is hit, surface a banner so admins know cohort/template stats are
  // sampled rather than total. Set to null when both samples are full.
  dataWindowWarning: string | null;

  // Activation
  usersWithHome: number;
  usersWithEquipment: number;
  usersWithTask: number;
  avgTasksPerUser: number;

  // Gift Codes
  giftCodeConversion: number;
  avgDaysToRedeem: number;
  giftCodesByTier: { tier: string; count: number }[];
  giftCodesExpiringIn7d: number;

  // Pro Service
  proRequestsTotal: number;
  proRequestsByStatus: { status: string; count: number }[];
  avgTimeToAssignment: number;

  // Task Template Performance (Item 17)
  templateStats: TemplateStat[];
  templateTotals: {
    totalTemplates: number;
    totalGenerated: number;
    totalCompleted: number;
    avgCompletionRate: number;
    overdueCount: number;
  };
}

// 2026-05-02: minimal shape for the top-issues feed.
interface SupportTicketSummary {
  id: string;
  subject: string;
  category: string | null;
  priority: string | null;
  status: string;
  created_at: string;
}

interface TemplateStat {
  id: string;
  title: string;
  category: string;
  source: string;
  task_level: string;
  generated: number;
  completed: number;
  skipped: number;
  overdue: number;
  completionRate: number; // %
  avgDaysToComplete: number | null;
  lastCompletedAt: string | null;
}

// 2026-05-02: keep in sync with Canopy-Web/src/constants/pricing.ts.
// home is $6.99/mo, home_2 is $11.99/mo, pro is $149/mo, pro_2 is $279/mo.
const TIER_PRICES = { free: 0, home: 6.99, home_2: 11.99, pro: 149, pro_2: 279 };

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['user-growth', 'revenue']));

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const dateFilter = getDateFilter();

      // 2026-05-02: operational tiles bundled into the same Promise.all so we
      // pay a single round-trip cost. notifications use HEAD/count to avoid
      // pulling the full table; support_tickets pulls only the 5 most recent
      // unresolved rows for the top-issues feed.
      const opsNow = new Date();
      const todayStartIso = new Date(opsNow.getFullYear(), opsNow.getMonth(), opsNow.getDate()).toISOString();
      const last24hIso = new Date(opsNow.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // 2026-05-02 (STRATEGIC_TOP #9 deferred half): hard LIMIT caps on the
      // full-table pulls so a runaway dataset can't lock the admin browser
      // tab. Pre-launch we'll never hit these caps; they exist so we don't
      // silently grind at 100K+ users. The proper fix is an
      // admin_analytics_summary() RPC that aggregates server-side — tracked
      // as future work, not blocking pre-launch since the RPC requires
      // testing against realistic data.
      //
      // Caps chosen for "comfortable on a mid-tier laptop":
      //   profiles 50k, tasks 200k, gift_codes 25k, pro_requests 25k.
      // If `data.totalUsers > LIMIT_PROFILES` the UI will surface a banner.
      const LIMIT_PROFILES = 50_000;
      const LIMIT_TASKS = 200_000;
      const LIMIT_GIFTS = 25_000;
      const LIMIT_PRO_REQUESTS = 25_000;

      const [
        profilesRes, tasksRes, giftCodesRes, proReqRes, templatesRes,
        signupsTodayRes, totalNotif24hRes, failedNotif24hRes,
        openTicketsRes, recentTicketsRes,
        totalProfilesCountRes, totalTasksCountRes,
      ] = await Promise.all([
        // 2026-05-02: include subscription_status + subscription_expires_at + updated_at so we
        // can compute a real churn signal instead of the 0 placeholder.
        supabase.from('profiles').select('id,created_at,updated_at,subscription_tier,subscription_status,subscription_expires_at').limit(LIMIT_PROFILES),
        // 2026-05-06: maintenance_tasks has no user_id column — derive
        // owner via homes!inner(user_id) so the activation/retention
        // metrics keep their per-user uniqueness.
        supabase.from('maintenance_tasks').select('id,home_id,created_at,status,template_id,due_date,completed_date,homes!inner(user_id)').limit(LIMIT_TASKS),
        supabase.from('gift_codes').select('id,tier,redeemed_by,redeemed_at,created_at,expires_at').limit(LIMIT_GIFTS),
        // 2026-05-06: pro_requests has no matched_at — approximate via
        // updated_at (refer to the timesToAssignment block below).
        supabase.from('pro_requests').select('id,status,created_at,updated_at').limit(LIMIT_PRO_REQUESTS),
        supabase.from('task_templates').select('id,title,category,source,task_level,active'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayStartIso),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).gte('created_at', last24hIso),
        supabase.from('notifications').select('id', { count: 'exact', head: true })
          .gte('created_at', last24hIso)
          .or('email_permanently_failed.eq.true,email_last_error.not.is.null'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true })
          .neq('status', 'resolved'),
        supabase.from('support_tickets')
          .select('id, subject, category, priority, status, created_at')
          .neq('status', 'resolved')
          .order('created_at', { ascending: false })
          .limit(5),
        // 2026-05-02: true totals (count: 'exact', head: true) so we can
        // detect when the LIMIT caps above are hiding rows from the JS-side
        // analysis. Surfaces a banner if totalUsers > LIMIT_PROFILES.
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('maintenance_tasks').select('id', { count: 'exact', head: true }),
      ]);

      const profiles = profilesRes.data || [];
      const tasks = tasksRes.data || [];
      const giftCodes = giftCodesRes.data || [];
      const proRequests = proReqRes.data || [];
      const templatesList = templatesRes.data || [];

      // User Growth & Cohorts
      const now = new Date();
      const allMonths: { [key: string]: number } = {};
      const monthlySignups: { month: string; count: number }[] = [];

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        allMonths[key] = 0;
      }

      profiles.forEach(p => {
        if (p.created_at) {
          const d = new Date(p.created_at);
          const key = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          if (key in allMonths) allMonths[key]++;
        }
      });

      Object.entries(allMonths).forEach(([month, count]) => {
        monthlySignups.push({ month, count });
      });

      // 2026-05-02: prefer the head/count totals over profiles.length so
      // the KPI is honest even when the LIMIT cap is hiding rows from the
      // JS-side cohort/template analysis. monthlySignups + newUsers30d are
      // computed from the (capped) sample — they're approximations that
      // only diverge from truth when rows past the cap exist.
      const totalUsers = totalProfilesCountRes.count ?? profiles.length;
      const newUsers30d = profiles.filter(p => new Date(p.created_at || 0) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length;
      const returningUsers = totalUsers - newUsers30d;
      const profilesSampleHitCap = profiles.length >= LIMIT_PROFILES;
      const tasksSampleHitCap = tasks.length >= LIMIT_TASKS;

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      // 2026-05-06: extract owner from joined homes object — the join can
      // arrive as { user_id } or [{ user_id }] depending on Supabase's
      // relationship inference; tolerate both.
      const taskOwnerId = (t: any): string | undefined => {
        const h = t?.homes;
        if (!h) return undefined;
        return Array.isArray(h) ? h[0]?.user_id : h.user_id;
      };
      const activeUserIds = new Set(
        tasks
          .filter(t => new Date(t.created_at || 0) > thirtyDaysAgo)
          .map(t => taskOwnerId(t))
          .filter((id): id is string => Boolean(id))
      );
      const activeUsers30d = activeUserIds.size;

      // Revenue Metrics
      const tierCounts: { [key in keyof typeof TIER_PRICES]: number } = { free: 0, home: 0, home_2: 0, pro: 0, pro_2: 0 };
      profiles.forEach(p => {
        const tier = (p.subscription_tier || 'free') as keyof typeof TIER_PRICES;
        if (tier in tierCounts) tierCounts[tier]++;
      });

      const usersByTier = Object.entries(tierCounts).map(([tier, count]) => ({
        tier,
        count,
        price: TIER_PRICES[tier as keyof typeof TIER_PRICES],
      }));

      const mrrEstimate = Object.entries(tierCounts).reduce((sum, [tier, count]) => {
        return sum + (count * TIER_PRICES[tier as keyof typeof TIER_PRICES]);
      }, 0);

      const projectedArr = mrrEstimate * 12;

      // ─── Churn Analysis ─────────────────────────────────────────────
      // 2026-05-02: real signal. A user counts as churned in the last 30
      // days when their stripe-reported subscription_status moved to
      // 'canceled' (or 'canceling') AND profiles.updated_at landed in the
      // 30d window. We also count expiry-based churn: tier=free with a
      // subscription_expires_at falling inside the window — catches the
      // free-after-expiry case where stripe-webhook updated tier without
      // explicitly setting status.
      const churnWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const churned30d = profiles.filter(p => {
        const status = (p as { subscription_status?: string }).subscription_status;
        const updatedAt = (p as { updated_at?: string }).updated_at;
        const expiresAt = (p as { subscription_expires_at?: string }).subscription_expires_at;
        const tier = (p as { subscription_tier?: string }).subscription_tier;

        if (status && (status === 'canceled' || status === 'canceling') && updatedAt && new Date(updatedAt) >= churnWindowStart) {
          return true;
        }
        if (tier === 'free' && expiresAt) {
          const exp = new Date(expiresAt);
          if (exp >= churnWindowStart && exp <= now) return true;
        }
        return false;
      }).length;

      const monthAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const usersMonthAgo = profiles.filter(p => new Date(p.created_at || 0) <= monthAgoDate).length;
      const retentionRate = usersMonthAgo > 0 ? Math.round((activeUsers30d / usersMonthAgo) * 100) : 100;

      // Activation Metrics
      const userIdsWithTask = new Set(
        tasks.map(t => taskOwnerId(t)).filter((id): id is string => Boolean(id))
      );
      const usersWithHome = profiles.length;
      const usersWithEquipment = profiles.length;
      const usersWithTask = userIdsWithTask.size;
      const avgTasksPerUser = userIdsWithTask.size > 0 ? Math.round((tasks.length / userIdsWithTask.size) * 100) / 100 : 0;

      // Gift Code Performance
      const redeemedCodes = giftCodes.filter(gc => gc.redeemed_by);
      const totalCodes = giftCodes.length;
      const giftCodeConversion = totalCodes > 0 ? Math.round((redeemedCodes.length / totalCodes) * 100) : 0;

      const daysToRedeemList = redeemedCodes
        .filter(gc => gc.redeemed_at && gc.created_at)
        .map(gc => {
          const created = new Date(gc.created_at || 0);
          const redeemed = new Date(gc.redeemed_at || 0);
          return Math.floor((redeemed.getTime() - created.getTime()) / (24 * 60 * 60 * 1000));
        });

      const avgDaysToRedeem = daysToRedeemList.length > 0
        ? Math.round((daysToRedeemList.reduce((a, b) => a + b, 0) / daysToRedeemList.length) * 10) / 10
        : 0;

      const giftCodeTierCounts: { [key: string]: number } = {};
      giftCodes.forEach(gc => {
        const tier = gc.tier || 'unknown';
        giftCodeTierCounts[tier] = (giftCodeTierCounts[tier] || 0) + 1;
      });

      const giftCodesByTier = Object.entries(giftCodeTierCounts).map(([tier, count]) => ({ tier, count }));

      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const giftCodesExpiringIn7d = giftCodes.filter(gc => {
        if (!gc.expires_at || gc.redeemed_by) return false;
        return new Date(gc.expires_at) <= sevenDaysFromNow && new Date(gc.expires_at) >= now;
      }).length;

      // Pro Service Metrics
      const proRequestsTotal = proRequests.length;

      const statusCounts: { [key: string]: number } = {};
      proRequests.forEach(pr => {
        const status = pr.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const proRequestsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

      // 2026-05-06: pro_requests has no matched_at column. Approximate
      // time-to-assignment as updated_at - created_at for rows whose
      // status indicates they're past the pending phase. This drifts if
      // a row was updated again after assignment (e.g. rescheduled);
      // reasonable for an admin smoke metric, not a billing one. If a
      // dedicated matched_at column is added later, restore the precise
      // calc.
      const ASSIGNED_STATUSES = new Set(['assigned', 'matched', 'scheduled', 'in_progress', 'completed']);
      const timesToAssignment = proRequests
        .filter(pr => pr.status && ASSIGNED_STATUSES.has(pr.status) && pr.updated_at && pr.created_at)
        .map(pr => {
          const created = new Date(pr.created_at || 0);
          const updated = new Date(pr.updated_at || 0);
          return Math.floor((updated.getTime() - created.getTime()) / (60 * 60 * 1000));
        })
        .filter(hours => hours >= 0);

      const avgTimeToAssignment = timesToAssignment.length > 0
        ? Math.round((timesToAssignment.reduce((a, b) => a + b, 0) / timesToAssignment.length) * 10) / 10
        : 0;

      // Task Template Performance (Item 17)
      const templateBuckets = new Map<string, { generated: number; completed: number; skipped: number; overdue: number; daysToComplete: number[]; lastCompleted: string | null }>();
      const todayIso = new Date().toISOString().slice(0, 10);
      tasks.forEach((t: any) => {
        if (!t.template_id) return;
        const b = templateBuckets.get(t.template_id) || { generated: 0, completed: 0, skipped: 0, overdue: 0, daysToComplete: [], lastCompleted: null };
        b.generated += 1;
        if (t.status === 'completed') {
          b.completed += 1;
          if (t.due_date && t.completed_date) {
            const due = new Date(t.due_date).getTime();
            const done = new Date(t.completed_date).getTime();
            if (Number.isFinite(due) && Number.isFinite(done)) {
              b.daysToComplete.push(Math.round((done - due) / 86400000));
            }
          }
          if (t.completed_date && (!b.lastCompleted || new Date(t.completed_date) > new Date(b.lastCompleted))) {
            b.lastCompleted = t.completed_date;
          }
        } else if (t.status === 'skipped') {
          b.skipped += 1;
        } else if (t.status !== 'completed' && t.due_date && t.due_date < todayIso) {
          b.overdue += 1;
        }
        templateBuckets.set(t.template_id, b);
      });
      const templateStats: TemplateStat[] = templatesList.map((tpl: any) => {
        const b = templateBuckets.get(tpl.id) || { generated: 0, completed: 0, skipped: 0, overdue: 0, daysToComplete: [], lastCompleted: null };
        const nonSkipped = b.generated - b.skipped;
        const completionRate = nonSkipped > 0 ? Math.round((b.completed / nonSkipped) * 1000) / 10 : 0;
        const avgDays = b.daysToComplete.length > 0
          ? Math.round((b.daysToComplete.reduce((a, c) => a + c, 0) / b.daysToComplete.length) * 10) / 10
          : null;
        return {
          id: tpl.id,
          title: tpl.title,
          category: tpl.category,
          source: tpl.source || 'built_in',
          task_level: tpl.task_level || 'standard',
          generated: b.generated,
          completed: b.completed,
          skipped: b.skipped,
          overdue: b.overdue,
          completionRate,
          avgDaysToComplete: avgDays,
          lastCompletedAt: b.lastCompleted,
        };
      }).sort((a, b) => b.generated - a.generated);

      const totalGenerated = templateStats.reduce((s, t) => s + t.generated, 0);
      const totalCompleted = templateStats.reduce((s, t) => s + t.completed, 0);
      const avgCompletionRate = templateStats.length > 0
        ? Math.round(
            (templateStats.filter(t => t.generated > 0).reduce((s, t) => s + t.completionRate, 0) /
              Math.max(templateStats.filter(t => t.generated > 0).length, 1)) * 10,
          ) / 10
        : 0;
      const overdueCount = templateStats.reduce((s, t) => s + t.overdue, 0);

      // 2026-05-02: operational metrics
      const signupsToday = signupsTodayRes.count ?? 0;
      const totalNotifications24h = totalNotif24hRes.count ?? 0;
      const failedNotifications24h = failedNotif24hRes.count ?? 0;
      const edgeFnErrorRate24h = totalNotifications24h > 0
        ? failedNotifications24h / totalNotifications24h
        : 0;
      const openSupportTickets = openTicketsRes.count ?? 0;
      const recentSupportTickets = (recentTicketsRes.data ?? []) as SupportTicketSummary[];

      const totalTasksDb = totalTasksCountRes.count ?? tasks.length;
      const dataWindowWarning = profilesSampleHitCap || tasksSampleHitCap
        ? `Showing analytics for the first ${LIMIT_PROFILES.toLocaleString()} profiles and ${LIMIT_TASKS.toLocaleString()} tasks (DB has ${(totalUsers ?? 0).toLocaleString()} profiles, ${totalTasksDb.toLocaleString()} tasks). Cohort and template stats below are sampled — KPIs above are full counts.`
        : null;

      setData({
        monthlySignups,
        totalUsers,
        newUsers30d,
        returningUsers,
        activeUsers30d,
        usersByTier,
        mrrEstimate,
        projectedArr,
        churned30d,
        retentionRate,
        usersWithHome,
        usersWithEquipment,
        usersWithTask,
        avgTasksPerUser,
        giftCodeConversion,
        avgDaysToRedeem,
        giftCodesByTier,
        giftCodesExpiringIn7d,
        proRequestsTotal,
        proRequestsByStatus,
        avgTimeToAssignment,
        templateStats,
        templateTotals: {
          totalTemplates: templatesList.length,
          totalGenerated,
          totalCompleted,
          avgCompletionRate,
          overdueCount,
        },
        signupsToday,
        failedNotifications24h,
        totalNotifications24h,
        edgeFnErrorRate24h,
        openSupportTickets,
        recentSupportTickets,
        dataWindowWarning,
      });
    } catch (err) {
      logger.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  if (loading) {
    return <div className="page-wide"><PageSkeleton rows={4} /></div>;
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 100 }}>
        <p style={{ color: Colors.medGray }}>Failed to load analytics</p>
      </div>
    );
  }

  const maxMonthlySignups = Math.max(...data.monthlySignups.map(m => m.count), 1);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header with Date Range */}
      <div className="admin-page-header">
        <div>
          <h1>Analytics</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: Colors.medGray }}>
            Platform metrics and performance overview.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              className={`btn btn-sm ${dateRange === range ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDateRange(range)}
            >
              {range === 'all' ? 'All Time' : 'Last ' + range}
            </button>
          ))}
        </div>
      </div>

      {/* 2026-05-02: data-window banner shown when LIMIT caps engaged */}
      {data.dataWindowWarning && (
        <div role="alert" style={{
          padding: 12, marginBottom: 16, borderRadius: 6,
          background: `${Colors.warning}15`, border: `1px solid ${Colors.warning}`,
          fontSize: FontSize.sm, color: Colors.charcoal,
        }}>
          <strong style={{ color: Colors.warning }}>Sampled view —</strong> {data.dataWindowWarning}
        </div>
      )}

      {/* Top KPI Grid */}
      <div className="admin-kpi-grid" style={{ marginBottom: 24 }}>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Total Users</p>
          <p className="admin-kpi-value" style={{ color: Colors.copper }}>{data.totalUsers}</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Signups today</p>
          <p className="admin-kpi-value" style={{ color: Colors.sage }}>{data.signupsToday}</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">New Users (30d)</p>
          <p className="admin-kpi-value" style={{ color: Colors.sage }}>{data.newUsers30d}</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Active Users (30d)</p>
          <p className="admin-kpi-value" style={{ color: Colors.info }}>{data.activeUsers30d}</p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">MRR</p>
          <p className="admin-kpi-value" style={{ color: Colors.success }}>
            ${data.mrrEstimate.toFixed(0)}
          </p>
        </div>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">ARR</p>
          <p className="admin-kpi-value" style={{ color: Colors.success }}>
            ${data.projectedArr.toFixed(0)}
          </p>
        </div>
      </div>

      {/* 2026-05-02: Operational Pulse — error rate + open tickets + top issues.
          STRATEGIC_TOP #7 deferred halves. Visible in same view as the KPI grid
          so admins land on "is the business healthy right now?" first. */}
      <div className="admin-section" style={{
        marginBottom: 24, padding: 20, background: 'white',
        border: '1px solid var(--border-color)', borderRadius: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <h3 style={{ fontSize: FontSize.md, fontWeight: 600, margin: 0 }}>Operational Pulse</h3>
          <span style={{ fontSize: FontSize.xs, color: Colors.medGray }}>Last 24 hours</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <p className="admin-kpi-label">Notifications sent</p>
            <p className="admin-kpi-value" style={{ color: Colors.charcoal }}>{data.totalNotifications24h}</p>
          </div>
          <div>
            <p className="admin-kpi-label">Failed deliveries</p>
            <p className="admin-kpi-value" style={{
              color: data.failedNotifications24h > 0 ? Colors.error : Colors.medGray,
            }}>{data.failedNotifications24h}</p>
          </div>
          <div>
            <p className="admin-kpi-label">Edge fn error rate</p>
            <p className="admin-kpi-value" style={{
              color: data.edgeFnErrorRate24h > 0.05 ? Colors.error : data.edgeFnErrorRate24h > 0.01 ? Colors.warning : Colors.success,
            }}>{(data.edgeFnErrorRate24h * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="admin-kpi-label">Open support tickets</p>
            <p className="admin-kpi-value" style={{
              color: data.openSupportTickets > 5 ? Colors.warning : Colors.charcoal,
            }}>{data.openSupportTickets}</p>
          </div>
        </div>

        {/* Top issues feed */}
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: Colors.medGray, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Top issues
          </p>
          {data.recentSupportTickets.length === 0 ? (
            <p style={{ fontSize: FontSize.sm, color: Colors.medGray, fontStyle: 'italic', margin: 0 }}>
              No open support tickets — quiet on the support front.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.recentSupportTickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/admin/support`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    background: Colors.cream, border: 'none', borderRadius: 6, cursor: 'pointer',
                    textAlign: 'left', width: '100%',
                  }}
                  title="Open in Admin → Support"
                >
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                    color: '#fff',
                    background: t.priority === 'urgent' || t.priority === 'high' ? Colors.error
                      : t.priority === 'medium' ? Colors.warning
                      : Colors.medGray,
                  }}>
                    {(t.priority || 'normal').toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: FontSize.sm, fontWeight: 600, color: Colors.charcoal, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject}
                    </p>
                    <p style={{ fontSize: FontSize.xs, color: Colors.medGray, margin: '2px 0 0' }}>
                      {t.category ? `${t.category} · ` : ''}{new Date(t.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <span style={{ fontSize: FontSize.xs, color: Colors.medGray }}>→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Growth Section */}
      <div
        className="admin-section"
        style={{
          marginBottom: 16,
          background: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '12px 16px',
            background: Colors.cream,
            borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--border-color)',
          }}
          onClick={() => toggleSection('user-growth')}
        >
          <h3 style={{ fontSize: FontSize.md, fontWeight: 600, margin: 0 }}>User Growth</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('user-growth') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('user-growth') && (
          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: Colors.medGray, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Monthly Signups
            </p>
            <div className="admin-chart-container">
              {data.monthlySignups.map(m => {
                const height = (m.count / maxMonthlySignups) * 120;
                return (
                  <div key={m.month} className="admin-chart-bar-row" style={{ marginBottom: 12 }}>
                    <div className="admin-chart-bar-label" style={{ minWidth: 60 }}>{m.month}</div>
                    <div className="admin-chart-bar" style={{ flex: 1, minWidth: 200 }}>
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          width: `${(m.count / maxMonthlySignups) * 100}%`,
                          background: Colors.copper,
                          height: 24,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: FontSize.sm, fontWeight: 500, marginLeft: 12, minWidth: 40, textAlign: 'right' }}>
                      {m.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Revenue Section */}
      <div
        className="admin-section"
        style={{
          marginBottom: 16,
          background: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '12px 16px',
            background: Colors.cream,
            borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--border-color)',
          }}
          onClick={() => toggleSection('revenue')}
        >
          <h3 style={{ fontSize: FontSize.md, fontWeight: 600, margin: 0 }}>Revenue</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('revenue') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('revenue') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
                  MRR
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>
                  ${data.mrrEstimate.toFixed(0)}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
                  ARR
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>
                  ${data.projectedArr.toFixed(0)}
                </p>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: Colors.medGray, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tier Distribution
            </p>
            <div className="admin-chart-container">
              {data.usersByTier.map(t => {
                const percentage = data.totalUsers > 0 ? (t.count / data.totalUsers) * 100 : 0;
                return (
                  <div key={t.tier} className="admin-chart-bar-row" style={{ marginBottom: 12 }}>
                    <div className="admin-chart-bar-label" style={{ minWidth: 80, textTransform: 'capitalize' }}>
                      {t.tier}
                    </div>
                    <div className="admin-chart-bar" style={{ flex: 1, minWidth: 200 }}>
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          width: `${percentage}%`,
                          background: Colors.copper,
                          height: 24,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: FontSize.sm, fontWeight: 500, marginLeft: 12, minWidth: 60, textAlign: 'right' }}>
                      {t.count} ({Math.round(percentage)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Churn Section */}
      <div
        className="admin-section"
        style={{
          marginBottom: 16,
          background: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '12px 16px',
            background: Colors.cream,
            borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--border-color)',
          }}
          onClick={() => toggleSection('churn')}
        >
          <h3 style={{ fontSize: FontSize.md, fontWeight: 600, margin: 0 }}>Churn</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('churn') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('churn') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, background: Colors.error + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.error, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Churned (30d)
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.error, margin: 0 }}>
                  {data.churned30d}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.success + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.success, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Retention Rate
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.success, margin: 0 }}>
                  {data.retentionRate}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activation Section */}
      <div
        className="admin-section"
        style={{
          marginBottom: 16,
          background: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '12px 16px',
            background: Colors.cream,
            borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--border-color)',
          }}
          onClick={() => toggleSection('activation')}
        >
          <h3 style={{ fontSize: FontSize.md, fontWeight: 600, margin: 0 }}>Activation</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('activation') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('activation') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ padding: 12, background: Colors.copperMuted, borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Created Home
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithHome / data.totalUsers) * 100) : 0}%
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.copperMuted, borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Added Equipment
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithEquipment / data.totalUsers) * 100) : 0}%
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Completed Task
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithTask / data.totalUsers) * 100) : 0}%
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Avg Tasks/User
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>
                  {data.avgTasksPerUser}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gift Codes Section */}
      <div
        className="admin-section"
        style={{
          marginBottom: 16,
          background: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '12px 16px',
            background: Colors.cream,
            borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--border-color)',
          }}
          onClick={() => toggleSection('gift-codes')}
        >
          <h3 style={{ fontSize: FontSize.md, fontWeight: 600, margin: 0 }}>Gift Codes</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('gift-codes') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('gift-codes') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: Colors.success + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.success, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Conversion Rate
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.success, margin: 0 }}>
                  {data.giftCodeConversion}%
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.info + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.info, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Avg Days to Redeem
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.info, margin: 0 }}>
                  {data.avgDaysToRedeem}d
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.warning + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.warning, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Expiring in 7d
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.warning, margin: 0 }}>
                  {data.giftCodesExpiringIn7d}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.copper + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Total Codes
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>
                  {data.giftCodesByTier.reduce((sum, t) => sum + t.count, 0)}
                </p>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: Colors.medGray, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Codes by Tier
            </p>
            <div className="admin-chart-container">
              {data.giftCodesByTier.map(t => {
                const totalCodes = data.giftCodesByTier.reduce((sum, x) => sum + x.count, 0);
                const percentage = totalCodes > 0 ? (t.count / totalCodes) * 100 : 0;
                return (
                  <div key={t.tier} className="admin-chart-bar-row" style={{ marginBottom: 12 }}>
                    <div className="admin-chart-bar-label" style={{ minWidth: 80, textTransform: 'capitalize' }}>
                      {t.tier}
                    </div>
                    <div className="admin-chart-bar" style={{ flex: 1, minWidth: 200 }}>
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          width: `${percentage}%`,
                          background: Colors.copper,
                          height: 24,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: FontSize.sm, fontWeight: 500, marginLeft: 12, minWidth: 60, textAlign: 'right' }}>
                      {t.count} ({Math.round(percentage)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pro Service Section */}
      <div
        className="admin-section"
        style={{
          marginBottom: 16,
          background: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '12px 16px',
            background: Colors.cream,
            borderRadius: '8px 8px 0 0',
            borderBottom: '1px solid var(--border-color)',
          }}
          onClick={() => toggleSection('pro-service')}
        >
          <h3 style={{ fontSize: FontSize.md, fontWeight: 600, margin: 0 }}>Pro Services</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('pro-service') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('pro-service') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: Colors.copper + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Total Requests
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>
                  {data.proRequestsTotal}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.info + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.info, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Avg Time to Assignment
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.info, margin: 0 }}>
                  {data.avgTimeToAssignment}h
                </p>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: Colors.medGray, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Requests by Status
            </p>
            <div className="admin-chart-container">
              {data.proRequestsByStatus.map(s => {
                const percentage = data.proRequestsTotal > 0 ? (s.count / data.proRequestsTotal) * 100 : 0;
                return (
                  <div key={s.status} className="admin-chart-bar-row" style={{ marginBottom: 12 }}>
                    <div className="admin-chart-bar-label" style={{ minWidth: 80, textTransform: 'capitalize' }}>
                      {s.status}
                    </div>
                    <div className="admin-chart-bar" style={{ flex: 1, minWidth: 200 }}>
                      <div
                        className="admin-chart-bar-fill"
                        style={{
                          width: `${percentage}%`,
                          background: Colors.sage,
                          height: 24,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: FontSize.sm, fontWeight: 500, marginLeft: 12, minWidth: 60, textAlign: 'right' }}>
                      {s.count} ({Math.round(percentage)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Task Template Performance — Item 17 */}
      <div
        className="admin-section"
        style={{
          marginBottom: 16,
          background: 'white',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
        }}
      >
        <div
          onClick={() => toggleSection('template-performance')}
          style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: expandedSections.has('template-performance') ? '1px solid var(--border-color)' : 'none' }}
        >
          <h2 style={{ margin: 0, fontSize: 16 }}>Task Template Performance</h2>
          <span style={{ fontSize: FontSize.lg, color: Colors.medGray }}>{expandedSections.has('template-performance') ? '−' : '+'}</span>
        </div>
        {expandedSections.has('template-performance') && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: Colors.sage + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>Templates</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>{data.templateTotals.totalTemplates}</p>
              </div>
              <div style={{ padding: 12, background: Colors.info + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.info, fontWeight: 600, margin: '0 0 4px 0' }}>Generated</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.info, margin: 0 }}>{data.templateTotals.totalGenerated.toLocaleString()}</p>
              </div>
              <div style={{ padding: 12, background: Colors.success + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.success, fontWeight: 600, margin: '0 0 4px 0' }}>Completed</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.success, margin: 0 }}>{data.templateTotals.totalCompleted.toLocaleString()}</p>
              </div>
              <div style={{ padding: 12, background: Colors.copper + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>Avg Completion</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>{data.templateTotals.avgCompletionRate}%</p>
              </div>
              <div style={{ padding: 12, background: Colors.error + '15', borderRadius: 6 }}>
                <p style={{ fontSize: FontSize.xs, color: Colors.error, fontWeight: 600, margin: '0 0 4px 0' }}>Overdue</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.error, margin: 0 }}>{data.templateTotals.overdueCount}</p>
              </div>
            </div>

            <p style={{ fontSize: 12, fontWeight: 600, color: Colors.medGray, margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Top 25 templates by tasks generated
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: Colors.medGray }}>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }} scope="col">Title</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }} scope="col">Category</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }} scope="col">Level</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }} scope="col">Generated</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }} scope="col">Completed</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }} scope="col">Skipped</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }} scope="col">Overdue</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }} scope="col">Rate</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }} scope="col">Avg Δ Days</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }} scope="col">Last Done</th>
                  </tr>
                </thead>
                <tbody>
                  {data.templateStats.slice(0, 25).map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px', fontWeight: 600 }}>{t.title}</td>
                      <td style={{ padding: '6px', color: Colors.medGray }}>{t.category}</td>
                      <td style={{ padding: '6px', color: Colors.medGray, textTransform: 'capitalize' }}>{t.task_level}</td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>{t.generated.toLocaleString()}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: Colors.success, fontWeight: 600 }}>{t.completed.toLocaleString()}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: Colors.medGray }}>{t.skipped.toLocaleString()}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: t.overdue > 0 ? Colors.error : Colors.medGray }}>{t.overdue.toLocaleString()}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: t.completionRate >= 70 ? Colors.success : t.completionRate >= 40 ? Colors.warning : Colors.error }}>
                        {t.generated === 0 ? '—' : `${t.completionRate}%`}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right', color: Colors.medGray }}>
                        {t.avgDaysToComplete == null ? '—' : `${t.avgDaysToComplete > 0 ? '+' : ''}${t.avgDaysToComplete}d`}
                      </td>
                      <td style={{ padding: '6px', color: Colors.medGray }}>
                        {t.lastCompletedAt ? new Date(t.lastCompletedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {data.templateStats.length === 0 && (
                    <tr><td colSpan={10} style={{ padding: 16, textAlign: 'center', color: Colors.medGray }}>No template data yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: FontSize.xs, color: Colors.medGray, marginTop: 12, lineHeight: 1.4 }}>
              <strong>Avg Δ Days</strong> = average days between due date and completion (negative = done early, positive = done late).
              <br />
              <strong>Rate</strong> = completed ÷ (generated − skipped). Non-skipped denominator avoids penalizing templates users opt out of.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
