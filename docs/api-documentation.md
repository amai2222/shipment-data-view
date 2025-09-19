# API 文档

## 概述

本文档记录了中科物流跟踪系统的所有API接口，包括Supabase Edge Functions和数据库函数。

## 认证

所有API请求都需要通过Supabase Auth进行认证。请求头需要包含：

```typescript
{
  'Authorization': 'Bearer <access_token>',
  'Content-Type': 'application/json'
}
```

## Edge Functions

### 用户管理相关

#### 1. 用户名登录
**Endpoint**: `/functions/v1/username-login`
**Method**: `POST`
**Description**: 支持用户名或邮箱登录

**Request Body**:
```typescript
{
  username: string;  // 用户名或邮箱
  password: string;   // 密码
}
```

**Response**:
```typescript
{
  access_token: string;
  refresh_token: string;
  user: User;
}
```

#### 2. 管理员重置密码
**Endpoint**: `/functions/v1/admin-reset-password`
**Method**: `POST`
**Description**: 管理员重置用户密码

**Request Body**:
```typescript
{
  userId: string;     // 用户ID
  newPassword: string; // 新密码
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 数据导入相关

#### 3. 批量导入运单
**Endpoint**: `/functions/v1/batch-import-logistics`
**Method**: `POST`
**Description**: 批量导入运单记录

**Request Body**:
```typescript
{
  records: LogisticsRecord[]; // 运单记录数组
  projectName: string;         // 项目名称
}
```

**Response**:
```typescript
{
  success_count: number;
  error_count: number;
  errors: string[];
}
```

## 数据库函数

### 项目状态管理

#### 1. 项目状态变更处理
**Function**: `handle_project_status_change()`
**Description**: 项目状态变更触发器函数

**Parameters**: 无（触发器自动调用）

**Returns**: `void`

**功能**:
- 当项目状态变更为"进行中"时
- 自动为所有用户分配项目访问权限
- 记录权限分配日志

#### 2. 为用户分配项目权限
**Function**: `assign_project_to_all_users(p_project_id UUID)`
**Description**: 为所有用户分配指定项目的访问权限

**Parameters**:
- `p_project_id` (UUID): 项目ID

**Returns**: `void`

**功能**:
- 获取所有活跃用户
- 为每个用户创建项目访问权限记录
- 避免重复分配

### 数据导入

#### 3. 预览导入数据
**Function**: `preview_import_with_duplicates_check(p_records jsonb)`
**Description**: 预览导入数据并检查重复

**Parameters**:
- `p_records` (jsonb): 导入记录数组

**Returns**:
```typescript
{
  new_records: any[];      // 新记录
  duplicate_records: any[]; // 重复记录
  error_records: any[];    // 错误记录
}
```

#### 4. 批量导入运单记录
**Function**: `batch_import_logistics_records(p_records jsonb)`
**Description**: 批量导入运单记录到数据库

**Parameters**:
- `p_records` (jsonb): 运单记录数组

**Returns**:
```typescript
{
  success_count: number;  // 成功导入数量
  error_count: number;    // 失败数量
  errors: string[];       // 错误信息
}
```

#### 5. 按项目删除运单
**Function**: `delete_waybills_by_project(p_project_name TEXT)`
**Description**: 删除指定项目的所有运单记录

**Parameters**:
- `p_project_name` (TEXT): 项目名称

**Returns**:
```typescript
{
  success: boolean;
  message: string;
  deleted_logistics_count: number;
  deleted_costs_count: number;
}
```

### 成本计算

#### 6. 重新计算成本
**Function**: `recalculate_and_update_costs_for_records(record_ids UUID[])`
**Description**: 重新计算并更新指定记录的成本

**Parameters**:
- `record_ids` (UUID[]): 运单记录ID数组

**Returns**: `void`

**功能**:
- 根据计费类型重新计算成本
- 更新运单记录的成本字段
- 更新相关成本表

### 数据统计

#### 7. 获取仪表板快速统计
**Function**: `get_dashboard_quick_stats(start_date DATE, end_date DATE, project_status_filter TEXT DEFAULT NULL)`
**Description**: 获取仪表板快速统计数据

**Parameters**:
- `start_date` (DATE): 开始日期
- `end_date` (DATE): 结束日期
- `project_status_filter` (TEXT): 项目状态筛选（可选）

**Returns**:
```typescript
{
  total_records: number;        // 总运单数
  total_weight: number;         // 总重量
  total_cost: number;           // 总成本
  active_projects: number;      // 活跃项目数
  active_drivers: number;       // 活跃司机数
}
```

#### 8. 获取带计费类型的统计数据
**Function**: `get_dashboard_stats_with_billing_types(start_date DATE, end_date DATE, project_status_filter TEXT DEFAULT NULL)`
**Description**: 获取按计费类型分组的统计数据

**Parameters**:
- `start_date` (DATE): 开始日期
- `end_date` (DATE): 结束日期
- `project_status_filter` (TEXT): 项目状态筛选（可选）

**Returns**:
```typescript
{
  billing_type_stats: {
    billing_type_id: number;
    billing_type_name: string;
    record_count: number;
    total_weight: number;
    total_cost: number;
  }[];
  summary: {
    total_records: number;
    total_weight: number;
    total_cost: number;
  };
}
```

## 数据库表操作

### 核心表

#### logistics_records (运单记录表)
**主要字段**:
- `id`: UUID主键
- `auto_number`: 运单编号
- `project_id`: 项目ID
- `driver_id`: 司机ID
- `loading_date`: 装货日期
- `unloading_date`: 卸货日期
- `loading_weight`: 装货重量
- `unloading_weight`: 卸货重量
- `current_cost`: 运费金额
- `extra_cost`: 额外费用
- `other_platform_names`: 其他平台名称数组
- `external_tracking_numbers`: 外部运单号JSON

#### projects (项目表)
**主要字段**:
- `id`: UUID主键
- `name`: 项目名称
- `project_status`: 项目状态
- `start_date`: 开始日期
- `end_date`: 结束日期
- `manager`: 项目经理
- `effective_quantity_type`: 有效数量计算类型

#### user_projects (用户项目关联表)
**主要字段**:
- `id`: UUID主键
- `user_id`: 用户ID
- `project_id`: 项目ID
- `access_level`: 访问级别
- `created_at`: 创建时间

### 权限相关表

#### profiles (用户档案表)
**主要字段**:
- `id`: UUID主键
- `role`: 用户角色 (admin, finance, business, operator, viewer)
- `is_active`: 是否激活
- `work_wechat_userid`: 企业微信用户ID
- `work_wechat_department`: 企业微信部门

#### user_permissions (用户权限表)
**主要字段**:
- `id`: UUID主键
- `user_id`: 用户ID
- `project_id`: 项目ID（可选）
- `menu_permissions`: 菜单权限数组
- `function_permissions`: 功能权限数组
- `project_permissions`: 项目权限数组
- `data_permissions`: 数据权限数组

#### role_permission_templates (角色权限模板表)
**主要字段**:
- `id`: UUID主键
- `role`: 角色名称
- `menu_permissions`: 菜单权限数组
- `function_permissions`: 功能权限数组
- `project_permissions`: 项目权限数组
- `data_permissions`: 数据权限数组

## 错误处理

### 常见错误码

| 错误码 | 描述 | 解决方案 |
|--------|------|----------|
| 400 | 请求参数错误 | 检查请求参数格式和必填字段 |
| 401 | 认证失败 | 检查访问令牌是否有效 |
| 403 | 权限不足 | 检查用户角色和权限 |
| 404 | 资源不存在 | 检查资源ID是否正确 |
| 500 | 服务器内部错误 | 联系技术支持 |

### 错误响应格式

```typescript
{
  error: {
    code: string;
    message: string;
    details?: any;
  }
}
```

## 使用示例

### 1. 用户登录
```typescript
const response = await fetch('/functions/v1/username-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'admin@example.com',
    password: 'password123'
  })
});

const data = await response.json();
```

### 2. 获取仪表板统计
```typescript
const { data, error } = await supabase.rpc('get_dashboard_quick_stats', {
  start_date: '2025-01-01',
  end_date: '2025-01-31',
  project_status_filter: '进行中'
});
```

### 3. 批量导入运单
```typescript
const { data, error } = await supabase.rpc('batch_import_logistics_records', {
  p_records: [
    {
      project_name: '项目A',
      driver_name: '张三',
      loading_location: '北京',
      unloading_location: '上海',
      loading_date: '2025-01-20',
      loading_weight: 25.5
    }
  ]
});
```

## 更新记录

- 2025-01-27: 初始版本，记录所有API接口
- 2025-01-27: 添加项目状态管理相关函数
- 2025-01-27: 添加数据统计和成本计算函数
- 2025-01-27: 完善错误处理和示例代码
