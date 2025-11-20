# 单价功能 SQL 文件执行说明

## 📋 需要执行的 SQL 文件

### 方案1：只使用新版本（推荐）✅

**只需执行 1 个文件**：

```
supabase/migrations/20251120_create_unit_price_functions.sql
```

**包含内容**：
- ✅ 添加 3 个新字段（unit_price, effective_quantity, calculation_mode）
- ✅ 创建 4 个 _1120 版本函数
- ✅ 创建触发器
- ✅ 迁移旧数据

**执行顺序**：无（只有1个文件）

---

### 方案2：保留旧版本（用于回滚）

**需要执行 2 个文件**：

#### 文件1：修复日期类型（可选，如果之前没执行过）
```
supabase/migrations/20251116_fix_add_logistics_record_with_costs_date_type.sql
```

**包含内容**：
- ✅ 修复日期类型转换问题
- ✅ 创建旧版本的 `add_logistics_record_with_costs` 函数（无_1120后缀）

**执行顺序**：第1个执行（如果之前没执行过）

#### 文件2：创建单价功能（必须）
```
supabase/migrations/20251120_create_unit_price_functions.sql
```

**包含内容**：
- ✅ 添加 3 个新字段
- ✅ 创建 4 个 _1120 版本函数
- ✅ 创建触发器
- ✅ 迁移旧数据

**执行顺序**：第2个执行

---

## 🎯 推荐方案：方案1（只执行1个文件）

### 为什么推荐方案1？

1. ✅ **更简单**：只需执行1个文件
2. ✅ **更安全**：不会影响旧函数
3. ✅ **更清晰**：新旧版本通过函数名区分
4. ✅ **易回滚**：如果出问题，前端改回调用旧函数即可

### 执行步骤

#### 在 Supabase Dashboard → SQL Editor 中：

```sql
-- 执行这个文件：
supabase/migrations/20251120_create_unit_price_functions.sql
```

**执行后验证**：

```sql
-- 1. 检查字段是否已添加
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'logistics_records'
AND column_name IN ('unit_price', 'effective_quantity', 'calculation_mode');

-- 预期结果：3 行

-- 2. 检查新函数是否已创建
SELECT proname 
FROM pg_proc 
WHERE proname LIKE '%_1120'
ORDER BY proname;

-- 预期结果：
-- add_logistics_record_with_costs_1120
-- auto_calculate_cost_from_unit_price_1120
-- get_effective_quantity_for_record_1120
-- update_logistics_record_via_recalc_1120

-- 3. 检查触发器是否已创建
SELECT trigger_name 
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_calculate_cost_from_unit_price_1120';

-- 预期结果：1 行
```

---

## 📊 两个文件的区别

### 文件1：20251116_fix_add_logistics_record_with_costs_date_type.sql

**创建的函数**：
- `add_logistics_record_with_costs`（旧版本，无后缀）
- 参数：17 个（不含单价）

**用途**：
- 修复日期类型转换问题
- 如果之前已经执行过，可以跳过

**是否必须**：
- ❌ 不是必须的（如果前端只调用_1120版本）

---

### 文件2：20251120_create_unit_price_functions.sql

**创建的函数**：
- `get_effective_quantity_for_record_1120`
- `auto_calculate_cost_from_unit_price_1120`
- `add_logistics_record_with_costs_1120`（新版本，_1120后缀）
- `update_logistics_record_via_recalc_1120`（新版本，_1120后缀）

**参数**：
- `add_logistics_record_with_costs_1120`：18 个参数（含单价）
- `update_logistics_record_via_recalc_1120`：19 个参数（含单价）

**用途**：
- 添加单价功能
- 创建所有新版本函数
- 创建触发器

**是否必须**：
- ✅ **必须执行**（前端调用的是_1120版本）

---

## 🔄 执行顺序（如果执行2个文件）

### 顺序1：先执行日期修复（如果之前没执行过）

```sql
-- 第1步：修复日期类型
执行: 20251116_fix_add_logistics_record_with_costs_date_type.sql

-- 第2步：创建单价功能
执行: 20251120_create_unit_price_functions.sql
```

**说明**：
- 文件1 创建旧版本函数（用于兼容）
- 文件2 创建新版本函数（前端使用）

### 顺序2：只执行单价功能（推荐）

```sql
-- 只执行这一个文件
执行: 20251120_create_unit_price_functions.sql
```

**说明**：
- 前端已经调用_1120版本
- 不需要旧版本函数
- 更简单，更安全

---

## ✅ 最终建议

### 推荐执行方案

**只执行 1 个文件**：

```
supabase/migrations/20251120_create_unit_price_functions.sql
```

**原因**：
1. ✅ 前端已调用 `_1120` 版本函数
2. ✅ 文件包含所有必需的功能
3. ✅ 不会影响现有函数
4. ✅ 执行简单，风险低

**执行后**：
- 刷新前端页面
- 测试新增运单功能
- 验证单价自动计算

---

## 📝 执行检查清单

### 执行前
- [ ] 备份数据库（可选，但推荐）
- [ ] 确认前端代码已更新为调用_1120版本

### 执行中
- [ ] 在 Supabase Dashboard → SQL Editor 中打开文件
- [ ] 执行 `20251120_create_unit_price_functions.sql`
- [ ] 检查执行结果，确认无错误

### 执行后
- [ ] 运行验证 SQL（见上方）
- [ ] 刷新前端页面
- [ ] 测试新增运单（自动模式）
- [ ] 测试新增运单（手动模式）
- [ ] 测试编辑旧运单

---

## 🚨 如果执行失败

### 错误1：字段已存在

```sql
-- 如果字段已存在，会显示警告，不影响执行
-- 可以忽略，继续执行
```

### 错误2：函数已存在

```sql
-- _1120 版本函数是新建的，不应该冲突
-- 如果冲突，检查是否有其他迁移文件创建了同名函数
```

### 错误3：触发器已存在

```sql
-- 迁移文件中有 DROP TRIGGER IF EXISTS，会自动删除旧触发器
-- 如果仍有问题，手动删除：
DROP TRIGGER IF EXISTS trigger_auto_calculate_cost_from_unit_price_1120 ON logistics_records;
```

---

## 📞 支持

如有问题，请检查：
1. Supabase Dashboard 的日志
2. 浏览器控制台的错误信息
3. 验证 SQL 的查询结果

---

**文档创建日期**：2025-11-20  
**推荐方案**：只执行 1 个文件

