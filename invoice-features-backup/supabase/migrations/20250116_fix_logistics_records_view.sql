-- 修复logistics_records视图的列名问题
-- 文件: supabase/migrations/20250116_fix_logistics_records_view.sql

BEGIN;

-- 1. 先删除可能存在的视图
DROP VIEW IF EXISTS public.logistics_records_status_summary;

-- 2. 重新创建视图，使用正确的字段名
CREATE OR REPLACE VIEW public.logistics_records_status_summary AS
SELECT 
    lr.id,
    lr.auto_number,
    -- 使用正确的字段名，如果project_name不存在则使用project_id
    COALESCE(lr.project_name, p.name) as project_name,
    lr.driver_name,
    lr.loading_date,
    lr.unloading_date,
    lr.loading_location,
    lr.unloading_location,
    lr.current_cost,
    lr.extra_cost,
    lr.payable_cost,
    -- 开票状态信息
    lr.invoice_status,
    lr.invoice_applied_at,
    lr.invoice_completed_at,
    lr.invoice_request_id,
    lr.invoice_number,
    -- 付款状态信息
    lr.payment_status,
    lr.payment_applied_at,
    lr.payment_completed_at,
    lr.payment_request_id,
    lr.payment_reference,
    -- 状态计算
    CASE 
        WHEN lr.invoice_status = 'Invoiced' THEN '已开票'
        WHEN lr.invoice_status = 'Processing' THEN '开票中'
        ELSE '未开票'
    END as invoice_status_text,
    CASE 
        WHEN lr.payment_status = 'Paid' THEN '已付款'
        WHEN lr.payment_status = 'Processing' THEN '付款中'
        ELSE '未付款'
    END as payment_status_text,
    -- 时间计算
    CASE 
        WHEN lr.invoice_completed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (lr.invoice_completed_at - lr.invoice_applied_at)) / 3600
        ELSE NULL
    END as invoice_processing_hours,
    CASE 
        WHEN lr.payment_completed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (lr.payment_completed_at - lr.payment_applied_at)) / 3600
        ELSE NULL
    END as payment_processing_hours
FROM public.logistics_records lr
LEFT JOIN public.projects p ON lr.project_id = p.id;

-- 3. 添加视图注释
COMMENT ON VIEW public.logistics_records_status_summary IS '运单状态汇总视图：包含开票和付款状态信息';

COMMIT;
