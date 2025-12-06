-- ============================================================================
-- 创建获取需要同步的车牌号RPC函数
-- 功能：高效查询drivers表中存在但vehicle_tracking_id_mappings表中不存在的车牌号
-- 优化：使用LEFT JOIN在数据库层面一次性查询，避免多次网络往返
-- ============================================================================
-- 创建时间: 2025-01-27
-- ============================================================================

-- 删除旧函数（如果存在）
DROP FUNCTION IF EXISTS public.get_plates_to_sync();

-- 创建RPC函数：获取需要同步的车牌号
CREATE OR REPLACE FUNCTION public.get_plates_to_sync()
RETURNS TABLE (
  license_plate TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
BEGIN
  -- 使用LEFT JOIN在数据库层面一次性查询出差异
  -- 查询在drivers表中但不在vehicle_tracking_id_mappings表中的车牌号
  RETURN QUERY
  SELECT DISTINCT 
    TRIM(d.license_plate)::TEXT as license_plate
  FROM drivers d
  LEFT JOIN vehicle_tracking_id_mappings m 
    ON TRIM(d.license_plate) = TRIM(m.license_plate)
  WHERE d.license_plate IS NOT NULL
    AND TRIM(d.license_plate) != ''
    AND m.license_plate IS NULL
  ORDER BY license_plate;
END;
$$;

-- 添加注释
COMMENT ON FUNCTION public.get_plates_to_sync() IS '获取需要同步的车牌号：查询drivers表中存在但vehicle_tracking_id_mappings表中不存在的车牌号，使用LEFT JOIN优化性能';
