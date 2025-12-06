-- ============================================================================
-- 测试脚本：查找需要同步的车牌号
-- 用途：验证 get_plates_to_sync() RPC函数是否正常工作
-- ============================================================================
-- 使用方法：在 Supabase SQL Editor 中执行此脚本
-- ============================================================================

-- 步骤1：先创建/更新RPC函数（如果还没有创建）
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

-- ============================================================================
-- 步骤2：统计信息查询
-- ============================================================================

-- 2.1 查看drivers表中的车牌号总数和唯一车牌数
SELECT 
  'drivers表统计' as source,
  COUNT(*) as total_records,
  COUNT(DISTINCT TRIM(license_plate)) as unique_plates
FROM drivers
WHERE license_plate IS NOT NULL 
  AND TRIM(license_plate) != '';

-- 2.2 查看vehicle_tracking_id_mappings表中的车牌号总数
SELECT 
  'vehicle_tracking_id_mappings表统计' as source,
  COUNT(*) as total_records,
  COUNT(DISTINCT TRIM(license_plate)) as unique_plates
FROM vehicle_tracking_id_mappings
WHERE license_plate IS NOT NULL 
  AND TRIM(license_plate) != '';

-- 2.3 查看需要同步的车牌号数量（使用RPC函数）
SELECT 
  '需要同步的车牌数量' as description,
  COUNT(*) as count
FROM get_plates_to_sync();

-- ============================================================================
-- 步骤3：查看需要同步的车牌号详情（前50个）
-- ============================================================================
SELECT 
  license_plate,
  '需要同步' as status
FROM get_plates_to_sync()
LIMIT 50;

-- ============================================================================
-- 步骤4：详细对比查询（可选，用于验证）
-- ============================================================================
-- 查看drivers表中有哪些车牌，以及它们是否在映射表中
SELECT 
  DISTINCT 
  TRIM(d.license_plate) as license_plate,
  CASE 
    WHEN m.license_plate IS NOT NULL THEN '已存在映射'
    ELSE '需要同步'
  END as status
FROM drivers d
LEFT JOIN vehicle_tracking_id_mappings m 
  ON TRIM(d.license_plate) = TRIM(m.license_plate)
WHERE d.license_plate IS NOT NULL
  AND TRIM(d.license_plate) != ''
ORDER BY status, license_plate
LIMIT 100;

-- ============================================================================
-- 步骤5：测试RPC函数直接调用
-- ============================================================================
SELECT * FROM get_plates_to_sync();
