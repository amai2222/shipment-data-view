# 实际数据库结构记录

## 说明
本文档记录通过SQL查询获取的实际数据库结构，用于开发参考。

## 查询命令
使用以下SQL命令获取数据库结构：

### 快速查询
```sql
-- 执行 scripts/quick-database-info.sql 中的内容
```

### 详细查询
```sql
-- 执行 scripts/query-database-structure.sql 中的内容
```

## 查询结果记录

### 表结构信息
**所有表名列表**（基于数据库查询结果）：
| tablename                        | 行数 | 大小 | RLS |
| -------------------------------- | ---- | ---- | --- |
| billing_types                    | 3    | 11KB | ✅  |
| contract_access_logs             | 0    | 10KB | ✅  |
| contract_file_versions           | 0    | 10KB | ✅  |
| contract_numbering_rules         | 3    | 12KB | ✅  |
| contract_permissions             | 0    | 10KB | ✅  |
| contract_reminders               | 0    | 10KB | ✅  |
| contract_tag_relations           | 0    | 10KB | ✅  |
| contract_tags                    | 3    | 12KB | ✅  |
| contracts                        | 0    | 109KB| ✅  |
| driver_projects                  | 441  | 122KB| ✅  |
| drivers                          | 441  | 109KB| ✅  |
| external_platforms               | 5    | 94KB | ✅  |
| import_field_mappings            | -    | -    | ✅  |
| import_fixed_mappings            | -    | -    | ✅  |
| import_templates                 | -    | -    | ✅  |
| invoice_records                  | 0    | 42KB | ✅  |
| location_projects                | 101  | 29KB | ✅  |
| locations                        | 102  | 104KB| ✅  |
| logistics_partner_costs          | 1118 | 839KB| ✅  |
| logistics_records                | 704  | 1113KB| ✅ |
| logistics_records_view           | -    | -    | ✅  |
| logistics_records_with_external_tra... | - | - | ✅ |
| logistics_records_with_platforms | -    | -    | ✅  |
| partner_bank_details             | 10   | 33KB | ✅  |
| partner_chains                   | 15   | 112KB| ✅  |
| partner_payment_items            | 0    | 14KB | ✅  |
| partner_payment_requests         | 2    | 42KB | ✅  |
| partners                         | 14   | 29KB | ✅  |
| payment_records                  | 0    | 42KB | ✅  |
| payment_requests                 | 0    | 10KB | ✅  |
| permission_audit_logs            | 1    | 30KB | ✅  |
| profiles                         | 2    | 30KB | ✅  |
| project_partners                 | 40   | 113KB| ✅  |
| projects                         | 11   | 29KB | ✅  |
| role_permission_templates        | 6    | 30KB | ✅  |
| saved_searches                   | 0    | 10KB | ✅  |
| scale_records                    | 105  | 139KB| ✅  |
| user_permissions                 | 5625 | 1229KB| ✅ |
| user_roles                       | 10   | 49KB | ✅  |

### 表分类说明
**核心业务表**：
- `logistics_records` - 运单记录表（核心表，1113KB，704条记录）
- `logistics_partner_costs` - 物流合作方成本表（839KB，1118条记录）
- `scale_records` - 磅单记录表（139KB，105条记录）

**基础数据表**：
- `profiles` - 用户配置文件表（30KB，2条记录）
- `projects` - 项目表（29KB，11条记录）
- `drivers` - 司机表（109KB，441条记录）
- `locations` - 地点表（104KB，102条记录）
- `partners` - 合作方表（29KB，14条记录）
- `partner_chains` - 合作链路表（112KB，15条记录）
- `billing_types` - 计费类型表（11KB，3条记录）

**财务相关表**：
- `payment_requests` - 付款申请表（10KB，0条记录）
- `partner_payment_requests` - 合作方付款申请表（42KB，2条记录）
- `payment_records` - 付款记录表（42KB，0条记录）
- `invoice_records` - 发票记录表（42KB，0条记录）
- `partner_bank_details` - 合作方银行详情表（33KB，10条记录）

**合同管理表**：
- `contracts` - 合同表（109KB，0条记录）
- `contract_tags` - 合同标签表（12KB，3条记录）
- `contract_tag_relations` - 合同标签关系表（10KB，0条记录）
- `contract_permissions` - 合同权限表（10KB，0条记录）
- `contract_reminders` - 合同提醒表（10KB，0条记录）
- `contract_numbering_rules` - 合同编号规则表（12KB，3条记录）
- `contract_file_versions` - 合同文件版本表（10KB，0条记录）
- `contract_access_logs` - 合同访问日志表（10KB，0条记录）

**权限管理表**：
- `user_roles` - 用户角色表（49KB，10条记录）
- `user_permissions` - 用户权限表（1229KB，5625条记录）
- `role_permission_templates` - 角色权限模板表（30KB，6条记录）
- `permission_audit_logs` - 权限审计日志表（30KB，1条记录）

**导入模板表**：
- `import_templates` - 导入模板配置表
- `import_field_mappings` - 字段映射配置表
- `import_fixed_mappings` - 固定值映射表

**关联表**：
- `driver_projects` - 司机项目关联表（122KB，441条记录）
- `location_projects` - 地点项目关联表（29KB，101条记录）
- `project_partners` - 项目合作方关联表（113KB，40条记录）
- `partner_payment_items` - 合作方付款项目表（14KB，0条记录）

**其他表**：
- `external_platforms` - 外部平台表（94KB，5条记录）
- `saved_searches` - 保存的搜索表（10KB，0条记录）

**视图**：
- `logistics_records_view` - 运单记录视图
- `logistics_records_with_external_tra...` - 带外部跟踪的运单记录视图
- `logistics_records_with_platforms` - 带平台信息的运单记录视图

**关键外键关系**：
| table_name        | column_name     | foreign_table_name | foreign_column_name |
| ----------------- | --------------- | ------------------ | ------------------- |
| logistics_records | billing_type_id | billing_types      | billing_type_id     |
| logistics_records | chain_id        | partner_chains     | id                  |
| logistics_records | driver_id       | drivers            | id                  |
| logistics_records | project_id      | projects           | id                  |

### 函数信息
**数据库函数**（基于项目代码分析）：
| 函数名 | 参数 | 返回类型 | 功能描述 |
|--------|------|----------|----------|
| `preview_import_with_duplicates_check` | `p_records jsonb` | `jsonb` | 预览导入数据并检查重复 |
| `batch_import_logistics_records` | `p_records jsonb` | `jsonb` | 批量导入运单记录 |
| `delete_waybills_by_project` | `p_project_name TEXT` | `jsonb` | 按项目删除运单记录 |
| `recalculate_and_update_costs_for_records` | `record_ids UUID[]` | `void` | 重新计算并更新指定记录的成本 |
| `get_dashboard_quick_stats` | `start_date DATE, end_date DATE, project_status_filter TEXT` | `jsonb` | 获取仪表板快速统计数据 |
| `get_dashboard_stats_with_billing_types` | `start_date DATE, end_date DATE, project_status_filter TEXT` | `jsonb` | 获取带计费类型的仪表板统计数据 |
| `update_updated_at_column` | - | `TRIGGER` | 更新时间戳触发器函数 |

**Edge函数**（Supabase Edge Functions）：
| 函数名 | 功能描述 |
|--------|----------|
| `admin-reset-password` | 管理员重置密码 |
| `bulk-link-logistics` | 批量关联物流记录 |
| `export-excel` | 导出Excel文件 |
| `get-approvers` | 获取审批人列表 |
| `get-filtered-payment-requests` | 获取筛选的付款申请 |
| `log-contract-access` | 记录合同访问日志 |
| `pdf-proxy` | PDF代理服务 |
| `pdf-proxy-simple` | 简化PDF代理服务 |
| `qiniu-upload` | 七牛云上传服务 |
| `username-login` | 用户名登录 |
| `work-wechat-approval` | 企业微信审批 |
| `work-wechat-auth` | 企业微信认证 |

### 视图信息
**数据库视图**：
| 视图名 | 功能描述 |
|--------|----------|
| `logistics_records_view` | 运单记录基础视图 |
| `logistics_records_with_external_tra...` | 带外部跟踪信息的运单记录视图 |
| `logistics_records_with_platforms` | 带平台信息的运单记录视图 |

### RLS策略信息
*[待补充]*

### 约束信息
*[待补充]*

## 重要发现
1. **数据库规模**：
   - 总共 **40+ 个表** 和 **3个视图**
   - 核心数据表：`logistics_records`（704条记录，1113KB）
   - 最大表：`user_permissions`（5625条记录，1229KB）
   - 所有表都启用了RLS（行级安全）

2. **导入模板表已成功创建**：
   - `import_templates` - 导入模板配置表
   - `import_field_mappings` - 字段映射配置表
   - `import_fixed_mappings` - 固定值映射表

3. **logistics_records表的外键关系**：
   - `billing_type_id` → `billing_types.billing_type_id`
   - `chain_id` → `partner_chains.id`
   - `driver_id` → `drivers.id`
   - `project_id` → `projects.id`

4. **表名确认**：
   - ✅ 用户表是 `profiles`（不是 `user_profiles`）
   - ✅ 导入模板相关表已创建
   - ✅ 所有表都在 `public` schema 中

5. **数据分布**：
   - **有数据的表**：logistics_records, logistics_partner_costs, scale_records, drivers, locations, partners等
   - **空表**：大部分合同管理表、财务表还未使用
   - **配置表**：billing_types, contract_tags, user_roles等有少量配置数据

6. **视图系统**：
   - 有3个基于logistics_records的视图
   - 支持外部平台跟踪和平台信息展示

7. **函数系统**：
   - **数据库函数**: 7个核心函数，包括导入、删除、统计、成本计算等
   - **Edge函数**: 12个Edge函数，涵盖认证、业务逻辑、文件处理、审计等
   - **触发器函数**: 1个自动更新时间戳的触发器函数

8. **Edge函数分类**：
   - **认证类**: 3个函数（admin-reset-password, username-login, work-wechat-auth）
   - **业务类**: 3个函数（bulk-link-logistics, get-approvers, get-filtered-payment-requests）
   - **文件类**: 4个函数（export-excel, pdf-proxy, pdf-proxy-simple, qiniu-upload）
   - **审计类**: 1个函数（log-contract-access）
   - **集成类**: 1个函数（work-wechat-approval）

## 更新记录
- 2025-01-20: 初始版本，创建查询命令和记录模板
- 2025-01-20: 记录导入模板表创建成功，记录logistics_records表外键关系
- 2025-01-20: 完善完整数据库结构记录，包含40+个表和3个视图的详细信息
- 2025-01-20: 添加数据库函数和Edge函数的完整记录
