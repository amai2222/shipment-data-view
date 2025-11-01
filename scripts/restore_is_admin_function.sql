-- ============================================================================
-- 恢复 is_admin() 函数
-- ============================================================================
-- 用途: 从备份恢复 is_admin() 函数
-- 注意: 请先查看 scripts/backup_is_admin_function.sql 确定使用哪个版本
-- ============================================================================

-- ============================================================================
-- 方法1: 恢复 SQL 版本（简单高效）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS '检查当前用户是否为管理员（SQL版本，从备份恢复）';

-- ============================================================================
-- 方法2: 恢复 PL/pgSQL 版本（逻辑清晰）
-- ============================================================================
-- 如果方法1不工作，尝试使用这个方法

/*
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
BEGIN
    -- 获取当前用户ID
    v_user_id := auth.uid();
    
    -- 如果用户未登录，返回false
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 获取用户角色
    SELECT role::TEXT INTO v_user_role
    FROM public.profiles
    WHERE id = v_user_id;
    
    -- 返回是否为admin
    RETURN v_user_role = 'admin';
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS '检查当前用户是否为管理员（PL/pgSQL版本，从备份恢复）';
*/

-- ============================================================================
-- 验证恢复结果
-- ============================================================================

-- 测试函数是否正常工作
SELECT 
    '函数测试' as test,
    public.is_admin() as is_admin_result,
    auth.uid() as current_user_id,
    (SELECT role FROM public.profiles WHERE id = auth.uid()) as current_user_role;

-- 显示函数定义确认恢复成功
SELECT 
    '恢复验证' as verification,
    proname as function_name,
    prosrc as source_code,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'is_admin'
  AND pronamespace = 'public'::regnamespace
ORDER BY pronargs;

