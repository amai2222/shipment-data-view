-- 修复策略冲突的脚本
-- 专门解决 "policy already exists" 错误

-- 删除所有可能存在的合同相关策略
DROP POLICY IF EXISTS "Users can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can delete contracts" ON public.contracts;
DROP POLICY IF EXISTS "Authenticated users can manage contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins can manage all contracts" ON public.contracts;
DROP POLICY IF EXISTS "Finance can view all contracts" ON public.contracts;

DROP POLICY IF EXISTS "Users can view numbering rules" ON public.contract_numbering_rules;
DROP POLICY IF EXISTS "Admins can manage numbering rules" ON public.contract_numbering_rules;

DROP POLICY IF EXISTS "Users can view tags" ON public.contract_tags;
DROP POLICY IF EXISTS "Users can manage tags" ON public.contract_tags;

DROP POLICY IF EXISTS "Users can view tag relations" ON public.contract_tag_relations;
DROP POLICY IF EXISTS "Users can manage tag relations" ON public.contract_tag_relations;

DROP POLICY IF EXISTS "Users can view permissions" ON public.contract_permissions;
DROP POLICY IF EXISTS "Users can manage permissions" ON public.contract_permissions;

DROP POLICY IF EXISTS "Users can view access logs" ON public.contract_access_logs;
DROP POLICY IF EXISTS "System can insert access logs" ON public.contract_access_logs;

DROP POLICY IF EXISTS "Users can view reminders" ON public.contract_reminders;
DROP POLICY IF EXISTS "Users can manage reminders" ON public.contract_reminders;

DROP POLICY IF EXISTS "Users can view file versions" ON public.contract_file_versions;
DROP POLICY IF EXISTS "Users can manage file versions" ON public.contract_file_versions;

DROP POLICY IF EXISTS "Users can view own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can create own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can update own searches" ON public.saved_searches;
DROP POLICY IF EXISTS "Users can delete own searches" ON public.saved_searches;

-- 现在重新创建策略
CREATE POLICY "Users can view contracts" ON public.contracts FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can create contracts" ON public.contracts FOR INSERT WITH CHECK (is_authenticated_user());
CREATE POLICY "Users can update contracts" ON public.contracts FOR UPDATE USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());
CREATE POLICY "Users can delete contracts" ON public.contracts FOR DELETE USING (is_authenticated_user());

CREATE POLICY "Users can view numbering rules" ON public.contract_numbering_rules FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Admins can manage numbering rules" ON public.contract_numbering_rules FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());

CREATE POLICY "Users can view tags" ON public.contract_tags FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can manage tags" ON public.contract_tags FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());

CREATE POLICY "Users can view tag relations" ON public.contract_tag_relations FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can manage tag relations" ON public.contract_tag_relations FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());

CREATE POLICY "Users can view permissions" ON public.contract_permissions FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can manage permissions" ON public.contract_permissions FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());

CREATE POLICY "Users can view access logs" ON public.contract_access_logs FOR SELECT USING (is_authenticated_user());
CREATE POLICY "System can insert access logs" ON public.contract_access_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view reminders" ON public.contract_reminders FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can manage reminders" ON public.contract_reminders FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());

CREATE POLICY "Users can view file versions" ON public.contract_file_versions FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can manage file versions" ON public.contract_file_versions FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());

CREATE POLICY "Users can view own searches" ON public.saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own searches" ON public.saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own searches" ON public.saved_searches FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own searches" ON public.saved_searches FOR DELETE USING (auth.uid() = user_id);

SELECT '策略冲突修复完成！' as message;
