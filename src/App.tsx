import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import ErrorBoundary from '@/components/ErrorBoundary';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
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
import AgentPortal from '@/pages/AgentPortal';
import AgentClientHome from '@/pages/AgentClientHome';
import TaskDetail from '@/pages/TaskDetail';
import EquipmentDetail from '@/pages/EquipmentDetail';
import Notifications from '@/pages/Notifications';
import Documents from '@/pages/Documents';
import Help from '@/pages/Help';
import Onboarding from '@/pages/Onboarding';
import ProPortal from '@/pages/ProPortal';
import ProLogin from '@/pages/ProLogin';
import ProJobs from '@/pages/ProJobs';
import ProAvailability from '@/pages/ProAvailability';
import ProProfile from '@/pages/ProProfile';
import CreateTask from '@/pages/CreateTask';
import ProServices from '@/pages/ProServices';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';

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

export default function App() {
  const { reset } = useStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        reset();
      }
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Session refreshed — keep user logged in
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/pro-login" element={<ProLogin />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

          {/* Protected routes with sidebar */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/weather" element={<Weather />} />
            <Route path="/task/:id" element={<TaskDetail />} />
            <Route path="/task/create" element={<CreateTask />} />
            <Route path="/equipment" element={<Equipment />} />
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/help" element={<Help />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/pro-request" element={<ProRequest />} />
            <Route path="/pro-services" element={<ProServices />} />
            <Route path="/agent" element={<AgentView />} />
            <Route path="/logs" element={<MaintenanceLogs />} />
            <Route path="/home" element={<HomeDetails />} />
            <Route path="/admin" element={<RoleRoute roles={['admin']}><AdminDashboard /></RoleRoute>} />
            <Route path="/admin/agents" element={<RoleRoute roles={['admin']}><AdminAgents /></RoleRoute>} />
            <Route path="/admin/users" element={<RoleRoute roles={['admin']}><AdminUsers /></RoleRoute>} />
            <Route path="/admin/gift-codes" element={<RoleRoute roles={['admin']}><AdminGiftCodes /></RoleRoute>} />
            <Route path="/admin/pro-requests" element={<RoleRoute roles={['admin']}><AdminProRequests /></RoleRoute>} />
            <Route path="/agent-portal" element={<RoleRoute roles={['agent', 'admin']}><AgentPortal /></RoleRoute>} />
            <Route path="/agent-portal/client/:clientId" element={<RoleRoute roles={['agent', 'admin']}><AgentClientHome /></RoleRoute>} />
            <Route path="/pro-portal" element={<RoleRoute roles={['pro_provider', 'admin']}><ProPortal /></RoleRoute>} />
            <Route path="/pro-portal/jobs" element={<RoleRoute roles={['pro_provider', 'admin']}><ProJobs /></RoleRoute>} />
            <Route path="/pro-portal/availability" element={<RoleRoute roles={['pro_provider', 'admin']}><ProAvailability /></RoleRoute>} />
            <Route path="/pro-portal/profile" element={<RoleRoute roles={['pro_provider', 'admin']}><ProProfile /></RoleRoute>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
