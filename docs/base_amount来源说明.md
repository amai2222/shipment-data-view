# base_amount 来源说明

## 📋 概述

`logistics_partner_costs.base_amount`（基础金额）字段的值来源于**运单记录（`logistics_records`）的 `payable_cost` 字段（司机应收合计）**。

## 🔍 数据流向

```
logistics_records.payable_cost（司机应收合计）
           ↓
    v_base_amount（变量）
           ↓
logistics_partner_costs.base_amount（基础金额）
```

## 📝 详细说明

### 1. 来源字段

**`logistics_records.payable_cost`**（司机应收合计）
- **计算公式**：`payable_cost = current_cost + extra_cost`
  - `current_cost`：基础运费
  - `extra_cost`：额外费用

### 2. 赋值过程

在重算函数中（如 `batch_recalculate_partner_costs`），代码逻辑如下：

```sql
-- 步骤1：从运单记录获取 payable_cost
SELECT 
    chain_id,
    project_id,
    payable_cost,  -- ✅ 使用payable_cost（司机应收合计）
    loading_weight,
    unloading_weight,
    effective_quantity
INTO v_chain_id, v_project_id, v_base_amount, v_loading_weight, v_unloading_weight, v_effective_quantity
FROM logistics_records
WHERE id = v_record_id;

-- 步骤2：为每个合作方创建成本记录时，使用 v_base_amount
INSERT INTO logistics_partner_costs (
    logistics_record_id,
    partner_id,
    level,
    base_amount,      -- ✅ 这里保存的是 payable_cost 的值
    payable_amount,   -- 根据计算方法计算出的应付金额
    tax_rate,
    is_manually_modified
) VALUES (
    v_record_id,
    v_project_partners.partner_id,
    v_project_partners.level,
    v_base_amount,    -- 来自 payable_cost
    v_payable_amount, -- 根据计算方法计算
    v_project_partners.tax_rate,
    false
);
```

### 3. 重要特点

- **所有合作方共享同一个基础金额**：同一个运单的所有合作方成本记录的 `base_amount` 都相同，都等于该运单的 `payable_cost`。
- **独立计算应付金额**：虽然 `base_amount` 相同，但每个合作方的 `payable_amount`（应付金额）会根据不同的计算方法（税点法、利润法、定价法）独立计算。

### 4. 计算方法

根据 `project_partners.calculation_method` 的不同，`payable_amount` 的计算方式：

#### 税点法（默认）
```sql
payable_amount = base_amount / (1 - tax_rate)
```

#### 利润法
```sql
payable_amount = base_amount + (profit_rate * loading_weight)
-- 或
payable_amount = base_amount + profit_rate
```

#### 定价法
```sql
payable_amount = effective_quantity * unit_price
-- 注意：定价法不依赖 base_amount
```

## 📊 示例

假设有一个运单：
- `payable_cost` = 1000（司机应收合计）

该运单有 3 个合作方（level 1, 2, 3），都使用税点法：
- **合作方1**（level 1, tax_rate = 0.03）：
  - `base_amount` = 1000
  - `payable_amount` = 1000 / (1 - 0.03) = 1030.93

- **合作方2**（level 2, tax_rate = 0.05）：
  - `base_amount` = 1000（相同）
  - `payable_amount` = 1000 / (1 - 0.05) = 1052.63

- **合作方3**（level 3, tax_rate = 0.06）：
  - `base_amount` = 1000（相同）
  - `payable_amount` = 1000 / (1 - 0.06) = 1063.83

## 🔗 相关文件

- `supabase/migrations/20251120_update_recalculate_functions_support_fixed_price.sql`
- `supabase/migrations/20251106_add_trigger_recalc_on_payable_cost_change.sql`
- `supabase/migrations/20251106_create_batch_recalculate_function.sql`

## ✅ 总结

**`base_amount` = `logistics_records.payable_cost`（司机应收合计）**

所有合作方成本记录的基础金额都来自同一个运单的司机应收合计，然后根据各自的税率、利润或定价方式计算出不同的应付金额。

