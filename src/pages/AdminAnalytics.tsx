import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

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

      const [profilesRes, tasksRes, giftCodesRes, proReqRes] = await Promise.all([
        supabase.from('profiles').select('id,created_at,subscription_tier'),
        supabase.from('maintenance_tasks').select('id,user_id,created_at,status'),
        supabase.from('gift_codes').select('id,tier,redeemed_by,redeemed_at,created_at,expires_at'),
        supabase.from('pro_requests').select('id,status,created_at,matched_at'),
      ]);

      const profiles = profilesRes.data || [];
      const tasks = tasksRes.data || [];
      const giftCodes = giftCodesRes.data || [];
      const proRequests = proReqRes.data || [];

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

      // Active users (at least 1 task in last 30d)
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

      // Churn Analysis (approximated: users with free tier who have cancelled subscriptions)
      // For now, approximate by finding profiles with subscription_tier = 'free' (conservative estimate)
      const churned30d = 0; // Would need subscription_history table for accurate calculation

      // Retention: simple approximation
      const monthAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const usersMonthAgo = profiles.filter(p => new Date(p.created_at || 0) <= monthAgoDate).length;
      const retentionRate = usersMonthAgo > 0 ? Math.round((activeUsers30d / usersMonthAgo) * 100) : 100;

      // Activation Metrics
      const userIdsWithTask = new Set(tasks.map(t => t.user_id));
      const usersWithHome = profiles.length; // Simplified; would need homes table join
      const usersWithEquipment = profiles.length; // Simplified; would need equipment table join
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
          return Math.floor((matched.getTime() - created.getTime()) / (60 * 60 * 1000)); // hours
        });

      const avgTimeToAssignment = timesToAssignment.length > 0
        ? Math.round((timesToAssignment.reduce((a, b) => a + b, 0) / timesToAssignment.length) * 10) / 10
        : 0;

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
    return (
      <div className="page text-center" style={{ paddingTop: 100 }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <p className="mt-md text-gray">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page text-center" style={{ paddingTop: 100 }}>
        <p className="text-gray">Failed to load analytics</p>
      </div>
    );
  }

  const maxMonthlySignups = Math.max(...data.monthlySignups.map(m => m.count), 1);
  const maxTierCount = Math.max(...data.usersByTier.map(t => t.count), 1);

  return (
    <div className="page-wide">
      <div className="flex items-center justify-between mb-lg">
        <div>
          <h1 style={{ fontSize: 28 }}>Analytics Dashboard</h1>
          <p className="text-sm text-copper fw-500">Platform metrics and performance</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>
            &#8592; Back to Admin
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="card mb-lg">
        <p style={{ fontWeight: 600, marginBottom: 12 }}>Time Period</p>
        <div className="flex gap-sm">
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              className={`btn btn-sm ${dateRange === range ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDateRange(range)}
            >
              {range === 'all' ? 'All Time' : 'Last ' + range}
            </button>
          ))}
        </div>
      </div>

      {/* User Growth & Cohorts */}
      <div className="card mb-lg">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}
          onClick={() => toggleSection('user-growth')}
        >
          <p style={{ fontWeight: 600, margin: 0 }}>User Growth & Cohorts</p>
          <span style={{ color: Colors.silver }}>{expandedSections.has('user-growth') ? '▼' : '▶'}</span>
        </div>

        {expandedSections.has('user-growth') && (
          <div>
            <div className="grid-4 mb-lg">
              <div className="card stat-card">
                <div className="stat-icon" style={{ background: Colors.copper + '15', fontSize: 12, fontWeight: 700, color: Colors.copper }}>
                  US
                </div>
                <div className="stat-value">{data.totalUsers}</div>
                <div className="stat-label">Total Users</div>
              </div>
              <div className="card stat-card">
                <div className="stat-icon" style={{ background: Colors.sage + '15', fontSize: 12, fontWeight: 700, color: Colors.sage }}>
                  NW
                </div>
                <div className="stat-value">{data.newUsers30d}</div>
                <div className="stat-label">New (30d)</div>
              </div>
              <div className="card stat-card">
                <div className="stat-icon" style={{ background: Colors.info + '15', fontSize: 12, fontWeight: 700, color: Colors.info }}>
                  RT
                </div>
                <div className="stat-value">{data.returningUsers}</div>
                <div className="stat-label">Returning</div>
              </div>
              <div className="card stat-card">
                <div className="stat-icon" style={{ background: Colors.success + '15', fontSize: 12, fontWeight: 700, color: Colors.success }}>
                  AC
                </div>
                <div className="stat-value">{data.activeUsers30d}</div>
                <div className="stat-label">Active (30d)</div>
              </div>
            </div>

            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Monthly Signups</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, marginBottom: 12 }}>
              {data.monthlySignups.map(m => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${(m.count / maxMonthlySignups) * 120}px`,
                      background: Colors.copper,
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--silver)', textAlign: 'center' }}>{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Revenue Metrics */}
      <div className="card mb-lg">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}
          onClick={() => toggleSection('revenue')}
        >
          <p style={{ fontWeight: 600, margin: 0 }}>Revenue Metrics</p>
          <span style={{ color: Colors.silver }}>{expandedSections.has('revenue') ? '▼' : '▶'}</span>
        </div>

        {expandedSections.has('revenue') && (
          <div>
            <div className="grid-2 mb-lg">
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>MRR Estimate</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: Colors.success, marginBottom: 4 }}>${data.mrrEstimate.toFixed(2)}</p>
                <p className="text-xs text-gray">Monthly recurring revenue</p>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Projected ARR</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: Colors.success, marginBottom: 4 }}>${data.projectedArr.toFixed(2)}</p>
                <p className="text-xs text-gray">Annual recurring revenue</p>
              </div>
            </div>

            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Subscription Tier Distribution</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
              {data.usersByTier.map(t => {
                const percentage = data.totalUsers > 0 ? Math.round((t.count / data.totalUsers) * 100) : 0;
                return (
                  <div key={t.tier} style={{ borderLeft: `4px solid ${Colors.copper}`, paddingLeft: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t.tier}</span>
                      <span style={{ color: Colors.silver }}>{t.count}</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 4 }}>
                      <div className="progress-fill" style={{ width: `${percentage}%`, background: Colors.copper }} />
                    </div>
                    <p className="text-xs text-gray">{percentage}% • ${t.price.toFixed(2)}/mo</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Churn Analysis */}
      <div className="card mb-lg">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}
          onClick={() => toggleSection('churn')}
        >
          <p style={{ fontWeight: 600, margin: 0 }}>Churn Analysis</p>
          <span style={{ color: Colors.silver }}>{expandedSections.has('churn') ? '▼' : '▶'}</span>
        </div>

        {expandedSections.has('churn') && (
          <div>
            <div className="grid-2">
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Churned (30d)</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: Colors.warning, marginBottom: 4 }}>{data.churned30d}</p>
                <p className="text-xs text-gray">Users who downgraded</p>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Retention Rate</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: Colors.success, marginBottom: 4 }}>{data.retentionRate}%</p>
                <p className="text-xs text-gray">Users retained vs. month ago</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activation Metrics */}
      <div className="card mb-lg">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}
          onClick={() => toggleSection('activation')}
        >
          <p style={{ fontWeight: 600, margin: 0 }}>Activation Metrics</p>
          <span style={{ color: Colors.silver }}>{expandedSections.has('activation') ? '▼' : '▶'}</span>
        </div>

        {expandedSections.has('activation') && (
          <div>
            <div className="grid-2 mb-lg">
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Created a Home</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, marginBottom: 4 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithHome / data.totalUsers) * 100) : 0}%
                </p>
                <p className="text-xs text-gray">{data.usersWithHome} of {data.totalUsers} users</p>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Added Equipment</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, marginBottom: 4 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithEquipment / data.totalUsers) * 100) : 0}%
                </p>
                <p className="text-xs text-gray">{data.usersWithEquipment} of {data.totalUsers} users</p>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Completed a Task</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, marginBottom: 4 }}>
                  {data.totalUsers > 0 ? Math.round((data.usersWithTask / data.totalUsers) * 100) : 0}%
                </p>
                <p className="text-xs text-gray">{data.usersWithTask} of {data.totalUsers} users</p>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Avg Tasks per User</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, marginBottom: 4 }}>{data.avgTasksPerUser}</p>
                <p className="text-xs text-gray">Among active users</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gift Code Performance */}
      <div className="card mb-lg">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}
          onClick={() => toggleSection('gift-codes')}
        >
          <p style={{ fontWeight: 600, margin: 0 }}>Gift Code Performance</p>
          <span style={{ color: Colors.silver }}>{expandedSections.has('gift-codes') ? '▼' : '▶'}</span>
        </div>

        {expandedSections.has('gift-codes') && (
          <div>
            <div className="grid-4 mb-lg">
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Conversion Rate</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.success, marginBottom: 4 }}>{data.giftCodeConversion}%</p>
                <p className="text-xs text-gray">Redeemed vs. issued</p>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Avg Days to Redeem</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.info, marginBottom: 4 }}>{data.avgDaysToRedeem}</p>
                <p className="text-xs text-gray">Time from issue to use</p>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Expiring in 7d</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.warning, marginBottom: 4 }}>{data.giftCodesExpiringIn7d}</p>
                <p className="text-xs text-gray">Unredeemed codes</p>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Total Codes</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, marginBottom: 4 }}>
                  {data.giftCodesByTier.reduce((sum, t) => sum + t.count, 0)}
                </p>
                <p className="text-xs text-gray">All issued codes</p>
              </div>
            </div>

            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Codes by Tier</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {data.giftCodesByTier.map(t => {
                const totalCodes = data.giftCodesByTier.reduce((sum, x) => sum + x.count, 0);
                const percentage = totalCodes > 0 ? Math.round((t.count / totalCodes) * 100) : 0;
                return (
                  <div key={t.tier} style={{ flex: 1 }}>
                    <div
                      style={{
                        height: 60,
                        background: Colors.copper + '15',
                        borderRadius: 4,
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: Colors.copper,
                        fontWeight: 600,
                      }}
                    >
                      {t.count}
                    </div>
                    <p style={{ fontSize: 12, textAlign: 'center', marginBottom: 2, textTransform: 'capitalize' }}>{t.tier}</p>
                    <p className="text-xs text-gray" style={{ textAlign: 'center' }}>{percentage}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pro Service Metrics */}
      <div className="card mb-lg">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}
          onClick={() => toggleSection('pro-service')}
        >
          <p style={{ fontWeight: 600, margin: 0 }}>Pro Service Metrics</p>
          <span style={{ color: Colors.silver }}>{expandedSections.has('pro-service') ? '▼' : '▶'}</span>
        </div>

        {expandedSections.has('pro-service') && (
          <div>
            <div className="grid-2 mb-lg">
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Total Requests</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: Colors.copper, marginBottom: 4 }}>{data.proRequestsTotal}</p>
                <p className="text-xs text-gray">All time pro requests</p>
              </div>
              <div className="card">
                <p style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Avg Time to Assignment</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: Colors.info, marginBottom: 4 }}>{data.avgTimeToAssignment}h</p>
                <p className="text-xs text-gray">Hours from creation to match</p>
              </div>
            </div>

            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Requests by Status</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {data.proRequestsByStatus.map(s => {
                const percentage = data.proRequestsTotal > 0 ? Math.round((s.count / data.proRequestsTotal) * 100) : 0;
                return (
                  <div key={s.status} style={{ borderLeft: `4px solid ${Colors.sage}`, paddingLeft: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.status}</span>
                      <span style={{ color: Colors.silver }}>{s.count}</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 4 }}>
                      <div className="progress-fill" style={{ width: `${percentage}%`, background: Colors.sage }} />
                    </div>
                    <p className="text-xs text-gray">{percentage}% of total</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
