import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from '@/components/Layout';
import AgentLayout from '@/components/AgentLayout';
import ProLayout from '@/components/ProLayout';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Calendar from '@/pages/Calendar';
import Weather from '@/pages/Weather';
import Equipment from '@/pages/Equipment';
import Profile from '@/pages/Profile';
import Subscription from '@/pages/Subscription';
import ProRequest from '@/pages/ProRequest';
import AgentView from '@/pages/AgentView';
import MaintenanceLogs from '@/pages/MaintenanceLogs';
import HomeDetails from '@/pages/HomeDetails';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminAgents from '@/pages/AdminAgents';
import AdminUsers from '@/pages/AdminUsers';
import AdminGiftCodes from '@/pages/AdminGiftCodes';
import AdminProRequests from '@/pages/AdminProRequests';
import AdminProProviders from '@/pages/AdminProProviders';
import AdminServiceAreas from '@/pages/AdminServiceAreas';
import AdminNotifications from '@/pages/AdminNotifications';
import AdminEmails from '@/pages/AdminEmails';
import AdminAnalytics from '@/pages/AdminAnalytics';
import AdminAuditLog from '@/pages/AdminAuditLog';
import AgentPortal from '@/pages/AgentPortal';
import AgentProfile from '@/pages/AgentProfile';
import AgentClientHome from '@/pages/AgentClientHome';
import AgentPurchaseCodes from '@/pages/AgentPurchaseCodes';
import AgentLinkClient from '@/pages/AgentLinkClient';
import TaskDetail from '@/pages/TaskDetail';
import EquipmentDetail from '@/pages/EquipmentDetail';
import Notifications from '@/pages/Notifications';
import Documents from '@/pages/Documents';
import Help from '@/pages/Help';
import Onboarding from '@/pages/Onboarding';
import ProPortal from '@/pages/ProPortal';
import ProLogin from '@/pages/ProLogin';
// ProJobs removed — obsolete marketplace page, redirects to job-queue
import ProAvailability from '@/pages/ProAvailability';
import ProProfile from '@/pages/ProProfile';
import CreateTask from '@/pages/CreateTask';
import ProServices from '@/pages/ProServices';
import Visits from '@/pages/Visits';
import ProPlusManage from '@/pages/ProPlusManage';
import Quotes from '@/pages/Quotes';
import Invoices from '@/pages/Invoices';
import ProVisitSchedule from '@/pages/ProVisitSchedule';
import ProQuotesInvoices from '@/pages/ProQuotesInvoices';
import ProJobQueue from '@/pages/ProJobQueue';
import ProInspection from '@/pages/ProInspection';
import HomeAssistant from '@/pages/HomeAssistant';
import SalePrep from '@/pages/SalePrep';
import HomeReport from '@/pages/HomeReport';
import HomeTransfer from '@/pages/HomeTransfer';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import ContractorTerms from '@/pages/ContractorTerms';
import AIDisclaimer from '@/pages/AIDisclaimer';
import CancellationPolicy from '@/pages/CancellationPolicy';
import PCICompliance from '@/pages/PCICompliance';
import Support from '@/pages/Support';
import ApplyPro from '@/pages/ApplyPro';

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

function HomeRoute() {
  const { isAuthenticated } = useStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  const { reset } = useStore();

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
        console.warn('[Auth] Session expired or invalid — logging out', error?.message);
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
      }
    };
    validateSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        reset();
      }
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Sync email_confirmed on token refresh too
        const storeUser = useStore.getState().user;
        if (storeUser) {
          useStore.getState().setUser({ ...storeUser, email_confirmed: !!session.user.email_confirmed_at });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
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
          </Route>

          {/* ═══════════════════════════════════════════════════════
              HOMEOWNER + ADMIN — Full Layout with sidebar
              Admin can access everything; regular users see homeowner nav
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

            {/* Admin pages — inside homeowner Layout since admin sees everything */}
            <Route path="/admin" element={<RoleRoute roles={['admin']}><AdminDashboard /></RoleRoute>} />
            <Route path="/admin/agents" element={<RoleRoute roles={['admin']}><AdminAgents /></RoleRoute>} />
            <Route path="/admin/users" element={<RoleRoute roles={['admin']}><AdminUsers /></RoleRoute>} />
            <Route path="/admin/gift-codes" element={<RoleRoute roles={['admin']}><AdminGiftCodes /></RoleRoute>} />
            <Route path="/admin/pro-providers" element={<RoleRoute roles={['admin']}><AdminProProviders /></RoleRoute>} />
            <Route path="/admin/pro-requests" element={<RoleRoute roles={['admin']}><AdminProRequests /></RoleRoute>} />
            <Route path="/admin/service-areas" element={<RoleRoute roles={['admin']}><AdminServiceAreas /></RoleRoute>} />
            <Route path="/admin/notifications" element={<RoleRoute roles={['admin']}><AdminNotifications /></RoleRoute>} />
            <Route path="/admin/emails" element={<RoleRoute roles={['admin']}><AdminEmails /></RoleRoute>} />
            <Route path="/admin/analytics" element={<RoleRoute roles={['admin']}><AdminAnalytics /></RoleRoute>} />
            <Route path="/admin/audit-log" element={<RoleRoute roles={['admin']}><AdminAuditLog /></RoleRoute>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
