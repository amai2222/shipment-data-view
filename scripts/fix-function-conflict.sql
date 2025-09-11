-- 修复函数冲突问题
-- 这个脚本将删除现有的函数并重新创建

-- 1. 删除现有的 get_logistics_records_by_platform 函数
DROP FUNCTION IF EXISTS public.get_logistics_records_by_platform(TEXT);

-- 2. 重新创建 get_logistics_records_by_platform 函数
CREATE OR REPLACE FUNCTION public.get_logistics_records_by_platform(
  p_platform_name TEXT
)
RETURNS TABLE (
  id UUID,
  auto_number TEXT,
  project_name TEXT,
  driver_name TEXT,
  loading_location TEXT,
  loading_date TIMESTAMP WITH TIME ZONE,
  other_platform_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lr.id,
    lr.auto_number,
    lr.project_name,
    lr.driver_name,
    lr.loading_location,
    lr.loading_date,
    lr.other_platform_names
  FROM public.logistics_records lr
  WHERE p_platform_name = ANY(lr.other_platform_names);
END;
$$;

-- 3. 为函数添加注释
COMMENT ON FUNCTION public.get_logistics_records_by_platform(TEXT) IS '根据平台名称查询运单记录';

-- 完成提示
SELECT '函数冲突已修复！' as message;
