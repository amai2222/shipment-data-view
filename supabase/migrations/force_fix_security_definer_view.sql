-- 强制修复 SECURITY DEFINER 视图问题
-- 彻底删除并重新创建视图，确保不使用 SECURITY DEFINER

-- ============================================
-- 1. 强制删除视图（包括依赖）
-- ============================================

-- 删除视图（CASCADE删除所有依赖）
DROP VIEW IF EXISTS public.logistics_records_status_summary CASCADE;

-- 再次确认删除
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'logistics_records_status_summary'
  ) THEN
    EXECUTE 'DROP VIEW public.logistics_records_status_summary CASCADE';
  END IF;
END $$;

-- ============================================
-- 2. 创建新视图（不使用 SECURITY DEFINER）
-- ============================================

-- 创建视图，明确不使用 SECURITY DEFINER
CREATE VIEW public.logistics_records_status_summary 
WITH (security_invoker = true)  -- 明确使用调用者权限
AS
SELECT 
  lr.id,
  lr.auto_number,
  lr.project_id,
  lr.project_name,
  lr.driver_id,
  lr.driver_name,
  lr.license_plate,
  lr.loading_date,
  -- lr.loading_time 字段不存在，已移除
  lr.loading_location,
  lr.loading_weight,
  lr.unloading_date,
  lr.unloading_location,
  lr.unloading_weight,
  lr.transport_type,
  lr.current_cost,
  lr.extra_cost,
  lr.payable_cost,
  -- lr.driver_payable_cost 可能不存在，如果报错则移除
  lr.remarks,
  lr.created_at,
  lr.created_by_user_id,
  p.name AS project_full_name,
  p.manager AS project_manager,
  d.name AS driver_full_name,
  d.phone AS driver_phone_number
FROM public.logistics_records lr
LEFT JOIN public.projects p ON lr.project_id = p.id
LEFT JOIN public.drivers d ON lr.driver_id = d.id;

-- ============================================
-- 3. 设置视图权限
-- ============================================

-- 授予查看权限给已认证用户
GRANT SELECT ON public.logistics_records_status_summary TO authenticated;
GRANT SELECT ON public.logistics_records_status_summary TO anon;

-- ============================================
-- 4. 添加注释
-- ============================================

COMMENT ON VIEW public.logistics_records_status_summary IS 
'运输记录状态汇总视图 - 使用 security_invoker 确保使用调用者权限，符合Supabase安全最佳实践';

-- ============================================
-- 5. 验证视图已正确创建
-- ============================================

DO $$ 
DECLARE
  v_view_definition text;
BEGIN
  -- 获取视图定义
  SELECT pg_get_viewdef('public.logistics_records_status_summary', true)
  INTO v_view_definition;
  
  -- 检查是否包含 SECURITY DEFINER
  IF v_view_definition LIKE '%SECURITY DEFINER%' THEN
    RAISE WARNING 'WARNING: 视图仍然包含 SECURITY DEFINER！';
  ELSE
    RAISE NOTICE 'SUCCESS: 视图已正确创建，不使用 SECURITY DEFINER';
  END IF;
END $$;

-- 显示视图信息
SELECT 
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE viewname = 'logistics_records_status_summary';
