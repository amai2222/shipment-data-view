-- 创建基本的合同相关表（最简版本）
-- 这个版本只创建最基本的表结构，避免所有可能的错误

-- 1. 创建合同权限表
CREATE TABLE IF NOT EXISTS public.contract_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL,
    user_id UUID,
    role_name TEXT,
    department_name TEXT,
    permission_type TEXT NOT NULL,
    granted_by UUID,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建合同文件版本表
CREATE TABLE IF NOT EXISTS public.contract_file_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL,
    file_type TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS public.contract_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL,
    user_id UUID,
    action TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建合同提醒表
CREATE TABLE IF NOT EXISTS public.contract_reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL,
    reminder_type TEXT NOT NULL,
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
    category TEXT NOT NULL,
    prefix TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT '{prefix}-{year}-{month}-{sequence}',
    current_sequence INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 创建合同标签表
CREATE TABLE IF NOT EXISTS public.contract_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 创建合同标签关系表
CREATE TABLE IF NOT EXISTS public.contract_tag_relations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contract_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 创建保存的搜索表
CREATE TABLE IF NOT EXISTS public.saved_searches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    name TEXT NOT NULL,
    search_criteria JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认数据
INSERT INTO public.contract_numbering_rules (category, prefix, format, current_sequence) VALUES
('行政合同', 'ADM', '{prefix}-{year}-{month}-{sequence}', 0),
('内部合同', 'INT', '{prefix}-{year}-{month}-{sequence}', 0),
('业务合同', 'BUS', '{prefix}-{year}-{month}-{sequence}', 0)
ON CONFLICT DO NOTHING;

INSERT INTO public.contract_tags (name, color, description) VALUES
('重要', '#EF4444', '重要合同'),
('紧急', '#F59E0B', '紧急处理'),
('长期', '#10B981', '长期合同'),
('短期', '#3B82F6', '短期合同'),
('保密', '#8B5CF6', '保密合同')
ON CONFLICT DO NOTHING;
