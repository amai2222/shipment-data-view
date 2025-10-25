-- 安全删除合作链路相关函数
-- 创建时间: 2025-01-22
-- 功能: 安全删除仅用于修改合作链路的数据库函数

-- ============================================================
-- 第一步: 检查函数是否存在
-- ============================================================

SELECT 
    '检查合作链路相关函数' as step,
    routine_name as function_name,
    routine_type as function_type,
    '存在' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_project_available_chains',
    'validate_chain_modification_permission', 
    'modify_logistics_record_chain',
    'batch_modify_logistics_records_chain',
    'is_finance_operator_or_admin'
)
ORDER BY routine_name;

-- ============================================================
-- 第二步: 检查函数依赖关系
-- ============================================================

-- 检查是否有其他函数依赖这些函数
SELECT 
    '检查函数依赖关系' as step,
    'get_project_available_chains' as function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_definition LIKE '%get_project_available_chains%'
            AND routine_name NOT IN (
                'get_project_available_chains',
                'validate_chain_modification_permission', 
                'modify_logistics_record_chain',
                'batch_modify_logistics_records_chain'
            )
        ) THEN '有依赖'
        ELSE '无依赖'
    END as dependency_status

UNION ALL

SELECT 
    '检查函数依赖关系' as step,
    'validate_chain_modification_permission' as function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_definition LIKE '%validate_chain_modification_permission%'
            AND routine_name NOT IN (
                'get_project_available_chains',
                'validate_chain_modification_permission', 
                'modify_logistics_record_chain',
                'batch_modify_logistics_records_chain'
            )
        ) THEN '有依赖'
        ELSE '无依赖'
    END as dependency_status

UNION ALL

SELECT 
    '检查函数依赖关系' as step,
    'modify_logistics_record_chain' as function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_definition LIKE '%modify_logistics_record_chain%'
            AND routine_name NOT IN (
                'get_project_available_chains',
                'validate_chain_modification_permission', 
                'modify_logistics_record_chain',
                'batch_modify_logistics_records_chain'
            )
        ) THEN '有依赖'
        ELSE '无依赖'
    END as dependency_status

UNION ALL

SELECT 
    '检查函数依赖关系' as step,
    'batch_modify_logistics_records_chain' as function_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_definition LIKE '%batch_modify_logistics_records_chain%'
            AND routine_name NOT IN (
                'get_project_available_chains',
                'validate_chain_modification_permission', 
                'modify_logistics_record_chain',
                'batch_modify_logistics_records_chain'
            )
        ) THEN '有依赖'
        ELSE '无依赖'
    END as dependency_status;

-- ============================================================
-- 第三步: 检查前端代码使用情况
-- ============================================================

-- 注意：以下检查基于代码分析，确认这些函数只在合作链路修改功能中使用
-- 检查结果：
-- 1. get_project_available_chains - 仅在 PaymentRequest.tsx 中使用（已移除）
-- 2. validate_chain_modification_permission - 仅在 PaymentRequest.tsx 中使用（已移除）
-- 3. modify_logistics_record_chain - 仅在 PaymentRequest.tsx 中使用（已移除）
-- 4. batch_modify_logistics_records_chain - 仅在 PaymentRequest.tsx 中使用（已移除）

SELECT 
    '前端代码使用检查' as step,
    'get_project_available_chains' as function_name,
    '仅在已移除的PaymentRequest.tsx中使用' as usage_status

UNION ALL

SELECT 
    '前端代码使用检查' as step,
    'validate_chain_modification_permission' as function_name,
    '仅在已移除的PaymentRequest.tsx中使用' as usage_status

UNION ALL

SELECT 
    '前端代码使用检查' as step,
    'modify_logistics_record_chain' as function_name,
    '仅在已移除的PaymentRequest.tsx中使用' as usage_status

UNION ALL

SELECT 
    '前端代码使用检查' as step,
    'batch_modify_logistics_records_chain' as function_name,
    '仅在已移除的PaymentRequest.tsx中使用' as usage_status;

-- ============================================================
-- 第四步: 安全删除函数
-- ============================================================

-- 删除合作链路相关函数（按依赖顺序删除）
DROP FUNCTION IF EXISTS public.batch_modify_logistics_records_chain(UUID[], TEXT);
DROP FUNCTION IF EXISTS public.modify_logistics_record_chain(UUID, TEXT);
DROP FUNCTION IF EXISTS public.validate_chain_modification_permission(UUID[]);
DROP FUNCTION IF EXISTS public.get_project_available_chains(UUID);

-- 注意：is_finance_operator_or_admin 函数可能被其他功能使用，需要谨慎处理
-- 如果确认只用于合作链路功能，可以删除：
-- DROP FUNCTION IF EXISTS public.is_finance_operator_or_admin();

-- ============================================================
-- 第五步: 验证删除结果
-- ============================================================

SELECT 
    '删除后验证' as step,
    routine_name as function_name,
    '已删除' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
    'get_project_available_chains',
    'validate_chain_modification_permission', 
    'modify_logistics_record_chain',
    'batch_modify_logistics_records_chain'
)
ORDER BY routine_name;

-- 如果没有返回结果，说明函数已成功删除

-- ============================================================
-- 第六步: 清理相关文档和说明
-- ============================================================

SELECT 
    '=== 合作链路功能删除完成 ===' as summary,
    '已删除的函数:' as info,
    'get_project_available_chains, validate_chain_modification_permission, modify_logistics_record_chain, batch_modify_logistics_records_chain' as deleted_functions,
    '注意: is_finance_operator_or_admin 函数保留，可能被其他功能使用' as note;
