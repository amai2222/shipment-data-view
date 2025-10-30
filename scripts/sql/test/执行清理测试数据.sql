-- 执行清理测试数据
-- 文件：执行清理测试数据.sql
-- 描述：清理系统中的所有测试数据
-- 创建时间：2025-10-25

-- ========================================
-- 第1步：查找测试数据
-- ========================================
DO $$
DECLARE
    v_partner_count INTEGER;
    v_logistics_cost_count INTEGER;
    v_bank_count INTEGER;
BEGIN
    -- 统计测试数据
    SELECT COUNT(*) INTO v_partner_count
    FROM public.partners 
    WHERE full_name LIKE '%测试%' 
       OR name LIKE '%测试%'
       OR full_name LIKE '%测试名称%';
    
    -- 统计测试合作方的成本记录
    SELECT COUNT(*) INTO v_logistics_cost_count
    FROM public.logistics_partner_costs lpc
    JOIN public.partners p ON lpc.partner_id = p.id
    WHERE p.full_name LIKE '%测试%' 
       OR p.name LIKE '%测试%'
       OR p.full_name LIKE '%测试名称%';
    
    SELECT COUNT(*) INTO v_bank_count
    FROM public.partner_bank_details 
    WHERE full_name LIKE '%测试%' 
       OR full_name LIKE '%测试名称%';
    
    RAISE NOTICE '============================';
    RAISE NOTICE '发现测试数据统计：';
    RAISE NOTICE '- 测试合作方数量：%', v_partner_count;
    RAISE NOTICE '- 测试合作方成本记录数量：%', v_logistics_cost_count;
    RAISE NOTICE '- 测试银行详情数量：%', v_bank_count;
    RAISE NOTICE '============================';
END $$;

-- ========================================
-- 第2步：清理测试数据（禁用所有触发器）
-- ========================================
DO $$
DECLARE
    v_deleted_project_partners INTEGER;
    v_deleted_costs INTEGER;
    v_deleted_banks INTEGER;
    v_deleted_partners INTEGER;
BEGIN
    RAISE NOTICE '开始清理测试数据...';
    
    -- 2.0 禁用所有触发器（会话级别）
    SET session_replication_role = replica;
    RAISE NOTICE '✓ 已禁用所有触发器';
    
    -- 2.1 删除测试合作方的项目配置（先删除，避免 CASCADE 触发器）
    WITH deleted AS (
        DELETE FROM public.project_partners 
        WHERE partner_id IN (
            SELECT id FROM public.partners 
            WHERE full_name LIKE '%测试%' 
               OR name LIKE '%测试%'
               OR full_name LIKE '%测试名称%'
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_project_partners FROM deleted;
    
    RAISE NOTICE '✓ 已删除 % 条测试合作方的项目配置', v_deleted_project_partners;
    
    -- 2.2 删除测试合作方的成本记录
    WITH deleted AS (
        DELETE FROM public.logistics_partner_costs 
        WHERE partner_id IN (
            SELECT id FROM public.partners 
            WHERE full_name LIKE '%测试%' 
               OR name LIKE '%测试%'
               OR full_name LIKE '%测试名称%'
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_costs FROM deleted;
    
    RAISE NOTICE '✓ 已删除 % 条测试合作方成本记录', v_deleted_costs;
    
    -- 2.3 删除测试合作方的银行详情
    WITH deleted AS (
        DELETE FROM public.partner_bank_details 
        WHERE partner_id IN (
            SELECT id FROM public.partners 
            WHERE full_name LIKE '%测试%' 
               OR name LIKE '%测试%'
               OR full_name LIKE '%测试名称%'
        )
        RETURNING partner_id
    )
    SELECT COUNT(*) INTO v_deleted_banks FROM deleted;
    
    RAISE NOTICE '✓ 已删除 % 条测试银行详情', v_deleted_banks;
    
    -- 2.4 删除测试合作方
    WITH deleted AS (
        DELETE FROM public.partners 
        WHERE full_name LIKE '%测试%' 
           OR name LIKE '%测试%'
           OR full_name LIKE '%测试名称%'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_partners FROM deleted;
    
    RAISE NOTICE '✓ 已删除 % 条测试合作方', v_deleted_partners;
    
    -- 2.5 重新启用所有触发器
    SET session_replication_role = DEFAULT;
    RAISE NOTICE '✓ 已重新启用所有触发器';
    
    RAISE NOTICE '============================';
    RAISE NOTICE '测试数据清理完成！';
    RAISE NOTICE '============================';
END $$;

-- ========================================
-- 第3步：验证清理结果
-- ========================================
SELECT '=== 验证清理结果 ===' as step;

-- 检查是否还有测试数据
SELECT 
    'partners' as table_name,
    COUNT(*) as remaining_test_records
FROM public.partners 
WHERE full_name LIKE '%测试%' 
   OR name LIKE '%测试%'
   OR full_name LIKE '%测试名称%'

UNION ALL

SELECT 
    'partner_bank_details' as table_name,
    COUNT(*) as remaining_test_records
FROM public.partner_bank_details 
WHERE full_name LIKE '%测试%' 
   OR full_name LIKE '%测试名称%'

UNION ALL

SELECT 
    'logistics_partner_costs' as table_name,
    COUNT(*) as remaining_test_records
FROM public.logistics_partner_costs lpc
JOIN public.partners p ON lpc.partner_id = p.id
WHERE p.full_name LIKE '%测试%' 
   OR p.name LIKE '%测试%'
   OR p.full_name LIKE '%测试名称%';

-- ========================================
-- 第4步：检查受影响的付款申请单
-- ========================================
SELECT '=== 检查受影响的付款申请单 ===' as step;

SELECT 
    id,
    request_id,
    status,
    created_at,
    array_length(logistics_record_ids, 1) as remaining_records
FROM public.payment_requests 
WHERE array_length(logistics_record_ids, 1) = 0
   OR logistics_record_ids IS NULL
ORDER BY created_at DESC
LIMIT 10;

SELECT '✓ 测试数据清理完成！' as result;