-- ============================================================================
-- 修复 get_my_waybills 函数的字段引用不明确问题
-- 创建时间: 2025-11-08
-- 问题: column reference "id" is ambiguous
-- 解决方案: 明确指定表名前缀
-- ============================================================================

CREATE OR REPLACE FUNCTION get_my_waybills(
    p_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    auto_number TEXT,
    project_name TEXT,
    loading_location TEXT,
    unloading_location TEXT,
    loading_date DATE,
    loading_weight NUMERIC,
    unloading_weight NUMERIC,
    payment_status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_info RECORD;
BEGIN
    -- 获取司机信息（修复：明确指定表名前缀）
    SELECT internal_drivers.id, internal_drivers.name INTO v_driver_info
    FROM internal_drivers
    WHERE internal_drivers.id = get_current_driver_id();
    
    IF v_driver_info.name IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    -- 返回运单记录（修复：明确指定表名前缀）
    RETURN QUERY
    SELECT 
        lr.id,
        lr.auto_number,
        lr.project_name,
        lr.loading_location,
        lr.unloading_location,
        lr.loading_date::DATE,
        lr.loading_weight,
        lr.unloading_weight,
        lr.payment_status,
        lr.created_at
    FROM logistics_records lr
    WHERE lr.driver_name = v_driver_info.name  -- 通过姓名关联
    AND lr.loading_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    ORDER BY lr.loading_date DESC, lr.created_at DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_my_waybills IS '获取我的运单记录（内部司机专用，通过姓名匹配 logistics_records.driver_name）- 已修复字段引用不明确问题';

-- ============================================================================
-- 验证修复
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ get_my_waybills 函数已修复';
    RAISE NOTICE '========================================';
    RAISE NOTICE '修复内容: 明确指定表名前缀，避免字段引用不明确';
    RAISE NOTICE '影响: 司机移动端 - 我的运单列表';
    RAISE NOTICE '';
    RAISE NOTICE '💡 可以测试司机移动端是否正常加载运单了';
    RAISE NOTICE '========================================';
END $$;

