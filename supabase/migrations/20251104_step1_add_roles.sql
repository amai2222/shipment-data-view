-- ============================================================================
-- 步骤1：添加车队长和司机角色（必须先执行）
-- ============================================================================
-- 注意：此脚本必须单独执行，执行成功后再执行步骤2
-- 原因：PostgreSQL 要求新枚举值必须在单独的事务中提交后才能使用
-- ============================================================================

-- 添加 fleet_manager 角色
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'app_role'::regtype 
        AND enumlabel = 'fleet_manager'
    ) THEN
        ALTER TYPE app_role ADD VALUE 'fleet_manager';
        RAISE NOTICE '✅ 已添加角色: fleet_manager（车队长）';
    ELSE
        RAISE NOTICE '⚠️ 角色 fleet_manager 已存在，跳过';
    END IF;
END $$;

-- 添加 driver 角色
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'app_role'::regtype 
        AND enumlabel = 'driver'
    ) THEN
        ALTER TYPE app_role ADD VALUE 'driver';
        RAISE NOTICE '✅ 已添加角色: driver（司机）';
    ELSE
        RAISE NOTICE '⚠️ 角色 driver 已存在，跳过';
    END IF;
END $$;

-- 验证角色添加
DO $$
DECLARE
    v_role_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_role_count
    FROM pg_enum
    WHERE enumtypid = 'app_role'::regtype;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 角色添加完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '当前系统角色总数: %', v_role_count;
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 重要：请执行下一个脚本';
    RAISE NOTICE '   → 20251104_step2_create_tables.sql';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

