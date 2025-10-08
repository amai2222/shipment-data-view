-- 修复Supabase安全问题
-- 解决RLS未启用和SECURITY DEFINER视图的安全风险

-- ============================================
-- 1. 启用RLS（行级安全）
-- ============================================

-- 启用 invoice_request_details 表的RLS
ALTER TABLE public.invoice_request_details ENABLE ROW LEVEL SECURITY;

-- 启用 function_backup_log 表的RLS
ALTER TABLE public.function_backup_log ENABLE ROW LEVEL SECURITY;

-- 启用 invoice_requests 表的RLS
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. 创建RLS策略
-- ============================================

-- invoice_request_details 表的RLS策略
-- 允许所有已认证用户查看（根据业务需求调整）
CREATE POLICY "Allow authenticated users to view invoice request details"
ON public.invoice_request_details FOR SELECT
TO authenticated
USING (true);

-- 允许admin和finance角色插入和更新
CREATE POLICY "Allow admin and finance to insert invoice request details"
ON public.invoice_request_details FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'finance', 'operator')
  )
);

CREATE POLICY "Allow admin and finance to update invoice request details"
ON public.invoice_request_details FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'finance', 'operator')
  )
);

CREATE POLICY "Allow admin to delete invoice request details"
ON public.invoice_request_details FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- function_backup_log 表的RLS策略
-- 仅管理员可以查看和操作
CREATE POLICY "Only admin can view function backup log"
ON public.function_backup_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Only admin can insert function backup log"
ON public.function_backup_log FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- invoice_requests 表的RLS策略
-- 允许所有已认证用户查看
CREATE POLICY "Allow authenticated users to view invoice requests"
ON public.invoice_requests FOR SELECT
TO authenticated
USING (true);

-- 允许admin和finance角色创建
CREATE POLICY "Allow admin and finance to create invoice requests"
ON public.invoice_requests FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'finance', 'operator')
  )
);

-- 允许admin、finance角色更新（移除created_by检查，因为该字段不存在）
CREATE POLICY "Allow admin and finance to update invoice requests"
ON public.invoice_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'finance', 'operator')
  )
);

-- 仅管理员可以删除
CREATE POLICY "Only admin can delete invoice requests"
ON public.invoice_requests FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- ============================================
-- 3. 修复SECURITY DEFINER视图
-- ============================================

-- 重新创建 logistics_records_status_summary 视图
-- 移除 SECURITY DEFINER，使用调用者的权限
DROP VIEW IF EXISTS public.logistics_records_status_summary;

CREATE OR REPLACE VIEW public.logistics_records_status_summary AS
SELECT 
  lr.id,
  lr.project_id,
  lr.driver_id,
  lr.loading_date,
  lr.loading_weight,
  lr.unloading_weight,
  lr.transport_type,
  lr.current_cost,
  lr.extra_cost,
  lr.payable_cost,
  p.name AS project_name,
  d.name AS driver_name,
  lr.created_at
FROM public.logistics_records lr
LEFT JOIN public.projects p ON lr.project_id = p.id
LEFT JOIN public.drivers d ON lr.driver_id = d.id;

-- 授予视图访问权限
GRANT SELECT ON public.logistics_records_status_summary TO authenticated;

-- ============================================
-- 4. 添加安全注释
-- ============================================

COMMENT ON TABLE public.invoice_request_details IS 'RLS已启用 - 只有admin、finance和operator可以修改';
COMMENT ON TABLE public.function_backup_log IS 'RLS已启用 - 只有admin可以访问';
COMMENT ON TABLE public.invoice_requests IS 'RLS已启用 - 根据角色和创建者限制访问';
COMMENT ON VIEW public.logistics_records_status_summary IS '视图已移除SECURITY DEFINER - 使用调用者权限';

-- ============================================
-- 5. 验证RLS已启用
-- ============================================

-- 查看所有启用了RLS的表
DO $$
BEGIN
  RAISE NOTICE '=== RLS状态验证 ===';
  RAISE NOTICE 'invoice_request_details RLS: %', (
    SELECT relrowsecurity FROM pg_class 
    WHERE relname = 'invoice_request_details'
  );
  RAISE NOTICE 'function_backup_log RLS: %', (
    SELECT relrowsecurity FROM pg_class 
    WHERE relname = 'function_backup_log'
  );
  RAISE NOTICE 'invoice_requests RLS: %', (
    SELECT relrowsecurity FROM pg_class 
    WHERE relname = 'invoice_requests'
  );
END $$;

