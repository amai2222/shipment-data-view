/**
 * 路由级代码分割 - 懒加载组件
 * 根据代码优化建议报告 - 性能优化 4.2
 */

import { lazy } from 'react';

// ============================================
// 主要页面懒加载
// ============================================

// 首页和仪表盘
export const Home = lazy(() => import('./pages/Home'));
export const TransportOverview = lazy(() => import('./pages/TransportOverview'));

// 项目相关
export const Projects = lazy(() => import('./pages/Projects'));
export const ProjectsOverview = lazy(() => import('./pages/ProjectsOverview'));
export const ProjectDashboard = lazy(() => import('./pages/ProjectDashboard'));

// 业务管理
export const BusinessEntry = lazy(() => import('./pages/BusinessEntry'));
export const ScaleRecords = lazy(() => import('./pages/ScaleRecords'));

// 财务管理
export const PaymentRequest = lazy(() => import('./pages/PaymentRequest'));
export const InvoiceRequest = lazy(() => import('./pages/InvoiceRequest'));
export const FinanceReconciliation = lazy(() => import('./pages/FinanceReconciliation'));
export const PaymentInvoice = lazy(() => import('./pages/PaymentInvoice'));
export const PaymentInvoiceDetail = lazy(() => import('./pages/PaymentInvoiceDetail'));
export const PaymentRequestsList = lazy(() => import('./pages/PaymentRequestsList'));
export const FinancialOverview = lazy(() => import('./pages/FinancialOverview'));

// 基础数据管理
export const Drivers = lazy(() => import('./pages/Drivers'));
export const Locations = lazy(() => import('./pages/Locations'));
export const Partners = lazy(() => import('./pages/Partners'));
export const FleetManagement = lazy(() => import('./pages/FleetManagement'));

// 内部车辆管理 - PC端
export const VehicleManagement = lazy(() => import('./pages/internal/VehicleManagement'));
export const DriverManagement = lazy(() => import('./pages/internal/DriverManagement'));
export const ExpenseApproval = lazy(() => import('./pages/internal/ExpenseApproval'));
export const IncomeInput = lazy(() => import('./pages/internal/IncomeInput'));
export const PendingTasks = lazy(() => import('./pages/internal/PendingTasks'));
export const CertificateManagement = lazy(() => import('./pages/internal/CertificateManagement'));
export const VehicleStatus = lazy(() => import('./pages/internal/VehicleStatus'));
export const VehicleLedger = lazy(() => import('./pages/internal/VehicleLedger'));
export const ExpenseCategories = lazy(() => import('./pages/internal/ExpenseCategories'));
export const VehicleBalance = lazy(() => import('./pages/internal/VehicleBalance'));
export const FinancialReports = lazy(() => import('./pages/internal/FinancialReports'));

// 合同管理
export const ContractManagement = lazy(() => import('./pages/ContractManagement'));

// 数据维护
export const WaybillMaintenance = lazy(() => import('./pages/DataMaintenance/WaybillMaintenance'));

// 设置页面
export const UserManagement = lazy(() => import('./pages/Settings/UserManagement'));
export const PermissionConfig = lazy(() => import('./pages/Settings/PermissionConfig'));
export const ContractPermission = lazy(() => import('./pages/Settings/ContractPermission'));
export const RoleTemplate = lazy(() => import('./pages/Settings/RoleTemplate'));
export const AuditLogs = lazy(() => import('./pages/Settings/AuditLogs'));

// 权限管理
export const IntegratedUserManagement = lazy(() => import('./pages/IntegratedUserManagement'));

// ============================================
// 移动端页面懒加载
// ============================================

export const MobileHomeNew = lazy(() => import('./pages/mobile/MobileHomeNew'));
export const MobileHome = lazy(() => import('./pages/mobile/MobileHome'));
export const MobileDashboard = lazy(() => import('./pages/mobile/MobileDashboard'));
export const MobileBusinessEntry = lazy(() => import('./pages/mobile/MobileBusinessEntry'));
export const MobileBusinessEntryForm = lazy(() => import('./pages/mobile/MobileBusinessEntryForm'));
export const MobileProjectOverview = lazy(() => import('./pages/mobile/MobileProjectOverview'));
export const MobileProjectDetail = lazy(() => import('./pages/mobile/MobileProjectDetail'));
export const MobileProjectRecords = lazy(() => import('./pages/mobile/MobileProjectRecords'));
export const MobileProjectDashboardDetail = lazy(() => import('./pages/mobile/MobileProjectDashboardDetail'));
export const MobileWaybillDetail = lazy(() => import('./pages/mobile/MobileWaybillDetail'));
export const MobileDrivers = lazy(() => import('./pages/mobile/MobileDrivers'));
export const MobileLocations = lazy(() => import('./pages/mobile/MobileLocations'));
export const MobilePartners = lazy(() => import('./pages/mobile/MobilePartners'));
export const MobileScaleRecords = lazy(() => import('./pages/mobile/MobileScaleRecords'));
export const MobilePaymentRequestsList = lazy(() => import('./pages/mobile/MobilePaymentRequestsList'));
export const MobilePaymentRequestsManagement = lazy(() => import('./pages/mobile/MobilePaymentRequestsManagement'));
export const MobileFinancialOverview = lazy(() => import('./pages/mobile/MobileFinancialOverview'));
export const MobileContractManagement = lazy(() => import('./pages/mobile/MobileContractManagement'));
export const MobileIntegratedUserManagement = lazy(() => import('./pages/mobile/MobileIntegratedUserManagement'));
export const MobileAuditLogs = lazy(() => import('./pages/mobile/MobileAuditLogs'));
export const MobileNotifications = lazy(() => import('./pages/mobile/MobileNotifications'));
export const MobileSettings = lazy(() => import('./pages/mobile/MobileSettings'));
export const MobileUserManagement = lazy(() => import('./pages/mobile/MobileUserManagement'));
export const MobileContractPermission = lazy(() => import('./pages/mobile/MobileContractPermission'));
export const MobileRoleTemplate = lazy(() => import('./pages/mobile/MobileRoleTemplate'));
export const MobilePermissionManagement = lazy(() => import('./pages/mobile/MobilePermissionManagement'));

// ============================================
// 内部车辆管理 - 移动端页面懒加载 ⭐ 新增
// ============================================

// 内部司机端
export const MobileMyExpenses = lazy(() => import('./pages/mobile/internal/MobileMyExpenses'));
export const MobileDriverSalary = lazy(() => import('./pages/mobile/internal/MobileDriverSalary'));
export const MobileMyVehicles = lazy(() => import('./pages/mobile/internal/MobileMyVehicles'));
export const MobileSalaryRecords = lazy(() => import('./pages/mobile/internal/MobileSalaryRecords'));
export const MobileQuickEntry = lazy(() => import('./pages/mobile/internal/MobileQuickEntry'));

// 车队长端
export const MobileFleetDashboard = lazy(() => import('./pages/mobile/internal/MobileFleetDashboard'));
export const MobileExpenseReview = lazy(() => import('./pages/mobile/internal/MobileExpenseReview'));
export const MobileVehicleManagement = lazy(() => import('./pages/mobile/internal/MobileVehicleManagement'));
export const MobileDriverRouteConfig = lazy(() => import('./pages/mobile/internal/MobileDriverRouteConfig'));
export const MobileDispatchOrder = lazy(() => import('./pages/mobile/internal/MobileDispatchOrder'));

// 司机端
export const MobileMyDispatches = lazy(() => import('./pages/mobile/internal/MobileMyDispatches'));
export const MobileMyWaybills = lazy(() => import('./pages/mobile/internal/MobileMyWaybills'));

// ============================================
// 加载组件
// ============================================

export { default as LoadingSpinner } from './components/ui/loading-spinner';
