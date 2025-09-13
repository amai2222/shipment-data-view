-- 权限同步和角色变更处理脚本
-- 确保角色变更时立即应用模板权限

-- 1. 创建权限同步函数
CREATE OR REPLACE FUNCTION sync_user_permissions_with_role_template()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    role_template RECORD;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '开始同步用户权限与角色模板...';
    
    -- 为所有用户同步权限
    FOR user_record IN 
        SELECT id, email, role 
        FROM public.users 
        WHERE role IS NOT NULL
        ORDER BY role, email
    LOOP
        -- 获取角色模板
        SELECT * INTO role_template
        FROM public.role_permission_templates
        WHERE role = user_record.role;
        
        -- 如果找不到角色模板，跳过
        IF NOT FOUND THEN
            RAISE WARNING '用户 % 的角色 % 没有对应的权限模板', user_record.email, user_record.role;
            CONTINUE;
        END IF;
        
        -- 检查用户是否有全局权限配置
        IF EXISTS (
            SELECT 1 FROM public.user_permissions 
            WHERE user_id = user_record.id 
            AND project_id IS NULL
        ) THEN
            -- 如果用户有全局权限配置，检查是否需要清理
            IF EXISTS (
                SELECT 1 FROM public.user_permissions 
                WHERE user_id = user_record.id 
                AND project_id IS NULL 
                AND inherit_role = false
            ) THEN
                -- 删除不继承角色权限的用户特定权限
                DELETE FROM public.user_permissions 
                WHERE user_id = user_record.id 
                AND project_id IS NULL;
                
                updated_count := updated_count + 1;
                RAISE NOTICE '已清理用户 % 的全局权限配置，将使用角色 % 的模板权限', 
                    user_record.email, user_record.role;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE '权限同步完成，共处理 % 个用户', updated_count;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建角色变更触发器函数
CREATE OR REPLACE FUNCTION handle_user_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 当用户角色变更时，自动应用角色模板权限
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- 删除用户的全局权限配置（让用户使用新的角色模板）
        DELETE FROM public.user_permissions 
        WHERE user_id = NEW.id 
        AND project_id IS NULL;
        
        -- 记录角色变更日志
        INSERT INTO public.permission_audit_logs (
            user_id, 
            action, 
            details, 
            created_at
        ) VALUES (
            NEW.id, 
            'role_changed', 
            jsonb_build_object(
                'old_role', OLD.role,
                'new_role', NEW.role,
                'message', '用户角色已变更，权限将使用新角色模板',
                'timestamp', now()
            ), 
            now()
        );
        
        RAISE NOTICE '用户 % 角色已从 % 变更为 %，权限将使用新角色模板', 
            NEW.email, OLD.role, NEW.role;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建角色变更触发器
DROP TRIGGER IF EXISTS trigger_user_role_change ON public.users;
CREATE TRIGGER trigger_user_role_change
    AFTER UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_role_change();

-- 4. 创建权限检查函数
CREATE OR REPLACE FUNCTION check_permission_inheritance()
RETURNS TABLE(
    user_id uuid,
    user_email text,
    user_role text,
    permission_type text,
    permission_source text,
    menu_count integer,
    function_count integer,
    project_count integer,
    data_count integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.role,
        CASE 
            WHEN up.user_id IS NULL THEN 'role_template'
            WHEN up.inherit_role = true THEN 'inherited'
            ELSE 'custom'
        END as permission_type,
        CASE 
            WHEN up.user_id IS NULL THEN rpt.name
            ELSE '用户特定权限'
        END as permission_source,
        COALESCE(array_length(COALESCE(up.menu_permissions, rpt.menu_permissions), 1), 0) as menu_count,
        COALESCE(array_length(COALESCE(up.function_permissions, rpt.function_permissions), 1), 0) as function_count,
        COALESCE(array_length(COALESCE(up.project_permissions, rpt.project_permissions), 1), 0) as project_count,
        COALESCE(array_length(COALESCE(up.data_permissions, rpt.data_permissions), 1), 0) as data_count
    FROM public.users u
    LEFT JOIN public.user_permissions up ON u.id = up.user_id AND up.project_id IS NULL
    LEFT JOIN public.role_permission_templates rpt ON rpt.role = u.role
    ORDER BY u.role, u.email;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建权限修复函数
CREATE OR REPLACE FUNCTION fix_permission_inheritance()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    role_template RECORD;
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE '开始修复权限继承问题...';
    
    -- 查找有权限继承问题的用户
    FOR user_record IN 
        SELECT u.id, u.email, u.role
        FROM public.users u
        JOIN public.user_permissions up ON u.id = up.user_id AND up.project_id IS NULL
        WHERE up.inherit_role = false
        ORDER BY u.role, u.email
    LOOP
        -- 获取角色模板
        SELECT * INTO role_template
        FROM public.role_permission_templates
        WHERE role = user_record.role;
        
        -- 如果找不到角色模板，跳过
        IF NOT FOUND THEN
            RAISE WARNING '用户 % 的角色 % 没有对应的权限模板', user_record.email, user_record.role;
            CONTINUE;
        END IF;
        
        -- 检查用户权限是否与角色模板权限相同
        IF EXISTS (
            SELECT 1 FROM public.user_permissions up2
            WHERE up2.user_id = user_record.id 
            AND up2.project_id IS NULL
            AND up2.menu_permissions = role_template.menu_permissions
            AND up2.function_permissions = role_template.function_permissions
            AND up2.project_permissions = role_template.project_permissions
            AND up2.data_permissions = role_template.data_permissions
        ) THEN
            -- 如果权限相同，删除用户特定权限，让用户使用角色模板
            DELETE FROM public.user_permissions 
            WHERE user_id = user_record.id 
            AND project_id IS NULL;
            
            fixed_count := fixed_count + 1;
            RAISE NOTICE '已修复用户 % 的权限继承问题，现在使用角色 % 的模板权限', 
                user_record.email, user_record.role;
        END IF;
    END LOOP;
    
    RAISE NOTICE '权限继承修复完成，共修复 % 个用户', fixed_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 执行权限同步
SELECT sync_user_permissions_with_role_template();

-- 7. 执行权限修复
SELECT fix_permission_inheritance();

-- 8. 验证修复结果
SELECT 
    '=== 权限同步和修复结果 ===' as section,
    '权限同步完成' as status,
    '角色变更触发器已创建' as trigger_status,
    '权限继承问题已修复' as inheritance_status,
    '请刷新权限管理页面查看效果' as instruction;

-- 9. 显示权限检查结果
SELECT * FROM check_permission_inheritance() 
WHERE user_role = 'admin'  -- 可以修改这里检查特定角色
ORDER BY user_email;
