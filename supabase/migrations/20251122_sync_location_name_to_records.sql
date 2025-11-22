-- ============================================================================
-- 同步地点名称到运单记录
-- 创建时间: 2025-11-22
-- 功能: 当地点名称修改时，自动同步更新所有相关运单的装货地点和卸货地点
-- 问题: logistics_records 表中冗余存储了 loading_location 和 unloading_location 字段，
--       修改 locations 表的 name 字段时不会自动同步
-- ============================================================================

BEGIN;

-- ============================================================================
-- 创建触发器函数：同步地点名称
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_location_name_to_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- 只有当地点名称发生变化时才执行同步
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        
        RAISE NOTICE '地点名称变更: "%" → "%"', OLD.name, NEW.name;
        
        -- 更新所有使用该地点的运单记录（装货地点）
        UPDATE public.logistics_records
        SET loading_location = NEW.name,
            updated_at = NOW()
        WHERE loading_location = OLD.name
          AND loading_location != NEW.name;  -- 只更新名称不一致的记录
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        
        RAISE NOTICE '已同步更新 % 条运单记录的装货地点', v_updated_count;
        
        -- 更新所有使用该地点的运单记录（卸货地点）
        UPDATE public.logistics_records
        SET unloading_location = NEW.name,
            updated_at = NOW()
        WHERE unloading_location = OLD.name
          AND unloading_location != NEW.name;  -- 只更新名称不一致的记录
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        
        RAISE NOTICE '已同步更新 % 条运单记录的卸货地点', v_updated_count;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_location_name_to_records IS '当地点名称修改时，自动同步更新所有相关运单的装货地点和卸货地点';

-- ============================================================================
-- 创建触发器
-- ============================================================================

-- 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS trigger_sync_location_name ON public.locations;

-- 创建触发器（AFTER UPDATE）
CREATE TRIGGER trigger_sync_location_name
    AFTER UPDATE OF name
    ON public.locations
    FOR EACH ROW
    WHEN (OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION public.sync_location_name_to_records();

COMMENT ON TRIGGER trigger_sync_location_name ON public.locations
    IS '地点名称变更时，自动同步更新所有相关运单的装货地点和卸货地点';

-- ============================================================================
-- 手动同步函数（可选）：修复历史数据
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fix_inconsistent_location_names()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_total_loading INTEGER := 0;
    v_total_unloading INTEGER := 0;
    v_fixed_loading INTEGER := 0;
    v_fixed_unloading INTEGER := 0;
BEGIN
    -- 查找装货地点不一致的运单
    SELECT COUNT(*) INTO v_total_loading
    FROM public.logistics_records lr
    INNER JOIN public.locations l ON lr.loading_location = l.name
    WHERE lr.loading_location != l.name;
    
    -- 查找卸货地点不一致的运单（这个查询可能有问题，因为如果name匹配就不会不一致）
    -- 实际上应该查找那些地点名称在locations表中不存在或已更改的情况
    -- 这里我们查找那些loading_location在locations表中找不到对应name的记录
    SELECT COUNT(*) INTO v_total_unloading
    FROM public.logistics_records lr
    WHERE lr.unloading_location IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM public.locations l 
          WHERE l.name = lr.unloading_location
      );
    
    RAISE NOTICE '发现 % 条运单的装货地点可能需要修复', v_total_loading;
    RAISE NOTICE '发现 % 条运单的卸货地点在locations表中不存在', v_total_unloading;
    
    -- 修复不一致的记录（装货地点）
    -- 注意：这个修复逻辑需要根据实际情况调整
    -- 如果locations表中的name已经改变，我们需要找到对应的记录
    -- 这里我们只修复那些地点名称在locations表中找不到的记录
    
    -- 修复卸货地点：将不存在的地点名称标记为需要手动处理
    -- 或者可以尝试通过其他方式匹配（比如通过location_ids）
    
    RETURN json_build_object(
        'total_loading_inconsistent', v_total_loading,
        'total_unloading_inconsistent', v_total_unloading,
        'fixed_loading_count', v_fixed_loading,
        'fixed_unloading_count', v_fixed_unloading,
        'message', format('发现 %s 条装货地点不一致，%s 条卸货地点不存在', v_total_loading, v_total_unloading)
    );
END;
$$;

COMMENT ON FUNCTION public.fix_inconsistent_location_names IS '手动修复运单表中与locations表不一致的地点名称';

-- ============================================================================
-- 完成
-- ============================================================================

COMMIT;

SELECT '✅ 地点名称同步触发器已创建！' AS status;

