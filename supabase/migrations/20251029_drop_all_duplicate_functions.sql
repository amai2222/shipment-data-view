-- ==========================================
-- 删除所有重复的函数定义
-- ==========================================
-- 用于解决函数签名冲突问题
-- ==========================================

BEGIN;

-- 查看当前存在的所有 get_invoice_request_data 函数
DO $$
DECLARE
    v_func record;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '查找 get_invoice_request_data 函数';
    RAISE NOTICE '========================================';
    
    FOR v_func IN 
        SELECT 
            p.oid,
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_invoice_request_data'
        ORDER BY p.oid
    LOOP
        RAISE NOTICE 'OID: % | 函数签名: %(%)', v_func.oid, v_func.proname, v_func.signature;
    END LOOP;
END $$;

-- 删除所有版本的 get_invoice_request_data (包括 _latest 和 _v2 版本)
DO $$
DECLARE
    v_func_oid oid;
    v_func_sig text;
    v_drop_cmd text;
BEGIN
    -- 逐个删除函数
    FOR v_func_oid IN 
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND (p.proname = 'get_invoice_request_data' 
            OR p.proname = 'get_invoice_request_data_latest'
            OR p.proname = 'get_invoice_request_data_v2')
    LOOP
        v_drop_cmd := 'DROP FUNCTION IF EXISTS ' || v_func_oid::regprocedure || ' CASCADE';
        EXECUTE v_drop_cmd;
        RAISE NOTICE '删除函数: %', v_func_oid::regprocedure;
    END LOOP;
    
    RAISE NOTICE '✅ 已删除所有 get_invoice_request_data 相关函数';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '删除函数时出错: %', SQLERRM;
END $$;

-- 查看当前存在的所有 get_payment_request_data 函数
DO $$
DECLARE
    v_func record;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '查找 get_payment_request_data 函数';
    RAISE NOTICE '========================================';
    
    FOR v_func IN 
        SELECT 
            p.oid,
            p.proname,
            pg_get_function_identity_arguments(p.oid) AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_payment_request_data'
        ORDER BY p.oid
    LOOP
        RAISE NOTICE 'OID: % | 函数签名: %(%)', v_func.oid, v_func.proname, v_func.signature;
    END LOOP;
END $$;

-- 删除 get_payment_request_data (但保留 _v2 版本，其他页面在用)
DO $$
DECLARE
    v_func_oid oid;
    v_drop_cmd text;
BEGIN
    -- 逐个删除函数（排除 _v2 版本）
    FOR v_func_oid IN 
        SELECT p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_payment_request_data'  -- 只删除基础版本，不删除 _v2
    LOOP
        v_drop_cmd := 'DROP FUNCTION IF EXISTS ' || v_func_oid::regprocedure || ' CASCADE';
        EXECUTE v_drop_cmd;
        RAISE NOTICE '删除函数: %', v_func_oid::regprocedure;
    END LOOP;
    
    RAISE NOTICE '✅ 已删除 get_payment_request_data 函数（保留 _v2 版本）';
    RAISE NOTICE '⚠️  get_payment_request_data_v2 已保留（其他5个页面在使用）';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '删除函数时出错: %', SQLERRM;
END $$;

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 函数删除完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  重要说明:';
    RAISE NOTICE '- get_invoice_request_data_v2: 已删除（没有页面使用）';
    RAISE NOTICE '- get_payment_request_data_v2: ✅ 保留（5个页面使用）';
    RAISE NOTICE '';
    RAISE NOTICE '现在可以执行以下迁移文件:';
    RAISE NOTICE '1. 20251029_fix_payment_request_data_sort_by_auto_number.sql';
    RAISE NOTICE '2. 20251029_fix_invoice_request_data_sort_by_auto_number.sql';
    RAISE NOTICE '========================================';
END $$;

