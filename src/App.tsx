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
import { GlobalErrorHandler } from "./components/GlobalErrorHandler";

// --- 懒加载页面组件导入 ---
import { Suspense } from 'react';

// 从 App.lazy.tsx 统一导入所有懒加载组件
import {
  LoadingSpinner,
  // PC端页面
  Home,
  TransportOverview,
  Projects,
  ProjectsOverview,
  ProjectDashboard,
  Drivers,
  Locations,
  Partners,
  FleetManagement,
  // 内部车辆管理 - PC端
  VehicleManagement,
  DriverManagement,
  ExpenseApproval,
  ExpenseWriteoff,
  IncomeInput,
  PendingTasks,
  CertificateManagement,
  VehicleStatus,
  VehicleLedger,
  ExpenseCategories,
  VehicleBalance,
  FinancialReports,
  BusinessEntry,
  ScaleRecords,
  PaymentRequest,
  InvoiceRequest,
  FinanceReconciliation,
  PaymentInvoice,
  PaymentInvoiceDetail,
  PaymentRequestsList,
  FinancialOverview,
  ContractManagement,
  WaybillMaintenance,
  UserManagement,
  PermissionConfig,
  ContractPermission,
  RoleTemplate,
  AuditLogs,
  IntegratedUserManagement,
  // 移动端页面
  MobileHomeNew,
  MobileHome,
  MobileDashboard,
  MobileBusinessEntry,
  MobileBusinessEntryForm,
  MobileProjectOverview,
  MobileProjectDetail,
  MobileProjectRecords,
  MobileProjectDashboardDetail,
  MobileWaybillDetail,
  MobileDrivers,
  MobileLocations,
  MobilePartners,
  MobileScaleRecords,
  MobilePaymentRequestsList,
  MobilePaymentRequestsManagement,
  MobileFinancialOverview,
  MobileContractManagement,
  MobileIntegratedUserManagement,
  MobileAuditLogs,
  MobileNotifications,
  MobileSettings,
  MobileUserManagement,
  MobileContractPermission,
  MobileRoleTemplate,
  MobilePermissionManagement,
  // 内部车辆管理 - 移动端
  MobileMyExpenses,
  MobileDriverSalary,
  MobileMyVehicles,
  MobileSalaryRecords,
  MobileQuickEntry,
  // 车队长端
  MobileFleetDashboard,
  MobileExpenseReview,
  MobileVehicleManagement,
  MobileDriverRouteConfig,
  MobileDispatchOrder,
  MobileFleetManagerConfig,
  // 司机端
  MobileMyDispatches,
  MobileMyWaybills,
  MobileExpenseWriteoff,
  MobileInternalWaybillDetail
} from "./App.lazy";

// 懒加载公共组件（非懒加载）
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import NotFoundWithStaticFileCheck from "./components/NotFoundWithStaticFileCheck";
import Unauthorized from "./pages/Unauthorized";

// 需要单独懒加载的组件（App.lazy.tsx 中没有）
import { lazy } from 'react';
const EnhancedLocations = lazy(() => import("./pages/EnhancedLocations"));
const PartnerHierarchyManagement = lazy(() => import("./pages/PartnerHierarchyManagement"));
const InvoiceRequestManagement = lazy(() => import("./pages/InvoiceRequestManagement"));
const PermissionManagement = lazy(() => import("./pages/Settings/PermissionManagement"));
const MenuConfig = lazy(() => import("./pages/Settings/MenuConfig"));
const SystemBackup = lazy(() => import("./pages/Settings/SystemBackup"));
const DriverUserAssociation = lazy(() => import("./pages/Settings/DriverUserAssociation"));
const VehicleAssignment = lazy(() => import("./pages/internal/VehicleAssignment"));
const TaskDispatch = lazy(() => import("./pages/internal/TaskDispatch"));
const InternalDailyWaybills = lazy(() => import("./pages/internal/InternalDailyWaybills"));
const FleetManagerConfig = lazy(() => import("./pages/internal/FleetManagerConfig"));
import RoleBasedRedirect from "./components/RoleBasedRedirect";
import LazyLoadErrorBoundary from "./components/LazyLoadErrorBoundary";
const MobileProfile = lazy(() => import("./pages/mobile/MobileProfile"));
const MobileSecurity = lazy(() => import("./pages/mobile/MobileSecurity"));
const ShipperDashboard = lazy(() => import("./pages/ShipperDashboard"));
const PaymentAudit = lazy(() => import("./pages/PaymentAudit"));
const InvoiceAudit = lazy(() => import("./pages/InvoiceAudit"));
const EnhancedWaybillMaintenance = lazy(() => import("./pages/DataMaintenance/EnhancedWaybillMaintenance"));
const MobileInvoiceRequestManagement = lazy(() => import("./pages/mobile/MobileInvoiceRequestManagement"));
const MobileShipperDashboard = lazy(() => import("./pages/mobile/MobileShipperDashboard"));
const MobileProjectDashboard = lazy(() => import("./pages/mobile/MobileProjectDashboard"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* 全局错误处理器：捕获所有未处理的错误 */}
    <GlobalErrorHandler>
      {/* 关键改动：将 BrowserRouter 包裹在 AuthProvider 外层 */}
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AutoMenuSync />
            <MobileRedirect>
            <LazyLoadErrorBoundary>
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen">
                  <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground">页面加载中...</p>
                  </div>
                </div>
              }>
                <Routes>
            {/* --- 公开路由 --- */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* --- 受保护的路由 --- */}
            <Route path="/" element={
              <ProtectedRoute>
                <RoleBasedRedirect />
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

            <Route path="/fleet-management" element={
              <ProtectedRoute requiredPermission="maintenance.fleet">
                <AppLayout><FleetManagement /></AppLayout>
              </ProtectedRoute>
            } />

            {/* --- 内部车辆管理 - PC端路由 ⭐ --- */}
            <Route path="/internal/vehicles" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <AppLayout><VehicleManagement /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/drivers" element={
              <ProtectedRoute requiredPermission="internal.driver_management">
                <AppLayout><DriverManagement /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/expense-approval" element={
              <ProtectedRoute requiredPermission="internal.expense_review">
                <AppLayout><ExpenseApproval /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/expense-writeoff" element={
              <ProtectedRoute requiredPermission="internal.expense_review">
                <AppLayout><ExpenseWriteoff /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/income-input" element={
              <ProtectedRoute requiredPermission="internal.income_input">
                <AppLayout><IncomeInput /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/pending-tasks" element={
              <ProtectedRoute requiredPermission="internal.pending_tasks">
                <AppLayout><PendingTasks /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/internal/vehicle-assignment" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <AppLayout><VehicleAssignment /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/internal/task-dispatch" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <AppLayout><TaskDispatch /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/internal/daily-waybills" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <AppLayout><InternalDailyWaybills /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/internal/fleet-config" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <AppLayout><FleetManagerConfig /></AppLayout>
              </ProtectedRoute>
            } />
            
            <Route path="/internal/driver-association" element={
              <ProtectedRoute requiredPermission="internal.manage_drivers">
                <AppLayout><DriverUserAssociation /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/certificates" element={
              <ProtectedRoute requiredPermission="internal.certificates">
                <AppLayout><CertificateManagement /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/vehicle-status" element={
              <ProtectedRoute requiredPermission="internal.vehicle_status">
                <AppLayout><VehicleStatus /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/ledger" element={
              <ProtectedRoute requiredPermission="internal.ledger">
                <AppLayout><VehicleLedger /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/expenses" element={
              <ProtectedRoute requiredPermission="internal.expenses">
                <AppLayout><ExpenseCategories /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/balance" element={
              <ProtectedRoute requiredPermission="internal.balance">
                <AppLayout><VehicleBalance /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="/internal/reports" element={
              <ProtectedRoute requiredPermission="internal.reports">
                <AppLayout><FinancialReports /></AppLayout>
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
            
            <Route path="/settings/driver-association" element={
              <ProtectedRoute requiredPermission="settings.manage_roles">
                <AppLayout><DriverUserAssociation /></AppLayout>
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
            
            <Route path="/m/profile" element={
              <ProtectedRoute>
                <MobileProfile />
              </ProtectedRoute>
            } />
            
            <Route path="/m/security" element={
              <ProtectedRoute>
                <MobileSecurity />
              </ProtectedRoute>
            } />

            {/* --- 内部车辆管理 - 移动端路由 ⭐ 新增 --- */}
            <Route path="/m/internal/my-expenses" element={
              <ProtectedRoute requiredPermission="internal.my_expenses">
                <MobileMyExpenses />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/driver-salary" element={
              <ProtectedRoute requiredPermission="internal.driver_salary">
                <MobileDriverSalary />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/my-vehicles" element={
              <ProtectedRoute requiredPermission="internal.my_expenses">
                <MobileMyVehicles />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/salary-records" element={
              <ProtectedRoute requiredPermission="internal.salary_records">
                <MobileSalaryRecords />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/quick-entry" element={
              <ProtectedRoute requiredPermission="internal.my_expenses">
                <MobileQuickEntry />
              </ProtectedRoute>
            } />

            {/* --- 车队长移动端路由 ⭐ --- */}
            <Route path="/m/internal/fleet-dashboard" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <MobileFleetDashboard />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/vehicles" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <MobileVehicleManagement />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/expense-review" element={
              <ProtectedRoute requiredPermission="internal.expense_review">
                <MobileExpenseReview />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/driver-route-config" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <MobileDriverRouteConfig />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/dispatch-order" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <MobileDispatchOrder />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/fleet-config" element={
              <ProtectedRoute requiredPermission="internal.vehicles">
                <MobileFleetManagerConfig />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/my-dispatches" element={
              <ProtectedRoute requiredPermission="internal.my_expenses">
                <MobileMyDispatches />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/my-waybills" element={
              <ProtectedRoute requiredPermission="internal.my_expenses">
                <MobileMyWaybills />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/waybill/:waybillId" element={
              <ProtectedRoute requiredPermission="internal.my_expenses">
                <MobileInternalWaybillDetail />
              </ProtectedRoute>
            } />

            <Route path="/m/internal/expense-writeoff" element={
              <ProtectedRoute requiredPermission="internal.my_expenses">
                <MobileExpenseWriteoff />
              </ProtectedRoute>
            } />

            {/* --- 404路由 - 排除静态文件扩展名 --- */}
            <Route path="*" element={<NotFoundWithStaticFileCheck />} />
                </Routes>
              </Suspense>
            </LazyLoadErrorBoundary>
          </MobileRedirect>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
    </GlobalErrorHandler>
  </QueryClientProvider>
);

export default App;
