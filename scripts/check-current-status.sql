-- 检查当前系统状态
DO $$
DECLARE
    rec record;
BEGIN
    RAISE NOTICE '=== 检查当前系统状态 ===';
    
    -- 1. 检查函数是否存在
    IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'batch_import_logistics_records_with_update') THEN
        RAISE NOTICE '✓ batch_import_logistics_records_with_update 函数存在';
    ELSE
        RAISE NOTICE '✗ batch_import_logistics_records_with_update 函数不存在';
    END IF;
    
    -- 2. 检查函数参数
    IF EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'batch_import_logistics_records_with_update') THEN
        RAISE NOTICE '函数参数:';
        FOR rec IN 
            SELECT proname, proargnames, proargtypes
            FROM pg_proc 
            WHERE proname = 'batch_import_logistics_records_with_update'
        LOOP
            RAISE NOTICE '  函数名: %', rec.proname;
            RAISE NOTICE '  参数名: %', rec.proargnames;
            RAISE NOTICE '  参数类型: %', rec.proargtypes;
        END LOOP;
    END IF;
    
    -- 3. 检查用户权限
    IF auth.uid() IS NOT NULL THEN
        RAISE NOTICE '✓ 用户已登录: %', auth.uid();
    ELSE
        RAISE NOTICE '✗ 用户未登录';
    END IF;
    
    -- 4. 检查项目表
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        RAISE NOTICE '✓ projects 表存在';
    ELSE
        RAISE NOTICE '✗ projects 表不存在';
    END IF;
    
    -- 5. 检查运单表
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'logistics_records') THEN
        RAISE NOTICE '✓ logistics_records 表存在';
    ELSE
        RAISE NOTICE '✗ logistics_records 表不存在';
    END IF;
    
    RAISE NOTICE '=== 状态检查完成 ===';
    
END $$;
