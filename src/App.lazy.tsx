/**
 * 路由级代码分割 - 懒加载组件
 * 根据代码优化建议报告 - 性能优化 4.2
 * 
 * 懒加载开关：
 * - 开发环境：可配置启用/禁用（在 src/utils/conditionalLazy.ts 中设置）
 * - 生产环境：始终启用（优化性能）
 */

import { lazy, ComponentType, LazyExoticComponent, ComponentPropsWithoutRef, createElement } from 'react';

// 🔧 懒加载配置开关
const USE_LAZY_IN_DEV = true; // ✅ 开发环境也使用懒加载，提升加载速度

// 条件懒加载函数类型定义
type ConditionalLazy = <T extends ComponentType<Record<string, unknown>>>(
  importFn: () => Promise<{ default: T }>
) => LazyExoticComponent<T>;

// 条件懒加载函数
const conditionalLazy: ConditionalLazy = (import.meta.env.DEV && !USE_LAZY_IN_DEV
  ? <T extends ComponentType<Record<string, unknown>>>(importFn: () => Promise<{ default: T }>) => {
      // 开发环境且禁用懒加载：立即同步导入，不使用 lazy()
      // 这样可以完全避免懒加载相关的错误
      console.warn(
        '%c⚠️ 懒加载已禁用（开发模式）',
        'color: #f56565; font-weight: bold; font-size: 14px;'
      );
      console.warn('所有模块将在启动时立即加载，便于快速查看错误');
      
      // 创建一个立即解析的 Promise，然后同步返回组件
      // 注意：这会导致所有模块在启动时加载，但可以避免懒加载错误
      let resolvedComponent: T | null = null;
      let loadingPromise: Promise<T> | null = null;
      
      // 立即开始加载
      loadingPromise = importFn().then(module => {
        resolvedComponent = module.default;
        return module.default;
      }).catch(err => {
        console.error('立即导入组件失败:', err);
        throw err;
      });
      
      // 返回一个包装组件，在组件渲染时等待加载完成
      return ((props: ComponentPropsWithoutRef<T>) => {
        if (!resolvedComponent && loadingPromise) {
          // 如果还没加载完成，抛出 Promise 让 Suspense 处理
          throw loadingPromise;
        }
        if (!resolvedComponent) {
          return <div>加载中...</div>;
        }
        const Component = resolvedComponent as T;
        // 使用 createElement 来避免 JSX 类型检查问题
        return createElement(Component, props);
      }) as LazyExoticComponent<T>;
    }
  : lazy) as ConditionalLazy; // 生产环境或开发环境启用懒加载：使用标准lazy

// 开发模式状态提示
if (import.meta.env.DEV) {
  console.log(
    `%c🔧 懒加载配置：${USE_LAZY_IN_DEV ? '✅ 已启用' : '❌ 已禁用'}`,
    `color: ${USE_LAZY_IN_DEV ? '#48bb78' : '#f56565'}; font-weight: bold; font-size: 12px;`
  );
}

// ============================================
// 主要页面懒加载
// ============================================

// 首页和仪表盘
export const Home = conditionalLazy(() => import('./pages/Home'));
export const TransportOverview = conditionalLazy(() => import('./pages/TransportOverview'));

// 项目相关
export const Projects = conditionalLazy(() => import('./pages/Projects'));
export const ProjectsOverview = conditionalLazy(() => import('./pages/ProjectsOverview'));
export const ProjectDashboard = conditionalLazy(() => import('./pages/ProjectDashboard'));

// 业务管理
export const BusinessEntry = conditionalLazy(() => import('./pages/BusinessEntry'));
export const ScaleRecords = conditionalLazy(() => import('./pages/ScaleRecords'));

// 财务管理
export const PaymentRequest = conditionalLazy(() => import('./pages/PaymentRequest'));
export const InvoiceRequest = conditionalLazy(() => import('./pages/InvoiceRequest'));
export const FinanceReconciliation = conditionalLazy(() => import('./pages/FinanceReconciliation'));
export const PaymentInvoice = conditionalLazy(() => import('./pages/PaymentInvoice'));
export const PaymentInvoiceDetail = conditionalLazy(() => import('./pages/PaymentInvoiceDetail'));
export const PaymentRequestsList = conditionalLazy(() => import('./pages/PaymentRequestsList'));
export const FinancialOverview = conditionalLazy(() => import('./pages/FinancialOverview'));
export const ReceiptReport = conditionalLazy(() => import('./pages/ReceiptReport'));
export const ChainProfit = conditionalLazy(() => import('./pages/ChainProfit'));

// 基础数据管理
export const Drivers = conditionalLazy(() => import('./pages/Drivers'));
export const Locations = conditionalLazy(() => import('./pages/Locations'));
export const Partners = conditionalLazy(() => import('./pages/Partners'));
export const PartnerBalance = conditionalLazy(() => import('./pages/PartnerBalance'));
export const FleetManagement = conditionalLazy(() => import('./pages/FleetManagement'));

// 内部车辆管理 - PC端
export const VehicleManagement = conditionalLazy(() => import('./pages/internal/VehicleManagement'));
export const DriverManagement = conditionalLazy(() => import('./pages/internal/DriverManagement'));
export const ExpenseApproval = conditionalLazy(() => import('./pages/internal/ExpenseApproval'));
export const ExpenseWriteoff = conditionalLazy(() => import('./pages/internal/ExpenseWriteoff'));
export const IncomeInput = conditionalLazy(() => import('./pages/internal/IncomeInput'));
export const PendingTasks = conditionalLazy(() => import('./pages/internal/PendingTasks'));
export const CertificateManagement = conditionalLazy(() => import('./pages/internal/CertificateManagement'));
export const VehicleStatus = conditionalLazy(() => import('./pages/internal/VehicleStatus'));
export const VehicleLedger = conditionalLazy(() => import('./pages/internal/VehicleLedger'));
export const ExpenseCategories = conditionalLazy(() => import('./pages/internal/ExpenseCategories'));
export const VehicleBalance = conditionalLazy(() => import('./pages/internal/VehicleBalance'));
export const FinancialReports = conditionalLazy(() => import('./pages/internal/FinancialReports'));

// 合同管理
export const ContractManagement = conditionalLazy(() => import('./pages/ContractManagement'));
export const VehicleTracking = conditionalLazy(() => import('./pages/VehicleTracking'));

// 数据维护
export const WaybillMaintenance = conditionalLazy(() => import('./pages/DataMaintenance/WaybillMaintenance'));

// 设置页面
export const UserManagement = conditionalLazy(() => import('./pages/Settings/UserManagement'));
export const PermissionConfig = conditionalLazy(() => import('./pages/Settings/PermissionConfig'));
export const ContractPermission = conditionalLazy(() => import('./pages/Settings/ContractPermission'));
export const RoleTemplate = conditionalLazy(() => import('./pages/Settings/RoleTemplate'));
export const AuditLogs = conditionalLazy(() => import('./pages/Settings/AuditLogs'));

// 权限管理
export const IntegratedUserManagement = conditionalLazy(() => import('./pages/IntegratedUserManagement'));

// ============================================
// 移动端页面懒加载
// ============================================

export const MobileHomeNew = conditionalLazy(() => import('./pages/mobile/MobileHomeNew'));
export const MobileHome = conditionalLazy(() => import('./pages/mobile/MobileHome'));
export const MobileDashboard = conditionalLazy(() => import('./pages/mobile/MobileDashboard'));
export const MobileBusinessEntry = conditionalLazy(() => import('./pages/mobile/MobileBusinessEntry'));
export const MobileBusinessEntryForm = conditionalLazy(() => import('./pages/mobile/MobileBusinessEntryForm'));
export const MobileProjectOverview = conditionalLazy(() => import('./pages/mobile/MobileProjectOverview'));
export const MobileProjectDetail = conditionalLazy(() => import('./pages/mobile/MobileProjectDetail'));
export const MobileProjectRecords = conditionalLazy(() => import('./pages/mobile/MobileProjectRecords'));
export const MobileProjectDashboardDetail = conditionalLazy(() => import('./pages/mobile/MobileProjectDashboardDetail'));
export const MobileWaybillDetail = conditionalLazy(() => import('./pages/mobile/MobileWaybillDetail'));
export const MobileDrivers = conditionalLazy(() => import('./pages/mobile/MobileDrivers'));
export const MobileLocations = conditionalLazy(() => import('./pages/mobile/MobileLocations'));
export const MobilePartners = conditionalLazy(() => import('./pages/mobile/MobilePartners'));
export const MobileScaleRecords = conditionalLazy(() => import('./pages/mobile/MobileScaleRecords'));
export const MobilePaymentRequestsList = conditionalLazy(() => import('./pages/mobile/MobilePaymentRequestsList'));
export const MobilePaymentRequestsManagement = conditionalLazy(() => import('./pages/mobile/MobilePaymentRequestsManagement'));
export const MobileFinancialOverview = conditionalLazy(() => import('./pages/mobile/MobileFinancialOverview'));
export const MobileContractManagement = conditionalLazy(() => import('./pages/mobile/MobileContractManagement'));
export const MobileIntegratedUserManagement = conditionalLazy(() => import('./pages/mobile/MobileIntegratedUserManagement'));
export const MobileAuditLogs = conditionalLazy(() => import('./pages/mobile/MobileAuditLogs'));
export const MobileNotifications = conditionalLazy(() => import('./pages/mobile/MobileNotifications'));
export const MobileSettings = conditionalLazy(() => import('./pages/mobile/MobileSettings'));
export const MobileUserManagement = conditionalLazy(() => import('./pages/mobile/MobileUserManagement'));
export const MobileContractPermission = conditionalLazy(() => import('./pages/mobile/MobileContractPermission'));
export const MobileRoleTemplate = conditionalLazy(() => import('./pages/mobile/MobileRoleTemplate'));
export const MobilePermissionManagement = conditionalLazy(() => import('./pages/mobile/MobilePermissionManagement'));

// ============================================
// 内部车辆管理 - 移动端页面懒加载 ⭐ 新增
// ============================================

// 内部司机端
export const MobileMyExpenses = conditionalLazy(() => import('./pages/mobile/internal/MobileMyExpenses'));
export const MobileMyExpensesPage = conditionalLazy(() => import('./pages/mobile/internal/MobileMyExpensesPage'));
export const MobileDriverSalary = conditionalLazy(() => import('./pages/mobile/internal/MobileDriverSalary'));
export const MobileMyVehicles = conditionalLazy(() => import('./pages/mobile/internal/MobileMyVehicles'));
export const MobileVehicleProfile = conditionalLazy(() => import('./pages/mobile/internal/MobileVehicleProfile'));
export const MobileVehicleChangeApplication = conditionalLazy(() => import('./pages/mobile/internal/MobileVehicleChangeApplication'));
export const MobileVehicleExpenses = conditionalLazy(() => import('./pages/mobile/internal/MobileVehicleExpenses'));
export const MobileSalaryRecords = conditionalLazy(() => import('./pages/mobile/internal/MobileSalaryRecords'));
export const MobileQuickEntry = conditionalLazy(() => import('./pages/mobile/internal/MobileQuickEntry'));
export const MobileDriverSettings = conditionalLazy(() => import('./pages/mobile/internal/MobileDriverSettings'));
export const MobileDriverSecurity = conditionalLazy(() => import('./pages/mobile/internal/MobileDriverSecurity'));

// 车队长端
export const MobileFleetDashboard = conditionalLazy(() => import('./pages/mobile/internal/MobileFleetDashboard'));
export const MobileExpenseReview = conditionalLazy(() => import('./pages/mobile/internal/MobileExpenseReview'));
export const MobileVehicleManagement = conditionalLazy(() => import('./pages/mobile/internal/MobileVehicleManagement'));
export const MobileDriverRouteConfig = conditionalLazy(() => import('./pages/mobile/internal/MobileDriverRouteConfig'));
export const MobileDispatchOrder = conditionalLazy(() => import('./pages/mobile/internal/MobileDispatchOrder'));
export const MobileFleetManagerConfig = conditionalLazy(() => import('./pages/mobile/internal/MobileFleetManagerConfig'));
export const MobileAddVehicle = conditionalLazy(() => import('./pages/mobile/internal/MobileAddVehicle'));
export const MobileAddDriver = conditionalLazy(() => import('./pages/mobile/internal/MobileAddDriver'));
export const MobileVehicleDriverDetail = conditionalLazy(() => import('./pages/mobile/internal/MobileVehicleDriverDetail'));
export const MobileDailyWaybills = conditionalLazy(() => import('./pages/mobile/internal/MobileDailyWaybills'));
export const MobileDriverProfile = conditionalLazy(() => import('./pages/mobile/internal/MobileDriverProfile'));
export const MobileVehicleAssignment = conditionalLazy(() => import('./pages/mobile/internal/MobileVehicleAssignment'));

// 司机端
export const MobileMyDispatches = conditionalLazy(() => import('./pages/mobile/internal/MobileMyDispatches'));
export const MobileMyWaybills = conditionalLazy(() => import('./pages/mobile/internal/MobileMyWaybills'));
export const MobileExpenseWriteoff = conditionalLazy(() => import('./pages/mobile/internal/MobileExpenseWriteoff'));
export const MobileInternalWaybillDetail = conditionalLazy(() => import('./pages/mobile/internal/MobileInternalWaybillDetail'));

// ============================================
// 加载组件
// ============================================

export { default as LoadingSpinner } from './components/ui/loading-spinner';
