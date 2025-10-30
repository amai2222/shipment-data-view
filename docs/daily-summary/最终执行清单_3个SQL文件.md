# 最终执行清单 - 批量查询支持空格分隔（4个SQL文件）

## 📋 需要执行的SQL文件

### ✅ 已完成
1. ✅ `update_payment_requests_filter_with_all_params.sql` - 付款审核/财务付款

### ⏳ 待执行（共4个文件）

| 优先级 | 文件名 | 包含函数 | 影响页面 |
|-------|--------|---------|---------|
| ⭐⭐⭐ | `20250126_update_payment_request_functions_support_space.sql` | 2个函数 | 付款申请 |
| ⭐⭐⭐ | `20250126_update_logistics_functions_support_space.sql` | 2个函数 | 运单管理 |
| ⭐⭐⭐ | `20250126_create_invoice_requests_filtered_function.sql` | 1个函数 | 开票申请单管理 |
| ⭐⭐ | `20250126_update_invoice_functions_support_space_separator.sql` | 1个函数 | 开票申请 |

---

## 🚀 执行步骤

### 文件1：付款申请页面 ⭐⭐⭐ 最优先

**文件**：`20250126_update_payment_request_functions_support_space.sql`

**包含函数**：
- `get_payment_request_data` - 主查询函数
- `get_filtered_unpaid_ids` - 跨页全选函数

**为什么优先**：用户反馈批量查询不支持空格

**执行方法**：
```
1. 打开 Supabase SQL Editor
2. 复制整个文件内容
3. 粘贴并点击 Run
```

**验证**：
```sql
SELECT * FROM get_payment_request_data(p_driver_name => '张三 李四');
```

---

### 文件2：运单管理页面 ⭐⭐⭐ 最优先

**文件**：`20250126_update_logistics_functions_support_space.sql`

**包含函数**：
- `get_logistics_summary_and_records_enhanced` - 主查询函数
- `get_all_filtered_record_ids` - 批量选择函数

**为什么优先**：保持功能一致性，用户体验

**执行方法**：同上

**验证**：
```sql
SELECT * FROM get_logistics_summary_and_records_enhanced(p_driver_name => '张三 李四');
```

---

### 文件3：开票申请单管理页面 ⭐⭐⭐

**文件**：`20250126_create_invoice_requests_filtered_function.sql`

**包含函数**：
- `get_invoice_requests_filtered` - 开票申请单筛选函数（新建）

**为什么重要**：前端已更新使用此函数，必须执行

**执行方法**：同上

**验证**：
```sql
SELECT * FROM get_invoice_requests_filtered(p_driver_name => '张三 李四');
```

---

### 文件4：开票申请页面 ⭐⭐

**文件**：`20250126_update_invoice_functions_support_space_separator.sql`

**包含函数**：
- `get_invoice_request_data` - 主查询函数

**为什么可以稍后**：使用频率相对较低

**执行方法**：同上

**验证**：
```sql
SELECT * FROM get_invoice_request_data(p_driver_name => '张三 李四');
```

---

## 📦 备份文件

所有原始函数已备份到：
- `BACKUP_20250126_all_functions_before_space_support.sql`

---

## 🎯 执行建议顺序

### 推荐顺序A：逐个执行并测试
```
1. 执行文件1（付款申请）→ 测试 → 确认
2. 执行文件2（运单管理）→ 测试 → 确认  
3. 执行文件3（开票申请）→ 测试 → 确认
```

### 推荐顺序B：批量执行
```
1. 执行文件1（付款申请）
2. 执行文件2（运单管理）
3. 刷新前端页面测试
4. （可选）稍后执行文件3（开票申请）
```

---

## ✅ 完整测试清单

执行所有文件后，运行这些测试：

### 付款申请测试
```sql
-- 空格分隔
SELECT * FROM get_payment_request_data(p_driver_name => '张三 李四');
-- 逗号分隔（向后兼容）
SELECT * FROM get_payment_request_data(p_driver_name => '张三,李四');
```

### 运单管理测试
```sql
-- 空格分隔
SELECT * FROM get_logistics_summary_and_records_enhanced(p_driver_name => '张三 李四');
-- 逗号分隔（向后兼容）
SELECT * FROM get_logistics_summary_and_records_enhanced(p_driver_name => '张三,李四');
```

### 开票申请测试
```sql
-- 空格分隔
SELECT * FROM get_invoice_request_data(p_driver_name => '张三 李四');
-- 逗号分隔（向后兼容）
SELECT * FROM get_invoice_request_data(p_driver_name => '张三,李四');
```

---

## 📊 修改汇总

| 页面 | 修改前 | 修改后 | 支持格式 |
|------|--------|--------|---------|
| 付款审核/财务付款 | ✅ 已完成 | ✅ 逗号+空格 | `张三,李四` `张三 李四` |
| 付款申请 | ❌ 仅逗号 | ⏳ 待更新 | 待支持空格 |
| 运单管理 | ❌ 仅逗号 | ⏳ 待更新 | 待支持空格 |
| 开票申请 | ❌ 仅逗号 | ⏳ 待更新 | 待支持空格 |

---

## 🎉 预期完成状态

全部执行后：

| 页面 | 批量查询 | 支持格式 |
|------|---------|---------|
| 付款审核 | ✅ | 逗号、空格、混合 |
| 财务付款 | ✅ | 逗号、空格、混合 |
| 付款申请 | ✅ | 逗号、空格、混合 |
| 运单管理 | ✅ | 逗号、空格、混合 |
| 开票申请 | ✅ | 逗号、空格、混合 |

---

## 💡 执行建议

1. **先执行文件1和文件2**（付款申请+运单管理）- 用户需求最迫切
2. **测试确认无误后**，再执行文件3（开票申请）
3. **每次执行后**都在前端页面测试一下批量输入功能

---

## 📞 快速参考

- 详细说明：`SQL执行摘要_支持空格分隔.md`
- 函数清单：`函数修改清单_支持空格分隔.md`
- 完整文档：`批量查询支持空格分隔完成说明.md`

