# 收款系统SQL执行步骤

## 📋 概述

本文档说明如何执行收款系统相关的SQL迁移文件。收款系统包括以下功能：
- 货主余额管理
- 财务收款功能
- 收款记录查询
- 收款对账功能
- 收款提醒功能
- 收款报表功能

## 🎯 执行方案

### 方案一：使用合并文件（推荐）

**最简单的方式**：直接执行合并文件，它包含了所有功能。

#### 执行步骤：

1. **执行合并文件**
   ```sql
   -- 文件：supabase/migrations/20251114_merged_all_receipt_and_balance_functions.sql
   ```
   
   这个文件包含了：
   - ✅ 数据库结构扩展（添加收款相关字段）
   - ✅ 货主余额系统（partner_balance表和相关函数）
   - ✅ 收款功能（receive_invoice_payment_1114）
   - ✅ 退款功能（refund_invoice_receipt_1114）
   - ✅ 对账功能（reconcile_invoice_receipt_1114）
   - ✅ 提醒功能（send_receipt_reminders_1114）
   - ✅ 报表功能（get_receipt_statistics_1114, get_receipt_details_report_1114）
   - ✅ 查询功能（get_receipt_records_1114, get_invoice_requests_filtered_1114）

2. **执行JSONB返回类型更新（如果合并文件中未包含）**
   ```sql
   -- 文件：supabase/migrations/20251114_update_invoice_requests_filtered_return_jsonb.sql
   ```
   
   ⚠️ **注意**：如果合并文件中的 `get_invoice_requests_filtered_1114` 已经返回 `JSONB` 类型，则无需执行此文件。

---

### 方案二：分步执行（如果合并文件执行失败）

如果合并文件执行失败，可以按以下顺序分步执行：

#### 第一步：创建数据库结构

```sql
-- 文件：supabase/migrations/20251114_add_partner_balance_system.sql
-- 功能：创建货主余额系统（partner_balance表和partner_balance_transactions表）
```

#### 第二步：添加收款相关字段

```sql
-- 文件：supabase/migrations/20251114_add_invoice_receipt_functionality.sql
-- 功能：在invoice_requests和logistics_records表中添加收款相关字段
```

#### 第三步：创建收款功能函数

```sql
-- 文件：supabase/migrations/20251114_enhance_receipt_functionality_comprehensive.sql
-- 功能：创建收款、退款、对账、提醒、报表等核心功能函数
```

#### 第四步：重命名函数（添加_1114后缀）

```sql
-- 文件：supabase/migrations/20251114_rename_receipt_functions_add_1114_suffix.sql
-- 功能：将所有收款相关函数重命名，添加_1114后缀
```

#### 第五步：更新查询函数

```sql
-- 文件：supabase/migrations/20251114_update_invoice_requests_filtered_add_receipt_fields.sql
-- 功能：更新get_invoice_requests_filtered_1114函数，添加收款相关字段
```

#### 第六步：更新函数返回类型为JSONB

```sql
-- 文件：supabase/migrations/20251114_update_invoice_requests_filtered_return_jsonb.sql
-- 功能：将get_invoice_requests_filtered_1114函数返回类型改为JSONB
```

#### 第七步：添加手动充值和费用扣款功能

```sql
-- 文件：supabase/migrations/20251114_add_manual_recharge_and_fee_functions.sql
-- 功能：添加手动充值、服务费、逾期费等函数
```

---

## 🚀 推荐执行方式

### 使用Supabase Dashboard执行

1. **登录Supabase Dashboard**
   - 访问：https://app.supabase.com
   - 选择你的项目

2. **打开SQL Editor**
   - 点击左侧菜单的 "SQL Editor"
   - 点击 "New query"

3. **执行合并文件**
   - 打开文件：`supabase/migrations/20251114_merged_all_receipt_and_balance_functions.sql`
   - 复制全部内容
   - 粘贴到SQL Editor
   - 点击 "Run" 执行

4. **验证执行结果**
   - 检查是否有错误信息
   - 如果成功，应该看到 "Success. No rows returned"

5. **执行JSONB更新（如果需要）**
   - 打开文件：`supabase/migrations/20251114_update_invoice_requests_filtered_return_jsonb.sql`
   - 复制全部内容
   - 粘贴到SQL Editor
   - 点击 "Run" 执行

---

### 使用Supabase CLI执行

如果你使用Supabase CLI管理迁移：

```bash
# 1. 确保你在项目根目录
cd /path/to/shipment-data-view

# 2. 链接到你的Supabase项目（如果还没链接）
supabase link --project-ref your-project-ref

# 3. 执行迁移文件
supabase db push

# 或者只执行特定文件
supabase migration up 20251114_merged_all_receipt_and_balance_functions
```

---

## ✅ 执行后验证

执行完成后，请验证以下内容：

### 1. 检查表结构

```sql
-- 检查partner_balance表是否存在
SELECT * FROM information_schema.tables 
WHERE table_name = 'partner_balance';

-- 检查invoice_requests表是否有新字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoice_requests' 
AND column_name IN ('receipt_number', 'receipt_bank', 'total_received_amount', 'payment_due_date');

-- 检查logistics_records表是否有receipt_status字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
AND column_name = 'receipt_status';
```

### 2. 检查函数是否存在

```sql
-- 检查所有_1114后缀的函数
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%_1114'
ORDER BY routine_name;
```

应该看到以下函数：
- `receive_invoice_payment_1114`
- `refund_invoice_receipt_1114`
- `reconcile_invoice_receipt_1114`
- `send_receipt_reminders_1114`
- `get_receipt_statistics_1114`
- `get_receipt_details_report_1114`
- `get_receipt_records_1114`
- `get_invoice_requests_filtered_1114`
- `manual_recharge_partner_balance`
- `deduct_service_fee`
- `deduct_overdue_fee`
- `deduct_partner_fee`

### 3. 测试函数调用

```sql
-- 测试get_invoice_requests_filtered_1114函数
SELECT * FROM get_invoice_requests_filtered_1114(
    p_page_number := 1,
    p_page_size := 10
);

-- 应该返回JSONB格式：
-- {
--   "success": true,
--   "records": [...],
--   "total_count": N,
--   "page_number": 1,
--   "page_size": 10,
--   "total_pages": N
-- }
```

---

## ⚠️ 注意事项

1. **备份数据库**
   - 执行前请先备份数据库
   - 可以使用Supabase Dashboard的备份功能

2. **执行顺序**
   - 如果使用合并文件，只需执行一次
   - 如果分步执行，必须按照上述顺序执行

3. **函数冲突**
   - 如果之前已经执行过部分文件，可能会有函数冲突
   - 合并文件使用 `CREATE OR REPLACE FUNCTION`，会自动覆盖旧函数

4. **数据迁移**
   - 执行后，现有记录的 `receipt_status` 会自动设置为 `'Unreceived'`
   - 现有记录的 `total_received_amount` 会自动设置为 `0`

5. **权限检查**
   - 确保执行SQL的用户有足够的权限
   - 所有函数都使用 `SECURITY DEFINER`，会以函数创建者的权限执行

---

## 🔧 故障排除

### 问题1：函数已存在错误

**错误信息**：`function already exists`

**解决方案**：
- 合并文件使用 `CREATE OR REPLACE FUNCTION`，应该会自动覆盖
- 如果仍有问题，可以先手动删除旧函数：
  ```sql
  DROP FUNCTION IF EXISTS function_name CASCADE;
  ```

### 问题2：表字段已存在错误

**错误信息**：`column already exists`

**解决方案**：
- 合并文件使用 `ADD COLUMN IF NOT EXISTS`，应该不会报错
- 如果仍有问题，说明字段已存在，可以跳过

### 问题3：返回类型不匹配

**错误信息**：前端调用函数时报错，返回数据格式不正确

**解决方案**：
- 确保执行了 `20251114_update_invoice_requests_filtered_return_jsonb.sql`
- 检查函数返回类型是否为 `JSONB`：
  ```sql
  SELECT routine_name, data_type
  FROM information_schema.routines
  WHERE routine_name = 'get_invoice_requests_filtered_1114';
  ```

---

## 📞 需要帮助？

如果执行过程中遇到问题，请检查：
1. Supabase Dashboard的日志
2. 前端控制台的错误信息
3. 数据库连接是否正常

---

**最后更新**：2025-11-14

