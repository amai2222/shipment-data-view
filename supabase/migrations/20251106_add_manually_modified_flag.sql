-- ============================================================================
-- 添加手工修改标记字段
-- 创建日期：2025-11-06
-- 功能：标记哪些合作方成本是手工修改过的，重算时需要保护
-- ============================================================================

-- ============================================================================
-- 第一步：添加字段
-- ============================================================================

ALTER TABLE logistics_partner_costs
ADD COLUMN IF NOT EXISTS is_manually_modified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN logistics_partner_costs.is_manually_modified IS '是否手工修改过（true=手工改过，重算时保护；false=系统计算，重算时覆盖）';

-- ============================================================================
-- 第二步：创建索引（提高查询性能）
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_manually_modified 
ON logistics_partner_costs(logistics_record_id, is_manually_modified)
WHERE is_manually_modified = true;

-- ============================================================================
-- 第三步：标记现有数据（可选：将所有现有数据标记为未改过）
-- ============================================================================

-- 默认所有现有数据都是系统计算的（未手工改过）
UPDATE logistics_partner_costs
SET is_manually_modified = FALSE
WHERE is_manually_modified IS NULL;

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
DECLARE
    v_total_count INTEGER;
    v_manual_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_count FROM logistics_partner_costs;
    SELECT COUNT(*) INTO v_manual_count FROM logistics_partner_costs WHERE is_manually_modified = true;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ is_manually_modified 字段已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '统计信息：';
    RAISE NOTICE '  总记录数：%', v_total_count;
    RAISE NOTICE '  手工修改：%', v_manual_count;
    RAISE NOTICE '  系统计算：%', v_total_count - v_manual_count;
    RAISE NOTICE '';
    RAISE NOTICE '用途：';
    RAISE NOTICE '  • 保存时设置为 true（标记为手工修改）';
    RAISE NOTICE '  • 重算时保护 true 的记录（不覆盖手工值）';
    RAISE NOTICE '  • 重算时覆盖 false 的记录（重新计算）';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

