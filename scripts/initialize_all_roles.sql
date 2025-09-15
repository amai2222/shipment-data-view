-- 初始化所有6种角色的数据
-- 确保系统支持所有定义的角色

-- 1. 检查当前角色分布
SELECT 'Current role distribution:' as info;
SELECT 
    'profiles' as table_name,
    role,
    COUNT(*) as count
FROM public.profiles
GROUP BY role
UNION ALL
SELECT 
    'user_projects' as table_name,
    role::text,
    COUNT(*) as count
FROM public.user_projects
GROUP BY role;

-- 2. 为缺失的角色创建示例用户（如果不存在）
-- 注意：这里只是示例，实际使用时需要根据业务需求调整

-- 检查是否存在各种角色的用户
DO $$
DECLARE
    role_count integer;
    role_name text;
    role_list text[] := ARRAY['admin', 'finance', 'business', 'operator', 'partner', 'viewer'];
BEGIN
    FOREACH role_name IN ARRAY role_list
    LOOP
        SELECT COUNT(*) INTO role_count
        FROM public.profiles
        WHERE role = role_name;
        
        IF role_count = 0 THEN
            RAISE NOTICE 'Role % has no users. Consider creating sample users for testing.', role_name;
        ELSE
            RAISE NOTICE 'Role % has % users.', role_name, role_count;
        END IF;
    END LOOP;
END $$;

-- 3. 确保所有角色在 user_projects 中都有数据
-- 为每个角色创建默认的项目分配（如果不存在）
DO $$
DECLARE
    role_name text;
    role_list text[] := ARRAY['admin', 'finance', 'business', 'operator', 'partner', 'viewer'];
    user_record record;
    project_record record;
    assignment_count integer;
BEGIN
    -- 为每个角色创建项目分配
    FOREACH role_name IN ARRAY role_list
    LOOP
        -- 获取该角色的所有用户
        FOR user_record IN 
            SELECT id FROM public.profiles WHERE role = role_name
        LOOP
            -- 获取所有项目
            FOR project_record IN 
                SELECT id FROM public.projects
            LOOP
                -- 检查是否已存在分配
                SELECT COUNT(*) INTO assignment_count
                FROM public.user_projects
                WHERE user_id = user_record.id AND project_id = project_record.id;
                
                -- 如果不存在，创建默认分配
                IF assignment_count = 0 THEN
                    INSERT INTO public.user_projects (
                        user_id, 
                        project_id, 
                        role, 
                        can_view, 
                        can_edit, 
                        can_delete,
                        created_by
                    ) VALUES (
                        user_record.id,
                        project_record.id,
                        role_name::app_role,
                        true,  -- 默认可以查看
                        CASE 
                            WHEN role_name IN ('admin', 'finance', 'business') THEN true
                            ELSE false
                        END,  -- 根据角色设置编辑权限
                        CASE 
                            WHEN role_name = 'admin' THEN true
                            ELSE false
                        END,  -- 只有管理员可以删除
                        (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
                    );
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- 4. 验证所有角色都有数据
SELECT 'Final role distribution:' as info;
SELECT 
    'profiles' as table_name,
    role,
    COUNT(*) as count
FROM public.profiles
GROUP BY role
UNION ALL
SELECT 
    'user_projects' as table_name,
    role::text,
    COUNT(*) as count
FROM public.user_projects
GROUP BY role
ORDER BY table_name, role;

-- 5. 显示支持的角色信息（应该显示所有6种角色）
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
