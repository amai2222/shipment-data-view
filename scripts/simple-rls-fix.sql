-- 简单的 RLS 策略修复
-- 只处理核心的合同相关表

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_permissions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_file_versions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_access_logs;

-- 启用 RLS
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_access_logs ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Allow all for authenticated users" ON public.contract_permissions
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.contract_file_versions
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.contract_access_logs
    FOR ALL USING (auth.uid() IS NOT NULL);
