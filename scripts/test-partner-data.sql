-- 测试合作商数据查询
-- 文件路径: scripts/test-partner-data.sql
-- 描述: 测试project_partners表中的数据

-- 1. 检查partners表是否有数据
SELECT 'partners表数据:' as info;
SELECT id, name, full_name FROM public.partners LIMIT 10;

-- 2. 检查project_partners表是否有数据
SELECT 'project_partners表数据:' as info;
SELECT partner_id, project_id, level FROM public.project_partners LIMIT 10;

-- 3. 检查projects表是否有数据
SELECT 'projects表数据:' as info;
SELECT id, name FROM public.projects LIMIT 10;

-- 4. 检查合作商-项目关系
SELECT '合作商-项目关系:' as info;
SELECT 
    p.name as partner_name,
    pr.name as project_name,
    pp.level
FROM public.project_partners pp
JOIN public.partners p ON pp.partner_id = p.id
JOIN public.projects pr ON pp.project_id = pr.id
ORDER BY pp.level DESC
LIMIT 20;

-- 5. 测试每个项目的最高级别合作商查询（当前逻辑）
SELECT '每个项目的最高级别合作商查询:' as info;
WITH project_max_levels AS (
  SELECT 
    project_id,
    MAX(level) as max_level
  FROM public.project_partners
  GROUP BY project_id
),
highest_level_partners AS (
  SELECT DISTINCT
    pp.partner_id,
    p.id,
    p.name,
    p.full_name,
    pp.level,
    pp.project_id
  FROM public.project_partners pp
  JOIN public.partners p ON pp.partner_id = p.id
  JOIN project_max_levels pml ON pp.project_id = pml.project_id
  WHERE pp.level = pml.max_level
)
SELECT * FROM highest_level_partners ORDER BY name;

-- 6. 验证每个项目的最高级别
SELECT '每个项目的最高级别验证:' as info;
SELECT 
    pr.name as project_name,
    MAX(pp.level) as max_level,
    COUNT(*) as partner_count
FROM public.project_partners pp
JOIN public.projects pr ON pp.project_id = pr.id
GROUP BY pr.id, pr.name
ORDER BY pr.name;
