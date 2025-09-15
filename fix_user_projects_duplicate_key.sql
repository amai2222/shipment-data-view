-- 修复 user_projects 重复键约束错误
-- 文件: fix_user_projects_duplicate_key.sql

-- 1. 检查重复的 user_projects 记录
SELECT 
    '重复记录检查' as check_type,
    user_id,
    project_id,
    COUNT(*) as duplicate_count
FROM public.user_projects
GROUP BY user_id, project_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. 清理重复记录，保留最新的记录
WITH duplicates AS (
    SELECT 
        id,
        user_id,
        project_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, project_id 
            ORDER BY updated_at DESC, created_at DESC
        ) as rn
    FROM public.user_projects
)
DELETE FROM public.user_projects
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- 3. 验证清理结果
SELECT 
    '清理后重复记录检查' as check_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT (user_id, project_id)) as unique_combinations
FROM public.user_projects;

-- 4. 确保唯一约束正常工作
-- 检查约束是否存在
SELECT 
    '约束检查' as check_type,
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints
WHERE table_name = 'user_projects'
AND constraint_type = 'UNIQUE';

-- 5. 测试插入功能（使用 ON CONFLICT 处理重复）
DO $$
DECLARE
    test_user_id UUID := '178a241e-5bb4-4aa8-bf7a-9d74fddfdb08';
    test_project_id UUID := 'b93428bc-cb77-483a-a332-16fc2b8f8eda';
    result_record RECORD;
BEGIN
    RAISE NOTICE '--- 开始测试 user_projects 插入功能 ---';
    
    -- 使用 ON CONFLICT 处理重复键
    INSERT INTO public.user_projects (user_id, project_id, can_view, can_edit, can_delete)
    VALUES (test_user_id, test_project_id, true, true, false)
    ON CONFLICT (user_id, project_id) 
    DO UPDATE SET 
        can_view = EXCLUDED.can_view,
        can_edit = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete,
        updated_at = NOW()
    RETURNING * INTO result_record;
    
    RAISE NOTICE '插入/更新成功: user_id=%, project_id=%, can_view=%, can_edit=%, can_delete=%', 
        result_record.user_id, 
        result_record.project_id, 
        result_record.can_view, 
        result_record.can_edit, 
        result_record.can_delete;
    
    RAISE NOTICE '--- user_projects 插入功能测试完成 ---';
END $$;

-- 6. 检查所有用户的项目权限分配情况
SELECT 
    '用户项目权限统计' as check_type,
    p.full_name,
    p.email,
    p.role,
    COUNT(up.project_id) as assigned_projects,
    COUNT(CASE WHEN up.can_view = true THEN 1 END) as view_permissions,
    COUNT(CASE WHEN up.can_edit = true THEN 1 END) as edit_permissions,
    COUNT(CASE WHEN up.can_delete = true THEN 1 END) as delete_permissions
FROM public.profiles p
LEFT JOIN public.user_projects up ON p.id = up.user_id
WHERE p.is_active = true
GROUP BY p.id, p.full_name, p.email, p.role
ORDER BY p.full_name;

-- 7. 检查项目权限分配情况
SELECT 
    '项目权限统计' as check_type,
    pr.name as project_name,
    COUNT(up.user_id) as assigned_users,
    COUNT(CASE WHEN up.can_view = true THEN 1 END) as view_permissions,
    COUNT(CASE WHEN up.can_edit = true THEN 1 END) as edit_permissions,
    COUNT(CASE WHEN up.can_delete = true THEN 1 END) as delete_permissions
FROM public.projects pr
LEFT JOIN public.user_projects up ON pr.id = up.project_id
GROUP BY pr.id, pr.name
ORDER BY pr.name;

-- 8. 确保所有活跃用户都有项目权限
DO $$
DECLARE
    user_record RECORD;
    project_record RECORD;
    missing_count INTEGER := 0;
    total_users INTEGER := 0;
    total_projects INTEGER := 0;
BEGIN
    RAISE NOTICE '--- 开始检查用户项目权限完整性 ---';
    
    -- 统计用户和项目数量
    SELECT COUNT(*) INTO total_users FROM public.profiles WHERE is_active = true;
    SELECT COUNT(*) INTO total_projects FROM public.projects;
    
    RAISE NOTICE '活跃用户数: %, 项目数: %', total_users, total_projects;
    
    -- 检查每个用户是否有所有项目的权限
    FOR user_record IN 
        SELECT id, full_name, email FROM public.profiles WHERE is_active = true
    LOOP
        FOR project_record IN 
            SELECT id, name FROM public.projects
        LOOP
            -- 检查用户是否有该项目的权限
            IF NOT EXISTS (
                SELECT 1 FROM public.user_projects 
                WHERE user_id = user_record.id 
                AND project_id = project_record.id
            ) THEN
                -- 为用户分配项目权限
                INSERT INTO public.user_projects (user_id, project_id, can_view, can_edit, can_delete)
                VALUES (user_record.id, project_record.id, true, false, false)
                ON CONFLICT (user_id, project_id) DO NOTHING;
                
                missing_count := missing_count + 1;
                RAISE NOTICE '为用户 % 分配项目 % 的权限', user_record.full_name, project_record.name;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '权限分配完成，新增权限记录数: %', missing_count;
    RAISE NOTICE '--- 用户项目权限完整性检查完成 ---';
END $$;

-- 9. 最终验证
SELECT 
    '最终验证' as check_type,
    'user_projects 表状态' as description,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT project_id) as unique_projects,
    COUNT(DISTINCT (user_id, project_id)) as unique_combinations
FROM public.user_projects;

SELECT 'user_projects 重复键问题修复完成' as status;
