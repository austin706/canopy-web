import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';
import { PageSkeleton } from '@/components/Skeleton';

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

const TIER_PRICES = { free: 0, home: 7.99, pro: 149.99, pro_plus: 249.99 };

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

      const [profilesRes, tasksRes, giftCodesRes, proReqRes, templatesRes] = await Promise.all([
        supabase.from('profiles').select('id,created_at,subscription_tier'),
        supabase.from('maintenance_tasks').select('id,user_id,created_at,status,template_id,due_date,completed_date'),
        supabase.from('gift_codes').select('id,tier,redeemed_by,redeemed_at,created_at,expires_at'),
        supabase.from('pro_requests').select('id,status,created_at,matched_at'),
        supabase.from('task_templates').select('id,title,category,source,task_level,active'),
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

      const totalUsers = profiles.length;
      const newUsers30d = profiles.filter(p => new Date(p.created_at || 0) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length;
      const returningUsers = totalUsers - newUsers30d;

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const activeUserIds = new Set(tasks.filter(t => new Date(t.created_at || 0) > thirtyDaysAgo).map(t => t.user_id));
      const activeUsers30d = activeUserIds.size;

      // Revenue Metrics
      const tierCounts: { [key in keyof typeof TIER_PRICES]: number } = { free: 0, home: 0, pro: 0, pro_plus: 0 };
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

      // Churn Analysis
      const churned30d = 0;

      const monthAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const usersMonthAgo = profiles.filter(p => new Date(p.created_at || 0) <= monthAgoDate).length;
      const retentionRate = usersMonthAgo > 0 ? Math.round((activeUsers30d / usersMonthAgo) * 100) : 100;

      // Activation Metrics
      const userIdsWithTask = new Set(tasks.map(t => t.user_id));
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

      const timesToAssignment = proRequests
        .filter(pr => pr.matched_at && pr.created_at)
        .map(pr => {
          const created = new Date(pr.created_at || 0);
          const matched = new Date(pr.matched_at || 0);
          return Math.floor((matched.getTime() - created.getTime()) / (60 * 60 * 1000));
        });

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
      });
    } catch (err) {
      console.error('Analytics error:', err);
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

      {/* Top KPI Grid */}
      <div className="admin-kpi-grid" style={{ marginBottom: 24 }}>
        <div className="admin-kpi-card">
          <p className="admin-kpi-label">Total Users</p>
          <p className="admin-kpi-value" style={{ color: Colors.copper }}>{data.totalUsers}</p>
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
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>User Growth</h3>
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
                    <div style={{ fontSize: 13, fontWeight: 500, marginLeft: 12, minWidth: 40, textAlign: 'right' }}>
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
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Revenue</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('revenue') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('revenue') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
                  MRR
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>
                  ${data.mrrEstimate.toFixed(0)}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
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
                    <div style={{ fontSize: 13, fontWeight: 500, marginLeft: 12, minWidth: 60, textAlign: 'right' }}>
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
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Churn</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('churn') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('churn') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, background: Colors.error + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.error, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Churned (30d)
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.error, margin: 0 }}>
                  {data.churned30d}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.success + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.success, fontWeight: 600, margin: '0 0 4px 0' }}>
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
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Activation</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('activation') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('activation') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div style={{ padding: 12, background: Colors.copperMuted, borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Created Home
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithHome / data.totalUsers) * 100) : 0}%
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.copperMuted, borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Added Equipment
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithEquipment / data.totalUsers) * 100) : 0}%
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Completed Task
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithTask / data.totalUsers) * 100) : 0}%
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.sageMuted, borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>
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
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Gift Codes</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('gift-codes') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('gift-codes') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: Colors.success + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.success, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Conversion Rate
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.success, margin: 0 }}>
                  {data.giftCodeConversion}%
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.info + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.info, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Avg Days to Redeem
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.info, margin: 0 }}>
                  {data.avgDaysToRedeem}d
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.warning + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.warning, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Expiring in 7d
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.warning, margin: 0 }}>
                  {data.giftCodesExpiringIn7d}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.copper + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
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
                    <div style={{ fontSize: 13, fontWeight: 500, marginLeft: 12, minWidth: 60, textAlign: 'right' }}>
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
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Pro Services</h3>
          <span style={{ color: Colors.medGray }}>
            {expandedSections.has('pro-service') ? '▼' : '▶'}
          </span>
        </div>

        {expandedSections.has('pro-service') && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: Colors.copper + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>
                  Total Requests
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>
                  {data.proRequestsTotal}
                </p>
              </div>
              <div style={{ padding: 12, background: Colors.info + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.info, fontWeight: 600, margin: '0 0 4px 0' }}>
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
                    <div style={{ fontSize: 13, fontWeight: 500, marginLeft: 12, minWidth: 60, textAlign: 'right' }}>
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
          <span style={{ fontSize: 18, color: Colors.medGray }}>{expandedSections.has('template-performance') ? '−' : '+'}</span>
        </div>
        {expandedSections.has('template-performance') && (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 12, background: Colors.sage + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.sage, fontWeight: 600, margin: '0 0 4px 0' }}>Templates</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>{data.templateTotals.totalTemplates}</p>
              </div>
              <div style={{ padding: 12, background: Colors.info + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.info, fontWeight: 600, margin: '0 0 4px 0' }}>Generated</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.info, margin: 0 }}>{data.templateTotals.totalGenerated.toLocaleString()}</p>
              </div>
              <div style={{ padding: 12, background: Colors.success + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.success, fontWeight: 600, margin: '0 0 4px 0' }}>Completed</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.success, margin: 0 }}>{data.templateTotals.totalCompleted.toLocaleString()}</p>
              </div>
              <div style={{ padding: 12, background: Colors.copper + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.copper, fontWeight: 600, margin: '0 0 4px 0' }}>Avg Completion</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>{data.templateTotals.avgCompletionRate}%</p>
              </div>
              <div style={{ padding: 12, background: Colors.error + '15', borderRadius: 6 }}>
                <p style={{ fontSize: 11, color: Colors.error, fontWeight: 600, margin: '0 0 4px 0' }}>Overdue</p>
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

            <p style={{ fontSize: 11, color: Colors.medGray, marginTop: 12, lineHeight: 1.4 }}>
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
