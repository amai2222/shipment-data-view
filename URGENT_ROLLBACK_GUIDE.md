# 🚨 紧急回滚指南

## 问题
执行RLS修复SQL后，网页打不开了

## 🚀 立即执行回滚

### 在Supabase SQL Editor中执行：

```sql
BEGIN;

-- 删除刚才创建的严格策略
DROP POLICY IF EXISTS "profiles_service_role_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 创建宽松的SELECT策略（关键！允许所有已认证用户查看）
CREATE POLICY "profiles_select_all_authenticated" 
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 创建INSERT策略（允许service_role）
CREATE POLICY "profiles_insert_service_role" 
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- 创建UPDATE策略（用户可以更新自己）
CREATE POLICY "profiles_update_own_or_admin" 
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 创建DELETE策略
CREATE POLICY "profiles_delete_admin_only" 
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

COMMIT;
```

### 执行后：
1. 刷新浏览器（Ctrl+F5）
2. 网页应该能打开了
3. 清除缓存后重新登录

---

## 原因分析

之前的SELECT策略太严格：
```sql
-- 问题策略
USING (
  auth.role() = 'service_role'  -- 只允许service_role
  OR id = auth.uid()             -- 或自己
  OR EXISTS (...)                -- 或admin/finance
)
```

这导致普通用户在登录时无法查询profiles表，影响了认证流程。

---

## 立即执行回滚SQL！

文件：`scripts/ROLLBACK_PROFILES_RLS.sql`

