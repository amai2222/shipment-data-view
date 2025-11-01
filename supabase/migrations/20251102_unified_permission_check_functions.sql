-- ============================================================================
-- 统一权限检查函数
-- ============================================================================
-- 功能：
--   1. 创建统一的权限检查函数，替代硬编码角色判断
--   2. 支持菜单权限、功能权限、数据权限检查
--   3. 自动处理用户自定义权限和角色模板权限
--   4. admin 角色自动拥有所有权限（保持兼容）
-- ============================================================================
-- 创建时间: 2025-11-02
-- ============================================================================

-- ============================================================================
-- Step 1: 检查菜单权限
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_menu_permission(p_menu_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_has_permission BOOLEAN := FALSE;
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
    
    -- 如果角色不存在，返回false
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- admin 角色自动拥有所有权限（保持兼容性）
    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- 检查用户自定义权限（全局权限，project_id IS NULL）
    SELECT EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
          AND p_menu_key = ANY(menu_permissions)
          AND array_length(menu_permissions, 1) > 0  -- 确保权限数组不为空
    ) INTO v_has_permission;
    
    -- 如果用户有自定义权限，直接返回
    IF v_has_permission THEN
        RETURN TRUE;
    END IF;
    
    -- 检查用户是否有自定义权限记录（即使为空数组）
    -- 如果有自定义记录但权限为空，说明用户被明确禁止，不应使用角色模板
    IF EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
    ) THEN
        -- 有自定义记录，检查是否为空数组
        SELECT EXISTS (
            SELECT 1
            FROM public.user_permissions
            WHERE user_id = v_user_id
              AND project_id IS NULL
              AND (
                  menu_permissions IS NULL
                  OR array_length(menu_permissions, 1) = 0
              )
        ) INTO v_has_permission;
        
        -- 如果权限数组为空，返回false（明确禁止）
        IF v_has_permission THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- 检查角色模板权限
    SELECT EXISTS (
        SELECT 1
        FROM public.role_permission_templates
        WHERE role = v_user_role
          AND p_menu_key = ANY(menu_permissions)
          AND array_length(menu_permissions, 1) > 0
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$;

COMMENT ON FUNCTION public.has_menu_permission IS '检查用户是否有指定的菜单权限（支持用户自定义权限和角色模板）';

-- ============================================================================
-- Step 2: 检查功能权限
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_function_permission(p_function_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_has_permission BOOLEAN := FALSE;
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
    
    -- 如果角色不存在，返回false
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- admin 角色自动拥有所有权限（保持兼容性）
    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- 检查用户自定义权限（全局权限，project_id IS NULL）
    SELECT EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
          AND p_function_key = ANY(function_permissions)
          AND array_length(function_permissions, 1) > 0
    ) INTO v_has_permission;
    
    -- 如果用户有自定义权限，直接返回
    IF v_has_permission THEN
        RETURN TRUE;
    END IF;
    
    -- 检查用户是否有自定义权限记录（即使为空数组）
    IF EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
    ) THEN
        -- 有自定义记录，检查是否为空数组
        SELECT EXISTS (
            SELECT 1
            FROM public.user_permissions
            WHERE user_id = v_user_id
              AND project_id IS NULL
              AND (
                  function_permissions IS NULL
                  OR array_length(function_permissions, 1) = 0
              )
        ) INTO v_has_permission;
        
        -- 如果权限数组为空，返回false（明确禁止）
        IF v_has_permission THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- 检查角色模板权限
    SELECT EXISTS (
        SELECT 1
        FROM public.role_permission_templates
        WHERE role = v_user_role
          AND p_function_key = ANY(function_permissions)
          AND array_length(function_permissions, 1) > 0
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$;

COMMENT ON FUNCTION public.has_function_permission IS '检查用户是否有指定的功能权限（支持用户自定义权限和角色模板）';

-- ============================================================================
-- Step 3: 检查数据权限
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_data_permission(p_data_scope TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_has_permission BOOLEAN := FALSE;
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
    
    -- 如果角色不存在，返回false
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- admin 角色自动拥有所有权限（保持兼容性）
    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- 检查用户自定义权限（全局权限，project_id IS NULL）
    SELECT EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
          AND p_data_scope = ANY(data_permissions)
          AND array_length(data_permissions, 1) > 0
    ) INTO v_has_permission;
    
    -- 如果用户有自定义权限，直接返回
    IF v_has_permission THEN
        RETURN TRUE;
    END IF;
    
    -- 检查用户是否有自定义权限记录（即使为空数组）
    IF EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
    ) THEN
        -- 有自定义记录，检查是否为空数组
        SELECT EXISTS (
            SELECT 1
            FROM public.user_permissions
            WHERE user_id = v_user_id
              AND project_id IS NULL
              AND (
                  data_permissions IS NULL
                  OR array_length(data_permissions, 1) = 0
              )
        ) INTO v_has_permission;
        
        -- 如果权限数组为空，返回false（明确禁止）
        IF v_has_permission THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- 检查角色模板权限
    SELECT EXISTS (
        SELECT 1
        FROM public.role_permission_templates
        WHERE role = v_user_role
          AND p_data_scope = ANY(data_permissions)
          AND array_length(data_permissions, 1) > 0
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$;

COMMENT ON FUNCTION public.has_data_permission IS '检查用户是否有指定的数据权限（支持用户自定义权限和角色模板）';

-- ============================================================================
-- Step 4: 检查项目权限
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_project_permission(p_project_scope TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_has_permission BOOLEAN := FALSE;
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
    
    -- 如果角色不存在，返回false
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- admin 角色自动拥有所有权限（保持兼容性）
    IF v_user_role = 'admin' THEN
        RETURN TRUE;
    END IF;
    
    -- 检查用户自定义权限（全局权限，project_id IS NULL）
    SELECT EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
          AND p_project_scope = ANY(project_permissions)
          AND array_length(project_permissions, 1) > 0
    ) INTO v_has_permission;
    
    -- 如果用户有自定义权限，直接返回
    IF v_has_permission THEN
        RETURN TRUE;
    END IF;
    
    -- 检查用户是否有自定义权限记录（即使为空数组）
    IF EXISTS (
        SELECT 1
        FROM public.user_permissions
        WHERE user_id = v_user_id
          AND project_id IS NULL
    ) THEN
        -- 有自定义记录，检查是否为空数组
        SELECT EXISTS (
            SELECT 1
            FROM public.user_permissions
            WHERE user_id = v_user_id
              AND project_id IS NULL
              AND (
                  project_permissions IS NULL
                  OR array_length(project_permissions, 1) = 0
              )
        ) INTO v_has_permission;
        
        -- 如果权限数组为空，返回false（明确禁止）
        IF v_has_permission THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- 检查角色模板权限
    SELECT EXISTS (
        SELECT 1
        FROM public.role_permission_templates
        WHERE role = v_user_role
          AND p_project_scope = ANY(project_permissions)
          AND array_length(project_permissions, 1) > 0
    ) INTO v_has_permission;
    
    RETURN v_has_permission;
END;
$$;

COMMENT ON FUNCTION public.has_project_permission IS '检查用户是否有指定的项目权限（支持用户自定义权限和角色模板）';

-- ============================================================================
-- Step 5: 辅助函数 - 检查用户是否为管理员
-- ============================================================================

-- 删除所有旧函数版本（如果存在，避免冲突）
-- 注意：可能有多个重载版本，需要删除所有可能的签名
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- 查找所有 is_admin 函数的变体
    FOR func_record IN
        SELECT 
            proname,
            pg_get_function_identity_arguments(oid) as args,
            oid
        FROM pg_proc
        WHERE proname = 'is_admin'
          AND pronamespace = 'public'::regnamespace
    LOOP
        -- 删除每个版本的函数
        EXECUTE format('DROP FUNCTION IF EXISTS public.is_admin(%s) CASCADE', func_record.args);
        RAISE NOTICE '已删除函数: public.is_admin(%)', func_record.args;
    END LOOP;
END $$;

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

COMMENT ON FUNCTION public.is_admin IS '检查当前用户是否为管理员（保持向后兼容）';

-- ============================================================================
-- Step 6: 验证函数创建成功
-- ============================================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 统一权限检查函数创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- 检查函数数量
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname IN (
        'has_menu_permission',
        'has_function_permission',
        'has_data_permission',
        'has_project_permission',
        'is_admin'
    )
    AND pronamespace = 'public'::regnamespace;
    
    RAISE NOTICE '已创建函数数量: %', v_count;
    RAISE NOTICE '';
    RAISE NOTICE '函数列表:';
    RAISE NOTICE '  ✅ has_menu_permission(menu_key TEXT) - 检查菜单权限';
    RAISE NOTICE '  ✅ has_function_permission(function_key TEXT) - 检查功能权限';
    RAISE NOTICE '  ✅ has_data_permission(data_scope TEXT) - 检查数据权限';
    RAISE NOTICE '  ✅ has_project_permission(project_scope TEXT) - 检查项目权限';
    RAISE NOTICE '  ✅ is_admin() - 检查是否为管理员（兼容）';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '使用示例:';
    RAISE NOTICE '  SELECT has_menu_permission(''settings.users'');';
    RAISE NOTICE '  SELECT has_function_permission(''logistics.modify_chain'');';
    RAISE NOTICE '  SELECT has_data_permission(''partner.view_all'');';
    RAISE NOTICE '  SELECT is_admin();';
    RAISE NOTICE '========================================';
END $$;

