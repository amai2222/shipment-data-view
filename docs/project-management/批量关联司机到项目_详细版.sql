-- ==========================================
-- 批量关联司机到项目（详细版）
-- ==========================================
-- 功能：
--   1. 根据运单记录，自动将司机关联到相关项目
--   2. 显示详细的执行过程和统计信息
--   3. 列出需要处理的数据
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
    v_potential_new_associations INTEGER;
BEGIN
    -- 统计司机数量
    SELECT COUNT(*) INTO v_total_drivers FROM drivers;
    
    -- 统计项目数量
    SELECT COUNT(*) INTO v_total_projects FROM projects;
    
    -- 统计已有关联
    SELECT COUNT(*) INTO v_existing_associations FROM driver_projects;
    
    -- 统计可以新增的关联
    SELECT COUNT(DISTINCT (driver_id, project_id)) INTO v_potential_new_associations
    FROM logistics_records
    WHERE driver_id IS NOT NULL 
      AND project_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM driver_projects dp 
          WHERE dp.driver_id = logistics_records.driver_id 
            AND dp.project_id = logistics_records.project_id
      );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '批量关联司机到项目 - 执行前状态';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '系统概况：';
    RAISE NOTICE '  • 总司机数：%', v_total_drivers;
    RAISE NOTICE '  • 总项目数：%', v_total_projects;
    RAISE NOTICE '  • 已有关联：%', v_existing_associations;
    RAISE NOTICE '  • 待新增关联：%', v_potential_new_associations;
    RAISE NOTICE '';
END $$;

-- ============================================================
-- 第二步：预览将要关联的数据（前20条）
-- ============================================================

SELECT 
    d.name as "司机姓名",
    d.license_plate as "车牌号",
    p.name as "项目名称",
    COUNT(*) as "运单数量"
FROM logistics_records lr
JOIN drivers d ON lr.driver_id = d.id
JOIN projects p ON lr.project_id = p.id
WHERE NOT EXISTS (
    SELECT 1 
    FROM driver_projects dp 
    WHERE dp.driver_id = lr.driver_id 
      AND dp.project_id = lr.project_id
)
GROUP BY d.name, d.license_plate, p.name
ORDER BY COUNT(*) DESC
LIMIT 20;

-- ============================================================
-- 第三步：执行批量关联
-- ============================================================

INSERT INTO public.driver_projects (driver_id, project_id, user_id)
SELECT DISTINCT 
    lr.driver_id,
    lr.project_id,
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)  -- 使用最早的用户ID
FROM public.logistics_records lr
WHERE lr.driver_id IS NOT NULL
  AND lr.project_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM public.driver_projects dp 
      WHERE dp.driver_id = lr.driver_id 
        AND dp.project_id = lr.project_id
  )
ON CONFLICT (driver_id, project_id) DO NOTHING;

-- ============================================================
-- 第四步：显示执行结果
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
    RAISE NOTICE '✅ 批量关联完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '执行结果：';
    RAISE NOTICE '  • 总关联数：%', v_total_associations;
    RAISE NOTICE '  • 有项目的司机：%', v_drivers_with_projects;
    RAISE NOTICE '  • 没有项目的司机：%', v_drivers_without_projects;
    RAISE NOTICE '';
    
    IF v_drivers_without_projects > 0 THEN
        RAISE NOTICE '⚠️  还有 % 个司机没有关联到任何项目', v_drivers_without_projects;
        RAISE NOTICE '这些司机可能是新导入的，还没有运单记录';
    ELSE
        RAISE NOTICE '🎉 所有司机都已关联到项目！';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ============================================================
-- 第五步：按项目统计司机数量
-- ============================================================

SELECT 
    p.name as "项目名称",
    COUNT(dp.driver_id) as "司机数量",
    string_agg(DISTINCT d.name, ', ' ORDER BY d.name) as "司机列表（部分）"
FROM public.projects p
LEFT JOIN public.driver_projects dp ON p.id = dp.project_id
LEFT JOIN public.drivers d ON dp.driver_id = d.id
GROUP BY p.id, p.name
ORDER BY COUNT(dp.driver_id) DESC;

-- ============================================================
-- 第六步：列出没有项目的司机
-- ============================================================

SELECT 
    d.name as "司机姓名",
    d.license_plate as "车牌号",
    d.phone as "电话",
    d.created_at as "创建时间"
FROM public.drivers d
WHERE NOT EXISTS (
    SELECT 1 FROM public.driver_projects dp WHERE dp.driver_id = d.id
)
ORDER BY d.created_at DESC
LIMIT 20;

COMMIT;

-- ============================================================
-- 完成提示
-- ============================================================

SELECT '🎉 批量关联任务完成！' as "完成提示",
       '请查看上面的详细统计信息' as "说明";
