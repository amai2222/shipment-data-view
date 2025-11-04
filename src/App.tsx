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
import { AutoMenuSync } from "./components/AutoMenuSync";

// --- 懒加载页面组件导入 ---
import { Suspense, lazy } from 'react';
import { LoadingSpinner } from "./App.lazy";

// 懒加载公共组件
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import NotFoundWithStaticFileCheck from "./components/NotFoundWithStaticFileCheck";

// 使用懒加载导入主要页面
const Home = lazy(() => import("./pages/Home"));
const TransportOverview = lazy(() => import("./pages/TransportOverview"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectsOverview = lazy(() => import("./pages/ProjectsOverview"));
const ProjectDashboard = lazy(() => import("./pages/ProjectDashboard"));
const Drivers = lazy(() => import("./pages/Drivers"));
const Locations = lazy(() => import("./pages/Locations"));
const EnhancedLocations = lazy(() => import("./pages/EnhancedLocations"));
const Partners = lazy(() => import("./pages/Partners"));
const PartnerHierarchyManagement = lazy(() => import("./pages/PartnerHierarchyManagement"));
const BusinessEntry = lazy(() => import("./pages/BusinessEntry"));
const PaymentRequest = lazy(() => import("./pages/PaymentRequest"));
const InvoiceRequest = lazy(() => import("./pages/InvoiceRequest"));
const InvoiceRequestManagement = lazy(() => import("./pages/InvoiceRequestManagement"));
const FinancialOverview = lazy(() => import("./pages/FinancialOverview"));
const FinanceReconciliation = lazy(() => import("./pages/FinanceReconciliation"));
const PaymentInvoice = lazy(() => import("./pages/PaymentInvoice"));
const PaymentInvoiceDetail = lazy(() => import("./pages/PaymentInvoiceDetail"));
const PaymentRequestsList = lazy(() => import("./pages/PaymentRequestsList"));
const UserManagement = lazy(() => import("./pages/Settings/UserManagement"));
const PermissionConfig = lazy(() => import("./pages/Settings/PermissionConfig"));
const ContractPermission = lazy(() => import("./pages/Settings/ContractPermission"));
const RoleTemplate = lazy(() => import("./pages/Settings/RoleTemplate"));
const PermissionManagement = lazy(() => import("./pages/Settings/PermissionManagement"));
const IntegratedUserManagement = lazy(() => import("./pages/IntegratedUserManagement"));
const AuditLogs = lazy(() => import("./pages/Settings/AuditLogs"));
const MenuConfig = lazy(() => import("./pages/Settings/MenuConfig"));
const SystemBackup = lazy(() => import("./pages/Settings/SystemBackup"));
const ScaleRecords = lazy(() => import("./pages/ScaleRecords"));
const ContractManagement = lazy(() => import("./pages/ContractManagement"));
const WaybillMaintenance = lazy(() => import("./pages/DataMaintenance/WaybillMaintenance"));
const EnhancedWaybillMaintenance = lazy(() => import("./pages/DataMaintenance/EnhancedWaybillMaintenance"));
const ShipperDashboard = lazy(() => import("./pages/ShipperDashboard"));
const PaymentAudit = lazy(() => import("./pages/PaymentAudit"));
const InvoiceAudit = lazy(() => import("./pages/InvoiceAudit"));

// 移动端页面懒加载
const MobileHomeNew = lazy(() => import("./pages/mobile/MobileHomeNew"));
const MobileHome = lazy(() => import("./pages/mobile/MobileHome"));
const MobileBusinessEntry = lazy(() => import("./pages/mobile/MobileBusinessEntry"));
const MobileBusinessEntryForm = lazy(() => import("./pages/mobile/MobileBusinessEntryForm"));
const MobileProjectDashboard = lazy(() => import("./pages/mobile/MobileProjectDashboard"));
const MobileScaleRecords = lazy(() => import("./pages/mobile/MobileScaleRecords"));
const MobileDrivers = lazy(() => import("./pages/mobile/MobileDrivers"));
const MobileLocations = lazy(() => import("./pages/mobile/MobileLocations"));
const MobilePartners = lazy(() => import("./pages/mobile/MobilePartners"));
const MobileDashboard = lazy(() => import("./pages/mobile/MobileDashboard"));
const MobileFinancialOverview = lazy(() => import("./pages/mobile/MobileFinancialOverview"));
const MobilePaymentRequestsList = lazy(() => import("./pages/mobile/MobilePaymentRequestsList"));
const MobilePermissionManagement = lazy(() => import("./pages/mobile/MobilePermissionManagement"));
const MobilePaymentRequestsManagement = lazy(() => import("./pages/mobile/MobilePaymentRequestsManagement"));
const MobileInvoiceRequestManagement = lazy(() => import("./pages/mobile/MobileInvoiceRequestManagement"));
const MobileContractManagement = lazy(() => import("./pages/mobile/MobileContractManagement"));
const MobileProjectOverview = lazy(() => import("./pages/mobile/MobileProjectOverview"));
const MobileProjectDetail = lazy(() => import("./pages/mobile/MobileProjectDetail"));
const MobileProjectRecords = lazy(() => import("./pages/mobile/MobileProjectRecords"));
const MobileWaybillDetail = lazy(() => import("./pages/mobile/MobileWaybillDetail"));
const MobileProjectDashboardDetail = lazy(() => import("./pages/mobile/MobileProjectDashboardDetail"));
const MobileShipperDashboard = lazy(() => import("./pages/mobile/MobileShipperDashboard"));
const MobileIntegratedUserManagement = lazy(() => import("./pages/mobile/MobileIntegratedUserManagement"));
const MobileAuditLogs = lazy(() => import("./pages/mobile/MobileAuditLogs"));
const MobileNotifications = lazy(() => import("./pages/mobile/MobileNotifications"));
const MobileSettings = lazy(() => import("./pages/mobile/MobileSettings"));
const MobileUserManagement = lazy(() => import("./pages/mobile/MobileUserManagement"));
const MobileContractPermission = lazy(() => import("./pages/mobile/MobileContractPermission"));
const MobileRoleTemplate = lazy(() => import("./pages/mobile/MobileRoleTemplate"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* 关键改动：将 BrowserRouter 包裹在 AuthProvider 外层 */}
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AutoMenuSync />
          <MobileRedirect>
              <Routes>
            {/* --- 公开路由 --- */}
            <Route path="/auth" element={<Auth />} />
            
            {/* --- 受保护的路由 --- */}
            <Route path="/" element={
              <ProtectedRoute requiredPermission="dashboard.transport">
                <AppLayout><TransportOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/home" element={
              <ProtectedRoute requiredPermission="dashboard.transport">
                <AppLayout><TransportOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard/transport" element={
              <ProtectedRoute requiredPermission="dashboard.transport">
                <AppLayout><TransportOverview /></AppLayout>
              </ProtectedRoute>
            } />

            {/* ★★★ 2. 添加新的“项目看板”概览页路由 ★★★ */}
            <Route path="/dashboard/project" element={
              <ProtectedRoute requiredPermission="dashboard.project">
                <AppLayout><ProjectsOverview /></AppLayout>
              </ProtectedRoute>
            } />

            {/* ★★★ 3. 添加新的“项目详情”下钻页路由 ★★★ */}
            <Route path="/project/:projectId" element={
              <ProtectedRoute requiredPermission="dashboard.project">
                <AppLayout><ProjectDashboard /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard/financial" element={
              <ProtectedRoute requiredPermission="dashboard.financial">
                <AppLayout><FinancialOverview /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* 您原有的“项目管理”路由，保持不变 */}
            <Route path="/projects" element={
              <ProtectedRoute requiredPermission="maintenance.projects">
                <AppLayout><Projects /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* ... 其他路由保持不变 ... */}
            <Route path="/drivers" element={
              <ProtectedRoute requiredPermission="maintenance.drivers">
                <AppLayout><Drivers /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/locations" element={
              <ProtectedRoute requiredPermission="maintenance.locations">
                <AppLayout><Locations /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* 增强版地点管理 - 支持批量地理编码 */}
            <Route path="/locations-enhanced" element={
              <ProtectedRoute requiredPermission="maintenance.locations_enhanced">
                <AppLayout><EnhancedLocations /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/partners" element={
              <ProtectedRoute requiredPermission="maintenance.partners">
                <AppLayout><Partners /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/partners/hierarchy" element={
              <ProtectedRoute requiredPermission="maintenance.partners">
                <AppLayout><PartnerHierarchyManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* 货主看板 - 所有角色均可访问 */}
            <Route path="/dashboard/shipper" element={
              <ProtectedRoute requiredPermission="dashboard.shipper">
                <AppLayout><ShipperDashboard /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/business-entry" element={
              <ProtectedRoute requiredPermission="business.entry">
                <AppLayout><BusinessEntry /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/scale-records" element={
              <ProtectedRoute requiredPermission="business.scale">
                <AppLayout><ScaleRecords /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/payment-request" element={
              <ProtectedRoute requiredPermission="business.payment_request">
                <AppLayout><PaymentRequest /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/invoice-request" element={
              <ProtectedRoute requiredPermission="business.invoice_request">
                <AppLayout><InvoiceRequest /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/invoice-request-management" element={
              <ProtectedRoute requiredPermission="finance.invoice_request_management">
                <AppLayout><InvoiceRequestManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/payment-requests-list" element={
              <ProtectedRoute requiredPermission="finance.payment_requests">
                <AppLayout><PaymentRequestsList /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/finance/reconciliation" element={
              <ProtectedRoute requiredPermission="finance.reconciliation">
                <AppLayout><FinanceReconciliation /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/finance/payment-invoice" element={
              <ProtectedRoute requiredPermission="finance.payment_invoice">
                <AppLayout><PaymentInvoice /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/finance/payment-invoice/:requestId" element={
              <ProtectedRoute requiredPermission="finance.payment_invoice">
                <AppLayout><PaymentInvoiceDetail /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* 审核管理路由 */}
            <Route path="/audit/payment" element={
              <ProtectedRoute requiredPermission="audit.payment">
                <AppLayout><PaymentAudit /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/audit/invoice" element={
              <ProtectedRoute requiredPermission="audit.invoice">
                <AppLayout><InvoiceAudit /></AppLayout>
              </ProtectedRoute>
            } />
            
            
            <Route path="/settings/users" element={
              <ProtectedRoute requiredPermission="settings.users">
                <AppLayout><UserManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/permissions" element={
              <ProtectedRoute requiredPermission="settings.permissions">
                <AppLayout><PermissionConfig /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/contract-permissions" element={
              <ProtectedRoute requiredPermission="settings.contract_permissions">
                <AppLayout><ContractPermission /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/role-templates" element={
              <ProtectedRoute requiredPermission="settings.role_templates">
                <AppLayout><RoleTemplate /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/integrated" element={
              <ProtectedRoute requiredPermission="settings.integrated">
                <AppLayout><IntegratedUserManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/audit-logs" element={
              <ProtectedRoute requiredPermission="settings.audit_logs">
                <AppLayout><AuditLogs /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/menu-config" element={
              <ProtectedRoute requiredPermission="settings.menu_config">
                <AppLayout><MenuConfig /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings/backup" element={
              <ProtectedRoute requiredPermission="settings.backup">
                <AppLayout><SystemBackup /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/contracts" element={
              <ProtectedRoute requiredPermission="contracts.list">
                <AppLayout><ContractManagement /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* 运单维护 - 原有页面（默认） */}
            <Route path="/data-maintenance/waybill" element={
              <ProtectedRoute requiredPermission="data_maintenance.waybill">
                <AppLayout><WaybillMaintenance /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* 运单维护 - 增强版本（可选） */}
            <Route path="/data-maintenance/waybill-enhanced" element={
              <ProtectedRoute requiredPermission="data_maintenance.waybill_enhanced">
                <AppLayout><EnhancedWaybillMaintenance /></AppLayout>
              </ProtectedRoute>
            } />
            
            {/* --- 移动端路由 --- */}
            <Route path="/m/" element={
              <ProtectedRoute requiredPermission="dashboard.transport">
                <MobileHomeNew />
              </ProtectedRoute>
            } />
            
            <Route path="/m/business-entry" element={
              <ProtectedRoute requiredPermission="business.entry">
                <MobileLayout><MobileBusinessEntry /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/business-entry/new" element={
              <ProtectedRoute requiredPermission="business.entry">
                <MobileLayout><MobileBusinessEntryForm /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/business-entry/edit/:id" element={
              <ProtectedRoute requiredPermission="business.entry">
                <MobileLayout><MobileBusinessEntryForm /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/dashboard/project" element={
              <ProtectedRoute requiredPermission="dashboard.project">
                <MobileProjectOverview />
              </ProtectedRoute>
            } />


            <Route path="/m/dashboard/financial" element={
              <ProtectedRoute requiredPermission="dashboard.financial">
                <MobileLayout><FinancialOverview /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/projects" element={
              <ProtectedRoute requiredPermission="maintenance.projects">
                <MobileProjectOverview />
              </ProtectedRoute>
            } />

            <Route path="/m/projects/detail/:projectId" element={
              <ProtectedRoute requiredPermission="maintenance.projects">
                <MobileProjectDetail />
              </ProtectedRoute>
            } />

            <Route path="/m/projects/detail/:projectId/records" element={
              <ProtectedRoute requiredPermission="maintenance.projects">
                <MobileProjectRecords />
              </ProtectedRoute>
            } />

            <Route path="/m/projects/detail/:projectId/dashboard" element={
              <ProtectedRoute requiredPermission="maintenance.projects">
                <MobileProjectDashboardDetail />
              </ProtectedRoute>
            } />

            <Route path="/m/waybill/:waybillId" element={
              <ProtectedRoute requiredPermission="business.entry">
                <MobileWaybillDetail />
              </ProtectedRoute>
            } />

            <Route path="/m/drivers" element={
              <ProtectedRoute requiredPermission="maintenance.drivers">
                <MobileDrivers />
              </ProtectedRoute>
            } />

            <Route path="/m/locations" element={
              <ProtectedRoute requiredPermission="maintenance.locations">
                <MobileLocations />
              </ProtectedRoute>
            } />

            <Route path="/m/partners" element={
              <ProtectedRoute requiredPermission="maintenance.partners">
                <MobilePartners />
              </ProtectedRoute>
            } />

            <Route path="/m/partners/hierarchy" element={
              <ProtectedRoute requiredPermission="maintenance.partners">
                <MobileLayout><PartnerHierarchyManagement /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/locations-enhanced" element={
              <ProtectedRoute requiredPermission="maintenance.locations_enhanced">
                <MobileLayout><EnhancedLocations /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/scale-records" element={
              <ProtectedRoute requiredPermission="business.scale">
                <MobileScaleRecords />
              </ProtectedRoute>
            } />

            <Route path="/m/payment-requests-management" element={
              <ProtectedRoute requiredPermission="finance.payment_requests">
                <MobilePaymentRequestsManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/invoice-request-management" element={
              <ProtectedRoute requiredPermission="finance.invoice_request_management">
                <MobileLayout><InvoiceRequestManagement /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/payment-request" element={
              <ProtectedRoute requiredPermission="business.payment_request">
                <MobileLayout><PaymentRequest /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/payment-requests-list" element={
              <ProtectedRoute requiredPermission="finance.payment_requests">
                <MobilePaymentRequestsList />
              </ProtectedRoute>
            } />
            
            <Route path="/m/dashboard" element={
              <ProtectedRoute requiredPermission="dashboard.transport">
                <MobileDashboard />
              </ProtectedRoute>
            } />
            
            {/* 移动端货主看板 - 所有角色均可访问 */}
            <Route path="/m/dashboard/shipper" element={
              <ProtectedRoute requiredPermission="dashboard.shipper">
                <MobileShipperDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/m/financial-overview" element={
              <ProtectedRoute requiredPermission="dashboard.financial">
                <MobileFinancialOverview />
              </ProtectedRoute>
            } />

            <Route path="/m/finance/reconciliation" element={
              <ProtectedRoute requiredPermission="finance.reconciliation">
                <MobileLayout><FinanceReconciliation /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/finance/payment-invoice" element={
              <ProtectedRoute requiredPermission="finance.payment_invoice">
                <MobileLayout><PaymentInvoice /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/finance/payment-invoice/:requestId" element={
              <ProtectedRoute requiredPermission="finance.payment_invoice">
                <MobileLayout><PaymentInvoiceDetail /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/settings/permissions" element={
              <ProtectedRoute requiredPermission="settings.permissions">
                <MobileLayout><PermissionConfig /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/data-maintenance/waybill" element={
              <ProtectedRoute requiredPermission="data_maintenance.waybill">
                <MobileLayout><WaybillMaintenance /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/data-maintenance/waybill-enhanced" element={
              <ProtectedRoute requiredPermission="data_maintenance.waybill_enhanced">
                <MobileLayout><EnhancedWaybillMaintenance /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/settings/integrated" element={
              <ProtectedRoute requiredPermission="settings.integrated">
                <MobileIntegratedUserManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/audit-logs" element={
              <ProtectedRoute requiredPermission="settings.audit_logs">
                <MobileAuditLogs />
              </ProtectedRoute>
            } />
            
            {/* 移动端审核管理路由 */}
            <Route path="/m/audit/payment" element={
              <ProtectedRoute requiredPermission="audit.payment">
                <MobileLayout><PaymentAudit /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/audit/invoice" element={
              <ProtectedRoute requiredPermission="audit.invoice">
                <MobileLayout><InvoiceAudit /></MobileLayout>
              </ProtectedRoute>
            } />

            <Route path="/m/contracts" element={
              <ProtectedRoute requiredPermission="contracts.list">
                <MobileContractManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/notifications" element={
              <ProtectedRoute requiredPermission="dashboard.transport">
                <MobileNotifications />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/users" element={
              <ProtectedRoute requiredPermission="settings.users">
                <MobileUserManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/contract-permissions" element={
              <ProtectedRoute requiredPermission="settings.contract_permissions">
                <MobileContractPermission />
              </ProtectedRoute>
            } />

            <Route path="/m/settings/role-templates" element={
              <ProtectedRoute requiredPermission="settings.role_templates">
                <MobileRoleTemplate />
              </ProtectedRoute>
            } />

            <Route path="/m/settings" element={
              <ProtectedRoute requiredPermission="settings">
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
