-- ============================================================================
-- 备份 is_admin() 函数
-- ============================================================================
-- 备份时间: 2025-11-02
-- 用途: 保存现有的 is_admin() 函数定义，以便在需要时恢复
-- ============================================================================

-- ============================================================================
-- 方法1: 查询当前数据库中的函数定义
-- ============================================================================
-- 在 Supabase SQL Editor 中运行以下查询，获取当前函数的完整定义：

SELECT 
    pg_get_functiondef(oid) as function_definition,
    proname as function_name,
    pronargs as argument_count,
    prorettype::regtype as return_type,
    proargtypes::regtype[] as argument_types,
    prosrc as function_source_code
FROM pg_proc
WHERE proname = 'is_admin'
  AND pronamespace = 'public'::regnamespace
ORDER BY pronargs;

-- ============================================================================
-- 方法2: 已知的旧版本函数定义（手动备份）
-- ============================================================================

-- 版本A: SQL 语言版本（来自 scripts/fix-contract-tables.sql）
-- 这个版本使用 LANGUAGE SQL，可能更简单高效
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

-- 版本B: PL/pgSQL 语言版本（来自新 migration）
-- 这个版本使用 LANGUAGE plpgsql，逻辑更清晰
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

-- ============================================================================
-- 版本对比
-- ============================================================================
-- 版本A (SQL):
--   - 优点: 更简洁，性能可能更好（由查询优化器处理）
--   - 缺点: 逻辑简单，难以扩展
-- 
-- 版本B (PL/pgSQL):
--   - 优点: 逻辑清晰，易于理解和扩展
--   - 缺点: 稍微复杂一些
-- 
-- 两个版本功能等价，但实现方式不同
-- ============================================================================

-- ============================================================================
-- 恢复方法
-- ============================================================================
-- 
-- 如果需要恢复旧函数：
-- 
-- 1. 确定当前使用的是哪个版本
--   运行方法1的查询，查看 function_source_code
-- 
-- 2. 根据查询结果选择对应的版本
--   - 如果 prosrc 包含 "SELECT EXISTS"，使用版本A
--   - 如果 prosrc 包含 "DECLARE"，使用版本B
-- 
-- 3. 执行恢复
--   复制对应的 CREATE OR REPLACE FUNCTION 语句并执行
-- 
-- ============================================================================

-- ============================================================================
-- 检查函数依赖关系
-- ============================================================================
-- 查看哪些对象依赖 is_admin() 函数：

SELECT 
    dependent_ns.nspname as dependent_schema,
    dependent_view.relname as dependent_view,
    dependent_view.relkind as dependent_type
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid
JOIN pg_namespace dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
JOIN pg_namespace source_ns ON source_table.relnamespace = source_ns.oid
WHERE source_ns.nspname = 'public'
  AND source_table.relname IN (
      SELECT oid::text 
      FROM pg_proc 
      WHERE proname = 'is_admin' 
        AND pronamespace = 'public'::regnamespace
  )
GROUP BY dependent_ns.nspname, dependent_view.relname, dependent_view.relkind;

-- ============================================================================
-- 备份完成
-- ============================================================================
