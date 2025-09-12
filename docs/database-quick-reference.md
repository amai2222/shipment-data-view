# 数据库快速参考

## 常用表名对照

| 功能 | 表名 | 说明 |
|------|------|------|
| 用户信息 | `public.profiles` | ❌ 不是 `user_profiles` |
| 项目 | `public.projects` | 项目表 |
| 司机 | `public.drivers` | 司机表 |
| 地点 | `public.locations` | 地点表 |
| 合作方 | `public.partners` | 合作方表 |
| 合作链路 | `public.partner_chains` | 合作链路表 |
| 运单记录 | `public.logistics_records` | 运单记录表 |
| 磅单记录 | `public.scale_records` | 磅单记录表 |
| 计费类型 | `public.billing_types` | 计费类型表 |
| 付款申请 | `public.payment_requests` | 付款申请表 |
| 合同 | `public.contracts` | 合同表 |
| 导入模板 | `public.import_templates` | 导入模板表 ✅ 已创建 |
| 字段映射 | `public.import_field_mappings` | 字段映射表 ✅ 已创建 |
| 固定映射 | `public.import_fixed_mappings` | 固定值映射表 ✅ 已创建 |

## 关键字段对照

### 用户相关
| 用途 | 字段名 | 表名 | 说明 |
|------|--------|------|------|
| 用户ID | `id` | `public.profiles` | 主键，对应 auth.users.id |
| 用户ID | `user_id` | 其他表 | 外键，关联到 profiles.id |
| 用户角色 | `role` | `public.profiles` | admin, finance, business, operator, partner, viewer |

### 时间字段
| 用途 | 字段名 | 类型 | 说明 |
|------|--------|------|------|
| 创建时间 | `created_at` | TIMESTAMPTZ | 记录创建时间 |
| 更新时间 | `updated_at` | TIMESTAMPTZ | 记录更新时间 |

### 外键字段
| 关联表 | 外键字段名 | 说明 |
|--------|------------|------|
| projects | `project_id` | 项目ID |
| drivers | `driver_id` | 司机ID |
| partners | `partner_id` | 合作方ID |
| partner_chains | `chain_id` | 合作链路ID |
| billing_types | `billing_type_id` | 计费类型ID |
| logistics_records | `logistics_record_id` | 运单记录ID |

### 重要外键关系（logistics_records表）
| 字段名 | 关联表 | 关联字段 | 说明 |
|--------|--------|----------|------|
| `billing_type_id` | `billing_types` | `billing_type_id` | 计费类型 |
| `chain_id` | `partner_chains` | `id` | 合作链路 |
| `driver_id` | `drivers` | `id` | 司机 |
| `project_id` | `projects` | `id` | 项目 |

## 权限检查常用模式

### RLS策略中的用户角色检查
```sql
-- ✅ 正确的方式
EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'operator')
)

-- ❌ 错误的方式
EXISTS (
    SELECT 1 FROM public.user_profiles  -- 表名错误
    WHERE user_id = auth.uid()          -- 字段名错误
    AND role IN ('admin', 'operator')
)
```

### 用户权限检查
```sql
-- 检查用户角色
SELECT role FROM public.profiles WHERE id = auth.uid();

-- 检查是否为管理员
SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'operator')
);
```

## 常用函数

### 数据导入
- `public.preview_import_with_duplicates_check(p_records jsonb)`
- `public.batch_import_logistics_records(p_records jsonb)`
- `public.delete_waybills_by_project(p_project_name TEXT)`

### 数据统计
- `public.get_dashboard_quick_stats(start_date DATE, end_date DATE, project_status_filter TEXT DEFAULT NULL)`
- `public.get_dashboard_stats_with_billing_types(start_date DATE, end_date DATE, project_status_filter TEXT DEFAULT NULL)`

### 成本计算
- `public.recalculate_and_update_costs_for_records(record_ids UUID[])`

## 数据类型参考

| 用途 | 类型 | 示例 |
|------|------|------|
| 主键/外键 | UUID | `gen_random_uuid()` |
| 时间戳 | TIMESTAMPTZ | `NOW()` |
| 文本 | TEXT | `'示例文本'` |
| 数值 | NUMERIC | `123.45` |
| 布尔值 | BOOLEAN | `true`, `false` |
| 数组 | TEXT[] | `ARRAY['值1', '值2']` |
| JSON | JSONB | `'{"key": "value"}'::jsonb` |

## 常见错误避免

### ❌ 常见错误
1. **表名错误**: `user_profiles` → 应该是 `profiles`
2. **字段名错误**: `user_id` → 在profiles表中应该是 `id`
3. **时区问题**: 使用 `TIMESTAMPTZ` 而不是 `TIMESTAMP`
4. **权限检查**: 忘记检查用户角色权限

### ✅ 最佳实践
1. **统一命名**: 主键统一使用 `id`，外键使用 `{table}_id`
2. **时区处理**: 所有时间字段使用 `TIMESTAMPTZ`
3. **权限控制**: 所有表都启用RLS，基于 `profiles.role` 进行权限控制
4. **数据完整性**: 使用外键约束和唯一约束

## 更新记录
- 2025-01-20: 初始版本，记录常见错误和正确用法
- 2025-01-20: 确认导入模板表已创建，记录logistics_records表外键关系
