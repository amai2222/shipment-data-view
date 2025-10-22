# 运单 chain_id 修复说明

## 📅 修复日期
2025-01-22

## 🐛 发现的问题

### 问题描述

**用户发现**：
- 导入、新建、编辑运单时
- `logistics_records` 表的 `chain_id` 字段可能为 NULL
- 导致：
  1. ❌ 运单没有关联到具体的合作链路
  2. ❌ 修改项目配置后，自动重算找不到这些运单
  3. ❌ 运费对账数据不会自动更新

### 数据表现

```sql
-- logistics_records 表
| auto_number | project_id | chain_id | 
| ----------- | ---------- | -------- |
| YDN001      | 可口可乐   | NULL ❌  |  ← 应该有 chain_id
| YDN002      | 可口可乐   | NULL ❌  |  ← 应该有 chain_id

-- 导致后果：
-- 1. 修改项目的合作方配置后
-- 2. 触发器找不到这些运单（因为 chain_id = NULL）
-- 3. 运费对账仍显示旧的合作方
```

---

## ✅ 修复方案

### 修复的函数

1. **`add_logistics_record_with_costs`** - 新建运单
   - ✅ 正确保存 `chain_id`
   - ✅ 根据 `chain_id` 查询合作方配置
   - ✅ 自动计算合作方成本

2. **`update_logistics_record_via_recalc`** - 编辑运单
   - ✅ 正确更新 `chain_id`
   - ✅ 删除旧的成本记录
   - ✅ 重新计算合作方成本

### 核心修复

**新建运单**：
```sql
INSERT INTO logistics_records (
    ...,
    chain_id,  -- ⭐ 确保保存
    ...
) VALUES (
    ...,
    p_chain_id,  -- ⭐ 传入的值
    ...
);
```

**编辑运单**：
```sql
UPDATE logistics_records
SET 
    chain_id = p_chain_id,  -- ⭐ 确保更新
    ...
WHERE id = p_record_id;
```

**查询合作方配置**：
```sql
SELECT * FROM project_partners
WHERE project_id = p_project_id
  AND (p_chain_id IS NULL OR chain_id = p_chain_id)  -- ⭐ 根据 chain_id 查询
```

---

## 📊 修复前 vs 修复后

### 修复前 ❌

```
新建运单：
  用户选择：项目=可口可乐，链路=成丰6
    ↓
  前端传递：p_chain_id = UUID
    ↓
  数据库保存：chain_id = NULL ❌（函数没有处理）
    ↓
  查询合作方：不使用 chain_id，可能查错
    ↓
  结果：
    - logistics_records.chain_id = NULL
    - 成本可能计算错误
    - 后续修改项目找不到运单
```

### 修复后 ✅

```
新建运单：
  用户选择：项目=可口可乐，链路=成丰6
    ↓
  前端传递：p_chain_id = UUID
    ↓
  数据库保存：chain_id = UUID ✅（正确保存）
    ↓
  查询合作方：根据 chain_id 精确查询
    ↓
  结果：
    - logistics_records.chain_id = UUID ✅
    - 成本计算正确 ✅
    - 修改项目后可以找到并重算 ✅
```

---

## 🚀 部署步骤

### 1. 执行迁移

```bash
# 部署修复
supabase db push
```

**或在 Supabase Dashboard SQL Editor 中执行**：
- `supabase/migrations/20250122_fix_logistics_chain_id_handling.sql`

### 2. 修复已有数据（可选）

如果有历史运单的 `chain_id` 为 NULL，可以修复：

```sql
-- 为 chain_id 为 NULL 的运单设置默认链路
WITH default_chains AS (
    SELECT 
        p.id as project_id,
        pc.id as chain_id
    FROM projects p
    JOIN partner_chains pc ON p.id = pc.project_id
    WHERE pc.is_default = TRUE
)
UPDATE logistics_records lr
SET chain_id = dc.chain_id
FROM default_chains dc
WHERE lr.project_id = dc.project_id
  AND lr.chain_id IS NULL;
```

### 3. 重算历史运单成本

```sql
-- 重算所有已修复 chain_id 的运单
SELECT recalculate_costs_for_project('可口可乐项目UUID'::UUID);
```

---

## 🧪 验证方法

### 1. 测试新建运单

```
1. 新建一个运单
2. 选择项目和链路
3. 保存

验证SQL：
SELECT auto_number, project_name, chain_id
FROM logistics_records
WHERE auto_number = '新建的运单编号';

预期：chain_id 不为 NULL ✅
```

### 2. 测试编辑运单

```
1. 编辑一个运单
2. 修改链路
3. 保存

验证SQL：
SELECT auto_number, chain_id
FROM logistics_records
WHERE id = '运单UUID';

预期：chain_id 已更新为新的链路ID ✅
```

### 3. 测试自动重算

```
1. 修改项目的合作方配置
2. 保存
3. 查看运费对账

预期：自动显示新的合作方 ✅
```

---

## ⚠️ 注意事项

### 1. 历史数据

**问题**：已有的运单 chain_id 可能为 NULL

**解决**：
- 执行修复SQL补充 chain_id
- 或使用运费对账的批量重算功能

### 2. 运单编号生成

新函数使用了序列生成编号：
```sql
CREATE SEQUENCE logistics_auto_number_seq;
```

如果序列不存在会自动创建。

### 3. 兼容性

修复后的函数：
- ✅ 向后兼容（已有调用不受影响）
- ✅ 参数相同
- ✅ 返回值相同

---

## 📚 相关文件

**迁移文件**：
- `supabase/migrations/20250122_fix_logistics_chain_id_handling.sql`

**检查脚本**：
- `检查并创建运单函数_完整版.sql`

**说明文档**：
- `运单chain_id修复说明.md`（本文件）

---

## ✅ 修复总结

**修复内容**：
1. ✅ `add_logistics_record_with_costs` - 新建时保存 chain_id
2. ✅ `update_logistics_record_via_recalc` - 编辑时更新 chain_id
3. ✅ 成本计算基于正确的 chain_id

**效果**：
- ✅ 新建运单：chain_id 正确保存
- ✅ 编辑运单：chain_id 正确更新
- ✅ 自动重算：可以找到所有运单
- ✅ 运费对账：自动显示最新数据

**部署后的完整流程**：
```
修改项目配置（中粮 → 中粮可乐）
  ↓
触发器执行：
  1. 查找该链路的合作方ID：[中粮的UUID]
  2. 反向查找使用"中粮"的运单（包括chain_id=NULL的）✅
  3. 删除旧成本记录
  4. 生成新成本记录（中粮可乐）
  ↓
运费对账自动更新 ✅

以后新建运单：
  ↓
chain_id 正确保存 ✅
  ↓
修改项目配置时能被正确找到 ✅
```

---

**状态**: ✅ 修复完成，等待部署  
**部署命令**: `supabase db push`  
**版本**: v1.2

---

**创建时间**: 2025-01-22

