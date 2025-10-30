-- ==========================================
-- 批量关联司机到项目（快速版）
-- ==========================================
-- 功能：根据运单记录，自动将司机关联到相关项目
-- 使用方法：直接在 Supabase Dashboard SQL Editor 中执行

BEGIN;

-- ============================================================
-- 第一步：执行批量关联
-- ============================================================

-- 从运单记录中提取司机-项目关系，批量插入到 driver_projects
INSERT INTO public.driver_projects (driver_id, project_id, user_id)
SELECT DISTINCT 
    lr.driver_id,
    lr.project_id,
    (SELECT id FROM auth.users LIMIT 1)  -- 使用第一个用户ID，或者改为固定的管理员ID
FROM public.logistics_records lr
WHERE lr.driver_id IS NOT NULL
  AND lr.project_id IS NOT NULL
  AND NOT EXISTS (
      -- 只关联尚未关联的
      SELECT 1 
      FROM public.driver_projects dp 
      WHERE dp.driver_id = lr.driver_id 
        AND dp.project_id = lr.project_id
  )
ON CONFLICT (driver_id, project_id) DO NOTHING;

-- ============================================================
-- 第二步：显示关联结果
-- ============================================================

-- 统计信息
SELECT 
    '✅ 关联完成' as "状态",
    COUNT(*) as "总关联数"
FROM public.driver_projects;

-- 按项目统计司机数量
SELECT 
    p.name as "项目名称",
    COUNT(dp.driver_id) as "司机数量"
FROM public.projects p
LEFT JOIN public.driver_projects dp ON p.id = dp.project_id
GROUP BY p.id, p.name
ORDER BY COUNT(dp.driver_id) DESC;

-- 查看没有项目的司机
SELECT 
    d.name as "司机姓名",
    d.license_plate as "车牌号",
    d.phone as "电话"
FROM public.drivers d
WHERE NOT EXISTS (
    SELECT 1 FROM public.driver_projects dp WHERE dp.driver_id = d.id
)
ORDER BY d.name
LIMIT 20;

COMMIT;

-- 显示完成信息
SELECT '🎉 批量关联任务完成！请查看上面的统计信息。' as "完成提示";
