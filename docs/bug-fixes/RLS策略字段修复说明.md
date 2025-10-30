# RLS策略字段修复说明

## 🐛 错误信息

```
ERROR: 42703: column "created_by" does not exist
HINT: Perhaps you mean to reference the column "invoice_requests.created_at".
```

---

## 🔍 问题原因

RLS策略中引用了不存在的字段 `created_by`。

**错误代码**:
```sql
CREATE POLICY "..."
ON public.invoice_requests FOR UPDATE
USING (
  created_by = auth.uid()  -- ❌ 字段不存在
  OR ...
);
```

---

## ✅ 修复方案

### 方案1: 移除字段检查（推荐）

```sql
-- ✅ 修复：只基于角色检查
CREATE POLICY "Allow admin and finance to update invoice requests"
ON public.invoice_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'finance', 'operator')
  )
);
```

**优点**: 
- 简单直接
- 所有admin、finance、operator都可以更新
- 符合当前业务需求

### 方案2: 添加created_by字段（如果需要）

```sql
-- 如果确实需要追踪创建者
ALTER TABLE public.invoice_requests 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 设置默认值为当前用户
ALTER TABLE public.invoice_requests 
ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 更新现有记录（可选）
UPDATE public.invoice_requests 
SET created_by = user_id 
WHERE created_by IS NULL;
```

---

## 📊 修复对比

### 原策略（有错误）❌
```sql
USING (
  created_by = auth.uid()  -- ❌ 字段不存在
  OR role IN ('admin', 'finance')
)
```

### 修复后策略 ✅
```sql
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'finance', 'operator')
  )
)
```

---

## 🎯 已修复的SQL文件

**文件**: `supabase/migrations/fix_security_issues.sql`

**修复内容**:
- ✅ 移除 `created_by` 字段引用
- ✅ 改为纯基于角色的权限控制
- ✅ 所有策略都使用实际存在的字段

---

## 🚀 重新执行

```bash
1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 新建查询
4. 复制修复后的文件：
   supabase/migrations/fix_security_issues.sql
5. 点击 Run
6. ✅ 应该成功执行，无字段错误
```

---

## ✨ 验证修复

```sql
-- 验证策略已创建
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'invoice_requests';

-- 应该看到新创建的策略，无created_by引用
```

---

## 📝 总结

**错误**: `created_by` 字段不存在  
**原因**: RLS策略引用了不存在的字段  
**修复**: 改为基于角色的权限控制  
**状态**: ✅ 已修复

---

**现在重新执行修复后的SQL，应该可以成功了！** 🔒

---

*字段修复 | 2025年1月8日*

