// src/App.tsx
import { useContext } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, AuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "./components/AppLayout";

// --- Page Component Imports ---
import Auth from "./pages/Auth";
import TransportOverview from "./pages/TransportOverview";
import ProjectsOverview from "./pages/ProjectsOverview";
import ProjectDashboard from "./pages/ProjectDashboard";
import FinancialOverview from "./pages/FinancialOverview";
import Projects from "./pages/Projects";
import Drivers from "./pages/Drivers";
import Locations from "./pages/Locations";
import Partners from "./pages/Partners";
import BusinessEntry from "./pages/BusinessEntry";
import ScaleRecords from "./pages/ScaleRecords";
import PaymentRequest from "./pages/PaymentRequest";
import PaymentRequestsList from "./pages/PaymentRequestsList";
import FinanceReconciliation from "./pages/FinanceReconciliation";
import PaymentInvoice from "./pages/PaymentInvoice";
import PaymentInvoiceDetail from "./pages/PaymentInvoiceDetail";
import UserManagement from "./pages/Settings/UserManagement";
import PermissionManagement from "./pages/Settings/PermissionManagement";
import NotFoundWithStaticFileCheck from "./components/NotFoundWithStaticFileCheck";

// ★★★ 1. Import the new callback and error pages ★★★
import AuthCallback from './pages/AuthCallback'; // Assuming you have created this file as per previous instructions
import AuthError from './pages/AuthError';     // A simple page to show login errors

const queryClient = new QueryClient();

// ★★★ 2. Create the corrected ProtectedRoute logic ★★★
const ProtectedRoute = ({ children, requiredRoles }: { children: React.ReactNode; requiredRoles: string[] }) => {
  const auth = useContext(AuthContext);

  // Show a loading spinner while checking authentication state
  if (auth.loading) {
    return <div>Loading...</div>;
  }

  // If authenticated, check for roles
  if (auth.isAuthenticated) {
    if (auth.hasPermission(requiredRoles as any)) {
      return <>{children}</>;
    } else {
      // Optional: Redirect to an "Access Denied" page if role doesn't match
      return <Navigate to="/unauthorized" />;
    }
  }

  // --- This is the core logic for auto-login ---
  // If not authenticated, automatically redirect to Work WeChat for authorization
  const corpId = import.meta.env.VITE_WORK_WECHAT_CORPID;
  const redirectUri = encodeURIComponent(`${import.meta.env.VITE_APP_URL}/auth/callback`);
  const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base#wechat_redirect`;

  // Execute the redirect
  window.location.href = url;

  // Display a message while redirecting
  return <div>Redirecting to Work WeChat for authentication...</div>;
};


const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* --- Public Routes --- */}
            <Route path="/auth" element={<Auth />} />
            
            {/* ★★★ 3. Add the essential callback and error routes ★★★ */}
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth-error" element={<AuthError />} />
            <Route path="/unauthorized" element={<div>Access Denied</div>} />

            {/* --- Protected Routes --- */}
            <Route path="/" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator', 'viewer']}>
                <AppLayout><TransportOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard/transport" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <AppLayout><TransportOverview /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/dashboard/project" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <AppLayout><ProjectsOverview /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/project/:projectId" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <AppLayout><ProjectDashboard /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard/financial" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'viewer']}>
                <AppLayout><FinancialOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/projects" element={
              <ProtectedRoute requiredRoles={['admin', 'business']}>
                <AppLayout><Projects /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/drivers" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator', 'viewer']}>
                <AppLayout><Drivers /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/locations" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator', 'viewer']}>
                <AppLayout><Locations /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/partners" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <AppLayout><Partners /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/business-entry" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <AppLayout><BusinessEntry /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/scale-records" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <AppLayout><ScaleRecords /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/payment-request" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><PaymentRequest /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/payment-requests-list" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><PaymentRequestsList /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/finance/reconciliation" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><FinanceReconciliation /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/finance/payment-invoice" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><PaymentInvoice /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/finance/payment-invoice/:requestId" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <AppLayout><PaymentInvoiceDetail /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/users" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AppLayout><UserManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/permissions" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AppLayout><PermissionManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFoundWithStaticFileCheck />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
