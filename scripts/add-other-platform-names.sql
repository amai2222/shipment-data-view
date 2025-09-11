-- 为logistics_records表添加其他平台名称字段
-- 这个脚本将添加一个简单的TEXT数组字段来记录其他平台名称

-- 1. 添加其他平台名称字段
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS other_platform_names TEXT[] DEFAULT '{}';

-- 2. 添加字段注释
COMMENT ON COLUMN public.logistics_records.other_platform_names IS '其他平台名称数组，记录该运单涉及的其他物流平台';

-- 3. 创建GIN索引以提高数组查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_other_platform_names 
ON public.logistics_records USING GIN (other_platform_names);

-- 4. 删除可能存在的同名函数
DROP FUNCTION IF EXISTS public.get_logistics_records_by_platform(TEXT);

-- 5. 创建根据平台名称查询运单的函数
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

-- 6. 创建获取所有使用过的平台名称的函数
CREATE OR REPLACE FUNCTION public.get_all_used_platforms()
RETURNS TABLE (
  platform_name TEXT,
  usage_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    platform_name,
    COUNT(*) as usage_count
  FROM (
    SELECT unnest(other_platform_names) as platform_name
    FROM public.logistics_records
    WHERE other_platform_names IS NOT NULL
    AND array_length(other_platform_names, 1) > 0
  ) t
  GROUP BY platform_name
  ORDER BY usage_count DESC;
END;
$$;

-- 7. 创建统计其他平台使用情况的函数
CREATE OR REPLACE FUNCTION public.get_platform_usage_statistics()
RETURNS TABLE (
  total_records_with_platforms BIGINT,
  total_platform_mentions BIGINT,
  unique_platforms BIGINT,
  most_used_platform TEXT,
  most_used_platform_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_records BIGINT;
  v_total_mentions BIGINT;
  v_unique_platforms BIGINT;
  v_most_used_platform TEXT;
  v_most_used_count BIGINT;
BEGIN
  -- 计算有平台名称的运单数量
  SELECT COUNT(*) INTO v_total_records
  FROM public.logistics_records
  WHERE other_platform_names IS NOT NULL
  AND array_length(other_platform_names, 1) > 0;
  
  -- 计算平台名称总提及次数
  SELECT COUNT(*) INTO v_total_mentions
  FROM (
    SELECT unnest(other_platform_names) as platform_name
    FROM public.logistics_records
    WHERE other_platform_names IS NOT NULL
    AND array_length(other_platform_names, 1) > 0
  ) t;
  
  -- 计算唯一平台数量
  SELECT COUNT(DISTINCT platform_name) INTO v_unique_platforms
  FROM (
    SELECT unnest(other_platform_names) as platform_name
    FROM public.logistics_records
    WHERE other_platform_names IS NOT NULL
    AND array_length(other_platform_names, 1) > 0
  ) t;
  
  -- 获取最常用的平台
  SELECT platform_name, usage_count
  INTO v_most_used_platform, v_most_used_count
  FROM public.get_all_used_platforms()
  LIMIT 1;
  
  RETURN QUERY
  SELECT 
    v_total_records,
    v_total_mentions,
    v_unique_platforms,
    v_most_used_platform,
    v_most_used_count;
END;
$$;

-- 8. 创建更新运单其他平台名称的函数
CREATE OR REPLACE FUNCTION public.update_logistics_record_platforms(
  p_logistics_record_id UUID,
  p_platform_names TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 过滤空字符串和null值
  p_platform_names := ARRAY(
    SELECT DISTINCT trim(name) 
    FROM unnest(p_platform_names) AS name 
    WHERE trim(name) != ''
  );
  
  -- 更新运单记录
  UPDATE public.logistics_records
  SET other_platform_names = p_platform_names
  WHERE id = p_logistics_record_id;
  
  RETURN TRUE;
END;
$$;

-- 9. 创建验证平台名称的函数
CREATE OR REPLACE FUNCTION public.validate_platform_names(
  p_platform_names TEXT[]
)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  cleaned_platforms TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cleaned_platforms TEXT[];
  v_error_message TEXT := '';
BEGIN
  -- 清理平台名称（去除空字符串和重复项）
  v_cleaned_platforms := ARRAY(
    SELECT DISTINCT trim(name) 
    FROM unnest(p_platform_names) AS name 
    WHERE trim(name) != ''
  );
  
  -- 验证平台名称长度
  IF EXISTS (
    SELECT 1 FROM unnest(v_cleaned_platforms) AS name 
    WHERE length(name) > 50
  ) THEN
    v_error_message := '平台名称长度不能超过50个字符';
    RETURN QUERY SELECT FALSE, v_error_message, v_cleaned_platforms;
    RETURN;
  END IF;
  
  -- 验证平台名称数量
  IF array_length(v_cleaned_platforms, 1) > 10 THEN
    v_error_message := '最多只能添加10个平台名称';
    RETURN QUERY SELECT FALSE, v_error_message, v_cleaned_platforms;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, '', v_cleaned_platforms;
END;
$$;

-- 10. 为函数添加注释
COMMENT ON FUNCTION public.get_logistics_records_by_platform(TEXT) IS '根据平台名称查询运单记录';
COMMENT ON FUNCTION public.get_all_used_platforms() IS '获取所有使用过的平台名称及其使用次数';
COMMENT ON FUNCTION public.get_platform_usage_statistics() IS '获取平台使用情况统计';
COMMENT ON FUNCTION public.update_logistics_record_platforms(UUID, TEXT[]) IS '更新运单的其他平台名称';
COMMENT ON FUNCTION public.validate_platform_names(TEXT[]) IS '验证平台名称的有效性';

-- 11. 创建视图：运单平台信息视图
CREATE OR REPLACE VIEW public.logistics_records_with_platforms AS
SELECT 
  lr.*,
  CASE 
    WHEN lr.other_platform_names IS NOT NULL AND array_length(lr.other_platform_names, 1) > 0 THEN
      lr.other_platform_names
    ELSE NULL
  END as platform_names,
  CASE 
    WHEN lr.other_platform_names IS NOT NULL AND array_length(lr.other_platform_names, 1) > 0 THEN
      array_length(lr.other_platform_names, 1)
    ELSE 0
  END as platform_count
FROM public.logistics_records lr;

-- 12. 测试数据（可选）
-- 为现有运单添加测试用的平台名称
/*
UPDATE public.logistics_records 
SET other_platform_names = ARRAY['货拉拉', '满帮']
WHERE auto_number = 'YDN20250120001';

UPDATE public.logistics_records 
SET other_platform_names = ARRAY['运满满']
WHERE auto_number = 'YDN20250120002';
*/

-- 13. 创建触发器：自动清理空平台名称
CREATE OR REPLACE FUNCTION public.clean_platform_names()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 清理空字符串和null值
  IF NEW.other_platform_names IS NOT NULL THEN
    NEW.other_platform_names := ARRAY(
      SELECT DISTINCT trim(name) 
      FROM unnest(NEW.other_platform_names) AS name 
      WHERE trim(name) != ''
    );
    
    -- 如果清理后为空数组，设置为NULL
    IF array_length(NEW.other_platform_names, 1) IS NULL THEN
      NEW.other_platform_names := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_clean_platform_names ON public.logistics_records;
CREATE TRIGGER trigger_clean_platform_names
  BEFORE INSERT OR UPDATE ON public.logistics_records
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_platform_names();

-- 14. 完成提示
SELECT '其他平台名称字段添加完成！' as message;
