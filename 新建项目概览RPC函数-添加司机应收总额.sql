-- 新建项目概览RPC函数，添加司机应收总额字段
-- 函数名：get_all_projects_overview_data_with_driver_receivable
-- 为了便于回滚，不修改现有函数

CREATE OR REPLACE FUNCTION public.get_all_projects_overview_data_with_driver_receivable(
  p_report_date date, 
  p_project_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  -- 调用新的带司机应收总额的函数
  RETURN public.get_projects_overview_with_driver_receivable(
    p_report_date::text, 
    NULL, 
    p_project_ids
  );
END;
$$;

-- 验证新函数创建成功
SELECT '新RPC函数 get_all_projects_overview_data_with_driver_receivable 创建完成' AS status;

-- 测试新函数（可选）
-- SELECT get_all_projects_overview_data_with_driver_receivable(CURRENT_DATE, NULL);
