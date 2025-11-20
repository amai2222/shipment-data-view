-- ============================================================================
-- 创建开票申请相关的性能索引
-- 日期：2025-11-20
-- 说明：移除 CONCURRENTLY 以避免事务块冲突
-- 注意：索引创建时会短暂锁表，建议在低峰期执行
-- ============================================================================

-- 组合索引：项目ID + 开票状态 + 装货日期（开票申请的核心查询）
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_invoice_date 
ON public.logistics_records(project_id, invoice_status, loading_date DESC);

-- 组合索引：项目ID + 装货日期（用于日期范围查询，条件索引）
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_loading_date_invoice 
ON public.logistics_records(project_id, loading_date DESC) 
WHERE invoice_status IN ('Uninvoiced', 'Processing');

-- 索引：开票状态（用于状态筛选）
CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_status 
ON public.logistics_records(invoice_status);

-- 索引：合作方成本表的合作方ID + 开票状态
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_partner_invoice 
ON public.logistics_partner_costs(partner_id, invoice_status);

-- 索引：合作方成本表的开票状态（用于批量查询）
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_invoice_status 
ON public.logistics_partner_costs(invoice_status);

-- ============================================================================
-- 索引创建完成
-- ============================================================================
-- 
-- ✅ 开票申请相关索引创建成功
-- 
-- 已创建的索引：
--   • idx_logistics_records_project_invoice_date
--   • idx_logistics_records_project_loading_date_invoice
--   • idx_logistics_records_invoice_status
--   • idx_logistics_partner_costs_partner_invoice
--   • idx_logistics_partner_costs_invoice_status
-- 
-- 注意：索引创建可能需要几分钟时间，创建期间表会被锁定

