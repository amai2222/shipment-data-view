-- 为合同相关表添加基本的 RLS 策略
-- 这个脚本会启用 RLS 并添加简单的策略

-- 启用 RLS
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的策略
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_permissions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_file_versions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_access_logs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_reminders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_numbering_rules;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_tags;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_tag_relations;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.saved_searches;

-- 创建简单的 RLS 策略（允许所有认证用户访问）
CREATE POLICY "Allow all for authenticated users" ON public.contract_permissions
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.contract_file_versions
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.contract_access_logs
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.contract_reminders
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.contract_numbering_rules
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.contract_tags
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.contract_tag_relations
    FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users" ON public.saved_searches
    FOR ALL USING (auth.uid() IS NOT NULL);
