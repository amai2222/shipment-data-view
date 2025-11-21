-- ============================================================================
-- 文件名：20251121_create_batch_user_permissions_function.sql
-- 描述：创建批量查询用户有效权限的 RPC 函数
-- 功能：优化 N+1 查询问题，一次性获取多个用户的有效权限
-- 创建日期：2025-11-21
-- ============================================================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS get_batch_user_effective_permissions_1121(TEXT[]);

-- ============================================================================
-- 函数：get_batch_user_effective_permissions_1121
-- 描述：批量获取用户有效权限（用户权限优先，否则使用角色模板）
-- 参数：
--   p_user_ids: 用户ID数组
-- 返回：JSONB 数组，包含每个用户的有效权限
-- ============================================================================
CREATE OR REPLACE FUNCTION get_batch_user_effective_permissions_1121(
    p_user_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- 批量查询用户权限和角色信息
    WITH user_info AS (
        SELECT 
            p.id,
            p.role,
            p.full_name,
            up.menu_permissions,
            up.function_permissions,
            up.project_permissions,
            up.data_permissions,
            up.created_at AS user_perm_created_at,
            rpt.menu_permissions AS role_menu_permissions,
            rpt.function_permissions AS role_function_permissions,
            rpt.project_permissions AS role_project_permissions,
            rpt.data_permissions AS role_data_permissions
        FROM profiles p
        LEFT JOIN (
            -- 获取每个用户最新的权限记录
            SELECT DISTINCT ON (user_id)
                user_id,
                menu_permissions,
                function_permissions,
                project_permissions,
                data_permissions,
                created_at
            FROM user_permissions
            WHERE user_id = ANY(p_user_ids)
            ORDER BY user_id, created_at DESC
        ) up ON p.id = up.user_id
        LEFT JOIN role_permission_templates rpt ON p.role = rpt.role
        WHERE p.id = ANY(p_user_ids)
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', id,
            'menu_permissions', COALESCE(
                menu_permissions,
                role_menu_permissions,
                '[]'::JSONB
            ),
            'function_permissions', COALESCE(
                function_permissions,
                role_function_permissions,
                '[]'::JSONB
            ),
            'project_permissions', COALESCE(
                project_permissions,
                role_project_permissions,
                '[]'::JSONB
            ),
            'data_permissions', COALESCE(
                data_permissions,
                role_data_permissions,
                '[]'::JSONB
            ),
            'source', CASE
                WHEN menu_permissions IS NOT NULL THEN 'user'
                WHEN role_menu_permissions IS NOT NULL THEN 'role'
                ELSE 'default'
            END,
            'created_at', COALESCE(user_perm_created_at, NOW())
        )
    ) INTO v_result
    FROM user_info;

    -- 返回结果
    RETURN COALESCE(v_result, '[]'::JSONB);
    
EXCEPTION
    WHEN OTHERS THEN
        -- 记录错误
        RAISE WARNING '批量获取用户有效权限失败: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        -- 返回空数组
        RETURN '[]'::JSONB;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_batch_user_effective_permissions_1121 IS '
批量获取用户有效权限（优化版本）
- 一次查询获取多个用户的权限信息
- 自动合并用户权限和角色模板权限
- 优先使用用户特定权限，否则使用角色模板
- 解决 N+1 查询问题，提升性能
';

-- ============================================================================
-- 授权：允许经过认证的用户调用此函数
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_batch_user_effective_permissions_1121(TEXT[]) TO authenticated;

-- ============================================================================
-- 测试查询
-- ============================================================================
-- SELECT get_batch_user_effective_permissions_1121(ARRAY['user-id-1', 'user-id-2']);

