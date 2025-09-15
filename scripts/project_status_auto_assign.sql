-- 项目状态变更自动分配权限触发器
-- 当项目状态变更为"进行中"时，自动为所有用户分配访问权限

-- 1. 创建项目状态变更触发器函数
CREATE OR REPLACE FUNCTION handle_project_status_change()
RETURNS TRIGGER AS $$
DECLARE
    user_record RECORD;
    current_user_id UUID;
BEGIN
    -- 检查项目状态是否变更为"进行中"
    IF NEW.project_status = '进行中' AND (OLD.project_status IS NULL OR OLD.project_status != '进行中') THEN
        -- 获取当前操作用户ID
        current_user_id := COALESCE(
            (SELECT auth.uid()),
            (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
        );
        
        -- 为所有用户分配该项目权限
        FOR user_record IN 
            SELECT id FROM public.profiles WHERE is_active = true
        LOOP
            -- 检查是否已存在分配记录
            IF NOT EXISTS (
                SELECT 1 FROM public.user_projects 
                WHERE user_id = user_record.id 
                AND project_id = NEW.id
            ) THEN
                -- 插入新的项目分配记录
                INSERT INTO public.user_projects (
                    user_id,
                    project_id,
                    role,
                    can_view,
                    can_edit,
                    can_delete,
                    created_at,
                    updated_at,
                    created_by
                ) VALUES (
                    user_record.id,
                    NEW.id,
                    'operator'::app_role, -- 默认角色
                    true,  -- 可以查看
                    true,  -- 可以编辑
                    false, -- 不能删除
                    NOW(),
                    NOW(),
                    current_user_id
                );
            END IF;
        END LOOP;
        
        -- 记录日志
        RAISE NOTICE '项目 % 状态变更为"进行中"，已为所有用户分配访问权限', NEW.name;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 创建触发器
DROP TRIGGER IF EXISTS project_status_change_trigger ON public.projects;
CREATE TRIGGER project_status_change_trigger
    AFTER UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION handle_project_status_change();

-- 3. 为现有"进行中"项目分配权限（一次性执行）
DO $$
DECLARE
    project_record RECORD;
    user_record RECORD;
    current_user_id UUID;
BEGIN
    -- 获取管理员用户ID
    current_user_id := (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1);
    
    -- 为所有"进行中"项目分配权限
    FOR project_record IN 
        SELECT id, name FROM public.projects WHERE project_status = '进行中'
    LOOP
        -- 为所有用户分配该项目权限
        FOR user_record IN 
            SELECT id FROM public.profiles WHERE is_active = true
        LOOP
            -- 检查是否已存在分配记录
            IF NOT EXISTS (
                SELECT 1 FROM public.user_projects 
                WHERE user_id = user_record.id 
                AND project_id = project_record.id
            ) THEN
                -- 插入新的项目分配记录
                INSERT INTO public.user_projects (
                    user_id,
                    project_id,
                    role,
                    can_view,
                    can_edit,
                    can_delete,
                    created_at,
                    updated_at,
                    created_by
                ) VALUES (
                    user_record.id,
                    project_record.id,
                    'operator'::app_role,
                    true,
                    true,
                    false,
                    NOW(),
                    NOW(),
                    current_user_id
                );
            END IF;
        END LOOP;
        
        RAISE NOTICE '已为"进行中"项目 % 分配所有用户权限', project_record.name;
    END LOOP;
END $$;

-- 4. 验证触发器创建
SELECT '触发器创建完成' as status;
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'project_status_change_trigger';

-- 5. 验证现有项目分配
SELECT '现有项目分配统计' as status;
SELECT 
    p.name as project_name,
    p.project_status,
    COUNT(up.user_id) as assigned_users,
    COUNT(pr.id) as total_users
FROM public.projects p
LEFT JOIN public.user_projects up ON p.id = up.project_id
LEFT JOIN public.profiles pr ON pr.is_active = true
WHERE p.project_status = '进行中'
GROUP BY p.id, p.name, p.project_status
ORDER BY p.name;
