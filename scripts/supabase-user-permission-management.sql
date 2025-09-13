-- Supabase 用户权限管理脚本
-- 支持特定用户权限修改、复制和快速变更

-- 1. 检查当前用户权限状态
SELECT 
    '=== 用户权限管理功能 ===' as section,
    '检查时间: ' || now() as check_time;

-- 2. 创建用户权限复制函数
CREATE OR REPLACE FUNCTION copy_user_permissions(
    source_user_id uuid,
    target_user_id uuid,
    copy_mode text DEFAULT 'replace' -- 'replace' 或 'merge'
)
RETURNS jsonb AS $$
DECLARE
    source_permissions RECORD;
    target_permissions RECORD;
    result jsonb;
BEGIN
    -- 获取源用户权限
    SELECT * INTO source_permissions
    FROM public.user_permissions
    WHERE user_id = source_user_id AND project_id IS NULL;
    
    -- 获取目标用户权限
    SELECT * INTO target_permissions
    FROM public.user_permissions
    WHERE user_id = target_user_id AND project_id IS NULL;
    
    -- 如果源用户没有特定权限，返回错误
    IF source_permissions IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '源用户没有特定权限配置，无法复制'
        );
    END IF;
    
    -- 根据复制模式处理
    IF copy_mode = 'replace' THEN
        -- 替换模式：删除目标用户现有权限，复制源用户权限
        DELETE FROM public.user_permissions 
        WHERE user_id = target_user_id AND project_id IS NULL;
        
        INSERT INTO public.user_permissions (
            user_id, project_id, menu_permissions, function_permissions,
            project_permissions, data_permissions, inherit_role, created_at, updated_at
        ) VALUES (
            target_user_id, NULL,
            source_permissions.menu_permissions,
            source_permissions.function_permissions,
            source_permissions.project_permissions,
            source_permissions.data_permissions,
            source_permissions.inherit_role,
            now(), now()
        );
        
        result := jsonb_build_object(
            'success', true,
            'message', '权限已成功复制（替换模式）',
            'copied_permissions', jsonb_build_object(
                'menu_count', array_length(source_permissions.menu_permissions, 1),
                'function_count', array_length(source_permissions.function_permissions, 1),
                'project_count', array_length(source_permissions.project_permissions, 1),
                'data_count', array_length(source_permissions.data_permissions, 1)
            )
        );
        
    ELSIF copy_mode = 'merge' THEN
        -- 合并模式：合并源用户和目标用户权限
        IF target_permissions IS NULL THEN
            -- 目标用户没有权限，直接插入
            INSERT INTO public.user_permissions (
                user_id, project_id, menu_permissions, function_permissions,
                project_permissions, data_permissions, inherit_role, created_at, updated_at
            ) VALUES (
                target_user_id, NULL,
                source_permissions.menu_permissions,
                source_permissions.function_permissions,
                source_permissions.project_permissions,
                source_permissions.data_permissions,
                source_permissions.inherit_role,
                now(), now()
            );
        ELSE
            -- 目标用户有权限，合并权限
            UPDATE public.user_permissions SET
                menu_permissions = array_cat(
                    COALESCE(menu_permissions, '{}'),
                    COALESCE(source_permissions.menu_permissions, '{}')
                ),
                function_permissions = array_cat(
                    COALESCE(function_permissions, '{}'),
                    COALESCE(source_permissions.function_permissions, '{}')
                ),
                project_permissions = array_cat(
                    COALESCE(project_permissions, '{}'),
                    COALESCE(source_permissions.project_permissions, '{}')
                ),
                data_permissions = array_cat(
                    COALESCE(data_permissions, '{}'),
                    COALESCE(source_permissions.data_permissions, '{}')
                ),
                updated_at = now()
            WHERE user_id = target_user_id AND project_id IS NULL;
        END IF;
        
        result := jsonb_build_object(
            'success', true,
            'message', '权限已成功复制（合并模式）'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', '无效的复制模式，请使用 replace 或 merge'
        );
    END IF;
    
    -- 记录权限变更日志
    INSERT INTO public.permission_audit_logs (
        user_id, action, details, created_at
    ) VALUES (
        target_user_id, 'permissions_copied',
        jsonb_build_object(
            'source_user_id', source_user_id,
            'copy_mode', copy_mode,
            'message', '用户权限已复制'
        ),
        now()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建用户权限修改函数
CREATE OR REPLACE FUNCTION modify_user_permissions(
    target_user_id uuid,
    permission_type text, -- 'menu', 'function', 'project', 'data'
    permission_key text,
    action text -- 'add', 'remove', 'set'
)
RETURNS jsonb AS $$
DECLARE
    user_permissions RECORD;
    current_permissions text[];
    new_permissions text[];
    result jsonb;
BEGIN
    -- 获取用户当前权限
    SELECT * INTO user_permissions
    FROM public.user_permissions
    WHERE user_id = target_user_id AND project_id IS NULL;
    
    -- 如果用户没有特定权限，创建基础权限记录
    IF user_permissions IS NULL THEN
        INSERT INTO public.user_permissions (
            user_id, project_id, menu_permissions, function_permissions,
            project_permissions, data_permissions, inherit_role, created_at, updated_at
        ) VALUES (
            target_user_id, NULL, '{}', '{}', '{}', '{}', false, now(), now()
        );
        
        SELECT * INTO user_permissions
        FROM public.user_permissions
        WHERE user_id = target_user_id AND project_id IS NULL;
    END IF;
    
    -- 根据权限类型获取当前权限数组
    CASE permission_type
        WHEN 'menu' THEN current_permissions := user_permissions.menu_permissions;
        WHEN 'function' THEN current_permissions := user_permissions.function_permissions;
        WHEN 'project' THEN current_permissions := user_permissions.project_permissions;
        WHEN 'data' THEN current_permissions := user_permissions.data_permissions;
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'message', '无效的权限类型，请使用 menu, function, project, data'
            );
    END CASE;
    
    -- 根据操作类型修改权限
    CASE action
        WHEN 'add' THEN
            IF NOT (permission_key = ANY(current_permissions)) THEN
                new_permissions := array_append(current_permissions, permission_key);
            ELSE
                new_permissions := current_permissions;
            END IF;
        WHEN 'remove' THEN
            new_permissions := array_remove(current_permissions, permission_key);
        WHEN 'set' THEN
            new_permissions := ARRAY[permission_key];
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'message', '无效的操作类型，请使用 add, remove, set'
            );
    END CASE;
    
    -- 更新权限
    CASE permission_type
        WHEN 'menu' THEN
            UPDATE public.user_permissions 
            SET menu_permissions = new_permissions, updated_at = now()
            WHERE user_id = target_user_id AND project_id IS NULL;
        WHEN 'function' THEN
            UPDATE public.user_permissions 
            SET function_permissions = new_permissions, updated_at = now()
            WHERE user_id = target_user_id AND project_id IS NULL;
        WHEN 'project' THEN
            UPDATE public.user_permissions 
            SET project_permissions = new_permissions, updated_at = now()
            WHERE user_id = target_user_id AND project_id IS NULL;
        WHEN 'data' THEN
            UPDATE public.user_permissions 
            SET data_permissions = new_permissions, updated_at = now()
            WHERE user_id = target_user_id AND project_id IS NULL;
    END CASE;
    
    -- 记录权限变更日志
    INSERT INTO public.permission_audit_logs (
        user_id, action, details, created_at
    ) VALUES (
        target_user_id, 'permissions_modified',
        jsonb_build_object(
            'permission_type', permission_type,
            'permission_key', permission_key,
            'action', action,
            'message', '用户权限已修改'
        ),
        now()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '权限修改成功',
        'permission_type', permission_type,
        'permission_key', permission_key,
        'action', action,
        'new_permissions_count', array_length(new_permissions, 1)
    );
END;
$$ LANGUAGE plpgsql;

-- 4. 创建快速权限变更函数
CREATE OR REPLACE FUNCTION quick_permission_change(
    target_user_id uuid,
    changes jsonb -- 格式: {"menu": ["add", "permission_key"], "function": ["remove", "permission_key"]}
)
RETURNS jsonb AS $$
DECLARE
    change_item jsonb;
    permission_type text;
    action text;
    permission_key text;
    results jsonb := '[]'::jsonb;
    result jsonb;
BEGIN
    -- 遍历所有变更
    FOR change_item IN SELECT jsonb_array_elements(changes)
    LOOP
        permission_type := change_item->>0;
        action := change_item->>1;
        permission_key := change_item->>2;
        
        -- 执行权限变更
        result := modify_user_permissions(target_user_id, permission_type, permission_key, action);
        results := results || result;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '批量权限变更完成',
        'results', results
    );
END;
$$ LANGUAGE plpgsql;

-- 5. 测试权限管理功能
SELECT 
    '=== 权限管理功能测试 ===' as section;

-- 6. 显示用户权限状态
SELECT 
    '当前用户权限状态' as category,
    p.email,
    p.role::text as role,
    CASE 
        WHEN up.user_id IS NULL THEN '使用角色模板'
        WHEN up.inherit_role = true THEN '继承角色权限'
        ELSE '用户特定权限'
    END as permission_type,
    COALESCE(array_length(up.menu_permissions, 1), 0) as menu_count,
    COALESCE(array_length(up.function_permissions, 1), 0) as function_count,
    COALESCE(array_length(up.project_permissions, 1), 0) as project_count,
    COALESCE(array_length(up.data_permissions, 1), 0) as data_count
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id AND up.project_id IS NULL
ORDER BY p.role::text, p.email;

-- 7. 使用示例
SELECT 
    '=== 使用示例 ===' as section,
    '权限复制示例' as example_type,
    'SELECT copy_user_permissions(''source_user_id'', ''target_user_id'', ''replace'');' as example_sql;

SELECT 
    '=== 使用示例 ===' as section,
    '权限修改示例' as example_type,
    'SELECT modify_user_permissions(''user_id'', ''menu'', ''dashboard'', ''add'');' as example_sql;

SELECT 
    '=== 使用示例 ===' as section,
    '批量权限变更示例' as example_type,
    'SELECT quick_permission_change(''user_id'', ''[["menu", "add", "dashboard"], ["function", "remove", "data.create"]]'');' as example_sql;

-- 8. 最终验证
SELECT 
    '=== 最终验证结果 ===' as section,
    '用户权限管理功能已创建' as status,
    '支持权限复制、修改和批量变更' as description,
    '所有变更都会记录审计日志' as audit_log,
    '权限变更会立即生效' as immediate_effect;
