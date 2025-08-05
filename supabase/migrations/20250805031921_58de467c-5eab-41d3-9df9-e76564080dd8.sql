-- 1. 为 logistics_records 表增加货物类型字段
ALTER TABLE public.logistics_records 
ADD COLUMN cargo_type TEXT;

-- 2. 为 partners 表增加合作方相关字段
ALTER TABLE public.partners 
ADD COLUMN full_name TEXT,
ADD COLUMN bank_account TEXT,
ADD COLUMN bank_name TEXT,
ADD COLUMN branch_name TEXT;

-- 为新字段添加注释
COMMENT ON COLUMN public.logistics_records.cargo_type IS '货物类型';
COMMENT ON COLUMN public.partners.full_name IS '合作方全名';
COMMENT ON COLUMN public.partners.bank_account IS '银行账户';
COMMENT ON COLUMN public.partners.bank_name IS '开户行名称';
COMMENT ON COLUMN public.partners.branch_name IS '支行网点';

-- 为货物类型字段创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_cargo_type 
ON public.logistics_records(cargo_type);

-- 为合作方银行相关字段创建索引
CREATE INDEX IF NOT EXISTS idx_partners_bank_account 
ON public.partners(bank_account);