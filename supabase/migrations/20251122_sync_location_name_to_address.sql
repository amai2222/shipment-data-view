-- ============================================================================
-- 同步地点名称到地址字段
-- ============================================================================
-- 功能: 当地点名称（name）新增或更新时，自动同步到地址字段（address）
-- 规则: 
--   1. 如果 address 为 NULL 或空字符串，自动设置为 name 的值
--   2. 如果 name 更新，且 address 为 NULL 或空字符串，自动更新 address
-- ============================================================================

BEGIN;

-- ============================================================================
-- 创建触发器函数：同步地点名称到地址
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_location_name_to_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- ============================================================
    -- 触发逻辑说明：
    -- 1. 当 locations 表的 name 字段新增（INSERT）或更新（UPDATE）时触发
    -- 2. 如果 address 为 NULL 或空字符串，自动设置为 name 的值
    -- 3. 只在 address 为空时才更新，避免覆盖已有的地址信息
    -- ============================================================
    
    -- 检查 address 是否为空（NULL 或空字符串）
    IF NEW.address IS NULL OR TRIM(NEW.address) = '' THEN
        -- 自动将 name 的值同步到 address
        NEW.address := TRIM(NEW.name);
        
        RAISE NOTICE '地点名称已同步到地址字段：ID=%, name="%", address="%"', 
            NEW.id, NEW.name, NEW.address;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_location_name_to_address IS 
'当地点名称新增或更新时，如果地址字段为空，自动将名称同步到地址字段';

-- ============================================================================
-- 创建触发器
-- ============================================================================

-- 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS trigger_sync_location_name_to_address ON public.locations;

-- 创建触发器（BEFORE INSERT OR UPDATE）
-- 使用 BEFORE 触发器，可以在插入/更新前修改 NEW 记录
CREATE TRIGGER trigger_sync_location_name_to_address
    BEFORE INSERT OR UPDATE OF name
    ON public.locations
    FOR EACH ROW
    WHEN (NEW.address IS NULL OR TRIM(NEW.address) = '')
    EXECUTE FUNCTION public.sync_location_name_to_address();

COMMENT ON TRIGGER trigger_sync_location_name_to_address ON public.locations
    IS '当地点名称新增或更新时，如果地址字段为空，自动将名称同步到地址字段';

-- ============================================================================
-- 验证触发器
-- ============================================================================

-- 验证触发器已创建
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'trigger_sync_location_name_to_address'
    ) THEN
        RAISE NOTICE '✅ 触发器 trigger_sync_location_name_to_address 已成功创建';
    ELSE
        RAISE WARNING '❌ 触发器 trigger_sync_location_name_to_address 创建失败';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- 使用说明
-- ============================================================================
-- 1. 新增地点时：
--    INSERT INTO locations (name) VALUES ('北京');
--    结果：address 自动设置为 '北京'
--
-- 2. 更新地点名称时（如果 address 为空）：
--    UPDATE locations SET name = '北京市' WHERE name = '北京' AND address IS NULL;
--    结果：address 自动更新为 '北京市'
--
-- 3. 更新地点名称时（如果 address 已有值）：
--    UPDATE locations SET name = '北京市' WHERE name = '北京' AND address = '北京市朝阳区';
--    结果：address 保持不变（不会覆盖已有地址）
-- ============================================================================

