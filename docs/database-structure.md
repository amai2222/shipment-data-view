# 数据库结构文档

## 概述
本文档记录了当前系统的数据库表结构和关键函数，用于开发时参考，避免表名和字段名错误。

## 核心表结构

### 用户相关表
- **`auth.users`** - Supabase内置用户表
- **`public.profiles`** - 用户配置文件表
  - `id` (UUID, PRIMARY KEY) - 对应 auth.users.id
  - `role` (TEXT) - 用户角色: admin, finance, business, operator, partner, viewer
  - `created_at`, `updated_at` (TIMESTAMPTZ)

### 项目管理表
- **`public.projects`** - 项目表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT) - 项目名称
  - `start_date`, `end_date` (DATE)
  - `project_status` (TEXT)

### 基础数据表
- **`public.drivers`** - 司机表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT) - 司机姓名
  - `license_plate` (TEXT) - 车牌号
  - `phone` (TEXT) - 电话

- **`public.locations`** - 地点表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT) - 地点名称

- **`public.partners`** - 合作方表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT) - 合作方名称

- **`public.partner_chains`** - 合作链路表
  - `id` (UUID, PRIMARY KEY)
  - `chain_name` (TEXT) - 链路名称
  - `project_id` (UUID) - 关联项目ID
  - `billing_type_id` (UUID) - 计费类型ID

### 运单相关表
- **`public.logistics_records`** - 运单记录表
  - `id` (UUID, PRIMARY KEY)
  - `auto_number` (TEXT, UNIQUE) - 自动生成的运单号
  - `project_id` (UUID) - 项目ID
  - `project_name` (TEXT) - 项目名称
  - `chain_id` (UUID) - 合作链路ID
  - `billing_type_id` (UUID) - 计费类型ID
  - `driver_id` (UUID) - 司机ID
  - `driver_name` (TEXT) - 司机姓名
  - `loading_location` (TEXT) - 装货地点
  - `unloading_location` (TEXT) - 卸货地点
  - `loading_date` (TIMESTAMPTZ) - 装货日期
  - `unloading_date` (TIMESTAMPTZ) - 卸货日期
  - `loading_weight` (NUMERIC) - 装货数量
  - `unloading_weight` (NUMERIC) - 卸货数量
  - `current_cost` (NUMERIC) - 运费金额
  - `extra_cost` (NUMERIC) - 额外费用
  - `license_plate` (TEXT) - 车牌号
  - `driver_phone` (TEXT) - 司机电话
  - `transport_type` (TEXT) - 运输类型
  - `remarks` (TEXT) - 备注
  - `payable_cost` (NUMERIC) - 应付费用
  - `other_platform_names` (TEXT[]) - 其他平台名称数组
  - `other_platform_waybills` (TEXT[]) - 其他平台运单号数组
  - `created_by_user_id` (UUID) - 创建用户ID
  - `created_at`, `updated_at` (TIMESTAMPTZ)

- **`public.logistics_partner_costs`** - 物流合作方成本表
  - `id` (UUID, PRIMARY KEY)
  - `logistics_record_id` (UUID) - 运单记录ID
  - `partner_id` (UUID) - 合作方ID
  - `cost` (NUMERIC) - 成本金额

### 磅单相关表
- **`public.scale_records`** - 磅单记录表
  - `id` (UUID, PRIMARY KEY)
  - `logistics_record_id` (UUID) - 关联运单记录ID
  - `scale_date` (TIMESTAMPTZ) - 过磅日期
  - `weight` (NUMERIC) - 重量

### 财务相关表
- **`public.billing_types`** - 计费类型表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT) - 计费类型名称

- **`public.payment_requests`** - 付款申请表
  - `id` (UUID, PRIMARY KEY)
  - `request_number` (TEXT) - 申请单号
  - `status` (TEXT) - 状态

- **`public.partner_payment_requests`** - 合作方付款申请表
  - `id` (UUID, PRIMARY KEY)
  - `partner_id` (UUID) - 合作方ID
  - `amount` (NUMERIC) - 金额

### 合同相关表
- **`public.contracts`** - 合同表
  - `id` (UUID, PRIMARY KEY)
  - `contract_number` (TEXT) - 合同编号
  - `title` (TEXT) - 合同标题
  - `status` (TEXT) - 合同状态

- **`public.contract_tags`** - 合同标签表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT) - 标签名称

- **`public.contract_tag_relations`** - 合同标签关系表
  - `id` (UUID, PRIMARY KEY)
  - `contract_id` (UUID) - 合同ID
  - `tag_id` (UUID) - 标签ID

### 权限相关表
- **`public.user_roles`** - 用户角色表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT) - 角色名称

- **`public.user_permissions`** - 用户权限表
  - `id` (UUID, PRIMARY KEY)
  - `user_id` (UUID) - 用户ID
  - `permission_key` (TEXT) - 权限键

- **`public.role_permission_templates`** - 角色权限模板表
  - `id` (UUID, PRIMARY KEY)
  - `role` (TEXT) - 角色名称
  - `permissions` (JSONB) - 权限配置

### 导入模板相关表
- **`public.import_templates`** - 导入模板配置表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT, UNIQUE) - 模板名称
  - `description` (TEXT) - 模板描述
  - `platform_name` (TEXT) - 平台名称
  - `is_active` (BOOLEAN) - 是否启用
  - `created_by_user_id` (UUID) - 创建用户ID
  - `created_at`, `updated_at` (TIMESTAMPTZ)

- **`public.import_field_mappings`** - 字段映射配置表
  - `id` (UUID, PRIMARY KEY)
  - `template_id` (UUID) - 模板ID
  - `source_field` (TEXT) - Excel中的字段名
  - `target_field` (TEXT) - 系统字段名
  - `field_type` (TEXT) - 字段类型: text, number, date, boolean
  - `is_required` (BOOLEAN) - 是否必填
  - `default_value` (TEXT) - 默认值
  - `transformation_rule` (TEXT) - 转换规则
  - `sort_order` (INTEGER) - 排序
  - `created_at` (TIMESTAMPTZ)

- **`public.import_fixed_mappings`** - 固定值映射表
  - `id` (UUID, PRIMARY KEY)
  - `template_id` (UUID) - 模板ID
  - `target_field` (TEXT) - 系统字段名
  - `fixed_value` (TEXT) - 固定值
  - `description` (TEXT) - 说明
  - `created_at` (TIMESTAMPTZ)

### 审计日志表
- **`public.permission_audit_logs`** - 权限审计日志表
  - `id` (UUID, PRIMARY KEY)
  - `user_id` (UUID) - 用户ID
  - `action` (TEXT) - 操作类型
  - `details` (JSONB) - 详细信息
  - `created_at` (TIMESTAMPTZ)

- **`public.contract_access_logs`** - 合同访问日志表
  - `id` (UUID, PRIMARY KEY)
  - `contract_id` (UUID) - 合同ID
  - `user_id` (UUID) - 用户ID
  - `action` (TEXT) - 操作类型
  - `created_at` (TIMESTAMPTZ)

## 关键函数

### 数据导入相关函数
- **`public.preview_import_with_duplicates_check(p_records jsonb)`**
  - 预览导入数据并检查重复
  - 返回: `{new_records, duplicate_records, error_records}`

- **`public.batch_import_logistics_records(p_records jsonb)`**
  - 批量导入运单记录
  - 返回: `{success_count, error_count, errors}`

- **`public.delete_waybills_by_project(p_project_name TEXT)`**
  - 按项目删除运单记录
  - 返回: `{success, message, deleted_logistics_count, deleted_costs_count}`

### 成本计算函数
- **`public.recalculate_and_update_costs_for_records(record_ids UUID[])`**
  - 重新计算并更新指定记录的成本

### 数据统计函数
- **`public.get_dashboard_quick_stats(start_date DATE, end_date DATE, project_status_filter TEXT DEFAULT NULL)`**
  - 获取仪表板快速统计数据

- **`public.get_dashboard_stats_with_billing_types(start_date DATE, end_date DATE, project_status_filter TEXT DEFAULT NULL)`**
  - 获取带计费类型的仪表板统计数据

## 视图 (Views)

### 运单相关视图
- **`public.logistics_records_view`** - 运单记录视图
- **`public.logistics_records_with_external_tracking`** - 带外部跟踪的运单记录视图
- **`public.logistics_records_with_platforms`** - 带平台信息的运单记录视图

## 重要注意事项

### 表名规范
- 所有表都在 `public` schema 中
- 表名使用下划线命名法 (snake_case)
- 主键统一使用 `id` (UUID类型)

### 字段名规范
- 用户ID字段: `user_id` (在关联表中) 或 `id` (在profiles表中)
- 时间字段: `created_at`, `updated_at` (TIMESTAMPTZ类型)
- 外键字段: `{table_name}_id` (如 `project_id`, `driver_id`)

### RLS (Row Level Security)
- 所有表都启用了RLS
- 权限策略基于 `public.profiles` 表的 `role` 字段
- 管理员和操作员角色: `admin`, `operator`

### 数据类型
- UUID: 主键和外键
- TIMESTAMPTZ: 时间戳（带时区）
- TEXT: 文本字段
- NUMERIC: 数值字段
- JSONB: 复杂数据结构
- TEXT[]: 文本数组

### 项目状态管理表
- **`public.user_projects`** - 用户项目关联表
  - `id` (UUID, PRIMARY KEY)
  - `user_id` (UUID) - 用户ID
  - `project_id` (UUID) - 项目ID
  - `access_level` (TEXT) - 访问级别
  - `created_at` (TIMESTAMPTZ)

### 外部平台集成表
- **`public.external_platforms`** - 外部平台表
  - `id` (UUID, PRIMARY KEY)
  - `name` (TEXT) - 平台名称
  - `api_endpoint` (TEXT) - API端点
  - `is_active` (BOOLEAN) - 是否启用
  - `created_at` (TIMESTAMPTZ)

### 银行信息表
- **`public.partner_bank_details`** - 合作方银行详情表
  - `id` (UUID, PRIMARY KEY)
  - `partner_id` (UUID) - 合作方ID
  - `bank_name` (TEXT) - 银行名称
  - `account_number` (TEXT) - 账户号码
  - `account_holder` (TEXT) - 账户持有人
  - `created_at` (TIMESTAMPTZ)

### 搜索保存表
- **`public.saved_searches`** - 保存的搜索表
  - `id` (UUID, PRIMARY KEY)
  - `user_id` (UUID) - 用户ID
  - `search_name` (TEXT) - 搜索名称
  - `filters` (JSONB) - 筛选条件
  - `created_at` (TIMESTAMPTZ)

## 重要函数更新

### 项目状态管理函数
- **`public.handle_project_status_change()`** - 项目状态变更触发器函数
- **`public.assign_project_to_all_users(p_project_id UUID)`** - 为所有用户分配项目权限

### 数据导入函数
- **`public.preview_import_with_duplicates_check(p_records jsonb)`** - 预览导入数据并检查重复
- **`public.batch_import_logistics_records(p_records jsonb)`** - 批量导入运单记录
- **`public.delete_waybills_by_project(p_project_name TEXT)`** - 按项目删除运单记录

### 成本计算函数
- **`public.recalculate_and_update_costs_for_records(record_ids UUID[])`** - 重新计算并更新指定记录的成本

### 数据统计函数
- **`public.get_dashboard_quick_stats(start_date DATE, end_date DATE, project_status_filter TEXT DEFAULT NULL)`** - 获取仪表板快速统计数据
- **`public.get_dashboard_stats_with_billing_types(start_date DATE, end_date DATE, project_status_filter TEXT DEFAULT NULL)`** - 获取带计费类型的仪表板统计数据

## 触发器

### 项目状态变更触发器
- **`project_status_change_trigger`** - 当项目状态变更为"进行中"时自动为所有用户分配访问权限

## 自定义类型

### 枚举类型
- **`effective_quantity_type`** - 有效数量计算类型
  - `min_value` - 取较小值
  - `loading` - 取装货数量
  - `unloading` - 取卸货数量

- **`contract_category`** - 合同分类枚举
- **`app_role`** - 应用角色枚举

## 更新记录
- 2025-01-20: 初始版本，记录现有表结构
- 2025-01-20: 添加导入模板相关表结构
- 2025-01-27: 添加项目状态管理、外部平台集成、银行信息等新表结构
- 2025-01-27: 更新函数列表，添加项目状态管理和数据统计函数
- 2025-01-27: 添加触发器和自定义类型说明
