-- ==========================================
-- 检查运单编辑相关函数是否存在
-- ==========================================
-- 用途：验证编辑运单所需的数据库函数
-- 执行：在 Supabase SQL Editor 中执行
-- ==========================================

-- ============================================================
-- 1. 检查 update_logistics_record_via_recalc 函数
-- ============================================================
SELECT 
    '检查 update_logistics_record_via_recalc 函数' as "检查项",
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'update_logistics_record_via_recalc'
        )
        THEN '✅ 函数存在'
        ELSE '❌ 函数不存在 - 编辑运单会失败！'
    END as "状态";

-- ============================================================
-- 2. 列出所有运单相关的函数
-- ============================================================
SELECT 
    '所有运单相关函数' as "类别",
    routine_name as "函数名",
    routine_type as "类型"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%logistics%'
ORDER BY routine_name;

-- ============================================================
-- 3. 检查新增运单函数（对比）
-- ============================================================
SELECT 
    '检查 add_logistics_record_with_costs 函数' as "检查项",
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'add_logistics_record_with_costs'
        )
        THEN '✅ 函数存在 - 新增运单正常'
        ELSE '❌ 函数不存在'
    END as "状态";

-- ============================================================
-- 4. 检查重算相关函数
-- ============================================================
SELECT 
    '重算相关函数' as "类别",
    routine_name as "函数名",
    routine_type as "类型"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%recalc%' OR routine_name LIKE '%calculate%')
ORDER BY routine_name;

-- ============================================================
-- 5. 详细信息（如果函数存在）
-- ============================================================
SELECT 
    routine_name as "函数名",
    pg_get_functiondef(p.oid) as "函数定义（前100字符）"
FROM information_schema.routines r
JOIN pg_proc p ON r.routine_name = p.proname
WHERE routine_schema = 'public'
  AND routine_name IN ('update_logistics_record_via_recalc', 'add_logistics_record_with_costs')
LIMIT 10;

-- ============================================================
-- 6. 检查合作方成本计算函数
-- ============================================================
SELECT 
    '合作方成本计算函数' as "类别",
    routine_name as "函数名"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%partner%cost%'
ORDER BY routine_name;

-- ============================================================
-- 7. 汇总报告
-- ============================================================
DO $$
DECLARE
    has_update_func BOOLEAN;
    has_add_func BOOLEAN;
    has_recalc_func BOOLEAN;
BEGIN
    -- 检查更新函数
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = 'update_logistics_record_via_recalc'
    ) INTO has_update_func;
    
    -- 检查新增函数
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = 'add_logistics_record_with_costs'
    ) INTO has_add_func;
    
    -- 检查重算函数
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name LIKE '%recalculate%partner%cost%'
    ) INTO has_recalc_func;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '运单编辑功能检查报告';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '核心函数检查：';
    RAISE NOTICE '  新增运单: % - %', 
        CASE WHEN has_add_func THEN '✅' ELSE '❌' END,
        CASE WHEN has_add_func THEN 'add_logistics_record_with_costs 存在' ELSE 'add_logistics_record_with_costs 不存在' END;
    RAISE NOTICE '  编辑运单: % - %', 
        CASE WHEN has_update_func THEN '✅' ELSE '❌' END,
        CASE WHEN has_update_func THEN 'update_logistics_record_via_recalc 存在' ELSE 'update_logistics_record_via_recalc 不存在' END;
    RAISE NOTICE '';
    
    IF NOT has_update_func THEN
        RAISE NOTICE '❌ 问题发现：';
        RAISE NOTICE '   update_logistics_record_via_recalc 函数不存在！';
        RAISE NOTICE '   这会导致编辑运单功能异常。';
        RAISE NOTICE '';
        RAISE NOTICE '建议：';
        RAISE NOTICE '   1. 创建缺失的函数';
        RAISE NOTICE '   2. 或修改前端代码使用其他方式更新';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '✅ 所有核心函数都存在';
        RAISE NOTICE '';
        RAISE NOTICE '编辑运单时：';
        RAISE NOTICE '   1. 更新运单基础信息';
        RAISE NOTICE '   2. 删除旧的合作方成本';
        RAISE NOTICE '   3. 重新计算新的合作方成本';
        RAISE NOTICE '   4. 插入新的成本记录';
        RAISE NOTICE '';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

