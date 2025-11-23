-- ============================================================================
-- 为 locations 表新增昵称字段并同步历史数据
-- ============================================================================
-- 功能：
-- 1. 添加 nickname（昵称）字段
-- 2. 一次性将历史数据的 name 值同步到 nickname 字段
-- ============================================================================

BEGIN;

-- ============================================================================
-- 步骤1：添加昵称字段
-- ============================================================================

-- 添加 nickname 字段
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS nickname TEXT;

COMMENT ON COLUMN public.locations.nickname IS '地点昵称，用于显示和搜索';

-- ============================================================================
-- 步骤2：一次性同步历史数据：将 name 的值复制到 nickname
-- ============================================================================

-- 将现有数据的 name 值同步到 nickname
UPDATE public.locations
SET nickname = TRIM(name)
WHERE nickname IS NULL OR TRIM(nickname) = '';

-- ============================================================================
-- 验证和统计
-- ============================================================================

-- 验证字段已添加
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'locations' 
          AND column_name = 'nickname'
    ) THEN
        RAISE NOTICE '✅ nickname 字段已成功添加到 locations 表';
    ELSE
        RAISE WARNING '❌ nickname 字段添加失败';
    END IF;
END $$;

-- 显示统计信息
DO $$
DECLARE
    v_total_count INTEGER;
    v_nickname_count INTEGER;
    v_synced_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_count FROM public.locations;
    SELECT COUNT(*) INTO v_nickname_count FROM public.locations WHERE nickname IS NOT NULL AND TRIM(nickname) != '';
    SELECT COUNT(*) INTO v_synced_count FROM public.locations WHERE nickname = TRIM(name);
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '数据同步统计：';
    RAISE NOTICE '  总记录数: %', v_total_count;
    RAISE NOTICE '  有昵称的记录数: %', v_nickname_count;
    RAISE NOTICE '  昵称与名称一致的记录数: %', v_synced_count;
    RAISE NOTICE '========================================';
END $$;

COMMIT;

