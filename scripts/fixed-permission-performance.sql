-- 修复后的权限性能优化脚本
-- 文件: scripts/fixed-permission-performance.sql

-- 1. 创建用户权限汇总视图（修复类型不匹配问题）
CREATE OR REPLACE VIEW user_permissions_summary AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.email,
    u.role,
    u.is_active,
    u.work_wechat_userid,
    -- 用户权限（处理text[]类型兼容性）
    CASE 
        WHEN up.menu_permissions IS NOT NULL THEN up.menu_permissions
        WHEN rpt.menu_permissions IS NOT NULL THEN rpt.menu_permissions
        ELSE '{}'::text[]
    END as menu_permissions,
    CASE 
        WHEN up.function_permissions IS NOT NULL THEN up.function_permissions
        WHEN rpt.function_permissions IS NOT NULL THEN rpt.function_permissions
        ELSE '{}'::text[]
    END as function_permissions,
    CASE 
        WHEN up.project_permissions IS NOT NULL THEN up.project_permissions
        WHEN rpt.project_permissions IS NOT NULL THEN rpt.project_permissions
        ELSE '{}'::text[]
    END as project_permissions,
    CASE 
        WHEN up.data_permissions IS NOT NULL THEN up.data_permissions
        WHEN rpt.data_permissions IS NOT NULL THEN rpt.data_permissions
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
LEFT JOIN user_permissions up ON u.id = up.user_id AND up.project_id IS NULL;

-- 2. 创建权限统计函数
CREATE OR REPLACE FUNCTION get_permission_stats()
RETURNS TABLE (
    total_users BIGINT,
    active_users BIGINT,
    total_role_templates BIGINT,
    total_user_permissions BIGINT,
    users_with_custom_permissions BIGINT
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

-- 3. 创建权限性能统计表
CREATE TABLE IF NOT EXISTS permission_performance_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_count BIGINT NOT NULL,
    unique_users BIGINT NOT NULL,
    unique_projects BIGINT NOT NULL,
    last_created TIMESTAMPTZ,
    first_created TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建批量权限更新函数（修复类型转换问题）
CREATE OR REPLACE FUNCTION batch_update_permissions(p_permissions JSONB)
RETURNS TABLE (
    updated_count INTEGER,
    inserted_count INTEGER,
    error_count INTEGER
) AS $$
DECLARE
    perm_record JSONB;
    updated_count integer := 0;
    inserted_count integer := 0;
    error_count integer := 0;
BEGIN
    -- 遍历权限数据
    FOR perm_record IN SELECT * FROM jsonb_array_elements(p_permissions)
    LOOP
        BEGIN
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
                updated_at = NOW();
            
            -- 检查是否是新插入还是更新
            IF FOUND THEN
                IF (perm_record->>'user_id')::uuid IN (SELECT user_id FROM user_permissions WHERE user_id = (perm_record->>'user_id')::uuid) THEN
                    updated_count := updated_count + 1;
                ELSE
                    inserted_count := inserted_count + 1;
                END IF;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE WARNING 'Error processing permission record: %', SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT updated_count, inserted_count, error_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建权限清理函数
CREATE OR REPLACE FUNCTION cleanup_permissions()
RETURNS TABLE (
    cleaned_count INTEGER,
    orphaned_count INTEGER
) AS $$
DECLARE
    cleaned_count integer := 0;
    orphaned_count integer := 0;
BEGIN
    -- 清理无效的用户权限（用户不存在）
    WITH deleted_perms AS (
        DELETE FROM user_permissions 
        WHERE user_id NOT IN (SELECT id FROM profiles)
        RETURNING id
    )
    SELECT COUNT(*) INTO orphaned_count FROM deleted_perms;
    
    -- 清理重复的权限记录（保留最新的）
    WITH ranked_perms AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, project_id 
                   ORDER BY created_at DESC
               ) as rn
        FROM user_permissions
    ),
    deleted_duplicates AS (
        DELETE FROM user_permissions 
        WHERE id IN (
            SELECT id FROM ranked_perms WHERE rn > 1
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO cleaned_count FROM deleted_duplicates;
    
    RETURN QUERY SELECT cleaned_count, orphaned_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 创建权限性能监控函数
CREATE OR REPLACE FUNCTION update_permission_performance_stats()
RETURNS void AS $$
BEGIN
    -- 清空现有统计
    DELETE FROM permission_performance_stats;
    
    -- 插入用户权限统计
    INSERT INTO permission_performance_stats (
        table_name, record_count, unique_users, unique_projects, last_created, first_created
    )
    SELECT 
        'user_permissions' as table_name,
        COUNT(*) as record_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT project_id) as unique_projects,
        MAX(created_at) as last_created,
        MIN(created_at) as first_created
    FROM user_permissions;
    
    -- 插入角色模板统计
    INSERT INTO permission_performance_stats (
        table_name, record_count, unique_users, unique_projects, last_created, first_created
    )
    SELECT 
        'role_permission_templates' as table_name,
        COUNT(*) as record_count,
        0 as unique_users,
        0 as unique_projects,
        MAX(created_at) as last_created,
        MIN(created_at) as first_created
    FROM role_permission_templates;
    
    -- 插入用户统计
    INSERT INTO permission_performance_stats (
        table_name, record_count, unique_users, unique_projects, last_created, first_created
    )
    SELECT 
        'profiles' as table_name,
        COUNT(*) as record_count,
        COUNT(*) as unique_users,
        0 as unique_projects,
        MAX(created_at) as last_created,
        MIN(created_at) as first_created
    FROM profiles;
END;
$$ LANGUAGE plpgsql;

-- 7. 创建索引优化
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_project_id ON user_permissions(project_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_created_at ON user_permissions(created_at);
CREATE INDEX IF NOT EXISTS idx_role_templates_role ON role_permission_templates(role);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- 8. 创建权限缓存表
CREATE TABLE IF NOT EXISTS permission_cache (
    cache_key TEXT PRIMARY KEY,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 创建权限缓存管理函数
CREATE OR REPLACE FUNCTION get_cached_permissions(p_cache_key TEXT)
RETURNS JSONB AS $$
DECLARE
    cached_data JSONB;
BEGIN
    SELECT cache_data INTO cached_data
    FROM permission_cache
    WHERE cache_key = p_cache_key 
    AND expires_at > NOW();
    
    RETURN cached_data;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_cached_permissions(p_cache_key TEXT, p_data JSONB, p_expires_minutes INTEGER DEFAULT 5)
RETURNS void AS $$
BEGIN
    INSERT INTO permission_cache (cache_key, cache_data, expires_at)
    VALUES (p_cache_key, p_data, NOW() + (p_expires_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (cache_key) 
    DO UPDATE SET 
        cache_data = EXCLUDED.cache_data,
        expires_at = EXCLUDED.expires_at;
END;
$$ LANGUAGE plpgsql;

-- 10. 创建权限缓存清理函数
CREATE OR REPLACE FUNCTION cleanup_permission_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM permission_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 11. 创建定时清理任务（Supabase兼容版本）
-- 注意：Supabase使用自己的调度系统，这里提供手动清理函数
CREATE OR REPLACE FUNCTION schedule_permission_maintenance()
RETURNS TABLE (
    maintenance_task TEXT,
    status TEXT,
    next_run TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'cache_cleanup' as maintenance_task,
        '手动执行: SELECT cleanup_permission_cache();' as status,
        NOW() + INTERVAL '1 hour' as next_run
    UNION ALL
    SELECT 
        'stats_update' as maintenance_task,
        '手动执行: SELECT update_permission_performance_stats();' as status,
        NOW() + INTERVAL '1 day' as next_run;
END;
$$ LANGUAGE plpgsql;

-- 完成配置
SELECT '权限性能优化配置完成' as status;
SELECT * FROM get_permission_stats();
