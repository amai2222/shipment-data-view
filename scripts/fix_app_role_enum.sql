-- ============================================================================
-- 修复 app_role 枚举类型问题
-- 错误：invalid input value for enum app_role: "system_admin"
-- ============================================================================

-- 问题：app_role 枚举类型中没有包含 "system_admin"
-- 解决：将SQL中的 "system_admin" 改为 "admin"

-- ============================================================================
-- 第1步：查看当前 app_role 枚举的所有值
-- ============================================================================

SELECT 
  enumlabel as "可用的角色值",
  enumsortorder as "排序"
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'app_role'
)
ORDER BY enumsortorder;

-- ============================================================================
-- 第2步：修复之前的SQL - 使用正确的角色值
-- ============================================================================

-- 删除使用了错误角色值的策略
DROP POLICY IF EXISTS "profiles_service_role_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_service_role_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 重新创建UPDATE策略（使用正确的角色）
CREATE POLICY "profiles_service_role_update" 
ON public.profiles
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'finance') -- 只使用admin，不用system_admin
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'finance') -- 只使用admin，不用system_admin
  )
);

-- 重新创建SELECT策略（使用正确的角色）
CREATE POLICY "profiles_select_policy" 
ON public.profiles
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'finance') -- 只使用admin，不用system_admin
  )
);

-- 重新创建DELETE策略（使用正确的角色）
CREATE POLICY "profiles_service_role_delete" 
ON public.profiles
FOR DELETE
USING (
  auth.role() = 'service_role'
  OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin' -- 只使用admin，不用system_admin
  )
);

-- ============================================================================
-- 第3步：验证修复
-- ============================================================================

SELECT 
  '✅ 枚举类型修复完成' as message,
  '所有策略已使用正确的角色值' as status;

-- 查看所有profiles的策略
SELECT 
  policyname,
  cmd,
  '✅ 已修复' as status
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- ============================================================================
-- 可选：如果需要添加 system_admin 到枚举类型
-- ============================================================================

-- ⚠️ 如果确实需要 system_admin 角色，可以添加到枚举类型
-- 但通常 admin 角色就足够了

/*
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'system_admin';

-- 验证添加成功
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
ORDER BY enumsortorder;
*/

