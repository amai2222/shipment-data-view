// src/App.tsx
import React, { useContext } from "react"; // 引入React
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, AuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "./components/AppLayout";

// --- 页面组件导入 ---
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

// 导入我们新创建的回调和错误页面
import AuthCallback from './pages/AuthCallback'; 
// 建议您创建一个简单的AuthError组件
const AuthError = () => <div style={{ padding: '2rem', color: 'red', textAlign: 'center' }}>企业微信认证失败，请联系管理员。</div>;


const queryClient = new QueryClient();

// ★★★ 这是修复后的路由守卫逻辑 ★★★
const ProtectedRoute = ({ children, requiredRoles }: { children: React.ReactNode; requiredRoles: string[] }) => {
  const auth = useContext(AuthContext);

  // 1. 首先，检查是否仍在加载认证状态
  if (auth.loading) {
    // 在加载时，显示一个全局的加载指示器
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>正在加载用户数据...</div>;
  }

  // 2. 加载完成后，检查是否已认证
  if (auth.isAuthenticated) {
    // 如果已认证，再检查角色权限
    if (auth.hasPermission(requiredRoles as any)) {
      return <>{children}</>; // 权限正确，显示页面
    } else {
      // 没有权限，跳转到“无权限”页面
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // 3. 如果加载完成且未认证，则执行跳转逻辑
  const isWorkWechat = /wxwork/i.test(navigator.userAgent);
  
  if (isWorkWechat) {
    // 在企业微信环境内，自动跳转到授权页
    const corpId = import.meta.env.VITE_WORK_WECHAT_CORPID;
    const redirectUri = encodeURIComponent(`${import.meta.env.VITE_APP_URL}/auth/callback`);
    const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${corpId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base#wechat_redirect`;
    window.location.href = url;
    return <div style={{ padding: '2rem', textAlign: 'center' }}>正在跳转到企业微信进行身份认证...</div>;
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
            <Route path="/unauthorized" element={<div style={{ padding: '2rem', textAlign: 'center' }}>您没有权限访问此页面。</div>} />

            {/* --- 受保护的路由 (使用修复后的ProtectedRoute) --- */}
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
