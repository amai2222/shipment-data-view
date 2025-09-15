-- 测试权限保存功能

-- 1. 检查 user_permissions 表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_permissions'
ORDER BY ordinal_position;

-- 2. 检查现有用户权限数据
SELECT 
    user_id,
    project_id,
    array_length(menu_permissions, 1) as menu_count,
    array_length(function_permissions, 1) as function_count,
    inherit_role,
    created_at,
    updated_at
FROM user_permissions
ORDER BY updated_at DESC
LIMIT 5;

-- 3. 测试插入用户权限
DO $$
DECLARE
    test_user_id UUID;
    test_result RECORD;
BEGIN
    -- 获取一个测试用户ID
    SELECT id INTO test_user_id FROM profiles WHERE is_active = true LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE '测试用户ID: %', test_user_id;
        
        -- 测试插入权限
        BEGIN
            INSERT INTO user_permissions (
                user_id,
                project_id,
                menu_permissions,
                function_permissions,
                project_permissions,
                data_permissions,
                inherit_role,
                custom_settings
            ) VALUES (
                test_user_id,
                NULL,
                ARRAY['dashboard', 'maintenance'],
                ARRAY['data.view', 'data.create'],
                ARRAY['project.view_assigned'],
                ARRAY['data.own'],
                false,
                '{}'::jsonb
            ) RETURNING * INTO test_result;
            
            RAISE NOTICE '权限插入成功: ID=%, 菜单权限数量=%', 
                test_result.id, 
                array_length(test_result.menu_permissions, 1);
            
            -- 清理测试数据
            DELETE FROM user_permissions WHERE id = test_result.id;
            RAISE NOTICE '测试数据已清理';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING '权限插入失败: %', SQLERRM;
        END;
    ELSE
        RAISE WARNING '没有找到活跃用户进行测试';
    END IF;
END $$;

-- 4. 检查约束
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.user_permissions'::regclass 
AND contype = 'c';

SELECT '权限保存功能测试完成' as status;
