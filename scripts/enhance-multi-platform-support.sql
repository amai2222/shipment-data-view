-- 增强多平台名称支持
-- 这个脚本将添加平台配置表和用户自定义平台功能

-- 1. 创建平台配置表
CREATE TABLE IF NOT EXISTS public.external_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_code TEXT NOT NULL UNIQUE, -- 平台代码（唯一标识）
  primary_name TEXT NOT NULL, -- 主要名称
  aliases TEXT[] DEFAULT '{}', -- 别名数组
  description TEXT, -- 平台描述
  website_url TEXT, -- 官网链接
  is_active BOOLEAN DEFAULT true, -- 是否启用
  sort_order INTEGER DEFAULT 0, -- 排序
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. 创建用户自定义平台表
CREATE TABLE IF NOT EXISTS public.user_custom_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_name TEXT NOT NULL, -- 平台名称
  platform_code TEXT, -- 平台代码（可选）
  description TEXT, -- 描述
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. 启用RLS
ALTER TABLE public.external_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_platforms ENABLE ROW LEVEL SECURITY;

-- 4. 创建RLS策略
-- 平台配置表：所有认证用户可读，管理员可写
CREATE POLICY IF NOT EXISTS "All users can view external platforms"
ON public.external_platforms
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage external platforms"
ON public.external_platforms
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 用户自定义平台：用户只能管理自己的
CREATE POLICY IF NOT EXISTS "Users can manage their own custom platforms"
ON public.user_custom_platforms
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_external_platforms_code ON public.external_platforms(platform_code);
CREATE INDEX IF NOT EXISTS idx_external_platforms_name ON public.external_platforms(primary_name);
CREATE INDEX IF NOT EXISTS idx_external_platforms_aliases ON public.external_platforms USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_external_platforms_active ON public.external_platforms(is_active);
CREATE INDEX IF NOT EXISTS idx_user_custom_platforms_user_id ON public.user_custom_platforms(user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_platforms_name ON public.user_custom_platforms(platform_name);

-- 6. 创建更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_external_platforms_updated_at
BEFORE UPDATE ON public.external_platforms
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 7. 插入预设平台数据
INSERT INTO public.external_platforms (platform_code, primary_name, aliases, description, sort_order) VALUES
  ('HLL', '货拉拉', ARRAY['货拉拉货运', 'Lalamove', '货拉拉物流', '货拉拉速运'], '货拉拉货运平台', 1),
  ('MB', '满帮', ARRAY['满帮集团', '满帮物流', 'Manbang', '满帮货运'], '满帮物流平台', 2),
  ('YMM', '运满满', ARRAY['运满满物流', 'Yunmanman', '运满满货运'], '运满满物流平台', 3),
  ('DDHY', '滴滴货运', ARRAY['滴滴物流', 'Didi Freight', '滴滴货运平台'], '滴滴货运平台', 4),
  ('SF', '顺丰', ARRAY['顺丰速运', 'SF Express', '顺丰物流'], '顺丰速运平台', 5),
  ('YTO', '圆通', ARRAY['圆通速递', 'YTO Express', '圆通物流'], '圆通速递平台', 6),
  ('ZTO', '中通', ARRAY['中通快递', 'ZTO Express', '中通物流'], '中通快递平台', 7),
  ('STO', '申通', ARRAY['申通快递', 'STO Express', '申通物流'], '申通快递平台', 8),
  ('JD', '京东物流', ARRAY['京东快递', 'JD Logistics', '京东速运'], '京东物流平台', 9),
  ('EMS', '中国邮政', ARRAY['EMS', '邮政速递', 'China Post'], '中国邮政速递', 10),
  ('OTHER', '其他', ARRAY['自定义平台', '其他平台'], '其他物流平台', 99)
ON CONFLICT (platform_code) DO UPDATE SET
  primary_name = EXCLUDED.primary_name,
  aliases = EXCLUDED.aliases,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 8. 创建平台查询函数
CREATE OR REPLACE FUNCTION public.get_platform_by_name_or_alias(
  p_platform_name TEXT
)
RETURNS TABLE (
  platform_code TEXT,
  primary_name TEXT,
  aliases TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ep.platform_code,
    ep.primary_name,
    ep.aliases
  FROM public.external_platforms ep
  WHERE ep.is_active = true
  AND (
    ep.primary_name ILIKE '%' || p_platform_name || '%'
    OR p_platform_name = ANY(ep.aliases)
    OR EXISTS (
      SELECT 1 FROM unnest(ep.aliases) AS alias
      WHERE alias ILIKE '%' || p_platform_name || '%'
    )
  )
  ORDER BY ep.sort_order, ep.primary_name
  LIMIT 1;
END;
$$;

-- 9. 创建获取所有可用平台的函数
CREATE OR REPLACE FUNCTION public.get_available_platforms(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  platform_code TEXT,
  primary_name TEXT,
  aliases TEXT[],
  description TEXT,
  is_custom BOOLEAN,
  sort_order INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 返回系统预设平台
  RETURN QUERY
  SELECT 
    ep.platform_code,
    ep.primary_name,
    ep.aliases,
    ep.description,
    false as is_custom,
    ep.sort_order
  FROM public.external_platforms ep
  WHERE ep.is_active = true
  ORDER BY ep.sort_order, ep.primary_name;
  
  -- 如果提供了用户ID，也返回用户自定义平台
  IF p_user_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      COALESCE(ucp.platform_code, 'CUSTOM_' || ucp.id::text) as platform_code,
      ucp.platform_name as primary_name,
      ARRAY[]::TEXT[] as aliases,
      ucp.description,
      true as is_custom,
      1000 as sort_order
    FROM public.user_custom_platforms ucp
    WHERE ucp.user_id = p_user_id
    ORDER BY ucp.platform_name;
  END IF;
END;
$$;

-- 10. 创建智能平台匹配函数
CREATE OR REPLACE FUNCTION public.smart_platform_match(
  p_input TEXT
)
RETURNS TABLE (
  platform_code TEXT,
  primary_name TEXT,
  match_type TEXT,
  confidence INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 精确匹配
  RETURN QUERY
  SELECT 
    ep.platform_code,
    ep.primary_name,
    'exact' as match_type,
    100 as confidence
  FROM public.external_platforms ep
  WHERE ep.is_active = true
  AND ep.primary_name = p_input;
  
  -- 别名精确匹配
  RETURN QUERY
  SELECT 
    ep.platform_code,
    ep.primary_name,
    'alias_exact' as match_type,
    90 as confidence
  FROM public.external_platforms ep
  WHERE ep.is_active = true
  AND p_input = ANY(ep.aliases);
  
  -- 模糊匹配
  RETURN QUERY
  SELECT 
    ep.platform_code,
    ep.primary_name,
    'fuzzy' as match_type,
    70 as confidence
  FROM public.external_platforms ep
  WHERE ep.is_active = true
  AND (
    ep.primary_name ILIKE '%' || p_input || '%'
    OR EXISTS (
      SELECT 1 FROM unnest(ep.aliases) AS alias
      WHERE alias ILIKE '%' || p_input || '%'
    )
  )
  ORDER BY confidence DESC, ep.sort_order
  LIMIT 5;
END;
$$;

-- 11. 创建添加自定义平台的函数
CREATE OR REPLACE FUNCTION public.add_custom_platform(
  p_platform_name TEXT,
  p_platform_code TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_platform_id UUID;
BEGIN
  -- 检查平台名称是否已存在
  IF EXISTS (
    SELECT 1 FROM public.external_platforms 
    WHERE primary_name = p_platform_name 
    OR p_platform_name = ANY(aliases)
  ) THEN
    RAISE EXCEPTION '平台名称已存在: %', p_platform_name;
  END IF;
  
  -- 检查用户自定义平台是否已存在
  IF EXISTS (
    SELECT 1 FROM public.user_custom_platforms 
    WHERE user_id = auth.uid() 
    AND platform_name = p_platform_name
  ) THEN
    RAISE EXCEPTION '您已添加过此平台: %', p_platform_name;
  END IF;
  
  -- 插入自定义平台
  INSERT INTO public.user_custom_platforms (
    user_id, platform_name, platform_code, description
  ) VALUES (
    auth.uid(), p_platform_name, p_platform_code, p_description
  ) RETURNING id INTO v_platform_id;
  
  RETURN v_platform_id;
END;
$$;

-- 12. 更新外部运单号查询函数以支持多平台名称
CREATE OR REPLACE FUNCTION public.get_logistics_records_by_platform_name_enhanced(
  p_platform_name TEXT
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
DECLARE
  v_platform_code TEXT;
BEGIN
  -- 首先尝试获取平台代码
  SELECT platform_code INTO v_platform_code
  FROM public.get_platform_by_name_or_alias(p_platform_name);
  
  -- 查询运单记录
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
    jsonb_build_object('platform_name', p_platform_name)
  )
  OR (v_platform_code IS NOT NULL AND lr.external_tracking_numbers @> jsonb_build_array(
    jsonb_build_object('platform_code', v_platform_code)
  ));
END;
$$;

-- 13. 为函数添加注释
COMMENT ON TABLE public.external_platforms IS '外部平台配置表，支持平台名称和别名管理';
COMMENT ON TABLE public.user_custom_platforms IS '用户自定义平台表，允许用户添加个性化平台';
COMMENT ON FUNCTION public.get_platform_by_name_or_alias(TEXT) IS '根据平台名称或别名查询平台信息';
COMMENT ON FUNCTION public.get_available_platforms(UUID) IS '获取所有可用平台（系统预设+用户自定义）';
COMMENT ON FUNCTION public.smart_platform_match(TEXT) IS '智能平台匹配，支持精确和模糊匹配';
COMMENT ON FUNCTION public.add_custom_platform(TEXT, TEXT, TEXT) IS '添加用户自定义平台';
COMMENT ON FUNCTION public.get_logistics_records_by_platform_name_enhanced(TEXT) IS '增强版平台名称查询运单记录';

-- 14. 创建视图：平台使用统计
CREATE OR REPLACE VIEW public.platform_usage_stats AS
SELECT 
  COALESCE(
    elem->>'platform_code',
    elem->>'platform_name',
    'unknown'
  ) as platform_identifier,
  COUNT(*) as usage_count,
  COUNT(DISTINCT lr.id) as unique_logistics_records,
  MIN(lr.created_at) as first_usage,
  MAX(lr.created_at) as last_usage
FROM public.logistics_records lr
CROSS JOIN jsonb_array_elements(lr.external_tracking_numbers) AS elem
WHERE lr.external_tracking_numbers IS NOT NULL
AND jsonb_array_length(lr.external_tracking_numbers) > 0
GROUP BY platform_identifier
ORDER BY usage_count DESC;

-- 15. 测试数据（可选）
-- 为现有运单添加测试用的多平台运单号
/*
UPDATE public.logistics_records 
SET external_tracking_numbers = '[
  {
    "platform_code": "HLL",
    "platform_name": "货拉拉",
    "tracking_number": "HLL20250120001",
    "status": "completed",
    "created_at": "2025-01-20T10:00:00Z",
    "remarks": "主运单"
  },
  {
    "platform_code": "MB",
    "platform_name": "满帮",
    "tracking_number": "MB20250120002",
    "status": "in_transit",
    "created_at": "2025-01-20T11:00:00Z",
    "remarks": "分单"
  }
]'::jsonb
WHERE auto_number = 'YDN20250120001';
*/

-- 完成提示
SELECT '多平台名称支持功能创建完成！' as message;
