-- 最终修复脚本 - 处理 app_role 枚举值问题
-- 解决 "invalid input value for enum app_role: member" 错误

-- 步骤1：检查 app_role 枚举的实际值
SELECT 'Step 1: Checking app_role enum values' as info;
SELECT enumlabel as role_value
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'app_role'
)
ORDER BY enumsortorder;

-- 步骤2：检查 user_projects 表中的当前数据
SELECT 'Step 2: Current data in user_projects' as info;
SELECT DISTINCT role, COUNT(*) as count
FROM public.user_projects
GROUP BY role
ORDER BY role;

-- 步骤3：清理无效的角色值
DO $$
DECLARE
    invalid_count integer;
BEGIN
    -- 统计无效值
    SELECT COUNT(*) INTO invalid_count
    FROM public.user_projects
    WHERE role NOT IN ('admin', 'finance', 'business', 'operator', 'partner', 'viewer')
       OR role IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Found % invalid role values, cleaning up...', invalid_count;
        
        -- 清理无效数据，设置为默认值
        UPDATE public.user_projects 
        SET role = 'operator'::app_role
        WHERE role NOT IN ('admin', 'finance', 'business', 'operator', 'partner', 'viewer')
           OR role IS NULL;
        
        RAISE NOTICE 'Cleaned up % invalid role values', invalid_count;
    ELSE
        RAISE NOTICE 'No invalid role values found';
    END IF;
END $$;

-- 步骤4：验证清理结果
SELECT 'Step 4: After cleanup' as info;
SELECT DISTINCT role, COUNT(*) as count
FROM public.user_projects
GROUP BY role
ORDER BY role;

-- 步骤5：确保列类型正确
DO $$
DECLARE
    current_type text;
BEGIN
    SELECT data_type INTO current_type
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'user_projects' 
      AND column_name = 'role';
    
    IF current_type = 'text' THEN
        RAISE NOTICE 'Converting role column from text to app_role type';
        
        -- 删除默认值约束
        ALTER TABLE public.user_projects 
        ALTER COLUMN role DROP DEFAULT;
        
        -- 转换类型
        ALTER TABLE public.user_projects 
        ALTER COLUMN role TYPE app_role USING role::app_role;
        
        -- 重新设置默认值
        ALTER TABLE public.user_projects 
        ALTER COLUMN role SET DEFAULT 'operator'::app_role;
        
        RAISE NOTICE 'Successfully converted to app_role type';
    ELSE
        RAISE NOTICE 'role column is already app_role type';
    END IF;
END $$;

-- 步骤6：最终验证
SELECT 'Step 6: Final verification' as info;
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('profiles', 'user_projects') 
  AND column_name = 'role'
ORDER BY table_name;

-- 步骤7：测试 UNION 查询
SELECT 'Step 7: Testing UNION query' as info;
SELECT 
    'Supported roles:' as info,
    string_agg(role_value, ', ' ORDER BY role_value) as roles
FROM (
    SELECT DISTINCT role::text as role_value FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_value FROM public.user_projects WHERE role IS NOT NULL
) t;

-- 步骤8：测试插入操作
SELECT 'Step 8: Testing insert operation' as info;
DO $$
DECLARE
    test_user_id uuid;
    test_project_id uuid;
BEGIN
    -- 获取测试数据
    SELECT id INTO test_user_id FROM public.profiles LIMIT 1;
    SELECT id INTO test_project_id FROM public.projects LIMIT 1;
    
    IF test_user_id IS NOT NULL AND test_project_id IS NOT NULL THEN
        -- 测试插入（使用默认角色）
        INSERT INTO public.user_projects (user_id, project_id, can_view, can_edit, can_delete)
        VALUES (test_user_id, test_project_id, true, true, false)
        ON CONFLICT (user_id, project_id) DO NOTHING;
        
        RAISE NOTICE 'Test insert successful';
        
        -- 清理测试数据
        DELETE FROM public.user_projects 
        WHERE user_id = test_user_id AND project_id = test_project_id;
        
        RAISE NOTICE 'Test cleanup completed';
    ELSE
        RAISE NOTICE 'No test data available';
    END IF;
END $$;
