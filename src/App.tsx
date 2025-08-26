// 文件路径: src/App.tsx
// 描述: [最终完整版] 已集成企业微信自动登录路由守卫和所有必要路由

import React, { useContext } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, AuthContext, UserRole } from "@/contexts/AuthContext";
import { AppLayout } from "./components/AppLayout";

// --- 页面组件导入 ---
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
import NotFoundWithStaticFileCheck from "./components/NotFoundWithStaticFileCheck";
import PaymentRequestsList from "./pages/PaymentRequestsList";
import UserManagement from "./pages/Settings/UserManagement";
import PermissionManagement from "./pages/Settings/PermissionManagement";
import ScaleRecords from "./pages/ScaleRecords";
import ProjectsOverview from "./pages/ProjectsOverview";
import ProjectDashboard from "./pages/ProjectDashboard";

// 导入企业微信认证所需的回调和错误页面
import AuthCallback from './pages/AuthCallback'; 
const AuthError = () => <div style={{ padding: '2rem', color: 'red', textAlign: 'center', fontFamily: 'sans-serif' }}>企业微信认证失败，请联系管理员。</div>;
const Unauthorized = () => <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>抱歉，您没有权限访问此页面。</div>;


const queryClient = new QueryClient();

/**
 * 路由守卫组件 (最终修正版)
 * - 解决了无限重定向问题
 * - 区分企业微信环境和普通浏览器环境
 */
const ProtectedRoute = ({ children, requiredRoles }: { children: React.ReactNode; requiredRoles: UserRole[] }) => {
  const auth = useContext(AuthContext);

  // 1. 检查是否仍在加载认证状态，避免在状态未知时做决策
  if (auth.loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>正在加载用户数据...</div>;
  }

  // 2. 加载完成后，检查是否已认证
  if (auth.isAuthenticated) {
    // 如果已认证，再检查角色权限
    if (auth.hasPermission(requiredRoles)) {
      return <>{children}</>; // 权限正确，显示页面
    } else {
      return <Navigate to="/unauthorized" replace />; // 没有权限
    }
  }

  // 3. 如果加载完成且未认证，则执行跳转逻辑
  const isWorkWechat = /wxwork/i.test(navigator.userAgent);
  
  if (isWorkWechat) {
    // 在企业微信环境内，自动跳转到授权页
    const corpId = import.meta.env.VITE_WORK_WECHAT_CORPID;
    const redirectUri = encodeURIComponent(`${import.meta.env.VITE_APP_URL}/auth/callback`);
    const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base#wechat_redirect`;
    
    // 执行跳转
    window.location.href = url;
    
    // 在跳转期间显示加载信息
    return <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>正在跳转到企业微信进行身份认证...</div>;
  } else {
    // 在普通浏览器环境，跳转到手动登录页
    return <Navigate to="/auth" replace />;
  }
};

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
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth-error" element={<AuthError />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

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
