-- 数据库初始化脚本
-- 用于快速创建合同管理系统的所有必要表

-- 1. 创建合同表
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category contract_category NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  counterparty_company TEXT NOT NULL,
  our_company TEXT NOT NULL,
  contract_amount DECIMAL(15,2),
  contract_original_url TEXT,
  attachment_url TEXT,
  remarks TEXT,
  contract_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated', 'archived')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  responsible_person TEXT,
  department TEXT,
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建合同编号规则表
CREATE TABLE IF NOT EXISTS public.contract_numbering_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category contract_category NOT NULL,
  prefix TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT '{prefix}-{year}-{month}-{sequence}',
  current_sequence INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  month INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM NOW()),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(category, year, month)
);

-- 3. 创建合同标签表
CREATE TABLE IF NOT EXISTS public.contract_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name)
);

-- 4. 创建合同标签关联表
CREATE TABLE IF NOT EXISTS public.contract_tag_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.contract_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contract_id, tag_id)
);

-- 5. 创建合同权限表
CREATE TABLE IF NOT EXISTS public.contract_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  department TEXT,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'delete', 'download', 'admin')),
  field_permissions JSONB,
  file_permissions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 创建合同访问日志表
CREATE TABLE IF NOT EXISTS public.contract_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'download', 'export')),
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 创建合同到期提醒表
CREATE TABLE IF NOT EXISTS public.contract_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('expiry_30', 'expiry_60', 'expiry_90', 'custom')),
  reminder_date DATE NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  recipient_emails TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 创建合同文件版本表
CREATE TABLE IF NOT EXISTS public.contract_file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('original', 'attachment', 'scan', 'amendment')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_hash TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

-- 9. 创建保存搜索表
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  search_type TEXT NOT NULL CHECK (search_type IN ('contract', 'logistics', 'payment')),
  filters JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_contracts_number ON public.contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_priority ON public.contracts(priority);
CREATE INDEX IF NOT EXISTS idx_contracts_responsible_person ON public.contracts(responsible_person);
CREATE INDEX IF NOT EXISTS idx_contracts_department ON public.contracts(department);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_is_confidential ON public.contracts(is_confidential);

CREATE INDEX IF NOT EXISTS idx_contract_permissions_contract_id ON public.contract_permissions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_permissions_user_id ON public.contract_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_permissions_role_id ON public.contract_permissions(role_id);

CREATE INDEX IF NOT EXISTS idx_contract_access_logs_contract_id ON public.contract_access_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_access_logs_user_id ON public.contract_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_access_logs_created_at ON public.contract_access_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_contract_reminders_contract_id ON public.contract_reminders(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_reminder_date ON public.contract_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_is_sent ON public.contract_reminders(is_sent);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_search_type ON public.saved_searches(search_type);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at ON public.saved_searches(created_at);

-- 启用RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- 创建基础RLS策略
DO $$ 
BEGIN
  -- 合同表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Users can view contracts') THEN
    CREATE POLICY "Users can view contracts" ON public.contracts FOR SELECT USING (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Users can create contracts') THEN
    CREATE POLICY "Users can create contracts" ON public.contracts FOR INSERT WITH CHECK (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Users can update contracts') THEN
    CREATE POLICY "Users can update contracts" ON public.contracts FOR UPDATE USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contracts' AND policyname = 'Users can delete contracts') THEN
    CREATE POLICY "Users can delete contracts" ON public.contracts FOR DELETE USING (is_authenticated_user());
  END IF;

  -- 编号规则表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_numbering_rules' AND policyname = 'Users can view numbering rules') THEN
    CREATE POLICY "Users can view numbering rules" ON public.contract_numbering_rules FOR SELECT USING (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_numbering_rules' AND policyname = 'Admins can manage numbering rules') THEN
    CREATE POLICY "Admins can manage numbering rules" ON public.contract_numbering_rules FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;

  -- 标签表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_tags' AND policyname = 'Users can view tags') THEN
    CREATE POLICY "Users can view tags" ON public.contract_tags FOR SELECT USING (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_tags' AND policyname = 'Admins can manage tags') THEN
    CREATE POLICY "Admins can manage tags" ON public.contract_tags FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;

  -- 标签关联表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_tag_relations' AND policyname = 'Users can view tag relations') THEN
    CREATE POLICY "Users can view tag relations" ON public.contract_tag_relations FOR SELECT USING (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_tag_relations' AND policyname = 'Users can manage tag relations') THEN
    CREATE POLICY "Users can manage tag relations" ON public.contract_tag_relations FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());
  END IF;

  -- 权限表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_permissions' AND policyname = 'Users can view permissions') THEN
    CREATE POLICY "Users can view permissions" ON public.contract_permissions FOR SELECT USING (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_permissions' AND policyname = 'Admins can manage permissions') THEN
    CREATE POLICY "Admins can manage permissions" ON public.contract_permissions FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;

  -- 访问日志表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_access_logs' AND policyname = 'Users can view access logs') THEN
    CREATE POLICY "Users can view access logs" ON public.contract_access_logs FOR SELECT USING (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_access_logs' AND policyname = 'System can insert access logs') THEN
    CREATE POLICY "System can insert access logs" ON public.contract_access_logs FOR INSERT WITH CHECK (true);
  END IF;

  -- 提醒表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_reminders' AND policyname = 'Users can view reminders') THEN
    CREATE POLICY "Users can view reminders" ON public.contract_reminders FOR SELECT USING (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_reminders' AND policyname = 'Admins can manage reminders') THEN
    CREATE POLICY "Admins can manage reminders" ON public.contract_reminders FOR ALL USING (is_admin()) WITH CHECK (is_admin());
  END IF;

  -- 文件版本表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_file_versions' AND policyname = 'Users can view file versions') THEN
    CREATE POLICY "Users can view file versions" ON public.contract_file_versions FOR SELECT USING (is_authenticated_user());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contract_file_versions' AND policyname = 'Users can manage file versions') THEN
    CREATE POLICY "Users can manage file versions" ON public.contract_file_versions FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());
  END IF;

  -- 保存搜索表策略
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_searches' AND policyname = 'Users can view own searches') THEN
    CREATE POLICY "Users can view own searches" ON public.saved_searches FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_searches' AND policyname = 'Users can create own searches') THEN
    CREATE POLICY "Users can create own searches" ON public.saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_searches' AND policyname = 'Users can update own searches') THEN
    CREATE POLICY "Users can update own searches" ON public.saved_searches FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saved_searches' AND policyname = 'Users can delete own searches') THEN
    CREATE POLICY "Users can delete own searches" ON public.saved_searches FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 插入默认数据
INSERT INTO public.contract_numbering_rules (category, prefix, format) VALUES
('行政合同', 'XZ', '{prefix}-{year}-{month}-{sequence}'),
('内部合同', 'NB', '{prefix}-{year}-{month}-{sequence}'),
('业务合同', 'YW', '{prefix}-{year}-{month}-{sequence}')
ON CONFLICT (category, year, month) DO NOTHING;

INSERT INTO public.contract_tags (name, color, description, is_system) VALUES
('重要', '#EF4444', '重要合同', true),
('紧急', '#F59E0B', '紧急处理', true),
('保密', '#8B5CF6', '保密合同', true),
('长期', '#10B981', '长期合同', true),
('短期', '#6B7280', '短期合同', true)
ON CONFLICT (name) DO NOTHING;

-- 显示创建结果
SELECT 'Database tables created successfully!' as message;
