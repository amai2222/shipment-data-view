# get_projects_with_details 函数版本记录（2025-11-20）

## 📋 今天创建的所有版本

### 版本1：迁移文件（正式版本）
**文件**：`supabase/migrations/20251120_fix_get_projects_with_details_include_unit_price.sql`
**函数名**：`get_projects_with_details_fixed_1120`
**特点**：
- ✅ 包含 `unit_price` 字段
- ✅ 使用 `_1120` 后缀
- ✅ 包含错误处理
- ✅ 使用 `COALESCE` 确保返回值不为 NULL

### 版本2：快速创建脚本
**文件**：`scripts/create_get_projects_with_details_fixed_1120.sql`
**函数名**：`get_projects_with_details_fixed_1120`
**特点**：
- ✅ 简化版本，可直接执行
- ✅ 包含 `unit_price` 字段
- ⚠️ 缺少错误处理

### 版本3：恢复脚本
**文件**：`scripts/restore_get_projects_with_details_fixed_1120.sql`
**函数名**：`get_projects_with_details_fixed_1120`
**特点**：
- ✅ 包含 `unit_price` 字段
- ✅ 包含错误处理
- ✅ 包含测试验证

### 版本4：最终修复脚本（推荐）
**文件**：`scripts/fix_get_projects_with_details_fixed_1120_final.sql`
**函数名**：`get_projects_with_details_fixed_1120`
**特点**：
- ✅ 包含 `unit_price` 字段
- ✅ 完整的错误处理
- ✅ 自动测试验证
- ✅ 详细的调试信息

---

## 🔍 原始函数备份（参考）

### 原始版本：`get_projects_with_details_fixed`
**来源**：`docs/全部函数.txt` (第10993-11078行)
**特点**：
- ❌ 不包含 `unit_price` 字段
- ✅ 使用 `partner_chains` 表（注意：不是 `project_chains`）
- ✅ 包含 `autoCode` 字段
- ✅ 使用 `JOIN` 而不是 `LEFT JOIN` 获取合作方名称

**关键差异**：
1. **表名不同**：
   - 原始版本：`public.partner_chains`
   - 新版本：`public.project_chains`
   
2. **字段差异**：
   - 原始版本：包含 `autoCode`，不包含 `unitPrice`
   - 新版本：不包含 `autoCode`，包含 `unitPrice`

3. **JOIN 方式**：
   - 原始版本：`JOIN public.partners p`（内连接）
   - 新版本：`LEFT JOIN public.partners p`（左连接）

---

## 🎯 推荐使用的版本

**推荐**：`scripts/fix_get_projects_with_details_fixed_1120_final.sql`

**原因**：
1. 包含完整的错误处理
2. 自动测试验证
3. 详细的调试信息
4. 确保返回正确的数据结构

---

## 📝 执行顺序

1. **首先执行**：`scripts/fix_get_projects_with_details_fixed_1120_final.sql`
2. **验证**：检查测试输出，确认函数正常工作
3. **如果失败**：检查错误信息，可能需要检查表名是否正确

---

## ⚠️ 重要发现（已修复）

**表名问题**：
- ✅ **数据库实际表名**：`partner_chains`（不是 `project_chains`）
- ✅ **已修复**：所有版本现在都使用正确的表名 `partner_chains`
- ✅ **修复文件**：
  - `supabase/migrations/20251120_fix_get_projects_with_details_include_unit_price.sql`
  - `scripts/fix_get_projects_with_details_fixed_1120_final.sql`
  - `scripts/restore_get_projects_with_details_fixed_1120.sql`
  - `scripts/create_get_projects_with_details_fixed_1120.sql`

---

## 🔧 快速修复建议

如果项目不显示，请检查：

1. **表名是否正确**：
   ```sql
   -- 检查表是否存在
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('project_chains', 'partner_chains');
   ```

2. **函数是否创建成功**：
   ```sql
   SELECT proname, prosrc 
   FROM pg_proc 
   WHERE proname = 'get_projects_with_details_fixed_1120';
   ```

3. **测试函数**：
   ```sql
   SELECT public.get_projects_with_details_fixed_1120();
   ```

