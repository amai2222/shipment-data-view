-- 添加billing_type_id字段到logistics_records表并初始化数据
ALTER TABLE public.logistics_records 
ADD COLUMN billing_type_id bigint DEFAULT 1;

-- 将现有记录的billing_type_id设置为对应合作链路的billing_type_id，如果没有链路则设为1
UPDATE public.logistics_records lr
SET billing_type_id = COALESCE(pc.billing_type_id, 1)
FROM public.partner_chains pc
WHERE lr.chain_id = pc.id;

-- 为billing_type_id字段创建索引以提升查询性能
CREATE INDEX idx_logistics_records_billing_type_id ON public.logistics_records(billing_type_id);

-- 创建复合索引用于常见的查询模式
CREATE INDEX idx_logistics_records_project_billing_date ON public.logistics_records(project_id, billing_type_id, loading_date DESC);