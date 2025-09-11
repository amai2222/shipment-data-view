-- 创建合同相关表（安全版本）
-- 这个版本会先删除可能存在的表，然后重新创建

-- 删除可能存在的表（如果存在）
DROP TABLE IF EXISTS public.contract_tag_relations CASCADE;
DROP TABLE IF EXISTS public.contract_tags CASCADE;
DROP TABLE IF EXISTS public.contract_reminders CASCADE;
DROP TABLE IF EXISTS public.contract_access_logs CASCADE;
DROP TABLE IF EXISTS public.contract_file_versions CASCADE;
DROP TABLE IF EXISTS public.contract_permissions CASCADE;
DROP TABLE IF EXISTS public.contract_numbering_rules CASCADE;
DROP TABLE IF EXISTS public.saved_searches CASCADE;

-- 删除可能存在的触发器
DROP TRIGGER IF EXISTS update_contract_permissions_updated_at ON public.contract_permissions;
DROP TRIGGER IF EXISTS update_contract_file_versions_updated_at ON public.contract_file_versions;
DROP TRIGGER IF EXISTS update_contract_reminders_updated_at ON public.contract_reminders;
DROP TRIGGER IF EXISTS update_contract_numbering_rules_updated_at ON public.contract_numbering_rules;
DROP TRIGGER IF EXISTS update_contract_tags_updated_at ON public.contract_tags;
DROP TRIGGER IF EXISTS update_saved_searches_updated_at ON public.saved_searches;

-- 删除可能存在的函数
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 1. 创建合同权限表
CREATE TABLE public.contract_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    user_id UUID,
    role_name TEXT,
    department_name TEXT,
    permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'download', 'edit', 'delete')),
    granted_by UUID,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建合同文件版本表
CREATE TABLE public.contract_file_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    file_type TEXT NOT NULL CHECK (file_type IN ('original', 'attachment', 'scan', 'amendment')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    file_hash TEXT,
    version_number INTEGER NOT NULL DEFAULT 1,
    is_current BOOLEAN DEFAULT false,
    uploaded_by UUID,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建合同访问日志表
CREATE TABLE public.contract_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'download', 'export')),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建合同提醒表
CREATE TABLE public.contract_reminders (
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
CREATE TABLE public.contract_numbering_rules (
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
CREATE TABLE public.contract_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 创建合同标签关系表
CREATE TABLE public.contract_tag_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.contract_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(contract_id, tag_id)
);

-- 8. 创建保存的搜索表
CREATE TABLE public.saved_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    name TEXT NOT NULL,
    search_criteria JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_contract_permissions_contract_id ON public.contract_permissions(contract_id);
CREATE INDEX idx_contract_permissions_user_id ON public.contract_permissions(user_id);
CREATE INDEX idx_contract_permissions_role_name ON public.contract_permissions(role_name);
CREATE INDEX idx_contract_permissions_department_name ON public.contract_permissions(department_name);

CREATE INDEX idx_contract_file_versions_contract_id ON public.contract_file_versions(contract_id);
CREATE INDEX idx_contract_file_versions_file_type ON public.contract_file_versions(file_type);
CREATE INDEX idx_contract_file_versions_is_current ON public.contract_file_versions(is_current);

CREATE INDEX idx_contract_access_logs_contract_id ON public.contract_access_logs(contract_id);
CREATE INDEX idx_contract_access_logs_user_id ON public.contract_access_logs(user_id);
CREATE INDEX idx_contract_access_logs_action ON public.contract_access_logs(action);
CREATE INDEX idx_contract_access_logs_created_at ON public.contract_access_logs(created_at);

CREATE INDEX idx_contract_reminders_contract_id ON public.contract_reminders(contract_id);
CREATE INDEX idx_contract_reminders_reminder_date ON public.contract_reminders(reminder_date);
CREATE INDEX idx_contract_reminders_is_sent ON public.contract_reminders(is_sent);

CREATE INDEX idx_contract_tag_relations_contract_id ON public.contract_tag_relations(contract_id);
CREATE INDEX idx_contract_tag_relations_tag_id ON public.contract_tag_relations(tag_id);

CREATE INDEX idx_saved_searches_user_id ON public.saved_searches(user_id);

-- 启用 RLS
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- 创建简单的 RLS 策略
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

-- 插入默认数据
INSERT INTO public.contract_numbering_rules (category, prefix, format, current_sequence) VALUES
('行政合同', 'ADM', '{prefix}-{year}-{month}-{sequence}', 0),
('内部合同', 'INT', '{prefix}-{year}-{month}-{sequence}', 0),
('业务合同', 'BUS', '{prefix}-{year}-{month}-{sequence}', 0);

INSERT INTO public.contract_tags (name, color, description) VALUES
('重要', '#EF4444', '重要合同'),
('紧急', '#F59E0B', '紧急处理'),
('长期', '#10B981', '长期合同'),
('短期', '#3B82F6', '短期合同'),
('保密', '#8B5CF6', '保密合同');

-- 创建更新时间触发器函数
CREATE FUNCTION update_updated_at_column()
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
