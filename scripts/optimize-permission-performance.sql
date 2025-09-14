-- 权限管理性能优化脚本
-- 文件: scripts/optimize-permission-performance.sql

-- 1. 为权限相关表添加索引
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_project_id ON user_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_created_at ON user_permissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_project ON user_permissions(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_role_permission_templates_role ON role_permission_templates(role);
CREATE INDEX IF NOT EXISTS idx_role_permission_templates_is_system ON role_permission_templates(is_system);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(project_status);

-- 2. 创建权限数据视图（预计算）
CREATE OR REPLACE VIEW user_permissions_summary AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.email,
    u.role,
    u.is_active,
    u.work_wechat_userid,
    -- 用户权限（处理text[]和jsonb类型兼容性）
    CASE 
        WHEN up.menu_permissions IS NOT NULL THEN up.menu_permissions::text[]
        WHEN rpt.menu_permissions IS NOT NULL THEN rpt.menu_permissions::text[]
        ELSE '{}'::text[]
    END as menu_permissions,
    CASE 
        WHEN up.function_permissions IS NOT NULL THEN up.function_permissions::text[]
        WHEN rpt.function_permissions IS NOT NULL THEN rpt.function_permissions::text[]
        ELSE '{}'::text[]
    END as function_permissions,
    CASE 
        WHEN up.project_permissions IS NOT NULL THEN up.project_permissions::text[]
        WHEN rpt.project_permissions IS NOT NULL THEN rpt.project_permissions::text[]
        ELSE '{}'::text[]
    END as project_permissions,
    CASE 
        WHEN up.data_permissions IS NOT NULL THEN up.data_permissions::text[]
        WHEN rpt.data_permissions IS NOT NULL THEN rpt.data_permissions::text[]
        ELSE '{}'::text[]
    END as data_permissions,
    -- 权限来源
    CASE 
        WHEN up.user_id IS NOT NULL THEN 'user'
        ELSE 'role'
    END as permission_source,
    -- 最后更新时间
    GREATEST(
        COALESCE(up.updated_at, up.created_at, '1970-01-01'::timestamptz),
        COALESCE(rpt.updated_at, rpt.created_at, '1970-01-01'::timestamptz)
    ) as last_updated
FROM profiles u
LEFT JOIN role_permission_templates rpt ON u.role = rpt.role
LEFT JOIN LATERAL (
    SELECT *
    FROM user_permissions up
    WHERE up.user_id = u.id
    ORDER BY up.created_at DESC
    LIMIT 1
) up ON true
WHERE u.is_active = true;

-- 3. 创建权限统计函数
CREATE OR REPLACE FUNCTION get_permission_stats()
RETURNS TABLE (
    total_users bigint,
    active_users bigint,
    total_role_templates bigint,
    total_user_permissions bigint,
    users_with_custom_permissions bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM profiles) as total_users,
        (SELECT COUNT(*) FROM profiles WHERE is_active = true) as active_users,
        (SELECT COUNT(*) FROM role_permission_templates) as total_role_templates,
        (SELECT COUNT(*) FROM user_permissions) as total_user_permissions,
        (SELECT COUNT(DISTINCT user_id) FROM user_permissions) as users_with_custom_permissions;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建批量权限更新函数
CREATE OR REPLACE FUNCTION batch_update_user_permissions(
    p_permissions jsonb
)
RETURNS TABLE (
    updated_count integer,
    inserted_count integer
) AS $$
DECLARE
    perm_record jsonb;
    updated_count integer := 0;
    inserted_count integer := 0;
BEGIN
    -- 遍历权限数据
    FOR perm_record IN SELECT * FROM jsonb_array_elements(p_permissions)
    LOOP
        -- 使用 UPSERT 更新或插入权限
        INSERT INTO user_permissions (
            user_id,
            project_id,
            menu_permissions,
            function_permissions,
            project_permissions,
            data_permissions,
            created_by
        ) VALUES (
            (perm_record->>'user_id')::uuid,
            CASE 
                WHEN perm_record->>'project_id' IS NOT NULL 
                THEN (perm_record->>'project_id')::uuid 
                ELSE NULL 
            END,
            CASE 
                WHEN perm_record->'menu_permissions' IS NOT NULL 
                THEN (perm_record->'menu_permissions')::text[]
                ELSE '{}'::text[]
            END,
            CASE 
                WHEN perm_record->'function_permissions' IS NOT NULL 
                THEN (perm_record->'function_permissions')::text[]
                ELSE '{}'::text[]
            END,
            CASE 
                WHEN perm_record->'project_permissions' IS NOT NULL 
                THEN (perm_record->'project_permissions')::text[]
                ELSE '{}'::text[]
            END,
            CASE 
                WHEN perm_record->'data_permissions' IS NOT NULL 
                THEN (perm_record->'data_permissions')::text[]
                ELSE '{}'::text[]
            END,
            auth.uid()
        )
        ON CONFLICT (user_id, project_id) 
        DO UPDATE SET
            menu_permissions = EXCLUDED.menu_permissions,
            function_permissions = EXCLUDED.function_permissions,
            project_permissions = EXCLUDED.project_permissions,
            data_permissions = EXCLUDED.data_permissions,
            updated_at = NOW()
        WHERE user_permissions.menu_permissions IS DISTINCT FROM EXCLUDED.menu_permissions
           OR user_permissions.function_permissions IS DISTINCT FROM EXCLUDED.function_permissions
           OR user_permissions.project_permissions IS DISTINCT FROM EXCLUDED.project_permissions
           OR user_permissions.data_permissions IS DISTINCT FROM EXCLUDED.data_permissions;
        
        -- 统计更新和插入数量
        IF FOUND THEN
            updated_count := updated_count + 1;
        ELSE
            inserted_count := inserted_count + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT updated_count, inserted_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建权限清理函数（删除重复和过期权限）
CREATE OR REPLACE FUNCTION cleanup_permissions()
RETURNS TABLE (
    deleted_duplicates integer,
    deleted_expired integer
) AS $$
DECLARE
    deleted_duplicates integer := 0;
    deleted_expired integer := 0;
BEGIN
    -- 删除重复权限（保留最新的）
    WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, project_id 
                   ORDER BY created_at DESC
               ) as rn
        FROM user_permissions
    )
    DELETE FROM user_permissions 
    WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
    );
    
    GET DIAGNOSTICS deleted_duplicates = ROW_COUNT;
    
    -- 删除过期权限（超过1年的权限记录）
    DELETE FROM user_permissions 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_expired = ROW_COUNT;
    
    RETURN QUERY SELECT deleted_duplicates, deleted_expired;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建权限缓存刷新函数
CREATE OR REPLACE FUNCTION refresh_permission_cache()
RETURNS void AS $$
BEGIN
    -- 刷新权限统计
    REFRESH MATERIALIZED VIEW IF EXISTS user_permissions_summary;
    
    -- 更新权限模板缓存
    PERFORM pg_notify('permission_cache_refresh', 'templates');
    
    -- 更新用户权限缓存
    PERFORM pg_notify('permission_cache_refresh', 'users');
END;
$$ LANGUAGE plpgsql;

-- 7. 添加权限变更触发器
CREATE OR REPLACE FUNCTION notify_permission_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 通知权限变更
    PERFORM pg_notify('permission_changed', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'user_id', COALESCE(NEW.user_id, OLD.user_id),
        'timestamp', NOW()
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 为权限表添加触发器
DROP TRIGGER IF EXISTS permission_change_trigger ON user_permissions;
CREATE TRIGGER permission_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION notify_permission_change();

DROP TRIGGER IF EXISTS role_template_change_trigger ON role_permission_templates;
CREATE TRIGGER role_template_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON role_permission_templates
    FOR EACH ROW EXECUTE FUNCTION notify_permission_change();

-- 8. 创建权限查询优化函数
CREATE OR REPLACE FUNCTION get_user_permissions_optimized(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
    user_id uuid,
    full_name text,
    email text,
    role text,
    is_active boolean,
    menu_permissions jsonb,
    function_permissions jsonb,
    project_permissions jsonb,
    data_permissions jsonb,
    permission_source text,
    last_updated timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ups.user_id,
        ups.full_name,
        ups.email,
        ups.role,
        ups.is_active,
        ups.menu_permissions,
        ups.function_permissions,
        ups.project_permissions,
        ups.data_permissions,
        ups.permission_source,
        ups.last_updated
    FROM user_permissions_summary ups
    WHERE (p_user_id IS NULL OR ups.user_id = p_user_id)
    ORDER BY ups.full_name;
END;
$$ LANGUAGE plpgsql;

-- 9. 添加权限表统计信息
ANALYZE user_permissions;
ANALYZE role_permission_templates;
ANALYZE profiles;
ANALYZE projects;

-- 10. 创建权限性能监控视图
CREATE OR REPLACE VIEW permission_performance_stats AS
SELECT 
    'user_permissions' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT project_id) as unique_projects,
    MAX(created_at) as last_created,
    MIN(created_at) as first_created
FROM user_permissions
UNION ALL
SELECT 
    'role_permission_templates' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT role) as unique_roles,
    0 as unique_projects,
    MAX(created_at) as last_created,
    MIN(created_at) as first_created
FROM role_permission_templates
UNION ALL
SELECT 
    'profiles' as table_name,
    COUNT(*) as record_count,
    COUNT(DISTINCT role) as unique_roles,
    0 as unique_projects,
    MAX(created_at) as last_created,
    MIN(created_at) as first_created
FROM profiles;

-- 完成优化
SELECT '权限管理性能优化完成' as status;
