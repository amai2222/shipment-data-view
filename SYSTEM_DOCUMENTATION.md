# 中科物流跟踪系统 - 完整技术文档

## 📋 目录
1. [系统概述](#系统概述)
2. [技术架构](#技术架构)
3. [数据库设计](#数据库设计)
4. [后端函数清单](#后端函数清单)
5. [前端架构](#前端架构)
6. [权限管理系统](#权限管理系统)
7. [移动端设计](#移动端设计)
8. [API接口文档](#API接口文档)
9. [部署和维护](#部署和维护)
10. [故障排除](#故障排除)

---

## 系统概述

### 🎯 项目简介
中科物流跟踪系统是一个全栈物流管理平台，支持运单管理、项目看板、财务管理、权限控制等核心功能。系统采用现代化技术栈，提供桌面端和移动端双重体验。

### 🏗️ 核心功能模块
- **运单管理**: 运单录入、编辑、查询、批量导入
- **项目看板**: 项目概览、数据统计、趋势分析
- **财务管理**: 付款申请、财务对账、发票管理
- **权限管理**: 用户管理、角色配置、权限分配
- **数据维护**: 数据导入导出、批量操作
- **移动端**: 响应式设计、触控优化

### 📊 系统特性
- **实时数据**: WebSocket实时更新
- **权限控制**: 细粒度权限管理
- **响应式设计**: 桌面端和移动端适配
- **数据安全**: RLS (Row Level Security) 保护
- **高性能**: React Query缓存优化
- **现代化UI**: Tailwind CSS + shadcn/ui

---

## 技术架构

### 🔧 前端技术栈
```
React 18.2.0           - 前端框架
TypeScript 5.2.2       - 类型安全
Vite 5.0.8             - 构建工具
React Router 6.20.1    - 路由管理
React Query 4.36.1     - 数据状态管理
Tailwind CSS 3.3.6     - CSS框架
shadcn/ui              - UI组件库
Recharts 2.12.7        - 图表库
Lucide React           - 图标库
```

### 🗄️ 后端技术栈
```
Supabase               - 后端即服务
PostgreSQL 15          - 数据库
PostgREST              - API自动生成
Supabase Auth          - 身份认证
Supabase Storage       - 文件存储
Row Level Security     - 数据安全
```

### 🏛️ 系统架构图
```
┌─────────────────────────────────────────────────────────────┐
│                     前端应用层                                │
├─────────────────┬─────────────────┬─────────────────────────┤
│   桌面端应用      │    移动端应用     │      管理后台           │
│   React SPA     │   Responsive    │   Permission Mgmt      │
└─────────────────┴─────────────────┴─────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                     API网关层                                │
├─────────────────┬─────────────────┬─────────────────────────┤
│   PostgREST     │   Supabase Auth │   Supabase Storage     │
│   RESTful API   │   JWT Token     │   File Upload          │
└─────────────────┴─────────────────┴─────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                    数据库层                                   │
├─────────────────┬─────────────────┬─────────────────────────┤
│   PostgreSQL    │   RLS Policies  │   Database Functions   │
│   Core Tables   │   Security      │   Business Logic       │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## 数据库设计

### 📊 核心数据表

#### 1. 项目管理
```sql
-- 项目表
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    manager TEXT,
    finance_manager TEXT,
    start_date DATE,
    end_date DATE,
    project_status TEXT DEFAULT '进行中',
    loading_address TEXT,
    unloading_address TEXT,
    planned_total_tons DECIMAL(10,2),
    billing_type_id INTEGER DEFAULT 1,
    auto_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. 物流记录
```sql
-- 物流记录表
CREATE TABLE logistics_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_number TEXT UNIQUE,
    project_id UUID REFERENCES projects(id),
    project_name TEXT,
    driver_name TEXT NOT NULL,
    license_plate TEXT,
    driver_phone TEXT,
    loading_date TIMESTAMP WITH TIME ZONE,
    unloading_date TIMESTAMP WITH TIME ZONE,
    loading_location TEXT,
    unloading_location TEXT,
    loading_weight DECIMAL(10,2),
    unloading_weight DECIMAL(10,2),
    transport_type TEXT DEFAULT '实际运输',
    billing_type_id INTEGER DEFAULT 1,
    driver_payable_cost DECIMAL(10,2),
    current_cost DECIMAL(10,2),
    extra_cost DECIMAL(10,2) DEFAULT 0,
    cargo_type TEXT,
    remarks TEXT,
    external_tracking_numbers JSONB DEFAULT '[]'::jsonb,
    other_platform_names TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);
```

#### 3. 用户权限
```sql
-- 用户配置表
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT,
    role TEXT DEFAULT 'viewer',
    department TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户权限表
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    permission_type TEXT NOT NULL,
    permission_name TEXT NOT NULL,
    has_permission BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, permission_type, permission_name)
);
```

#### 4. 合同管理
```sql
-- 合同表
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number TEXT UNIQUE NOT NULL,
    contract_name TEXT NOT NULL,
    contract_type TEXT DEFAULT 'standard',
    party_a TEXT NOT NULL,
    party_b TEXT NOT NULL,
    signing_date DATE,
    effective_date DATE,
    expiry_date DATE,
    contract_amount DECIMAL(15,2),
    status TEXT DEFAULT 'draft',
    file_path TEXT,
    created_by_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 🔐 行级安全策略 (RLS)

#### 基础安全策略
```sql
-- 启用RLS
ALTER TABLE logistics_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 物流记录访问策略
CREATE POLICY "Users can view logistics records based on permissions" 
ON logistics_records FOR SELECT 
USING (
    auth.uid() IN (
        SELECT user_id FROM user_permissions 
        WHERE permission_type = 'menu' 
        AND permission_name = 'business_entry' 
        AND has_permission = true
    )
);

-- 项目访问策略
CREATE POLICY "Users can view projects based on permissions" 
ON projects FOR SELECT 
USING (
    auth.uid() IN (
        SELECT user_id FROM user_permissions 
        WHERE permission_type = 'menu' 
        AND permission_name = 'projects' 
        AND has_permission = true
    )
);
```

---

## 后端函数清单

### 📋 Supabase RPC 函数完整列表

#### 1. 数据统计函数
```sql
-- 仪表盘统计数据
get_dashboard_stats_with_billing_types(
    p_start_date TEXT,
    p_end_date TEXT, 
    p_project_id UUID
) RETURNS JSON;

-- 项目看板数据
get_project_dashboard_data(
    p_selected_project_id UUID,
    p_report_date TEXT
) RETURNS JSON;

-- 所有项目概览数据
get_all_projects_overview_data(
    p_selected_project_ids UUID[],
    p_report_date TEXT
) RETURNS JSON;
```

#### 2. 物流记录管理
```sql
-- 获取物流记录汇总
get_logistics_summary_and_records_enhanced(
    p_start_date TEXT,
    p_end_date TEXT,
    p_project_name TEXT,
    p_driver_name TEXT,
    p_license_plate TEXT,
    p_driver_phone TEXT,
    p_other_platform_name TEXT,
    p_waybill_numbers TEXT,
    p_has_scale_record BOOLEAN,
    p_limit INTEGER,
    p_offset INTEGER
) RETURNS JSON;

-- 添加物流记录
add_logistics_record_with_costs(
    p_project_id UUID,
    p_project_name TEXT,
    p_driver_name TEXT,
    p_license_plate TEXT,
    p_driver_phone TEXT,
    p_loading_date TEXT,
    p_unloading_date TEXT,
    p_loading_location TEXT,
    p_unloading_location TEXT,
    p_loading_weight DECIMAL,
    p_unloading_weight DECIMAL,
    p_transport_type TEXT,
    p_current_cost DECIMAL,
    p_extra_cost DECIMAL,
    p_chain_id UUID,
    p_remarks TEXT
) RETURNS VOID;

-- 更新物流记录
update_logistics_record_via_recalc(
    p_record_id UUID,
    p_project_id UUID,
    p_project_name TEXT,
    p_driver_name TEXT,
    p_license_plate TEXT,
    p_driver_phone TEXT,
    p_loading_date TEXT,
    p_unloading_date TEXT,
    p_loading_location TEXT,
    p_unloading_location TEXT,
    p_loading_weight DECIMAL,
    p_unloading_weight DECIMAL,
    p_transport_type TEXT,
    p_current_cost DECIMAL,
    p_extra_cost DECIMAL,
    p_chain_id UUID,
    p_remarks TEXT
) RETURNS VOID;
```

#### 3. 批量导入函数
```sql
-- 预览导入数据
preview_import_with_duplicates_check(
    p_records JSON
) RETURNS JSON;

-- 带更新模式的预览
preview_import_with_update_mode(
    p_records JSON
) RETURNS JSON;

-- 批量导入物流记录
batch_import_logistics_records(
    p_records JSON
) RETURNS JSON;

-- 带更新模式的批量导入
batch_import_logistics_records_with_update(
    p_records JSON
) RETURNS JSON;
```

#### 4. 财务管理函数
```sql
-- 获取付款申请数据
get_payment_request_data(
    p_start_date TEXT,
    p_end_date TEXT,
    p_project_name TEXT,
    p_partner_name TEXT,
    p_limit INTEGER,
    p_offset INTEGER
) RETURNS JSON;

-- 处理付款申请
process_payment_application(
    p_record_ids UUID[],
    p_application_amount DECIMAL,
    p_application_reason TEXT
) RETURNS VOID;

-- 财务统计
get_total_receivables() RETURNS DECIMAL;
get_monthly_receivables() RETURNS DECIMAL;
get_pending_payments() RETURNS DECIMAL;
get_pending_invoicing() RETURNS DECIMAL;
get_monthly_trends() RETURNS JSON;
get_partner_ranking() RETURNS JSON;
```

#### 5. 权限管理函数
```sql
-- 检查枚举值
check_enum_value(
    p_enum_name TEXT,
    p_value TEXT
) RETURNS BOOLEAN;

-- 添加枚举值
add_enum_value(
    p_enum_name TEXT,
    p_value TEXT
) RETURNS VOID;

-- 应用标准RLS策略
apply_standard_rls_policies(
    p_table_name TEXT,
    p_user_id_column TEXT
) RETURNS VOID;
```

#### 6. 数据查询优化函数
```sql
-- 获取司机分页数据
get_drivers_paginated(
    p_search_term TEXT,
    p_limit INTEGER,
    p_offset INTEGER
) RETURNS JSON;

-- 获取筛选的物流记录
get_filtered_logistics_records_fixed(
    p_start_date TEXT,
    p_end_date TEXT,
    p_project_name TEXT,
    p_driver_name TEXT,
    p_license_plate TEXT,
    p_limit INTEGER,
    p_offset INTEGER
) RETURNS JSON;

-- 获取所有筛选记录ID
get_all_filtered_record_ids(
    p_start_date TEXT,
    p_end_date TEXT,
    p_project_name TEXT,
    p_driver_name TEXT,
    p_license_plate TEXT,
    p_driver_phone TEXT,
    p_other_platform_name TEXT,
    p_waybill_numbers TEXT,
    p_has_scale_record BOOLEAN
) RETURNS JSON;
```

### 🔄 数据库触发器

#### 1. 自动编号触发器
```sql
-- 物流记录自动编号
CREATE OR REPLACE FUNCTION generate_auto_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.auto_number IS NULL THEN
        NEW.auto_number := 'WB' || TO_CHAR(NOW(), 'YYYYMMDD') || 
                          LPAD(nextval('logistics_records_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_auto_number
    BEFORE INSERT ON logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION generate_auto_number();
```

#### 2. 更新时间触发器
```sql
-- 自动更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用到所有需要的表
CREATE TRIGGER trigger_update_logistics_records_updated_at
    BEFORE UPDATE ON logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

#### 3. 权限同步触发器
```sql
-- 用户权限变更同步
CREATE OR REPLACE FUNCTION sync_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
    -- 同步权限变更到相关表
    IF TG_OP = 'UPDATE' THEN
        -- 记录权限变更日志
        INSERT INTO permission_change_logs (
            user_id, 
            permission_type, 
            permission_name, 
            old_value, 
            new_value, 
            changed_at
        ) VALUES (
            NEW.user_id,
            NEW.permission_type,
            NEW.permission_name,
            OLD.has_permission,
            NEW.has_permission,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 前端架构

### 🏗️ 目录结构
```
src/
├── components/           # 可复用组件
│   ├── ui/              # 基础UI组件
│   ├── mobile/          # 移动端专用组件
│   ├── contracts/       # 合同管理组件
│   └── permissions/     # 权限管理组件
├── pages/               # 页面组件
│   ├── mobile/          # 移动端页面
│   ├── Settings/        # 设置页面
│   └── DataMaintenance/ # 数据维护页面
├── hooks/               # 自定义Hooks
├── services/            # 业务服务层
├── utils/               # 工具函数
├── types/               # TypeScript类型定义
├── contexts/            # React Context
└── integrations/        # 第三方集成
    └── supabase/        # Supabase配置
```

### 🎯 核心组件架构

#### 1. 路由设计
```typescript
// 桌面端路由
/                           -> 首页仪表盘
/projects                   -> 项目管理
/business-entry             -> 业务录入
/scale-records              -> 磅单记录
/data-maintenance           -> 数据维护
/financial-overview         -> 财务概览
/payment-requests           -> 付款申请
/settings/*                 -> 设置页面

// 移动端路由
/m/                         -> 移动端首页
/m/projects                 -> 项目概览
/m/projects/detail/:id      -> 项目详情
/m/projects/detail/:id/records    -> 项目运单列表
/m/projects/detail/:id/dashboard  -> 项目详细看板
/m/waybill/:id             -> 运单详情
/m/business-entry          -> 移动端业务录入
/m/contracts               -> 移动端合同管理
```

#### 2. 状态管理
```typescript
// React Query 配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5分钟缓存
      cacheTime: 10 * 60 * 1000,     // 10分钟保留
      refetchOnWindowFocus: false,    // 窗口聚焦不刷新
      retry: 1,                       // 失败重试1次
    },
  },
});

// 自定义Hook示例
export function useProjectDashboard(projectId: string, reportDate: Date) {
  return useQuery({
    queryKey: ['projectDashboard', projectId, format(reportDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_project_dashboard_data', {
        p_selected_project_id: projectId,
        p_report_date: format(reportDate, 'yyyy-MM-dd')
      });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}
```

#### 3. 权限控制组件
```typescript
// 权限保护路由
function ProtectedRoute({ 
  children, 
  requiredRoles = [], 
  requiredPermissions = [] 
}: ProtectedRouteProps) {
  const { user, userProfile, permissions } = useAuth();
  
  if (!user) return <Navigate to="/login" />;
  
  if (requiredRoles.length > 0 && !requiredRoles.includes(userProfile?.role)) {
    return <Navigate to="/unauthorized" />;
  }
  
  if (requiredPermissions.length > 0) {
    const hasPermission = requiredPermissions.every(permission => 
      permissions?.[permission] === true
    );
    if (!hasPermission) return <Navigate to="/unauthorized" />;
  }
  
  return <>{children}</>;
}

// 权限按钮组件
function PermissionButton({ 
  permission, 
  children, 
  ...props 
}: PermissionButtonProps) {
  const { permissions } = usePermissions();
  
  if (!permissions?.[permission]) return null;
  
  return <Button {...props}>{children}</Button>;
}
```

### 📱 移动端特殊设计

#### 1. 响应式布局
```typescript
// 移动端布局组件
export function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">物流管理系统</h1>
          <UserMenu />
        </div>
      </header>
      
      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
      
      {/* 底部导航 */}
      <BottomNavigation />
    </div>
  );
}
```

#### 2. 触控优化
```css
/* 移动端触控优化 */
.mobile-button {
  min-height: 44px;           /* 最小触控区域 */
  min-width: 44px;
  touch-action: manipulation;  /* 禁用双击缩放 */
}

.mobile-card {
  padding: 16px;
  border-radius: 16px;        /* 大圆角更现代 */
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.mobile-input {
  font-size: 16px;            /* 防止iOS缩放 */
  padding: 12px 16px;
}
```

---

## 权限管理系统

### 🔐 权限架构设计

#### 1. 权限类型
```typescript
// 权限类型定义
interface Permission {
  id: string;
  user_id: string;
  permission_type: 'menu' | 'function' | 'project' | 'data';
  permission_name: string;
  has_permission: boolean;
}

// 权限类型说明
enum PermissionType {
  MENU = 'menu',           // 菜单访问权限
  FUNCTION = 'function',   // 功能操作权限  
  PROJECT = 'project',     // 项目数据权限
  DATA = 'data'           // 数据级别权限
}
```

#### 2. 角色系统
```typescript
// 预定义角色
enum UserRole {
  ADMIN = 'admin',         // 系统管理员
  MANAGER = 'manager',     // 部门经理
  FINANCE = 'finance',     // 财务人员
  BUSINESS = 'business',   // 业务人员
  OPERATOR = 'operator',   // 操作员
  VIEWER = 'viewer'        // 查看者
}

// 角色权限映射
const rolePermissions = {
  admin: {
    menu: ['*'],           // 所有菜单
    function: ['*'],       // 所有功能
    project: ['*'],        // 所有项目
    data: ['*']           // 所有数据
  },
  manager: {
    menu: ['projects', 'business_entry', 'financial_overview'],
    function: ['create', 'edit', 'approve'],
    project: ['assigned'],  // 分配的项目
    data: ['department']   // 部门数据
  },
  // ... 其他角色配置
};
```

#### 3. 权限检查Hook
```typescript
export function usePermissions() {
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['userPermissions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user?.id);
      
      // 转换为易用的对象格式
      return data?.reduce((acc, perm) => {
        const key = `${perm.permission_type}_${perm.permission_name}`;
        acc[key] = perm.has_permission;
        return acc;
      }, {} as Record<string, boolean>);
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10分钟缓存
  });

  return {
    permissions,
    isLoading,
    hasPermission: (type: string, name: string) => 
      permissions?.[`${type}_${name}`] === true,
    hasMenuAccess: (menuName: string) => 
      permissions?.[`menu_${menuName}`] === true,
    hasFunctionAccess: (functionName: string) => 
      permissions?.[`function_${functionName}`] === true,
  };
}
```

### 🛡️ 数据安全策略

#### 1. 行级安全(RLS)实现
```sql
-- 基于用户权限的RLS策略
CREATE POLICY "logistics_records_select_policy" 
ON logistics_records FOR SELECT 
USING (
  -- 管理员可以看所有数据
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
  OR
  -- 有菜单权限的用户可以看数据
  EXISTS (
    SELECT 1 FROM user_permissions 
    WHERE user_id = auth.uid() 
    AND permission_type = 'menu' 
    AND permission_name = 'business_entry' 
    AND has_permission = true
  )
  OR  
  -- 有项目权限的用户可以看对应项目数据
  EXISTS (
    SELECT 1 FROM user_permissions 
    WHERE user_id = auth.uid() 
    AND permission_type = 'project' 
    AND permission_name = project_id::text 
    AND has_permission = true
  )
);
```

#### 2. API权限中间件
```typescript
// 权限检查中间件
export function withPermission(
  requiredPermission: string,
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    const user = await getUser(req);
    const hasPermission = await checkUserPermission(user.id, requiredPermission);
    
    if (!hasPermission) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    return handler(req, res);
  };
}
```

---

## 移动端设计

### 📱 设计原则

#### 1. 移动优先设计
- **触控友好**: 最小44px触控区域
- **简化导航**: 底部标签页 + 侧滑菜单
- **内容优先**: 减少装饰性元素
- **加载优化**: 懒加载 + 骨架屏

#### 2. 响应式断点
```css
/* Tailwind CSS 断点配置 */
sm: '640px',    /* 小屏幕 */
md: '768px',    /* 平板 */
lg: '1024px',   /* 小桌面 */
xl: '1280px',   /* 桌面 */
2xl: '1536px'   /* 大桌面 */
```

#### 3. 移动端特殊组件

##### MobileCard 组件
```typescript
interface MobileCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  badge?: { text: string; className?: string };
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MobileCard({ 
  children, 
  onClick, 
  badge, 
  onView, 
  onEdit, 
  onDelete 
}: MobileCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 border border-gray-100">
      {badge && (
        <div className="flex justify-end mb-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
            {badge.text}
          </span>
        </div>
      )}
      
      <div onClick={onClick} className="cursor-pointer">
        {children}
      </div>
      
      {(onView || onEdit || onDelete) && (
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
          {onView && (
            <Button variant="outline" size="sm" onClick={onView}>
              <Eye className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

##### 移动端导航
```typescript
// 底部导航组件
const navigationItems = [
  { name: '首页', href: '/m/', icon: Home },
  { name: '项目', href: '/m/projects', icon: BarChart3 },
  { name: '录入', href: '/m/business-entry', icon: Plus },
  { name: '合同', href: '/m/contracts', icon: FileText },
  { name: '我的', href: '/m/profile', icon: User },
];

export function BottomNavigation() {
  const location = useLocation();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around py-2">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                isActive 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### 🎨 移动端UI优化

#### 1. 现代化视觉设计
```css
/* 渐变色彩系统 */
.gradient-blue {
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
}

.gradient-green {
  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
}

.gradient-orange {
  background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
}

/* 阴影层次 */
.shadow-soft {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.shadow-medium {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.shadow-strong {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 毛玻璃效果 */
.backdrop-blur-soft {
  backdrop-filter: blur(8px);
  background: rgba(255, 255, 255, 0.8);
}
```

#### 2. 动画和交互
```css
/* 平滑过渡 */
.transition-smooth {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 点击反馈 */
.tap-highlight {
  -webkit-tap-highlight-color: rgba(59, 130, 246, 0.1);
}

/* 加载动画 */
@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.animate-pulse-soft {
  animation: pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

## API接口文档

### 📡 RESTful API 端点

#### 1. 项目管理API
```typescript
// GET /rest/v1/projects - 获取项目列表
interface GetProjectsResponse {
  data: Project[];
  count: number;
}

// POST /rest/v1/projects - 创建项目
interface CreateProjectRequest {
  name: string;
  manager: string;
  start_date: string;
  end_date: string;
  loading_address: string;
  unloading_address: string;
  planned_total_tons: number;
  billing_type_id: number;
}

// PUT /rest/v1/projects/:id - 更新项目
interface UpdateProjectRequest extends Partial<CreateProjectRequest> {}

// DELETE /rest/v1/projects/:id - 删除项目
```

#### 2. 物流记录API
```typescript
// GET /rest/v1/logistics_records - 获取物流记录
interface GetLogisticsRecordsParams {
  project_id?: string;
  driver_name?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

// POST /rest/v1/logistics_records - 创建物流记录
interface CreateLogisticsRecordRequest {
  project_id: string;
  driver_name: string;
  license_plate: string;
  loading_date: string;
  loading_location: string;
  unloading_location: string;
  loading_weight: number;
  transport_type: string;
  // ... 其他字段
}
```

### 🔧 RPC函数调用

#### 1. 统计数据RPC
```typescript
// 调用仪表盘统计
const { data, error } = await supabase.rpc('get_dashboard_stats_with_billing_types', {
  p_start_date: '2024-01-01',
  p_end_date: '2024-12-31',
  p_project_id: null
});

// 返回数据结构
interface DashboardStats {
  overview: {
    totalRecords: number;
    totalWeight: number;
    totalCost: number;
    actualTransportCount: number;
    returnCount: number;
  };
  dailyTransportStats: Array<{
    date: string;
    actualTransport: number;
    returns: number;
  }>;
  dailyCostStats: Array<{
    date: string;
    totalCost: number;
  }>;
}
```

#### 2. 批量操作RPC
```typescript
// 批量导入物流记录
const { data, error } = await supabase.rpc('batch_import_logistics_records', {
  p_records: [
    {
      project_name: "项目A",
      driver_name: "张三",
      license_plate: "京A12345",
      loading_date: "2024-01-15",
      loading_weight: 45.5,
      // ... 其他字段
    }
    // ... 更多记录
  ]
});

// 返回结果
interface BatchImportResult {
  success_count: number;
  error_count: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
  created_records: string[]; // 创建的记录ID列表
}
```

### 🔒 API安全

#### 1. JWT Token验证
```typescript
// 请求头设置
const headers = {
  'Authorization': `Bearer ${session.access_token}`,
  'apikey': process.env.SUPABASE_ANON_KEY,
  'Content-Type': 'application/json'
};
```

#### 2. RLS策略应用
```sql
-- API请求自动应用RLS策略
-- 用户只能访问有权限的数据
-- 无需在应用层额外检查权限
```

---

## 部署和维护

### 🚀 部署架构

#### 1. 生产环境部署
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    image: shipment-tracker:latest
    ports:
      - "80:80"
      - "443:443"
    environment:
      - VITE_SUPABASE_URL=${SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    restart: unless-stopped

  # Supabase 托管服务
  # 数据库、API、认证由 Supabase 提供
```

#### 2. CI/CD 流程
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build application
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          
      - name: Deploy to server
        run: |
          # 部署到服务器的脚本
          rsync -avz dist/ user@server:/var/www/html/
```

### 📊 监控和日志

#### 1. 应用监控
```typescript
// 性能监控
export function usePerformanceMonitor() {
  useEffect(() => {
    // 页面加载时间监控
    const navigationEntries = performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      const loadTime = navigationEntries[0].loadEventEnd - navigationEntries[0].loadEventStart;
      console.log(`Page load time: ${loadTime}ms`);
    }
    
    // 错误监控
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      // 发送错误到监控服务
    });
    
    // 未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  }, []);
}
```

#### 2. 数据库监控
```sql
-- 慢查询监控
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC;

-- 连接数监控
SELECT count(*) as connections, state 
FROM pg_stat_activity 
GROUP BY state;

-- 表大小监控
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 🔧 维护任务

#### 1. 定期备份
```bash
#!/bin/bash
# backup.sh - 数据库备份脚本

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="postgres"

# 创建备份
pg_dump -h db.supabase.co -U postgres -d $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# 压缩备份文件
gzip $BACKUP_DIR/backup_$DATE.sql

# 删除7天前的备份
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

#### 2. 数据清理
```sql
-- 清理过期的会话数据
DELETE FROM auth.sessions 
WHERE expires_at < NOW() - INTERVAL '7 days';

-- 清理过期的日志
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 更新统计信息
ANALYZE;

-- 重建索引
REINDEX DATABASE postgres;
```

#### 3. 性能优化
```sql
-- 添加缺失的索引
CREATE INDEX CONCURRENTLY idx_logistics_records_loading_date 
ON logistics_records(loading_date);

CREATE INDEX CONCURRENTLY idx_logistics_records_project_driver 
ON logistics_records(project_id, driver_name);

-- 分区大表
CREATE TABLE logistics_records_2024 
PARTITION OF logistics_records 
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

---

## 故障排除

### 🚨 常见问题和解决方案

#### 1. 数据库连接问题
```typescript
// 连接池配置
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// 连接错误处理
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
    // 重新初始化连接
    window.location.reload();
  }
});
```

#### 2. 权限问题排查
```sql
-- 检查用户权限
SELECT 
  up.full_name,
  up.role,
  perm.permission_type,
  perm.permission_name,
  perm.has_permission
FROM user_profiles up
LEFT JOIN user_permissions perm ON up.id = perm.user_id
WHERE up.id = 'user-uuid-here'
ORDER BY perm.permission_type, perm.permission_name;

-- 检查RLS策略
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public';
```

#### 3. 性能问题诊断
```sql
-- 查看慢查询
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  stddev_exec_time,
  rows
FROM pg_stat_statements 
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 查看表统计信息
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;
```

#### 4. 前端错误处理
```typescript
// 全局错误边界
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // 发送错误到监控服务
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">出现错误</h2>
            <p className="text-gray-600 mb-4">应用程序遇到了一个错误</p>
            <Button onClick={() => window.location.reload()}>
              刷新页面
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 🔍 调试工具

#### 1. 开发环境调试
```typescript
// React Query Devtools
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <>
      <Router>
        {/* 应用内容 */}
      </Router>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </>
  );
}

// Supabase 调试
if (process.env.NODE_ENV === 'development') {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event, session);
  });
}
```

#### 2. 生产环境监控
```typescript
// 错误收集
function setupErrorTracking() {
  // 捕获未处理的错误
  window.addEventListener('error', (event) => {
    sendErrorToService({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  });

  // 捕获Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    sendErrorToService({
      message: 'Unhandled Promise Rejection',
      reason: event.reason,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
  });
}
```

---

## 📝 更新日志

### Version 2.0.0 (2024-01-15)
- ✅ 重新设计移动端首页和项目看板
- ✅ 统一路由格式为 `/m/projects/detail/:id`
- ✅ 修复 `toLocaleString` 空值处理问题
- ✅ 移植桌面端图表逻辑到移动端
- ✅ 完善合同管理功能模块
- ✅ 优化权限管理系统

### Version 1.9.0 (2024-01-10)
- ✅ 实现Excel导入选择性更新功能
- ✅ 修复运单维护页面错误
- ✅ 优化数据库函数和触发器
- ✅ 完善移动端用户体验

### Version 1.8.0 (2024-01-05)
- ✅ 添加合同管理模块
- ✅ 实现工作流管理基础架构
- ✅ 优化移动端响应式设计
- ✅ 增强数据安全策略

---

## 📞 技术支持

### 联系信息
- 技术负责人: [技术团队]
- 邮箱: tech@company.com
- 文档更新: 2024年1月15日

### 相关资源
- [Supabase 官方文档](https://supabase.io/docs)
- [React 官方文档](https://react.dev)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [shadcn/ui 组件库](https://ui.shadcn.com)

---

*本文档由系统自动生成，包含了截至2024年1月15日的完整系统信息。*
