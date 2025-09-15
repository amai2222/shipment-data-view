-- 验证约束修复结果

-- 1. 检查新的约束
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.permission_audit_logs'::regclass 
AND contype = 'c';

-- 2. 测试插入新类型的记录
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- 获取一个测试用户ID
    SELECT id INTO test_user_id FROM public.profiles LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- 测试插入角色变更记录
        BEGIN
            INSERT INTO public.permission_audit_logs (
                user_id,
                action,
                permission_type,
                permission_key,
                reason,
                created_by
            ) VALUES (
                test_user_id,
                'update',
                'role',
                'test_role_change',
                '测试角色变更',
                test_user_id
            );
            
            RAISE NOTICE '测试插入成功: action=update, permission_type=role';
            
            -- 清理测试数据
            DELETE FROM public.permission_audit_logs 
            WHERE permission_key = 'test_role_change';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING '测试插入失败: %', SQLERRM;
        END;
        
        -- 测试插入用户状态变更记录
        BEGIN
            INSERT INTO public.permission_audit_logs (
                user_id,
                action,
                permission_type,
                permission_key,
                reason,
                created_by
            ) VALUES (
                test_user_id,
                'activate',
                'user',
                'test_user_activate',
                '测试用户激活',
                test_user_id
            );
            
            RAISE NOTICE '测试插入成功: action=activate, permission_type=user';
            
            -- 清理测试数据
            DELETE FROM public.permission_audit_logs 
            WHERE permission_key = 'test_user_activate';
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING '测试插入失败: %', SQLERRM;
        END;
    ELSE
        RAISE WARNING '没有找到测试用户';
    END IF;
END $$;

-- 3. 检查触发器是否存在
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
AND trigger_name = 'user_role_change_trigger';

SELECT '验证完成' as status;
