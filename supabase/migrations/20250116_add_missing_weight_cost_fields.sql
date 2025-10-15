-- 添加缺失的重量和成本字段到logistics_records表
-- 文件: supabase/migrations/20250116_add_missing_weight_cost_fields.sql

BEGIN;

-- 添加缺失的字段到logistics_records表
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS loading_weight numeric(10,3),
ADD COLUMN IF NOT EXISTS unloading_weight numeric(10,3),
ADD COLUMN IF NOT EXISTS current_cost numeric(10,2),
ADD COLUMN IF NOT EXISTS extra_cost numeric(10,2),
ADD COLUMN IF NOT EXISTS payable_cost numeric(10,2);

-- 添加字段注释
COMMENT ON COLUMN public.logistics_records.loading_weight IS '装货重量(吨)';
COMMENT ON COLUMN public.logistics_records.unloading_weight IS '卸货重量(吨)';
COMMENT ON COLUMN public.logistics_records.current_cost IS '当前成本(元)';
COMMENT ON COLUMN public.logistics_records.extra_cost IS '额外成本(元)';
COMMENT ON COLUMN public.logistics_records.payable_cost IS '应付成本(元)';

-- 更新logistics_records_view视图以包含新字段
DROP VIEW IF EXISTS public.logistics_records_view;

CREATE OR REPLACE VIEW public.logistics_records_view AS
SELECT 
    lr.id,
    lr.auto_number,
    lr.project_id,
    COALESCE(lr.project_name, p.name) as project_name,
    lr.driver_id,
    lr.driver_name,
    lr.driver_phone,
    lr.license_plate,
    lr.loading_location,
    lr.unloading_location,
    lr.loading_date,
    lr.unloading_date,
    lr.transport_type,
    lr.cargo_type,
    lr.billing_type_id,
    lr.chain_id,
    lr.user_id,
    lr.created_by_user_id,
    lr.created_at,
    lr.remarks,
    lr.external_tracking_numbers,
    lr.loading_location_ids,
    lr.unloading_location_ids,
    lr.other_platform_names,
    lr.payment_status,
    lr.invoice_status,
    lr.payment_applied_at,
    lr.payment_completed_at,
    lr.invoice_applied_at,
    lr.invoice_completed_at,
    lr.payment_request_id,
    lr.invoice_request_id,
    lr.payment_reference,
    lr.invoice_number,
    -- 新增的重量和成本字段
    lr.loading_weight,
    lr.unloading_weight,
    lr.current_cost,
    lr.extra_cost,
    lr.payable_cost,
    -- 合作链路名称
    pc.chain_name
FROM public.logistics_records lr
LEFT JOIN public.projects p ON lr.project_id = p.id
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id;

-- 添加视图注释
COMMENT ON VIEW public.logistics_records_view IS '运单记录视图：包含完整的运单信息、重量和成本数据';

COMMIT;
