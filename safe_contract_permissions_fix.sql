-- 安全的 contract_permissions 约束修复脚本
-- 文件: safe_contract_permissions_fix.sql

-- 1. 检查 contract_permissions 表的当前结构
SELECT 
    'contract_permissions 表结构' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'contract_permissions'
ORDER BY ordinal_position;

-- 2. 检查现有约束
SELECT 
    'contract_permissions 约束' as check_type,
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
AND table_name = 'contract_permissions';

-- 3. 检查是否有重复的 (user_id, contract_id) 组合
SELECT 
    '重复记录检查' as check_type,
    user_id,
    contract_id,
    COUNT(*) as duplicate_count
FROM public.contract_permissions
WHERE user_id IS NOT NULL AND contract_id IS NOT NULL
GROUP BY user_id, contract_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 4. 清理重复记录（如果存在）
WITH duplicates AS (
    SELECT 
        id,
        user_id,
        contract_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, contract_id 
            ORDER BY updated_at DESC, created_at DESC
        ) as rn
    FROM public.contract_permissions
    WHERE user_id IS NOT NULL AND contract_id IS NOT NULL
)
DELETE FROM public.contract_permissions
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- 5. 安全地添加唯一约束
DO $$
DECLARE
    constraint_exists BOOLEAN := FALSE;
BEGIN
    -- 检查约束是否已存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'contract_permissions'
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%user_id%contract_id%'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE 'contract_permissions 表的唯一约束已存在';
    ELSE
        BEGIN
            -- 尝试添加唯一约束
            ALTER TABLE public.contract_permissions
            ADD CONSTRAINT contract_permissions_user_contract_unique
            UNIQUE (user_id, contract_id);
            
            RAISE NOTICE '已添加 contract_permissions 表的唯一约束';
        EXCEPTION
            WHEN duplicate_object THEN
                RAISE NOTICE '唯一约束已存在，跳过创建';
            WHEN OTHERS THEN
                RAISE WARNING '添加唯一约束时出错: %', SQLERRM;
        END;
    END IF;
END $$;

-- 6. 验证约束状态
SELECT 
    '约束验证' as check_type,
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
AND table_name = 'contract_permissions'
AND constraint_type = 'UNIQUE';

-- 7. 测试插入功能（使用有效合同ID）
DO $$
DECLARE
    test_user_id UUID;
    valid_contract_id UUID;
    test_permission RECORD;
BEGIN
    RAISE NOTICE '--- 开始测试 contract_permissions 插入功能 ---';
    
    -- 获取第一个用户进行测试
    SELECT id INTO test_user_id FROM public.profiles WHERE is_active = true LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE WARNING '无法找到测试用户';
        RETURN;
    END IF;
    
    -- 尝试获取一个存在的合同ID
    SELECT id INTO valid_contract_id FROM public.contracts LIMIT 1;
    
    IF valid_contract_id IS NULL THEN
        RAISE NOTICE '没有找到有效的合同，跳过合同权限测试';
        RETURN;
    END IF;
    
    RAISE NOTICE '测试用户ID: %, 使用有效合同ID: %', test_user_id, valid_contract_id;
    
    -- 测试插入合同权限
    INSERT INTO public.contract_permissions (
        user_id,
        contract_id,
        permission_type,
        field_permissions,
        file_permissions,
        department,
        is_active
    )
    VALUES (
        test_user_id,
        valid_contract_id,
        'view',
        '{"contract_info": true, "financial_info": false}'::jsonb,
        '{"contract_file": true, "financial_file": false}'::jsonb,
        'test_department',
        true
    )
    RETURNING * INTO test_permission;
    
    RAISE NOTICE '合同权限创建成功: permission_type=%, department=%', 
        test_permission.permission_type, 
        test_permission.department;
    
    -- 测试重复插入（应该失败，如果有唯一约束）
    BEGIN
        INSERT INTO public.contract_permissions (
            user_id,
            contract_id,
            permission_type,
            field_permissions,
            file_permissions,
            department,
            is_active
        )
        VALUES (
            test_user_id,
            valid_contract_id,
            'edit',
            '{"contract_info": true, "financial_info": true}'::jsonb,
            '{"contract_file": true, "financial_file": true}'::jsonb,
            'test_department',
            true
        );
        
        RAISE WARNING '重复插入应该失败但没有失败';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE '重复插入正确失败，唯一约束工作正常';
        WHEN OTHERS THEN
            RAISE WARNING '重复插入失败，但错误类型不是唯一约束: %', SQLERRM;
    END;
    
    -- 清理测试数据
    DELETE FROM public.contract_permissions WHERE contract_id = valid_contract_id AND user_id = test_user_id;
    
    RAISE NOTICE '--- contract_permissions 插入功能测试完成 ---';
END $$;

-- 8. 最终状态检查
SELECT 
    '最终状态检查' as check_type,
    'contract_permissions 表' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT contract_id) as unique_contracts,
    COUNT(DISTINCT (user_id, contract_id)) as unique_combinations
FROM public.contract_permissions
WHERE user_id IS NOT NULL AND contract_id IS NOT NULL;

SELECT 'contract_permissions 约束安全修复完成' as status;
