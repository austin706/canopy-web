import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase, getProfile, getHome, getEquipment, getTasks, getHomeConsumables, getTaskTemplates, getAgent } from '@/services/supabase';
import { setUser as sentrySetUser } from '@/utils/sentry';
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

// ─── Lazy-loaded pages (code-split per route) ───────────────
const Login = lazy(() => import('@/pages/Login'));
const Signup = lazy(() => import('@/pages/Signup'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Landing = lazy(() => import('@/pages/Landing'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Weather = lazy(() => import('@/pages/Weather'));
const Equipment = lazy(() => import('@/pages/Equipment'));
const Profile = lazy(() => import('@/pages/Profile'));
const Subscription = lazy(() => import('@/pages/Subscription'));
const ProRequest = lazy(() => import('@/pages/ProRequest'));
const AgentView = lazy(() => import('@/pages/AgentView'));
const MaintenanceLogs = lazy(() => import('@/pages/MaintenanceLogs'));
const HomeDetails = lazy(() => import('@/pages/HomeDetails'));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminAgents = lazy(() => import('@/pages/AdminAgents'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));
const AdminGiftCodes = lazy(() => import('@/pages/AdminGiftCodes'));
const AdminProRequests = lazy(() => import('@/pages/AdminProRequests'));
const AdminProProviders = lazy(() => import('@/pages/AdminProProviders'));
const AdminServiceAreas = lazy(() => import('@/pages/AdminServiceAreas'));
const AdminNotifications = lazy(() => import('@/pages/AdminNotifications'));
const AdminEmails = lazy(() => import('@/pages/AdminEmails'));
const AdminAnalytics = lazy(() => import('@/pages/AdminAnalytics'));
const AdminAuditLog = lazy(() => import('@/pages/AdminAuditLog'));
const AdminProviderApplications = lazy(() => import('@/pages/AdminProviderApplications'));
const AdminSupportTickets = lazy(() => import('@/pages/AdminSupportTickets'));
const AdminReferenceData = lazy(() => import('@/pages/AdminReferenceData'));
const AdminTechnicianOnboarding = lazy(() => import('@/pages/AdminTechnicianOnboarding'));
const AgentPortal = lazy(() => import('@/pages/AgentPortal'));
const AgentProfile = lazy(() => import('@/pages/AgentProfile'));
const AgentClientHome = lazy(() => import('@/pages/AgentClientHome'));
const AgentPurchaseCodes = lazy(() => import('@/pages/AgentPurchaseCodes'));
const AgentLinkClient = lazy(() => import('@/pages/AgentLinkClient'));
const TaskDetail = lazy(() => import('@/pages/TaskDetail'));
const EquipmentDetail = lazy(() => import('@/pages/EquipmentDetail'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Documents = lazy(() => import('@/pages/Documents'));
const Help = lazy(() => import('@/pages/Help'));
const WhatsNew = lazy(() => import('@/pages/WhatsNew'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const ProPortal = lazy(() => import('@/pages/ProPortal'));
const ProLogin = lazy(() => import('@/pages/ProLogin'));
// ProJobs removed — obsolete marketplace page, redirects to job-queue
const ProAvailability = lazy(() => import('@/pages/ProAvailability'));
const ProProfile = lazy(() => import('@/pages/ProProfile'));
const CreateTask = lazy(() => import('@/pages/CreateTask'));
const ProServices = lazy(() => import('@/pages/ProServices'));
const Visits = lazy(() => import('@/pages/Visits'));
const ProPlusManage = lazy(() => import('@/pages/ProPlusManage'));
const Quotes = lazy(() => import('@/pages/Quotes'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const ProVisitSchedule = lazy(() => import('@/pages/ProVisitSchedule'));
const ProQuotesInvoices = lazy(() => import('@/pages/ProQuotesInvoices'));
const ProJobQueue = lazy(() => import('@/pages/ProJobQueue'));
const ProInspection = lazy(() => import('@/pages/ProInspection'));
const HomeAssistant = lazy(() => import('@/pages/HomeAssistant'));
const SalePrep = lazy(() => import('@/pages/SalePrep'));
const HomeReport = lazy(() => import('@/pages/HomeReport'));
const HomeTransfer = lazy(() => import('@/pages/HomeTransfer'));
const Terms = lazy(() => import('@/pages/Terms'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const ContractorTerms = lazy(() => import('@/pages/ContractorTerms'));
const AIDisclaimer = lazy(() => import('@/pages/AIDisclaimer'));
const CancellationPolicy = lazy(() => import('@/pages/CancellationPolicy'));
const PCICompliance = lazy(() => import('@/pages/PCICompliance'));
const Support = lazy(() => import('@/pages/Support'));
const ApplyPro = lazy(() => import('@/pages/ApplyPro'));
const AgentLanding = lazy(() => import('@/pages/AgentLanding'));
const ProLanding = lazy(() => import('@/pages/ProLanding'));
const AgentRedeem = lazy(() => import('@/pages/AgentRedeem'));
const AgentApplication = lazy(() => import('@/pages/AgentApplication'));
const BuilderApplication = lazy(() => import('@/pages/BuilderApplication'));
const AdminBuilders = lazy(() => import('@/pages/AdminBuilders'));
const AdminVerifications = lazy(() => import('@/pages/AdminVerifications'));
const AdminAffiliateProducts = lazy(() => import('@/pages/AdminAffiliateProducts'));
const TechnicianOnboarding = lazy(() => import('@/pages/TechnicianOnboarding'));
const ProOnboardingSuccess = lazy(() => import('@/pages/ProOnboardingSuccess'));
const ProOnboardingRefresh = lazy(() => import('@/pages/ProOnboardingRefresh'));
const NotFound = lazy(() => import('@/pages/NotFound'));

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
            onboarding_complete: profile?.onboarding_complete || false,
            email_confirmed: !!authUser.email_confirmed_at,
            created_at: authUser.created_at,
            role: profile?.role || 'user',
            agent_id: profile?.agent_id,
            phone: profile?.phone,
          };
          setUser(userData);

          // Load home data + custom templates
          try {
            const homeData = await getHome(authUser.id);
            if (homeData) {
              setHome(homeData);
              const [equip, consumables, tasks, templates] = await Promise.all([getEquipment(homeData.id), getHomeConsumables(homeData.id), getTasks(homeData.id), getTaskTemplates()]);
              setEquipment(equip);
              setConsumables(consumables);
              setTasks(tasks);
              setCustomTemplates(templates);
            }
          } catch {}

          // Load agent
          if (userData.agent_id) {
            try {
              const a = await getAgent(userData.agent_id);
              setAgent(a);
            } catch {}
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
            onboarding_complete: profile?.onboarding_complete || false,
            email_confirmed: !!authUser.email_confirmed_at,
            created_at: authUser.created_at,
            role: profile?.role || 'user',
            agent_id: profile?.agent_id,
            phone: profile?.phone,
          };
          setUser(userData);

          // Load home data + custom templates
          try {
            const homeData = await getHome(authUser.id);
            if (homeData) {
              setHome(homeData);
              const [equip, consumables, tasks, templates] = await Promise.all([getEquipment(homeData.id), getHomeConsumables(homeData.id), getTasks(homeData.id), getTaskTemplates()]);
              setEquipment(equip);
              setConsumables(consumables);
              setTasks(tasks);
              setCustomTemplates(templates);
            }
          } catch {}

          // Load agent
          if (userData.agent_id) {
            try {
              const a = await getAgent(userData.agent_id);
              setAgent(a);
            } catch {}
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
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/assistant" element={<HomeAssistant />} />
            <Route path="/help" element={<Help />} />
            <Route path="/whats-new" element={<WhatsNew />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/subscription" element={<Subscription />} />
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
