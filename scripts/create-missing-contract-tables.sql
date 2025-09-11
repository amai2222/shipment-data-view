-- 创建缺失的合同相关表
-- 这个脚本会创建所有合同管理功能需要的表

-- 1. 创建合同权限表
CREATE TABLE IF NOT EXISTS public.contract_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'download', 'edit', 'delete')),
    granted_by UUID REFERENCES public.profiles(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建合同文件版本表
CREATE TABLE IF NOT EXISTS public.contract_file_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    file_type TEXT NOT NULL CHECK (file_type IN ('original', 'attachment', 'scan', 'amendment')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    file_hash TEXT,
    version_number INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN DEFAULT false,
    uploaded_by UUID REFERENCES public.profiles(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建合同访问日志表
CREATE TABLE IF NOT EXISTS public.contract_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'download', 'export')),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建合同提醒表
CREATE TABLE IF NOT EXISTS public.contract_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('expiry_30', 'expiry_60', 'expiry_90', 'custom')),
    custom_days INTEGER,
    reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
    recipient_emails TEXT[],
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 创建合同编号规则表
CREATE TABLE IF NOT EXISTS public.contract_numbering_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('行政合同', '内部合同', '业务合同')),
    prefix TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT '{prefix}-{year}-{month}-{sequence}',
    current_sequence INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category)
);

-- 6. 创建合同标签表
CREATE TABLE IF NOT EXISTS public.contract_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 创建合同标签关系表
CREATE TABLE IF NOT EXISTS public.contract_tag_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.contract_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(contract_id, tag_id)
);

-- 8. 创建保存的搜索表
CREATE TABLE IF NOT EXISTS public.saved_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    search_criteria JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_contract_permissions_contract_id ON public.contract_permissions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_permissions_user_id ON public.contract_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_permissions_role_id ON public.contract_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_contract_permissions_department_id ON public.contract_permissions(department_id);

CREATE INDEX IF NOT EXISTS idx_contract_file_versions_contract_id ON public.contract_file_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_file_versions_file_type ON public.contract_file_versions(file_type);
CREATE INDEX IF NOT EXISTS idx_contract_file_versions_is_current ON public.contract_file_versions(is_current);

CREATE INDEX IF NOT EXISTS idx_contract_access_logs_contract_id ON public.contract_access_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_access_logs_user_id ON public.contract_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_access_logs_action ON public.contract_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_contract_access_logs_created_at ON public.contract_access_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_contract_reminders_contract_id ON public.contract_reminders(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_reminder_date ON public.contract_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_is_sent ON public.contract_reminders(is_sent);

CREATE INDEX IF NOT EXISTS idx_contract_tag_relations_contract_id ON public.contract_tag_relations(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_tag_relations_tag_id ON public.contract_tag_relations(tag_id);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);

-- 启用 RLS
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
-- 合同权限表策略
CREATE POLICY "Users can view contract permissions" ON public.contract_permissions
    FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract permissions" ON public.contract_permissions
    FOR ALL USING (is_admin());

CREATE POLICY "Users can create contract permissions" ON public.contract_permissions
    FOR INSERT WITH CHECK (is_authenticated_user());

CREATE POLICY "Users can update their own contract permissions" ON public.contract_permissions
    FOR UPDATE USING (is_authenticated_user());

-- 合同文件版本表策略
CREATE POLICY "Users can view contract files" ON public.contract_file_versions
    FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract files" ON public.contract_file_versions
    FOR ALL USING (is_admin());

CREATE POLICY "Users can upload contract files" ON public.contract_file_versions
    FOR INSERT WITH CHECK (is_authenticated_user());

-- 合同访问日志表策略
CREATE POLICY "Users can view contract access logs" ON public.contract_access_logs
    FOR SELECT USING (is_authenticated_user());

CREATE POLICY "System can create contract access logs" ON public.contract_access_logs
    FOR INSERT WITH CHECK (is_authenticated_user());

CREATE POLICY "Admins can manage contract access logs" ON public.contract_access_logs
    FOR ALL USING (is_admin());

-- 合同提醒表策略
CREATE POLICY "Users can view contract reminders" ON public.contract_reminders
    FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract reminders" ON public.contract_reminders
    FOR ALL USING (is_admin());

CREATE POLICY "Users can create contract reminders" ON public.contract_reminders
    FOR INSERT WITH CHECK (is_authenticated_user());

-- 合同编号规则表策略
CREATE POLICY "Users can view numbering rules" ON public.contract_numbering_rules
    FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Admins can manage numbering rules" ON public.contract_numbering_rules
    FOR ALL USING (is_admin());

-- 合同标签表策略
CREATE POLICY "Users can view contract tags" ON public.contract_tags
    FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract tags" ON public.contract_tags
    FOR ALL USING (is_admin());

CREATE POLICY "Users can create contract tags" ON public.contract_tags
    FOR INSERT WITH CHECK (is_authenticated_user());

-- 合同标签关系表策略
CREATE POLICY "Users can view contract tag relations" ON public.contract_tag_relations
    FOR SELECT USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract tag relations" ON public.contract_tag_relations
    FOR ALL USING (is_admin());

CREATE POLICY "Users can create contract tag relations" ON public.contract_tag_relations
    FOR INSERT WITH CHECK (is_authenticated_user());

-- 保存的搜索表策略
CREATE POLICY "Users can view their own saved searches" ON public.saved_searches
    FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can manage their own saved searches" ON public.saved_searches
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all saved searches" ON public.saved_searches
    FOR ALL USING (is_admin());

-- 插入默认数据
-- 插入默认的编号规则
INSERT INTO public.contract_numbering_rules (category, prefix, format, current_sequence) VALUES
('行政合同', 'ADM', '{prefix}-{year}-{month}-{sequence}', 0),
('内部合同', 'INT', '{prefix}-{year}-{month}-{sequence}', 0),
('业务合同', 'BUS', '{prefix}-{year}-{month}-{sequence}', 0)
ON CONFLICT (category) DO NOTHING;

-- 插入默认的合同标签
INSERT INTO public.contract_tags (name, color, description) VALUES
('重要', '#EF4444', '重要合同'),
('紧急', '#F59E0B', '紧急处理'),
('长期', '#10B981', '长期合同'),
('短期', '#3B82F6', '短期合同'),
('保密', '#8B5CF6', '保密合同')
ON CONFLICT (name) DO NOTHING;

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表创建更新时间触发器
CREATE TRIGGER update_contract_permissions_updated_at BEFORE UPDATE ON public.contract_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contract_file_versions_updated_at BEFORE UPDATE ON public.contract_file_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contract_reminders_updated_at BEFORE UPDATE ON public.contract_reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contract_numbering_rules_updated_at BEFORE UPDATE ON public.contract_numbering_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contract_tags_updated_at BEFORE UPDATE ON public.contract_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON public.saved_searches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
