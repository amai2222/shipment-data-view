-- 回滚脚本：恢复到原来的项目看板函数
-- 如果需要回滚，执行此脚本即可

-- 1. 删除新创建的函数
DROP FUNCTION IF EXISTS public.get_projects_overview_with_driver_receivable(text, text, text[]);
DROP FUNCTION IF EXISTS public.get_all_projects_overview_data_with_driver_receivable(date, uuid[]);

-- 2. 验证原函数仍然存在
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_all_projects_overview_data') 
    THEN '原函数 get_all_projects_overview_data 仍然存在，可以正常使用'
    ELSE '警告：原函数不存在，需要重新创建'
  END AS rollback_status;

-- 3. 如果需要，可以重新创建原函数（这里只是示例，实际需要根据具体情况）
-- CREATE OR REPLACE FUNCTION public.get_all_projects_overview_data(
--   p_report_date date, 
--   p_project_ids uuid[] DEFAULT NULL
-- )
-- RETURNS jsonb
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   RETURN public.get_all_projects_overview_data_optimized(
--     p_report_date::text, 
--     p_project_ids
--   );
-- END;
-- $$;

SELECT '回滚完成：新函数已删除，原函数保持不变' AS rollback_result;
