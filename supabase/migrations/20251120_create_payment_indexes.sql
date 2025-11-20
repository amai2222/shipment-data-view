-- ============================================================================
-- 创建付款申请相关的性能索引
-- 日期：2025-11-20
-- 说明：移除 CONCURRENTLY 以避免事务块冲突
-- 注意：索引创建时会短暂锁表，建议在低峰期执行
-- ============================================================================

-- 组合索引：项目ID + 付款状态 + 装货日期（付款申请的核心查询）
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_payment_date 
ON public.logistics_records(project_id, payment_status, loading_date DESC);

-- 组合索引：项目ID + 装货日期（用于日期范围查询，条件索引）
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_loading_date 
ON public.logistics_records(project_id, loading_date DESC) 
WHERE payment_status IN ('Unpaid', 'Processing');

-- 索引：合作方成本表的运单ID（用于JOIN优化）
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_record_id 
ON public.logistics_partner_costs(logistics_record_id);

-- 索引：合作方成本表的合作方ID + 付款状态
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_partner_payment 
ON public.logistics_partner_costs(partner_id, payment_status);

-- ============================================================================
-- 索引创建完成
-- ============================================================================
-- 
-- ✅ 付款申请相关索引创建成功
-- 
-- 已创建的索引：
--   • idx_logistics_records_project_payment_date
--   • idx_logistics_records_project_loading_date
--   • idx_logistics_partner_costs_record_id
--   • idx_logistics_partner_costs_partner_payment
-- 
-- 注意：索引创建可能需要几分钟时间，创建期间表会被锁定

