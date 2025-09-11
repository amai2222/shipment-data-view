-- 为logistics_records表添加其他平台运单号码字段
-- 这个脚本将添加支持多个外部平台运单号的功能

-- 1. 添加其他平台运单号码字段
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS external_tracking_numbers JSONB DEFAULT '[]'::jsonb;

-- 2. 添加字段注释
COMMENT ON COLUMN public.logistics_records.external_tracking_numbers IS '其他平台运单号码，JSON格式存储，支持多个平台的运单号关联';

-- 3. 创建JSON索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_external_tracking 
ON public.logistics_records USING GIN (external_tracking_numbers);

-- 4. 创建根据外部运单号查询运单的函数
CREATE OR REPLACE FUNCTION public.get_logistics_record_by_external_tracking(
  p_tracking_number TEXT
)
RETURNS TABLE (
  id UUID,
  auto_number TEXT,
  project_name TEXT,
  driver_name TEXT,
  loading_location TEXT,
  loading_date TIMESTAMP WITH TIME ZONE,
  external_tracking_numbers JSONB
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
    lr.external_tracking_numbers
  FROM public.logistics_records lr
  WHERE lr.external_tracking_numbers @> jsonb_build_array(
    jsonb_build_object('tracking_number', p_tracking_number)
  );
END;
$$;

-- 5. 创建根据平台查询运单的函数
CREATE OR REPLACE FUNCTION public.get_logistics_records_by_platform(
  p_platform TEXT
)
RETURNS TABLE (
  id UUID,
  auto_number TEXT,
  project_name TEXT,
  driver_name TEXT,
  loading_location TEXT,
  loading_date TIMESTAMP WITH TIME ZONE,
  external_tracking_numbers JSONB
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
    lr.external_tracking_numbers
  FROM public.logistics_records lr
  WHERE lr.external_tracking_numbers @> jsonb_build_array(
    jsonb_build_object('platform', p_platform)
  );
END;
$$;

-- 6. 创建更新外部运单号状态的函数
CREATE OR REPLACE FUNCTION public.update_external_tracking_status(
  p_logistics_record_id UUID,
  p_tracking_number TEXT,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_external_tracking JSONB;
  v_updated_tracking JSONB;
  v_updated_array JSONB;
BEGIN
  -- 获取当前的外部运单号数组
  SELECT external_tracking_numbers INTO v_external_tracking
  FROM public.logistics_records
  WHERE id = p_logistics_record_id;
  
  -- 更新指定运单号的状态
  v_updated_array := (
    SELECT jsonb_agg(
      CASE 
        WHEN elem->>'tracking_number' = p_tracking_number THEN
          jsonb_set(elem, '{status}', to_jsonb(p_status))
        ELSE elem
      END
    )
    FROM jsonb_array_elements(v_external_tracking) AS elem
  );
  
  -- 更新数据库记录
  UPDATE public.logistics_records
  SET external_tracking_numbers = v_updated_array
  WHERE id = p_logistics_record_id;
  
  RETURN TRUE;
END;
$$;

-- 7. 创建添加外部运单号的函数
CREATE OR REPLACE FUNCTION public.add_external_tracking_number(
  p_logistics_record_id UUID,
  p_platform TEXT,
  p_tracking_number TEXT,
  p_status TEXT DEFAULT 'pending',
  p_remarks TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_external_tracking JSONB;
  v_new_tracking JSONB;
BEGIN
  -- 获取当前的外部运单号数组
  SELECT external_tracking_numbers INTO v_external_tracking
  FROM public.logistics_records
  WHERE id = p_logistics_record_id;
  
  -- 创建新的运单号对象
  v_new_tracking := jsonb_build_object(
    'platform', p_platform,
    'tracking_number', p_tracking_number,
    'status', p_status,
    'created_at', now()::text,
    'remarks', p_remarks
  );
  
  -- 添加到数组中
  v_external_tracking := v_external_tracking || jsonb_build_array(v_new_tracking);
  
  -- 更新数据库记录
  UPDATE public.logistics_records
  SET external_tracking_numbers = v_external_tracking
  WHERE id = p_logistics_record_id;
  
  RETURN TRUE;
END;
$$;

-- 8. 创建删除外部运单号的函数
CREATE OR REPLACE FUNCTION public.remove_external_tracking_number(
  p_logistics_record_id UUID,
  p_tracking_number TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_external_tracking JSONB;
  v_updated_array JSONB;
BEGIN
  -- 获取当前的外部运单号数组
  SELECT external_tracking_numbers INTO v_external_tracking
  FROM public.logistics_records
  WHERE id = p_logistics_record_id;
  
  -- 移除指定的运单号
  v_updated_array := (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(v_external_tracking) AS elem
    WHERE elem->>'tracking_number' != p_tracking_number
  );
  
  -- 更新数据库记录
  UPDATE public.logistics_records
  SET external_tracking_numbers = COALESCE(v_updated_array, '[]'::jsonb)
  WHERE id = p_logistics_record_id;
  
  RETURN TRUE;
END;
$$;

-- 9. 创建验证外部运单号唯一性的函数
CREATE OR REPLACE FUNCTION public.validate_external_tracking_uniqueness(
  p_tracking_number TEXT,
  p_exclude_logistics_record_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- 检查运单号是否已存在
  SELECT COUNT(*) INTO v_count
  FROM public.logistics_records
  WHERE external_tracking_numbers @> jsonb_build_array(
    jsonb_build_object('tracking_number', p_tracking_number)
  )
  AND (p_exclude_logistics_record_id IS NULL OR id != p_exclude_logistics_record_id);
  
  RETURN v_count = 0;
END;
$$;

-- 10. 为函数添加注释
COMMENT ON FUNCTION public.get_logistics_record_by_external_tracking(TEXT) IS '根据外部运单号查询运单记录';
COMMENT ON FUNCTION public.get_logistics_records_by_platform(TEXT) IS '根据平台名称查询运单记录';
COMMENT ON FUNCTION public.update_external_tracking_status(UUID, TEXT, TEXT) IS '更新外部运单号状态';
COMMENT ON FUNCTION public.add_external_tracking_number(UUID, TEXT, TEXT, TEXT, TEXT) IS '添加外部运单号';
COMMENT ON FUNCTION public.remove_external_tracking_number(UUID, TEXT) IS '删除外部运单号';
COMMENT ON FUNCTION public.validate_external_tracking_uniqueness(TEXT, UUID) IS '验证外部运单号唯一性';

-- 11. 创建视图：包含外部运单号的运单视图
CREATE OR REPLACE VIEW public.logistics_records_with_external_tracking AS
SELECT 
  lr.*,
  CASE 
    WHEN jsonb_array_length(lr.external_tracking_numbers) > 0 THEN
      jsonb_agg(
        jsonb_build_object(
          'platform', elem->>'platform',
          'tracking_number', elem->>'tracking_number',
          'status', elem->>'status',
          'created_at', elem->>'created_at',
          'remarks', elem->>'remarks'
        )
      )
    ELSE NULL
  END as external_tracking_summary
FROM public.logistics_records lr
LEFT JOIN jsonb_array_elements(lr.external_tracking_numbers) AS elem ON true
GROUP BY lr.id;

-- 12. 测试数据（可选）
-- 为现有运单添加测试用的外部运单号
/*
UPDATE public.logistics_records 
SET external_tracking_numbers = '[
  {
    "platform": "货拉拉",
    "tracking_number": "HLL20250120001",
    "status": "completed",
    "created_at": "2025-01-20T10:00:00Z",
    "remarks": "主运单"
  }
]'::jsonb
WHERE auto_number = 'YDN20250120001';
*/

-- 13. 创建常用的平台配置表（可选）
CREATE TABLE IF NOT EXISTS public.external_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_name TEXT NOT NULL UNIQUE,
  platform_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 插入常用平台数据
INSERT INTO public.external_platforms (platform_name, platform_code) VALUES
  ('货拉拉', 'HLL'),
  ('满帮', 'MB'),
  ('运满满', 'YMM'),
  ('滴滴货运', 'DDHY'),
  ('其他', 'OTHER')
ON CONFLICT (platform_name) DO NOTHING;

-- 启用RLS
ALTER TABLE public.external_platforms ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "All users can view external platforms"
ON public.external_platforms
FOR SELECT
TO authenticated
USING (true);

-- 完成提示
SELECT '其他平台运单号码字段添加完成！' as message;
