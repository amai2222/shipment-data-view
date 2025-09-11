-- 修复 RLS 策略问题
-- 这个脚本会先删除现有的策略，然后重新创建

-- 1. 删除现有的策略（如果存在）
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_permissions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_file_versions;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_access_logs;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_reminders;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_numbering_rules;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_tags;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.contract_tag_relations;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.saved_searches;

-- 2. 确保 RLS 已启用
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- 3. 重新创建策略
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

-- 4. 验证策略创建成功
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename LIKE 'contract_%'
ORDER BY tablename, policyname;
