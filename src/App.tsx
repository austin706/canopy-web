import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { supabase } from '@/services/supabase';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Calendar from '@/pages/Calendar';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
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
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes with sidebar */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/pro-request" element={<ProRequest />} />
          <Route path="/agent" element={<AgentView />} />
          <Route path="/logs" element={<MaintenanceLogs />} />
          <Route path="/home" element={<HomeDetails />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/agents" element={<AdminAgents />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/gift-codes" element={<AdminGiftCodes />} />
          <Route path="/admin/pro-requests" element={<AdminProRequests />} />
          <Route path="/agent-portal" element={<AgentPortal />} />
          <Route path="/agent-portal/client/:clientId" element={<AgentClientHome />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
