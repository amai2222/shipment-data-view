// 文件路径: src/App.tsx
// 描述: [qZpSO-Final] 已集成新的两级项目看板路由

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";

// --- 页面组件导入 ---
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import TransportOverview from "./pages/TransportOverview";
import Projects from "./pages/Projects";
import Drivers from "./pages/Drivers";
import Locations from "./pages/Locations";
import Partners from "./pages/Partners";
import BusinessEntry from "./pages/BusinessEntry";
import PaymentRequest from "./pages/PaymentRequest";
import FinancialOverview from "./pages/FinancialOverview";
import FinanceReconciliation from "./pages/FinanceReconciliation";
import PaymentInvoice from "./pages/PaymentInvoice";
import PaymentInvoiceDetail from "./pages/PaymentInvoiceDetail";
import NotFound from "./pages/NotFound";
import PaymentRequestsList from "./pages/PaymentRequestsList";
import UserManagement from "./pages/Settings/UserManagement";

// ★★★ 1. 导入我们新创建的两个页面 ★★★
import ProjectsOverview from "./pages/ProjectsOverview"; // 新的概览页
import ProjectDashboard from "./pages/ProjectDashboard"; // 改造后的详情页

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* --- 公开路由 --- */}
            <Route path="/auth" element={<Auth />} />
            
            {/* --- 受保护的路由 --- */}
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

            {/* ★★★ 2. 添加新的“项目看板”概览页路由 ★★★ */}
            <Route path="/dashboard/project" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <AppLayout><ProjectsOverview /></AppLayout>
              </ProtectedRoute>
            } />

            {/* ★★★ 3. 添加新的“项目详情”下钻页路由 ★★★ */}
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
            
            {/* 您原有的“项目管理”路由，保持不变 */}
            <Route path="/projects" element={
              <ProtectedRoute requiredRoles={['admin', 'business']}>
                <AppLayout><Projects /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* ... 其他路由保持不变 ... */}
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
            
            {/* --- 404路由 --- */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
