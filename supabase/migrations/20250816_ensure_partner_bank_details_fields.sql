-- 确保partner_bank_details表有所有必要的字段
-- 这个迁移文件确保表结构正确

-- 添加缺失的字段到partner_bank_details表
ALTER TABLE IF EXISTS public.partner_bank_details
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS tax_number text,
ADD COLUMN IF NOT EXISTS company_address text;

-- 确保现有字段存在
ALTER TABLE IF EXISTS public.partner_bank_details
ADD COLUMN IF NOT EXISTS bank_name text,
ADD COLUMN IF NOT EXISTS bank_account text,
ADD COLUMN IF NOT EXISTS branch_name text;

-- 确保user_id字段存在且可为空（用于兼容性）
ALTER TABLE IF EXISTS public.partner_bank_details
ALTER COLUMN user_id DROP NOT NULL;

-- 更新RLS策略，确保管理员和财务人员可以查看所有银行详情
DROP POLICY IF EXISTS "Finance view all bank details" ON public.partner_bank_details;
CREATE POLICY "Finance view all bank details"
ON public.partner_bank_details FOR SELECT TO authenticated
USING (is_finance_or_admin());

-- 确保管理员可以管理所有银行详情
DROP POLICY IF EXISTS "Admins manage all bank details" ON public.partner_bank_details;
CREATE POLICY "Admins manage all bank details"
ON public.partner_bank_details FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());
