-- 合同存档管理系统数据库扩展
-- 创建时间: 2024-12-01

-- 1. 合同编号规则表
CREATE TABLE public.contract_numbering_rules (
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

-- 2. 合同标签表
CREATE TABLE public.contract_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name)
);

-- 3. 合同标签关联表
CREATE TABLE public.contract_tag_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.contract_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contract_id, tag_id)
);

-- 4. 合同权限表
CREATE TABLE public.contract_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.user_roles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'download', 'edit', 'delete')),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 合同访问日志表
CREATE TABLE public.contract_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'edit', 'delete')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 合同到期提醒表
CREATE TABLE public.contract_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('expiry_30', 'expiry_60', 'expiry_90', 'custom')),
  reminder_date DATE NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  recipient_emails TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 合同文件版本表
CREATE TABLE public.contract_file_versions (
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

-- 8. 扩展合同表，添加新字段
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS contract_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated', 'archived')),
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
ADD COLUMN IF NOT EXISTS responsible_person TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS expiry_reminder_sent BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS access_count INTEGER NOT NULL DEFAULT 0;

-- 创建索引
CREATE INDEX idx_contracts_number ON public.contracts(contract_number);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_priority ON public.contracts(priority);
CREATE INDEX idx_contracts_responsible_person ON public.contracts(responsible_person);
CREATE INDEX idx_contracts_department ON public.contracts(department);
CREATE INDEX idx_contracts_end_date ON public.contracts(end_date);
CREATE INDEX idx_contracts_is_confidential ON public.contracts(is_confidential);

CREATE INDEX idx_contract_permissions_contract_id ON public.contract_permissions(contract_id);
CREATE INDEX idx_contract_permissions_user_id ON public.contract_permissions(user_id);
CREATE INDEX idx_contract_permissions_role_id ON public.contract_permissions(role_id);

CREATE INDEX idx_contract_access_logs_contract_id ON public.contract_access_logs(contract_id);
CREATE INDEX idx_contract_access_logs_user_id ON public.contract_access_logs(user_id);
CREATE INDEX idx_contract_access_logs_created_at ON public.contract_access_logs(created_at);

CREATE INDEX idx_contract_reminders_contract_id ON public.contract_reminders(contract_id);
CREATE INDEX idx_contract_reminders_reminder_date ON public.contract_reminders(reminder_date);
CREATE INDEX idx_contract_reminders_is_sent ON public.contract_reminders(is_sent);

-- 启用RLS
ALTER TABLE public.contract_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_file_versions ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Authenticated users can view contract numbering rules" 
ON public.contract_numbering_rules FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract numbering rules" 
ON public.contract_numbering_rules FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Authenticated users can view contract tags" 
ON public.contract_tags FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract tags" 
ON public.contract_tags FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Users can view their contract tag relations" 
ON public.contract_tag_relations FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Users can manage their contract tag relations" 
ON public.contract_tag_relations FOR ALL 
USING (is_authenticated_user()) 
WITH CHECK (is_authenticated_user());

CREATE POLICY "Users can view their contract permissions" 
ON public.contract_permissions FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract permissions" 
ON public.contract_permissions FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Users can view their access logs" 
ON public.contract_access_logs FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "System can insert access logs" 
ON public.contract_access_logs FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their contract reminders" 
ON public.contract_reminders FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Admins can manage contract reminders" 
ON public.contract_reminders FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Users can view contract file versions" 
ON public.contract_file_versions FOR SELECT 
USING (is_authenticated_user());

CREATE POLICY "Users can manage contract file versions" 
ON public.contract_file_versions FOR ALL 
USING (is_authenticated_user()) 
WITH CHECK (is_authenticated_user());

-- 创建触发器
CREATE TRIGGER update_contract_numbering_rules_updated_at
  BEFORE UPDATE ON public.contract_numbering_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_contract_permissions_updated_at
  BEFORE UPDATE ON public.contract_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 插入默认编号规则
INSERT INTO public.contract_numbering_rules (category, prefix, format) VALUES
('行政合同', 'XZ', '{prefix}-{year}-{month}-{sequence}'),
('内部合同', 'NB', '{prefix}-{year}-{month}-{sequence}'),
('业务合同', 'YW', '{prefix}-{year}-{month}-{sequence}');

-- 插入默认标签
INSERT INTO public.contract_tags (name, color, description, is_system) VALUES
('重要', '#EF4444', '重要合同', true),
('紧急', '#F59E0B', '紧急处理', true),
('保密', '#8B5CF6', '保密合同', true),
('长期', '#10B981', '长期合同', true),
('短期', '#6B7280', '短期合同', true);

-- 创建生成合同编号的函数
CREATE OR REPLACE FUNCTION generate_contract_number(contract_category contract_category)
RETURNS TEXT AS $$
DECLARE
  rule_record RECORD;
  new_sequence INTEGER;
  current_year INTEGER;
  current_month INTEGER;
  contract_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  current_month := EXTRACT(MONTH FROM NOW());
  
  -- 获取或创建编号规则
  SELECT * INTO rule_record 
  FROM public.contract_numbering_rules 
  WHERE category = contract_category 
    AND year = current_year 
    AND month = current_month 
    AND is_active = true;
  
  IF NOT FOUND THEN
    -- 创建新的编号规则
    INSERT INTO public.contract_numbering_rules (category, prefix, year, month, current_sequence)
    VALUES (contract_category, 
            CASE contract_category
              WHEN '行政合同' THEN 'XZ'
              WHEN '内部合同' THEN 'NB'
              WHEN '业务合同' THEN 'YW'
              ELSE 'HT'
            END,
            current_year, current_month, 0)
    RETURNING * INTO rule_record;
  END IF;
  
  -- 增加序号
  new_sequence := rule_record.current_sequence + 1;
  
  -- 更新序号
  UPDATE public.contract_numbering_rules 
  SET current_sequence = new_sequence,
      updated_at = NOW()
  WHERE id = rule_record.id;
  
  -- 生成合同编号
  contract_number := REPLACE(rule_record.format, '{prefix}', rule_record.prefix);
  contract_number := REPLACE(contract_number, '{year}', LPAD(current_year::TEXT, 4, '0'));
  contract_number := REPLACE(contract_number, '{month}', LPAD(current_month::TEXT, 2, '0'));
  contract_number := REPLACE(contract_number, '{sequence}', LPAD(new_sequence::TEXT, 3, '0'));
  
  RETURN contract_number;
END;
$$ LANGUAGE plpgsql;

-- 创建合同插入时自动生成编号的触发器
CREATE OR REPLACE FUNCTION auto_generate_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_number IS NULL OR NEW.contract_number = '' THEN
    NEW.contract_number := generate_contract_number(NEW.category);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_contract_number
  BEFORE INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_contract_number();

-- 创建记录访问日志的函数
CREATE OR REPLACE FUNCTION log_contract_access(
  p_contract_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.contract_access_logs (contract_id, user_id, action, ip_address, user_agent)
  VALUES (p_contract_id, p_user_id, p_action, p_ip_address, p_user_agent);
  
  -- 更新合同的最后访问时间和访问次数
  UPDATE public.contracts 
  SET last_accessed_at = NOW(),
      access_count = access_count + 1
  WHERE id = p_contract_id;
END;
$$ LANGUAGE plpgsql;
