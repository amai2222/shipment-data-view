# 最终 SQL 文件清单

## 📅 日期
2025-11-20

## ✅ 需要执行的文件（共 7 个）

按照以下顺序执行：

| 序号 | 文件名 | 说明 | 必须性 |
|-----|--------|------|--------|
| 1️⃣ | `20251120_create_unit_price_functions.sql` | 单价功能基础 | ✅ 必须 |
| 2️⃣ | `20251120_fix_effective_quantity_by_billing_type.sql` | 支持根据计费模式计算 | ✅ 必须 |
| 3️⃣ | `20251120_fix_trigger_update_effective_quantity.sql` | 扩展触发器条件 | ✅ 必须 |
| 4️⃣ | `20251120_simple_fix_drop_and_recreate.sql` | 简化更新函数 | ✅ 必须 |
| 5️⃣ | `20251120_add_billing_type_4_by_piece.sql` | 添加计件模式 | ✅ 必须 |
| 6️⃣ | `20251120_update_summary_support_pieces.sql` | 统计支持计件 | ✅ 必须 |
| 7️⃣ | `20251120_update_all_filtered_records_function.sql` | 更新筛选函数 | ✅ 必须 |

## 🛠️ 工具文件（可选）

| 文件名 | 说明 | 何时使用 |
|--------|------|----------|
| `20251120_manual_fix_existing_data.sql` | 手动修复有效数量为0的数据 | 仅在有效数量显示0时使用 |

## 🗑️ 已删除的文件（6 个）

以下文件已被删除，不需要执行：

| 文件名 | 删除原因 |
|--------|----------|
| `20251120_debug_check_triggers.sql` | ❌ 调试用，不需要 |
| `20251120_debug_effective_quantity.sql` | ❌ 调试用，不需要 |
| `20251120_fix_effective_quantity_update.sql` | ❌ 被替代 |
| `20251120_fix_update_function_explicit_set.sql` | ❌ 被替代 |
| `20251120_fix_update_function_let_trigger_calculate.sql` | ❌ 被替代 |
| `20251120_fix_update_function_set_calculation_mode.sql` | ❌ 被替代 |

## 📊 文件统计

- ✅ **保留**：7 个必须文件 + 1 个工具文件
- 🗑️ **删除**：6 个调试/旧版本文件
- 📝 **文档**：5 个说明文档

## 🚀 快速执行（复制粘贴）

如果需要一次性复制所有文件路径：

```
supabase/migrations/20251120_create_unit_price_functions.sql
supabase/migrations/20251120_fix_effective_quantity_by_billing_type.sql
supabase/migrations/20251120_fix_trigger_update_effective_quantity.sql
supabase/migrations/20251120_simple_fix_drop_and_recreate.sql
supabase/migrations/20251120_add_billing_type_4_by_piece.sql
supabase/migrations/20251120_update_summary_support_pieces.sql
supabase/migrations/20251120_update_all_filtered_records_function.sql
```

## 📚 相关文档

1. `docs/20251120单价和计件功能完整执行清单.md` - 完整执行指南
2. `docs/单价功能设计方案.md` - 设计文档
3. `docs/单价功能SQL文件执行说明.md` - SQL详细说明
4. `docs/计费类型4按件功能设计说明.md` - 计件功能设计
5. `docs/计件模式显示修复说明.md` - 前端显示说明

---

**状态**：✅ 已清理完成  
**版本**：最终版  
**更新时间**：2025-11-20

