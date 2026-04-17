import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase, getProfile, getHome, getEquipment, getTasks, getHomeConsumables, getTaskTemplates, getAgent, redeemReferralCode } from '@/services/supabase';
import { setUser as sentrySetUser, captureException } from '@/utils/sentry';
import { loadServiceAreas, subscribeToServiceAreaChanges } from '@/services/subscriptionGate';
import logger from '@/utils/logger';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';
import { useCanonical, usePageMeta } from '@/utils/seo';
import { ProgressProvider } from '@/components/ProgressBar';
// Layout shells stay eager — they wrap every route
import Layout from '@/components/Layout';
import AgentLayout from '@/components/AgentLayout';
import ProLayout from '@/components/ProLayout';
import AdminLayout from '@/components/AdminLayout';
import Toast from '@/components/Toast';

// ─── Lazy with stale-chunk reload ────────────────────────────
// After a Vercel deploy, old cached HTML may reference chunk filenames
// that no longer exist. This wrapper catches the import failure and
// does a single hard reload so the browser fetches fresh HTML + chunks.
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err) => {
      const key = 'chunk_reload';
      const hasReloaded = sessionStorage.getItem(key);
      if (!hasReloaded) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Return a never-resolving promise so React doesn't render stale state
        return new Promise(() => {});
      }
      sessionStorage.removeItem(key);
      throw err; // Let ErrorBoundary handle it on 2nd failure
    })
  );
}

// ─── Lazy-loaded pages (code-split per route) ───────────────
const Login = lazyRetry(() => import('@/pages/Login'));
const Signup = lazyRetry(() => import('@/pages/Signup'));
const ForgotPassword = lazyRetry(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazyRetry(() => import('@/pages/ResetPassword'));
const Landing = lazyRetry(() => import('@/pages/Landing'));
const Dashboard = lazyRetry(() => import('@/pages/Dashboard'));
const Calendar = lazyRetry(() => import('@/pages/Calendar'));
const Weather = lazyRetry(() => import('@/pages/Weather'));
const Equipment = lazyRetry(() => import('@/pages/Equipment'));
const Warranties = lazyRetry(() => import('@/pages/Warranties'));
const Profile = lazyRetry(() => import('@/pages/Profile'));
const Subscription = lazyRetry(() => import('@/pages/Subscription'));
const Refer = lazyRetry(() => import('@/pages/Refer'));
const ProRequest = lazyRetry(() => import('@/pages/ProRequest'));
const AgentView = lazyRetry(() => import('@/pages/AgentView'));
const MaintenanceLogs = lazyRetry(() => import('@/pages/MaintenanceLogs'));
const HomeDetails = lazyRetry(() => import('@/pages/HomeDetails'));
const AdminDashboard = lazyRetry(() => import('@/pages/AdminDashboard'));
const AdminAgents = lazyRetry(() => import('@/pages/AdminAgents'));
const AdminUsers = lazyRetry(() => import('@/pages/AdminUsers'));
const AdminUserView = lazyRetry(() => import('@/pages/AdminUserView'));
const AdminGiftCodes = lazyRetry(() => import('@/pages/AdminGiftCodes'));
const AdminProRequests = lazyRetry(() => import('@/pages/AdminProRequests'));
const AdminProProviders = lazyRetry(() => import('@/pages/AdminProProviders'));
const AdminServiceAreas = lazyRetry(() => import('@/pages/AdminServiceAreas'));
const AdminNotifications = lazyRetry(() => import('@/pages/AdminNotifications'));
const AdminEmails = lazyRetry(() => import('@/pages/AdminEmails'));
const AdminAnalytics = lazyRetry(() => import('@/pages/AdminAnalytics'));
const AdminAuditLog = lazyRetry(() => import('@/pages/AdminAuditLog'));
const AdminProviderApplications = lazyRetry(() => import('@/pages/AdminProviderApplications'));
const AdminSupportTickets = lazyRetry(() => import('@/pages/AdminSupportTickets'));
const AdminReferenceData = lazyRetry(() => import('@/pages/AdminReferenceData'));
const AdminTechnicianOnboarding = lazyRetry(() => import('@/pages/AdminTechnicianOnboarding'));
const AgentPortal = lazyRetry(() => import('@/pages/AgentPortal'));
const AgentProfile = lazyRetry(() => import('@/pages/AgentProfile'));
const AgentClientHome = lazyRetry(() => import('@/pages/AgentClientHome'));
const AgentPurchaseCodes = lazyRetry(() => import('@/pages/AgentPurchaseCodes'));
const AgentLinkClient = lazyRetry(() => import('@/pages/AgentLinkClient'));
const TaskDetail = lazyRetry(() => import('@/pages/TaskDetail'));
const EquipmentDetail = lazyRetry(() => import('@/pages/EquipmentDetail'));
const Notifications = lazyRetry(() => import('@/pages/Notifications'));
const Documents = lazyRetry(() => import('@/pages/Documents'));
const Help = lazyRetry(() => import('@/pages/Help'));
const WhatsNew = lazyRetry(() => import('@/pages/WhatsNew'));
const Onboarding = lazyRetry(() => import('@/pages/Onboarding'));
const ProPortal = lazyRetry(() => import('@/pages/ProPortal'));
const ProPayouts = lazyRetry(() => import('@/pages/ProPayouts'));
const ProLogin = lazyRetry(() => import('@/pages/ProLogin'));
// ProJobs removed — obsolete marketplace page, redirects to job-queue
const ProAvailability = lazyRetry(() => import('@/pages/ProAvailability'));
const ProProfile = lazyRetry(() => import('@/pages/ProProfile'));
const CreateTask = lazyRetry(() => import('@/pages/CreateTask'));
const ProServices = lazyRetry(() => import('@/pages/ProServices'));
const Visits = lazyRetry(() => import('@/pages/Visits'));
const ProPlusManage = lazyRetry(() => import('@/pages/ProPlusManage'));
const Quotes = lazyRetry(() => import('@/pages/Quotes'));
const Invoices = lazyRetry(() => import('@/pages/Invoices'));
const ProVisitSchedule = lazyRetry(() => import('@/pages/ProVisitSchedule'));
const ProQuotesInvoices = lazyRetry(() => import('@/pages/ProQuotesInvoices'));
const ProJobQueue = lazyRetry(() => import('@/pages/ProJobQueue'));
const ProAddOnQuotes = lazyRetry(() => import('@/pages/ProAddOnQuotes'));
const ProInspection = lazyRetry(() => import('@/pages/ProInspection'));
const HomeAssistant = lazyRetry(() => import('@/pages/HomeAssistant'));
const SalePrep = lazyRetry(() => import('@/pages/SalePrep'));
const HomeReport = lazyRetry(() => import('@/pages/HomeReport'));
const HomeTransfer = lazyRetry(() => import('@/pages/HomeTransfer'));
const HomeTokenShareView = lazyRetry(() => import('@/pages/HomeTokenShareView'));
const Terms = lazyRetry(() => import('@/pages/Terms'));
const Privacy = lazyRetry(() => import('@/pages/Privacy'));
const ContractorTerms = lazyRetry(() => import('@/pages/ContractorTerms'));
const AIDisclaimer = lazyRetry(() => import('@/pages/AIDisclaimer'));
const CancellationPolicy = lazyRetry(() => import('@/pages/CancellationPolicy'));
const PCICompliance = lazyRetry(() => import('@/pages/PCICompliance'));
const Support = lazyRetry(() => import('@/pages/Support'));
const Unsubscribe = lazyRetry(() => import('@/pages/Unsubscribe'));
const AddOnsLanding = lazyRetry(() => import('@/pages/AddOnsLanding'));
const ApplyPro = lazyRetry(() => import('@/pages/ApplyPro'));
const AgentLanding = lazyRetry(() => import('@/pages/AgentLanding'));
const ProLanding = lazyRetry(() => import('@/pages/ProLanding'));
const AgentRedeem = lazyRetry(() => import('@/pages/AgentRedeem'));
const AgentApplication = lazyRetry(() => import('@/pages/AgentApplication'));
const BuilderApplication = lazyRetry(() => import('@/pages/BuilderApplication'));
const AdminBuilders = lazyRetry(() => import('@/pages/AdminBuilders'));
const AdminVerifications = lazyRetry(() => import('@/pages/AdminVerifications'));
const AdminAffiliateProducts = lazyRetry(() => import('@/pages/AdminAffiliateProducts'));
const AdminAddOns = lazyRetry(() => import('@/pages/AdminAddOns'));
const TechnicianOnboarding = lazyRetry(() => import('@/pages/TechnicianOnboarding'));
const ProOnboardingSuccess = lazyRetry(() => import('@/pages/ProOnboardingSuccess'));
const ProOnboardingRefresh = lazyRetry(() => import('@/pages/ProOnboardingRefresh'));
const SignupSuccess = lazyRetry(() => import('@/pages/SignupSuccess'));
const NotFound = lazyRetry(() => import('@/pages/NotFound'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RoleRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { isAuthenticated, user } = useStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.role || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Runs SEO hooks (canonical URL, page titles) inside the router context. */
function SEOManager() {
  useCanonical();
  usePageMeta();
  return null;
}

function HomeRoute() {
  const { isAuthenticated } = useStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  const { reset, setUser, setHome, setEquipment, setConsumables, setCustomTemplates, setTasks, setAgent } = useStore();

  useEffect(() => {
    // Validate Supabase session on app mount.
    // Zustand persists isAuthenticated in localStorage, but the actual JWT
    // may have expired (refresh token gone). If so, clear the store so the
    // user gets redirected to login instead of seeing cryptic 401 errors.
    const validateSession = async () => {
      const { isAuthenticated } = useStore.getState();
      if (!isAuthenticated) return; // not logged in, nothing to validate

      const { data: { session }, error } = await supabase.auth.getSession();
      if (!session || error) {
        logger.warn('[Auth] Session expired or invalid — logging out', error?.message);
        reset();
        return;
      }

      // Session is valid — sync email_confirmed from Supabase auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const storeUser = useStore.getState().user;
        if (storeUser && storeUser.email_confirmed !== !!authUser.email_confirmed_at) {
          useStore.getState().setUser({ ...storeUser, email_confirmed: !!authUser.email_confirmed_at });
        }
        // Tag Sentry events with the signed-in user's identity.
        sentrySetUser({
          id: authUser.id,
          email: authUser.email ?? undefined,
          role: storeUser?.role,
        });
      }
    };
    validateSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        reset();
        sentrySetUser(null);
      }

      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        // Recovery token detected — redirect to reset form, don't load dashboard
        window.location.replace('/reset-password');
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // User just signed in — load full profile and home data
        try {
          const authUser = session.user;
          const profile = await getProfile(authUser.id);
          const userData = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
            subscription_tier: profile?.subscription_tier || 'free',
            subscription_status: profile?.subscription_status,
            onboarding_complete: profile?.onboarding_complete || false,
            email_confirmed: !!authUser.email_confirmed_at,
            created_at: authUser.created_at,
            role: profile?.role || 'user',
            agent_id: profile?.agent_id,
            phone: profile?.phone,
          };
          setUser(userData);

          // Load home data + custom templates
          // IMPORTANT: setHome MUST fire AFTER equipment/tasks/templates resolve,
          // otherwise Dashboard's task-generation effect races and runs against
          // an empty customTemplates array, producing 0 tasks.
          try {
            const homeData = await getHome(authUser.id);
            if (homeData) {
              const [equip, consumables, tasks, templates] = await Promise.all([getEquipment(homeData.id), getHomeConsumables(homeData.id), getTasks(homeData.id), getTaskTemplates()]);
              setEquipment(equip);
              setConsumables(consumables);
              setTasks(tasks);
              setCustomTemplates(templates);
              setHome(homeData);
            }
          } catch (err) {
            logger.warn('[Auth] SIGNED_IN home/equipment/tasks bootstrap failed:', err);
            captureException(err, { context: 'SIGNED_IN home bootstrap' });
          }

          // Load agent
          if (userData.agent_id) {
            try {
              const a = await getAgent(userData.agent_id);
              setAgent(a);
            } catch (err) {
              logger.warn('[Auth] SIGNED_IN agent load failed:', err);
              captureException(err, { context: 'SIGNED_IN agent load' });
            }
          }

          // Redeem referral code if one was stored during signup
          try {
            const refCode = sessionStorage.getItem('canopy_referral_code');
            if (refCode) {
              sessionStorage.removeItem('canopy_referral_code');
              const result = await redeemReferralCode(refCode);
              if (result.success) {
                logger.info('[Referral] Code redeemed successfully:', refCode);
              } else {
                logger.warn('[Referral] Code redemption failed:', result.error);
              }
            }
          } catch (refErr) {
            logger.warn('[Referral] Failed to redeem code:', refErr);
          }

          sentrySetUser({
            id: authUser.id,
            email: authUser.email ?? undefined,
            role: userData.role,
          });
        } catch (err) {
          logger.error('[Auth] SIGNED_IN event handler failed:', err);
        }
      }

      if (event === 'USER_UPDATED' && session?.user) {
        // User data changed — sync updated fields
        const storeUser = useStore.getState().user;
        if (storeUser) {
          const updated = {
            ...storeUser,
            email_confirmed: !!session.user.email_confirmed_at,
            full_name: session.user.user_metadata?.full_name || storeUser.full_name,
          };
          setUser(updated);
          sentrySetUser({
            id: session.user.id,
            email: session.user.email ?? undefined,
            role: updated.role,
          });
        }
      }

      if (event === 'INITIAL_SESSION' && session?.user) {
        // If this is a password recovery session, redirect to reset page — don't load dashboard
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        if (hashParams.get('type') === 'recovery' || window.location.pathname === '/reset-password') {
          return; // Let ResetPassword component handle the session
        }

        // Initial session detected (e.g., magic link from URL hash)
        // Load profile and home data like SIGNED_IN
        try {
          const authUser = session.user;
          const profile = await getProfile(authUser.id);
          const userData = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
            subscription_tier: profile?.subscription_tier || 'free',
            subscription_status: profile?.subscription_status,
            onboarding_complete: profile?.onboarding_complete || false,
            email_confirmed: !!authUser.email_confirmed_at,
            created_at: authUser.created_at,
            role: profile?.role || 'user',
            agent_id: profile?.agent_id,
            phone: profile?.phone,
          };
          setUser(userData);

          // Load home data + custom templates
          // IMPORTANT: setHome MUST fire AFTER equipment/tasks/templates resolve,
          // otherwise Dashboard's task-generation effect races and runs against
          // an empty customTemplates array, producing 0 tasks.
          try {
            const homeData = await getHome(authUser.id);
            if (homeData) {
              const [equip, consumables, tasks, templates] = await Promise.all([getEquipment(homeData.id), getHomeConsumables(homeData.id), getTasks(homeData.id), getTaskTemplates()]);
              setEquipment(equip);
              setConsumables(consumables);
              setTasks(tasks);
              setCustomTemplates(templates);
              setHome(homeData);
            }
          } catch (err) {
            logger.warn('[Auth] INITIAL_SESSION home/equipment/tasks bootstrap failed:', err);
            captureException(err, { context: 'INITIAL_SESSION home bootstrap' });
          }

          // Load agent
          if (userData.agent_id) {
            try {
              const a = await getAgent(userData.agent_id);
              setAgent(a);
            } catch (err) {
              logger.warn('[Auth] INITIAL_SESSION agent load failed:', err);
              captureException(err, { context: 'INITIAL_SESSION agent load' });
            }
          }

          sentrySetUser({
            id: authUser.id,
            email: authUser.email ?? undefined,
            role: userData.role,
          });
        } catch (err) {
          logger.error('[Auth] INITIAL_SESSION event handler failed:', err);
        }
      }

      if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Sync email_confirmed on token refresh too
        const storeUser = useStore.getState().user;
        if (storeUser) {
          useStore.getState().setUser({ ...storeUser, email_confirmed: !!session.user.email_confirmed_at });
        }
        sentrySetUser({
          id: session.user.id,
          email: session.user.email ?? undefined,
          role: storeUser?.role,
        });
      }
    });
    // Prime the service area cache and subscribe to realtime updates
    loadServiceAreas().catch(() => {});
    const unsubscribeServiceAreas = subscribeToServiceAreaChanges();

    return () => {
      subscription.unsubscribe();
      unsubscribeServiceAreas();
    };
  }, []);

  return (
    <ThemeProvider>
    <BrowserRouter>
      <ProgressProvider>
        <SEOManager />
        <Toast />
        <ErrorBoundary>
          <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: Colors.medGray }}>Loading…</div>}>
          <Routes>
          {/* Landing/Home — shows Landing for unauthenticated, Dashboard for authenticated */}
          <Route path="/" element={<HomeRoute />} />

          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signup-success" element={<SignupSuccess />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pro-login" element={<ProLogin />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contractor-terms" element={<ContractorTerms />} />
          <Route path="/ai-disclaimer" element={<AIDisclaimer />} />
          <Route path="/cancellation" element={<CancellationPolicy />} />
          <Route path="/pci-compliance" element={<PCICompliance />} />
          <Route path="/support" element={<Support />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/add-ons" element={<AddOnsLanding />} />
          <Route path="/apply-pro" element={<ApplyPro />} />
          <Route path="/for-agents" element={<AgentLanding />} />
          <Route path="/for-pros" element={<ProLanding />} />
          <Route path="/a/:slug" element={<AgentRedeem />} />
          <Route path="/agent-application" element={<AgentApplication />} />
          <Route path="/builder-application" element={<BuilderApplication />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

          {/* ═══════════════════════════════════════════════════════
              AGENT PORTAL — Standalone layout, NO homeowner nav
              Agent users land here directly on login
          ═══════════════════════════════════════════════════════ */}
          <Route element={<RoleRoute roles={['agent', 'admin']}><AgentLayout /></RoleRoute>}>
            <Route path="/agent-portal" element={<AgentPortal />} />
            <Route path="/agent-portal/profile" element={<AgentProfile />} />
            <Route path="/agent-portal/client/:clientId" element={<AgentClientHome />} />
            <Route path="/agent-portal/purchase-codes" element={<AgentPurchaseCodes />} />
            <Route path="/agent-portal/link-client" element={<AgentLinkClient />} />
          </Route>

          {/* ═══════════════════════════════════════════════════════
              PRO PROVIDER PORTAL — Standalone layout, NO homeowner nav
              Pro provider users land here directly on login
          ═══════════════════════════════════════════════════════ */}
          <Route element={<RoleRoute roles={['pro_provider', 'admin']}><ProLayout /></RoleRoute>}>
            <Route path="/pro-portal" element={<ProPortal />} />
            <Route path="/pro-portal/jobs" element={<Navigate to="/pro-portal/job-queue" replace />} />
            <Route path="/pro-portal/availability" element={<ProAvailability />} />
            <Route path="/pro-portal/profile" element={<ProProfile />} />
            <Route path="/pro-portal/visit-schedule" element={<ProVisitSchedule />} />
            <Route path="/pro-portal/quotes-invoices" element={<ProQuotesInvoices />} />
            <Route path="/pro-portal/job-queue" element={<ProJobQueue />} />
            <Route path="/pro-portal/inspection/:visitId" element={<ProInspection />} />
            <Route path="/pro-portal/add-on-quotes" element={<ProAddOnQuotes />} />
            <Route path="/pro-portal/payouts" element={<ProPayouts />} />
            <Route path="/pro-portal/onboarding" element={<TechnicianOnboarding />} />
            <Route path="/pro-portal/onboarding/success" element={<ProOnboardingSuccess />} />
            <Route path="/pro-portal/onboarding/refresh" element={<ProOnboardingRefresh />} />
          </Route>

          {/* ═══════════════════════════════════════════════════════
              ADMIN PORTAL — Dedicated layout with admin sidebar
          ═══════════════════════════════════════════════════════ */}
          <Route element={<RoleRoute roles={['admin']}><AdminLayout /></RoleRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/agents" element={<AdminAgents />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/users/:userId/view" element={<AdminUserView />} />
            <Route path="/admin/gift-codes" element={<AdminGiftCodes />} />
            <Route path="/admin/pro-providers" element={<AdminProProviders />} />
            <Route path="/admin/pro-requests" element={<AdminProRequests />} />
            <Route path="/admin/service-areas" element={<AdminServiceAreas />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/emails" element={<AdminEmails />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/audit-log" element={<AdminAuditLog />} />
            <Route path="/admin/provider-applications" element={<AdminProviderApplications />} />
            <Route path="/admin/support-tickets" element={<AdminSupportTickets />} />
            <Route path="/admin/reference-data" element={<AdminReferenceData />} />
            <Route path="/admin/technician-onboarding" element={<AdminTechnicianOnboarding />} />
            <Route path="/admin/builders" element={<AdminBuilders />} />
            <Route path="/admin/verifications" element={<AdminVerifications />} />
            <Route path="/admin/affiliate-products" element={<AdminAffiliateProducts />} />
            <Route path="/admin/add-ons" element={<AdminAddOns />} />
          </Route>

          {/* ═══════════════════════════════════════════════════════
              HOMEOWNER — Full Layout with sidebar
              Admin can still access homeowner views
          ═══════════════════════════════════════════════════════ */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/weather" element={<Weather />} />
            <Route path="/task/:id" element={<TaskDetail />} />
            <Route path="/task/create" element={<CreateTask />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
            <Route path="/warranties" element={<Warranties />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/assistant" element={<HomeAssistant />} />
            <Route path="/help" element={<Help />} />
            <Route path="/whats-new" element={<WhatsNew />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/refer" element={<Refer />} />
            <Route path="/pro-request" element={<ProRequest />} />
            <Route path="/pro-services" element={<ProServices />} />
            <Route path="/visits" element={<Visits />} />
            <Route path="/pro-plus" element={<ProPlusManage />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/agent" element={<AgentView />} />
            <Route path="/logs" element={<Navigate to="/calendar?tab=log" replace />} />
            <Route path="/home" element={<HomeDetails />} />
            <Route path="/sale-prep" element={<SalePrep />} />
            <Route path="/home-report" element={<HomeReport />} />
            <Route path="/transfer" element={<HomeTransfer />} />
            <Route path="/transfer/accept" element={<HomeTransfer />} />
            <Route path="/home-token/share/:transferToken" element={<HomeTokenShareView />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </ErrorBoundary>
      </ProgressProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
