// 文件路径: src/App.tsx
// 描述: [qZpSO-Final] 已集成新的两级项目看板路由，并调整了 Provider 结构以修复移动端重定向问题。

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "./components/AppLayout";
import { MobileRedirect } from "./components/MobileRedirect";
import { MobileLayout } from "./components/mobile/MobileLayout";

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
import InvoiceRequest from "./pages/InvoiceRequest";
import FinancialOverview from "./pages/FinancialOverview";
import FinanceReconciliation from "./pages/FinanceReconciliation";
import PaymentInvoice from "./pages/PaymentInvoice";
import PaymentInvoiceDetail from "./pages/PaymentInvoiceDetail";
import NotFound from "./pages/NotFound";
import NotFoundWithStaticFileCheck from "./components/NotFoundWithStaticFileCheck";
import PaymentRequestsList from "./pages/PaymentRequestsList";
import UserManagement from "./pages/Settings/UserManagement";
import PermissionConfig from "./pages/Settings/PermissionConfig";
import ContractPermission from "./pages/Settings/ContractPermission";
import RoleTemplate from "./pages/Settings/RoleTemplate";
import PermissionManagement from "./pages/Settings/PermissionManagement";
import IntegratedUserManagement from "./pages/IntegratedUserManagement";
import DebugPermissions from "./pages/DebugPermissions";
import PermissionTest from "./pages/PermissionTest";
import MobileIntegratedUserManagement from "./pages/mobile/MobileIntegratedUserManagement";
import AuditLogs from "./pages/Settings/AuditLogs";
import MobileAuditLogs from "./pages/mobile/MobileAuditLogs";
import ScaleRecords from "./pages/ScaleRecords";
import ContractManagement from "./pages/ContractManagement";
import WaybillMaintenance from "./pages/DataMaintenance/WaybillMaintenance";
import MobileNotifications from "./pages/mobile/MobileNotifications";
import MobileSettings from "./pages/mobile/MobileSettings";
import MobileUserManagement from "./pages/mobile/MobileUserManagement";
import MobileContractPermission from "./pages/mobile/MobileContractPermission";
import MobileRoleTemplate from "./pages/mobile/MobileRoleTemplate";

// ★★★ 1. 导入我们新创建的两个页面 ★★★
import ProjectsOverview from "./pages/ProjectsOverview"; // 新的概览页
import ProjectDashboard from "./pages/ProjectDashboard"; // 改造后的详情页

// 移动端页面导入
import MobileHome from "./pages/mobile/MobileHome";
import MobileBusinessEntry from "./pages/mobile/MobileBusinessEntry";
import MobileBusinessEntryForm from "./pages/mobile/MobileBusinessEntryForm";
import MobileProjectDashboard from "./pages/mobile/MobileProjectDashboard";
import MobileScaleRecords from "./pages/mobile/MobileScaleRecords";
import MobileDrivers from "./pages/mobile/MobileDrivers";
import MobileLocations from "./pages/mobile/MobileLocations";
import MobilePartners from "./pages/mobile/MobilePartners";
import MobileDashboard from "./pages/mobile/MobileDashboard";
import MobileFinancialOverview from "./pages/mobile/MobileFinancialOverview";
import MobilePaymentRequestsList from "./pages/mobile/MobilePaymentRequestsList";
import MobilePermissionManagement from "./pages/mobile/MobilePermissionManagement";
import MobilePaymentRequestsManagement from "./pages/mobile/MobilePaymentRequestsManagement";
import MobileContractManagement from "./pages/mobile/MobileContractManagement";
import MobileProjectOverview from "./pages/mobile/MobileProjectOverview";
import MobileProjectDetail from "./pages/mobile/MobileProjectDetail";
import MobileHomeNew from "./pages/mobile/MobileHomeNew";
import MobileProjectRecords from "./pages/mobile/MobileProjectRecords";
import MobileWaybillDetail from "./pages/mobile/MobileWaybillDetail";
import MobileProjectDashboardDetail from "./pages/mobile/MobileProjectDashboardDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* 关键改动：将 BrowserRouter 包裹在 AuthProvider 外层 */}
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <MobileRedirect>
            <Routes>
            {/* --- 公开路由 --- */}
            <Route path="/auth" element={<Auth />} />
            
            {/* --- 受保护的路由 --- */}
            <Route path="/" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator', 'viewer']}>
                <AppLayout><TransportOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/home" element={
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
            
            <Route path="/invoice-request" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'operator']}>
                <AppLayout><InvoiceRequest /></AppLayout>
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
                <AppLayout><PermissionConfig /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/contract-permissions" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AppLayout><ContractPermission /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/role-templates" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AppLayout><RoleTemplate /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/integrated" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AppLayout><IntegratedUserManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/audit-logs" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AppLayout><AuditLogs /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/debug-permissions" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AppLayout><DebugPermissions /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/permission-test" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AppLayout><PermissionTest /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/contracts" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business']}>
                <AppLayout><ContractManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/data-maintenance/waybill" element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <AppLayout><WaybillMaintenance /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* --- 移动端路由 --- */}
            <Route path="/m/" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator', 'viewer']}>
                <MobileHomeNew />
              </ProtectedRoute>
            } />
            
            <Route path="/m/business-entry" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <MobileLayout><MobileBusinessEntry /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/business-entry/new" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <MobileLayout><MobileBusinessEntryForm /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/business-entry/edit/:id" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <MobileLayout><MobileBusinessEntryForm /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/dashboard/project" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <MobileLayout><ProjectsOverview /></MobileLayout>
              </ProtectedRoute>
            } />


            <Route path="/m/dashboard/financial" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'viewer']}>
                <MobileLayout><FinancialOverview /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/projects" element={
              <ProtectedRoute requiredRoles={['admin', 'business']}>
                <MobileProjectOverview />
              </ProtectedRoute>
            } />

            <Route path="/m/projects/detail/:projectId" element={
              <ProtectedRoute requiredRoles={['admin', 'business', 'viewer']}>
                <MobileProjectDetail />
              </ProtectedRoute>
            } />

            <Route path="/m/projects/detail/:projectId/records" element={
              <ProtectedRoute requiredRoles={['admin', 'business', 'viewer']}>
                <MobileProjectRecords />
              </ProtectedRoute>
            } />

            <Route path="/m/projects/detail/:projectId/dashboard" element={
              <ProtectedRoute requiredRoles={['admin', 'business', 'viewer']}>
                <MobileProjectDashboardDetail />
              </ProtectedRoute>
            } />

            <Route path="/m/waybill/:waybillId" element={
              <ProtectedRoute requiredRoles={['admin', 'business', 'viewer']}>
                <MobileWaybillDetail />
              </ProtectedRoute>
            } />

            <Route path="/m/drivers" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator', 'viewer']}>
                <MobileDrivers />
              </ProtectedRoute>
            } />

            <Route path="/m/locations" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator', 'viewer']}>
                <MobileLocations />
              </ProtectedRoute>
            } />

            <Route path="/m/partners" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <MobilePartners />
              </ProtectedRoute>
            } />

            <Route path="/m/scale-records" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'operator']}>
                <MobileScaleRecords />
              </ProtectedRoute>
            } />

            <Route path="/m/payment-requests-management" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <MobilePaymentRequestsManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/payment-request" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <MobileLayout><PaymentRequest /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/payment-requests-list" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <MobilePaymentRequestsList />
              </ProtectedRoute>
            } />
            
            <Route path="/m/dashboard" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <MobileDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/m/financial-overview" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'viewer']}>
                <MobileFinancialOverview />
              </ProtectedRoute>
            } />

            <Route path="/m/finance/reconciliation" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <MobileLayout><FinanceReconciliation /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/finance/payment-invoice" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <MobileLayout><PaymentInvoice /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/finance/payment-invoice/:requestId" element={
              <ProtectedRoute requiredRoles={['admin', 'finance']}>
                <MobileLayout><PaymentInvoiceDetail /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/settings/permissions" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <MobilePermissionManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/integrated" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <MobileIntegratedUserManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/audit-logs" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <MobileAuditLogs />
              </ProtectedRoute>
            } />

            <Route path="/m/contracts" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business']}>
                <MobileContractManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/notifications" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <MobileNotifications />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/users" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <MobileUserManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/contract-permissions" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <MobileContractPermission />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/role-templates" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <MobileRoleTemplate />
              </ProtectedRoute>
            } />

            <Route path="/m/settings" element={
              <ProtectedRoute requiredRoles={['admin', 'finance', 'business', 'viewer']}>
                <MobileSettings />
              </ProtectedRoute>
            } />

            {/* --- 404路由 - 排除静态文件扩展名 --- */}
            <Route path="*" element={<NotFoundWithStaticFileCheck />} />
          </Routes>
          </MobileRedirect>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
