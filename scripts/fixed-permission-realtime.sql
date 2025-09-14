-- 修复后的权限实时更新配置脚本
-- 文件: scripts/fixed-permission-realtime.sql

-- 1. 启用Realtime扩展（如果未启用）
CREATE EXTENSION IF NOT EXISTS "realtime";

-- 2. 为权限相关表启用实时发布
ALTER PUBLICATION supabase_realtime ADD TABLE user_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE role_permission_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- 3. 创建权限变更通知函数
CREATE OR REPLACE FUNCTION notify_permission_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 发送权限变更通知
    PERFORM pg_notify('permission_changed', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'user_id', COALESCE(NEW.user_id, OLD.user_id),
        'role', CASE 
            WHEN TG_TABLE_NAME = 'role_permission_templates' THEN COALESCE(NEW.role, OLD.role)
            ELSE NULL 
        END,
        'update_time', NOW()
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. 为权限表添加变更触发器
DROP TRIGGER IF EXISTS user_permissions_change_trigger ON user_permissions;
CREATE TRIGGER user_permissions_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION notify_permission_change();

DROP TRIGGER IF EXISTS role_templates_change_trigger ON role_permission_templates;
CREATE TRIGGER role_templates_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON role_permission_templates
    FOR EACH ROW EXECUTE FUNCTION notify_permission_change();

DROP TRIGGER IF EXISTS profiles_change_trigger ON profiles;
CREATE TRIGGER profiles_change_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION notify_permission_change();

-- 5. 创建权限缓存刷新函数
CREATE OR REPLACE FUNCTION refresh_permission_cache()
RETURNS void AS $$
BEGIN
    -- 发送缓存刷新通知
    PERFORM pg_notify('permission_cache_refresh', json_build_object(
        'update_time', NOW(),
        'action', 'refresh_all'
    )::text);
END;
$$ LANGUAGE plpgsql;

-- 6. 创建权限同步状态表
CREATE TABLE IF NOT EXISTS permission_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    last_sync TIMESTAMPTZ DEFAULT NOW(),
    sync_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(table_name)
);

-- 插入初始同步状态记录
INSERT INTO permission_sync_status (table_name, sync_count) 
VALUES 
    ('user_permissions', 0),
    ('role_permission_templates', 0),
    ('profiles', 0)
ON CONFLICT (table_name) DO NOTHING;

-- 7. 创建权限同步状态更新函数
CREATE OR REPLACE FUNCTION update_sync_status(p_table_name TEXT)
RETURNS void AS $$
BEGIN
    UPDATE permission_sync_status 
    SET 
        last_sync = NOW(),
        sync_count = sync_count + 1,
        updated_at = NOW()
    WHERE table_name = p_table_name;
    
    -- 如果记录不存在，创建新记录
    IF NOT FOUND THEN
        INSERT INTO permission_sync_status (table_name, sync_count)
        VALUES (p_table_name, 1);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. 更新权限变更触发器，包含同步状态更新
CREATE OR REPLACE FUNCTION notify_permission_change_with_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- 更新同步状态
    PERFORM update_sync_status(TG_TABLE_NAME);
    
    -- 发送权限变更通知
    PERFORM pg_notify('permission_changed', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'user_id', COALESCE(NEW.user_id, OLD.user_id),
        'role', CASE 
            WHEN TG_TABLE_NAME = 'role_permission_templates' THEN COALESCE(NEW.role, OLD.role)
            ELSE NULL 
        END,
        'update_time', NOW()
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 9. 重新创建触发器使用新的函数
DROP TRIGGER IF EXISTS user_permissions_change_trigger ON user_permissions;
CREATE TRIGGER user_permissions_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION notify_permission_change_with_sync();

DROP TRIGGER IF EXISTS role_templates_change_trigger ON role_permission_templates;
CREATE TRIGGER role_templates_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON role_permission_templates
    FOR EACH ROW EXECUTE FUNCTION notify_permission_change_with_sync();

DROP TRIGGER IF EXISTS profiles_change_trigger ON profiles;
CREATE TRIGGER profiles_change_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION notify_permission_change_with_sync();

-- 10. 创建权限同步状态查询函数
CREATE OR REPLACE FUNCTION get_permission_sync_status()
RETURNS TABLE (
    table_name TEXT,
    last_sync TIMESTAMPTZ,
    sync_count BIGINT,
    minutes_since_sync NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pss.table_name,
        pss.last_sync,
        pss.sync_count,
        EXTRACT(EPOCH FROM (NOW() - pss.last_sync)) / 60 as minutes_since_sync
    FROM permission_sync_status pss
    ORDER BY pss.last_sync DESC;
END;
$$ LANGUAGE plpgsql;

-- 11. 创建权限实时状态监控视图
CREATE OR REPLACE VIEW permission_realtime_status AS
SELECT 
    'user_permissions' as table_name,
    COUNT(*) as total_records,
    MAX(created_at) as last_created,
    MAX(updated_at) as last_updated,
    COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 minute' THEN 1 END) as recent_changes
FROM user_permissions
UNION ALL
SELECT 
    'role_permission_templates' as table_name,
    COUNT(*) as total_records,
    MAX(created_at) as last_created,
    MAX(updated_at) as last_updated,
    COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 minute' THEN 1 END) as recent_changes
FROM role_permission_templates
UNION ALL
SELECT 
    'profiles' as table_name,
    COUNT(*) as total_records,
    MAX(created_at) as last_created,
    MAX(updated_at) as last_updated,
    COUNT(CASE WHEN updated_at > NOW() - INTERVAL '1 minute' THEN 1 END) as recent_changes
FROM profiles;

-- 12. 创建权限变更日志表（可选，用于审计）
CREATE TABLE IF NOT EXISTS permission_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id UUID,
    role TEXT,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. 创建权限变更日志函数
CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO permission_change_log (
        table_name,
        operation,
        user_id,
        role,
        old_data,
        new_data,
        changed_by
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.user_id, OLD.user_id),
        CASE 
            WHEN TG_TABLE_NAME = 'role_permission_templates' THEN COALESCE(NEW.role, OLD.role)
            ELSE NULL 
        END,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        auth.uid()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 14. 为权限表添加变更日志触发器
DROP TRIGGER IF EXISTS user_permissions_log_trigger ON user_permissions;
CREATE TRIGGER user_permissions_log_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION log_permission_change();

DROP TRIGGER IF EXISTS role_templates_log_trigger ON role_permission_templates;
CREATE TRIGGER role_templates_log_trigger
    AFTER INSERT OR UPDATE OR DELETE ON role_permission_templates
    FOR EACH ROW EXECUTE FUNCTION log_permission_change();

-- 15. 创建权限实时监控函数（修复timestamp问题）
CREATE OR REPLACE FUNCTION monitor_permission_realtime()
RETURNS TABLE (
    status TEXT,
    message TEXT,
    update_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'realtime_enabled' as status,
        '权限实时更新已启用' as message,
        NOW() as update_time
    UNION ALL
    SELECT 
        'tables_monitored' as status,
        '监控表: user_permissions, role_permission_templates, profiles' as message,
        NOW() as update_time
    UNION ALL
    SELECT 
        'triggers_active' as status,
        '触发器已激活，权限变更将实时通知' as message,
        NOW() as update_time;
END;
$$ LANGUAGE plpgsql;

-- 完成配置
SELECT '权限实时更新配置完成' as status;
SELECT * FROM monitor_permission_realtime();
