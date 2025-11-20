# 定价法功能 - 必须执行的 SQL 文件清单

## ✅ 更新状态

- ✅ **数据库迁移文件**：5 个 SQL 文件已准备就绪
- ✅ **前端函数调用**：21 个文件已全部更新为 `_1120` 后缀
- ✅ **保护逻辑**：已修正为"只对未付款 且 未开票 且 未收款的运单重算"

---

## 📋 执行顺序（重要！）

请按照以下顺序在 Supabase SQL Editor 中执行：

---

## ✅ 第一步：基础字段和约束（必须）

**文件路径**：`supabase/migrations/20251120_add_fixed_price_calculation_method.sql`

**功能**：
- 添加 `project_partners.unit_price` 字段
- 更新 `calculation_method` 约束，支持 `'tax'`, `'profit'`, `'fixed_price'`

**验证**：
```sql
-- 执行后验证
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_partners' 
AND column_name = 'unit_price';
-- 应该返回 1 行
```

---

## ✅ 第二步：更新重算函数（必须）

**文件路径**：`supabase/migrations/20251120_update_recalculate_functions_support_fixed_price.sql`

**功能**：
- 更新 `batch_recalculate_partner_costs`（添加定价法支持）
- 更新 `auto_recalc_on_payable_cost_change`（添加定价法支持）
- **包含正确的保护逻辑：只对未开票且未付款且未收款的运单重算**

**验证**：
```sql
-- 执行后验证
SELECT proname FROM pg_proc 
WHERE proname = 'batch_recalculate_partner_costs';
-- 应该返回 1 行
```

---

## ✅ 第三步：添加有效数量触发器（必须）

**文件路径**：`supabase/migrations/20251120_add_trigger_recalc_on_effective_quantity_change.sql`

**功能**：
- 创建 `auto_recalc_on_effective_quantity_or_cost_change` 函数
- 创建 `trigger_recalc_on_effective_quantity_or_cost_change` 触发器
- 当有效数量、装卸货重量、链路、项目改变时自动触发重算

**验证**：
```sql
-- 执行后验证
SELECT tgname FROM pg_trigger 
WHERE tgname = 'trigger_recalc_on_effective_quantity_or_cost_change';
-- 应该返回 1 行
```

---

## ✅ 第四步：更新链路相关函数（必须）

**文件路径**：`supabase/migrations/20251120_update_all_recalc_functions_to_1120_with_fixed_price.sql`

**功能**：
- 创建 `recalculate_costs_for_chain_1120`
- 创建 `recalculate_costs_for_chain_safe_1120`
- 创建 `recalculate_costs_for_project_1120`
- 创建 `auto_recalc_on_project_partner_change_1120`
- 更新 `trigger_auto_recalc_partner_costs`

**验证**：
```sql
-- 执行后验证
SELECT proname FROM pg_proc 
WHERE proname LIKE '%_1120%';
-- 应该返回多行
```

---

## ✅ 第五步：更新特殊操作函数（必须）

**文件路径**：`supabase/migrations/20251120_update_modify_and_batch_filter_to_1120.sql`

**功能**：
- 创建 `modify_logistics_record_chain_with_recalc_1120`
- 创建 `batch_recalculate_by_filter_1120`

**验证**：
```sql
-- 执行后验证
SELECT proname FROM pg_proc 
WHERE proname IN (
    'modify_logistics_record_chain_with_recalc_1120',
    'batch_recalculate_by_filter_1120'
);
-- 应该返回 2 行
```

---

## 📝 执行方式

### 方式一：Supabase SQL Editor（推荐新手）

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 依次复制粘贴上述 5 个文件的内容并执行
4. 每执行一个文件后，运行对应的验证 SQL 确认成功

### 方式二：Supabase CLI（推荐有经验用户）

```bash
cd C:\Users\admin\Desktop\中科物流跟踪系统逻辑\github\shipment-data-view
supabase db push
```

这会自动执行所有未应用的迁移文件。

---

## 🛡️ 保护逻辑说明（重要！）

### 正确的保护逻辑

**只有同时满足以下三个条件的运单才会被重算**：
1. ✅ `payment_status = 'Unpaid'`（未付款）
2. ✅ `invoice_status = 'Uninvoiced'` 或 `invoice_status IS NULL`（未开票）
3. ✅ `receipt_status = 'Unreceived'` 或 `receipt_status IS NULL`（未收款）

### SQL 判断逻辑

```sql
-- 检查运单状态
IF payment_status != 'Unpaid' 
   OR (invoice_status IS NOT NULL AND invoice_status != 'Uninvoiced')
   OR (receipt_status IS NOT NULL AND receipt_status = 'Received') THEN
    -- 只要有一个条件不满足，就跳过重算
    -- 即：已付款 OR 已开票 OR 已收款 → 跳过
    RAISE NOTICE '⚠️ 运单已付款、已开票或已收款，跳过自动重算';
    RETURN NEW;  -- 或 CONTINUE（循环中）
END IF;

-- 如果通过了上面的检查，说明：
-- payment_status = 'Unpaid' AND 
-- invoice_status = 'Uninvoiced' (或 NULL) AND 
-- receipt_status = 'Unreceived' (或 NULL)
-- → 允许重算
```

### 保护效果

| 运单状态 | 是否重算 | 说明 |
|---------|---------|------|
| 未付款 + 未开票 + 未收款 | ✅ 允许重算 | 三个条件都满足 |
| **已付款** + 未开票 + 未收款 | ❌ 跳过重算 | 已付款 |
| 未付款 + **已开票** + 未收款 | ❌ 跳过重算 | 已开票 |
| 未付款 + 未开票 + **已收款** | ❌ 跳过重算 | 已收款 |
| **已付款** + **已开票** + 未收款 | ❌ 跳过重算 | 已付款或已开票 |
| **已付款** + **已开票** + **已收款** | ❌ 跳过重算 | 全部完成 |

---

## ✅ 全面验证

执行完所有文件后，运行以下 SQL 进行全面验证：

```sql
-- 1. 验证字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project_partners' 
AND column_name = 'unit_price';

-- 2. 验证约束
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'check_calculation_method';

-- 3. 验证函数（应返回 8+ 行）
SELECT proname, pronargs
FROM pg_proc 
WHERE proname IN (
    'batch_recalculate_partner_costs',
    'auto_recalc_on_payable_cost_change',
    'auto_recalc_on_effective_quantity_or_cost_change',
    'recalculate_costs_for_chain_1120',
    'recalculate_costs_for_chain_safe_1120',
    'recalculate_costs_for_project_1120',
    'auto_recalc_on_project_partner_change_1120',
    'modify_logistics_record_chain_with_recalc_1120',
    'batch_recalculate_by_filter_1120'
)
ORDER BY proname;

-- 4. 验证触发器（应返回 3 行）
SELECT tgname, tgrelid::regclass
FROM pg_trigger 
WHERE tgname LIKE '%recalc%'
ORDER BY tgname;
```

---

## ⚠️ 注意事项

1. **必须按顺序执行**：后面的文件依赖前面的文件创建的字段和函数
2. **执行前建议备份**：虽然这些是增量更新，但建议先备份数据库
3. **验证每一步**：每执行一个文件后，运行对应的验证 SQL
4. **保护逻辑已内置**：所有函数都包含了正确的保护逻辑

---

## 📞 遇到问题？

### 常见错误

1. **"column already exists"**：说明该迁移已经执行过，跳过即可
2. **"function does not exist"**：说明前面的文件未执行，请按顺序执行
3. **"constraint already exists"**：说明约束已存在，跳过即可

### 检查执行状态

```sql
-- 查看已执行的迁移
SELECT * FROM supabase_migrations.schema_migrations
WHERE version LIKE '20251120%'
ORDER BY version;
```

---

**创建日期**：2025-11-20  
**最后更新**：2025-11-20  
**状态**：✅ 清单已完成

