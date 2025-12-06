-- ============================================================================
-- 快速测试：查找需要同步的车牌号
-- 使用方法：在 Supabase Dashboard → SQL Editor 中执行
-- ============================================================================

-- 1. 先创建RPC函数（如果还没创建）
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_plates_to_sync();

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

-- 2. 统计信息
-- ============================================================================
-- 查看drivers表有多少车牌
SELECT 
  COUNT(*) as total_drivers,
  COUNT(DISTINCT TRIM(license_plate)) as unique_plates_in_drivers
FROM drivers
WHERE license_plate IS NOT NULL AND TRIM(license_plate) != '';

-- 查看映射表有多少车牌
SELECT 
  COUNT(*) as total_mappings,
  COUNT(DISTINCT TRIM(license_plate)) as unique_plates_in_mappings
FROM vehicle_tracking_id_mappings
WHERE license_plate IS NOT NULL AND TRIM(license_plate) != '';

-- 查看需要同步的车牌数量
SELECT COUNT(*) as plates_to_sync_count
FROM get_plates_to_sync();

-- 3. 查看需要同步的车牌号列表（前100个）
-- ============================================================================
SELECT 
  ROW_NUMBER() OVER (ORDER BY license_plate) as row_num,
  license_plate
FROM get_plates_to_sync()
LIMIT 100;

-- 4. 详细对比（查看所有车牌的状态）
-- ============================================================================
SELECT 
  DISTINCT TRIM(d.license_plate) as license_plate,
  CASE 
    WHEN m.license_plate IS NOT NULL THEN '✅ 已存在映射'
    ELSE '❌ 需要同步'
  END as status
FROM drivers d
LEFT JOIN vehicle_tracking_id_mappings m 
  ON TRIM(d.license_plate) = TRIM(m.license_plate)
WHERE d.license_plate IS NOT NULL
  AND TRIM(d.license_plate) != ''
ORDER BY status DESC, license_plate
LIMIT 200;
