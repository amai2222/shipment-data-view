-- 简化的合同管理修复脚本
-- 专门解决合同列表加载失败的问题

-- 1. 删除可能存在的旧函数
DROP FUNCTION IF EXISTS public.is_authenticated_user();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_finance_or_admin(UUID);

-- 2. 创建必要的权限函数
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- 3. 创建合同分类枚举（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_category') THEN
    CREATE TYPE contract_category AS ENUM ('行政合同', '内部合同', '业务合同');
  END IF;
END $$;

-- 4. 创建合同主表（如果不存在）
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
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建合同编号规则表
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

-- 5. 创建合同标签表
CREATE TABLE IF NOT EXISTS public.contract_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name)
);

-- 6. 创建合同标签关联表
CREATE TABLE IF NOT EXISTS public.contract_tag_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.contract_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contract_id, tag_id)
);

-- 7. 创建合同权限表
CREATE TABLE IF NOT EXISTS public.contract_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
  department TEXT,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'delete', 'download', 'admin')),
  field_permissions JSONB,
  file_permissions JSONB,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 创建合同访问日志表
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

-- 9. 创建合同到期提醒表
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

-- 10. 创建合同文件版本表
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

-- 11. 创建保存搜索表
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  search_type TEXT NOT NULL CHECK (search_type IN ('contract', 'logistics', 'payment')),
  filters JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. 创建索引
CREATE INDEX IF NOT EXISTS idx_contracts_number ON public.contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_priority ON public.contracts(priority);
CREATE INDEX IF NOT EXISTS idx_contracts_responsible_person ON public.contracts(responsible_person);
CREATE INDEX IF NOT EXISTS idx_contracts_department ON public.contracts(department);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_is_confidential ON public.contracts(is_confidential);

-- 13. 启用RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- 14. 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Authenticated users can manage contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins can manage all contracts" ON public.contracts;
DROP POLICY IF EXISTS "Finance can view all contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can delete contracts" ON public.contracts;

-- 15. 创建新的RLS策略
CREATE POLICY "Users can view contracts" ON public.contracts FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can create contracts" ON public.contracts FOR INSERT WITH CHECK (is_authenticated_user());
CREATE POLICY "Users can update contracts" ON public.contracts FOR UPDATE USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());
CREATE POLICY "Users can delete contracts" ON public.contracts FOR DELETE USING (is_authenticated_user());

-- 编号规则表策略
CREATE POLICY "Users can view numbering rules" ON public.contract_numbering_rules FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Admins can manage numbering rules" ON public.contract_numbering_rules FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 标签表策略
CREATE POLICY "Users can view tags" ON public.contract_tags FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Admins can manage tags" ON public.contract_tags FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 标签关联表策略
CREATE POLICY "Users can view tag relations" ON public.contract_tag_relations FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can manage tag relations" ON public.contract_tag_relations FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());

-- 权限表策略
CREATE POLICY "Users can view permissions" ON public.contract_permissions FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Admins can manage permissions" ON public.contract_permissions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 访问日志表策略
CREATE POLICY "Users can view access logs" ON public.contract_access_logs FOR SELECT USING (is_authenticated_user());
CREATE POLICY "System can insert access logs" ON public.contract_access_logs FOR INSERT WITH CHECK (true);

-- 提醒表策略
CREATE POLICY "Users can view reminders" ON public.contract_reminders FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Admins can manage reminders" ON public.contract_reminders FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 文件版本表策略
CREATE POLICY "Users can view file versions" ON public.contract_file_versions FOR SELECT USING (is_authenticated_user());
CREATE POLICY "Users can manage file versions" ON public.contract_file_versions FOR ALL USING (is_authenticated_user()) WITH CHECK (is_authenticated_user());

-- 保存搜索表策略
CREATE POLICY "Users can view own searches" ON public.saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own searches" ON public.saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own searches" ON public.saved_searches FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own searches" ON public.saved_searches FOR DELETE USING (auth.uid() = user_id);

-- 16. 插入默认数据
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

-- 17. 创建更新时间触发器
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 完成！
SELECT '合同管理表修复完成！现在可以正常使用合同管理功能了。' as message;
