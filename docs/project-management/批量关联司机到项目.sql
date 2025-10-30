-- ==========================================
-- 批量关联司机到项目
-- ==========================================
-- 功能：
--   1. 根据运单记录，自动将司机关联到相关项目
--   2. 避免重复关联
--   3. 只处理尚未关联的司机-项目对
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步：检查当前状态
-- ============================================================

DO $$
DECLARE
    v_total_drivers INTEGER;
    v_total_projects INTEGER;
    v_existing_associations INTEGER;
    v_potential_associations INTEGER;
BEGIN
    -- 统计司机数量
    SELECT COUNT(*) INTO v_total_drivers FROM drivers;
    
    -- 统计项目数量
    SELECT COUNT(*) INTO v_total_projects FROM projects;
    
    -- 统计已有关联
    SELECT COUNT(*) INTO v_existing_associations FROM driver_projects;
    
    -- 统计潜在关联（从运单记录中）
    SELECT COUNT(DISTINCT (driver_id, project_id)) INTO v_potential_associations
    FROM logistics_records
    WHERE driver_id IS NOT NULL 
      AND project_id IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '批量关联司机到项目 - 当前状态';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '系统概况：';
    RAISE NOTICE '  • 总司机数：%', v_total_drivers;
    RAISE NOTICE '  • 总项目数：%', v_total_projects;
    RAISE NOTICE '  • 已有关联：%', v_existing_associations;
    RAISE NOTICE '  • 潜在关联（从运单）：%', v_potential_associations;
    RAISE NOTICE '';
END $$;

-- ============================================================
-- 第二步：执行批量关联
-- ============================================================

-- 创建临时表存储新关联
CREATE TEMP TABLE IF NOT EXISTS new_associations (
    driver_id UUID,
    project_id UUID,
    driver_name TEXT,
    project_name TEXT
);

-- 插入新关联
WITH new_relations AS (
    INSERT INTO driver_projects (driver_id, project_id, user_id)
    SELECT DISTINCT 
        lr.driver_id,
        lr.project_id,
        auth.uid()
    FROM logistics_records lr
    WHERE lr.driver_id IS NOT NULL
      AND lr.project_id IS NOT NULL
      AND NOT EXISTS (
          -- 只关联尚未关联的
          SELECT 1 
          FROM driver_projects dp 
          WHERE dp.driver_id = lr.driver_id 
            AND dp.project_id = lr.project_id
      )
    ON CONFLICT (driver_id, project_id) DO NOTHING
    RETURNING driver_id, project_id
)
INSERT INTO new_associations
SELECT 
    nr.driver_id,
    nr.project_id,
    d.name as driver_name,
    p.name as project_name
FROM new_relations nr
LEFT JOIN drivers d ON nr.driver_id = d.id
LEFT JOIN projects p ON nr.project_id = p.id;

-- ============================================================
-- 第三步：显示关联结果
-- ============================================================

DO $$
DECLARE
    v_new_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_new_count FROM new_associations;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 批量关联完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增关联：% 条', v_new_count;
    RAISE NOTICE '';
    
    IF v_new_count > 0 THEN
        RAISE NOTICE '详细信息（前20条）：';
    ELSE
        RAISE NOTICE '没有需要新增的关联（所有司机已关联到对应项目）';
    END IF;
    RAISE NOTICE '';
END $$;

-- 显示新增关联的详细信息（前20条）
SELECT 
    driver_name as "司机姓名",
    project_name as "项目名称"
FROM new_associations
ORDER BY driver_name, project_name
LIMIT 20;

-- 显示每个项目新增了多少司机
SELECT 
    project_name as "项目名称",
    COUNT(*) as "新增司机数"
FROM new_associations
GROUP BY project_name
ORDER BY COUNT(*) DESC;

-- ============================================================
-- 第四步：验证结果
-- ============================================================

DO $$
DECLARE
    v_total_associations INTEGER;
    v_drivers_with_projects INTEGER;
    v_drivers_without_projects INTEGER;
BEGIN
    -- 统计关联总数
    SELECT COUNT(*) INTO v_total_associations FROM driver_projects;
    
    -- 统计有项目的司机
    SELECT COUNT(DISTINCT driver_id) INTO v_drivers_with_projects 
    FROM driver_projects;
    
    -- 统计没有项目的司机
    SELECT COUNT(*) INTO v_drivers_without_projects
    FROM drivers d
    WHERE NOT EXISTS (
        SELECT 1 FROM driver_projects dp WHERE dp.driver_id = d.id
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '验证结果';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '关联统计：';
    RAISE NOTICE '  • 总关联数：%', v_total_associations;
    RAISE NOTICE '  • 有项目的司机：%', v_drivers_with_projects;
    RAISE NOTICE '  • 没有项目的司机：%', v_drivers_without_projects;
    RAISE NOTICE '';
    
    IF v_drivers_without_projects > 0 THEN
        RAISE NOTICE '⚠️  还有 % 个司机没有关联到任何项目', v_drivers_without_projects;
        RAISE NOTICE '这些司机可能是新导入的，还没有运单记录';
    ELSE
        RAISE NOTICE '✅ 所有司机都已关联到项目！';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- 显示没有项目的司机列表
SELECT 
    d.name as "司机姓名",
    d.license_plate as "车牌号",
    d.phone as "电话"
FROM drivers d
WHERE NOT EXISTS (
    SELECT 1 FROM driver_projects dp WHERE dp.driver_id = d.id
)
ORDER BY d.name
LIMIT 20;

COMMIT;

-- ============================================================
-- 完成信息
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '批量关联任务完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '后续步骤：';
    RAISE NOTICE '  1. 查看上面的统计信息';
    RAISE NOTICE '  2. 对于没有项目的司机，可以：';
    RAISE NOTICE '     a) 在司机管理页面手动分配项目';
    RAISE NOTICE '     b) 等待他们有运单后自动关联';
    RAISE NOTICE '     c) 使用批量SQL脚本分配到默认项目';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
