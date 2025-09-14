-- 合同权限管理系统数据库迁移脚本
-- 创建合同权限管理相关的数据库表

-- 1. 创建合同权限表
CREATE TABLE IF NOT EXISTS contract_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  user_id UUID,
  role_id TEXT,
  department_id UUID,
  permission_type TEXT NOT NULL CHECK (permission_type IN (
    'view', 'download', 'edit', 'delete', 'manage', 
    'sensitive', 'approve', 'archive', 'audit'
  )),
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束：至少指定一个权限对象
  CONSTRAINT check_permission_target CHECK (
    user_id IS NOT NULL OR role_id IS NOT NULL OR department_id IS NOT NULL
  ),
  
  -- 约束：权限类型与权限对象的组合唯一
  CONSTRAINT unique_permission UNIQUE (
    contract_id, 
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(role_id, ''),
    COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
    permission_type
  )
);

-- 2. 创建合同访问日志表
CREATE TABLE IF NOT EXISTS contract_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'view', 'download', 'edit', 'delete', 'create', 
    'approve', 'archive', 'restore', 'permission_grant', 'permission_revoke'
  )),
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建权限模板表
CREATE TABLE IF NOT EXISTS contract_permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT[] NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建部门表（如果不存在）
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES departments(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_contract_permissions_contract_id 
ON contract_permissions(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_permissions_user_id 
ON contract_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_contract_permissions_role_id 
ON contract_permissions(role_id);

CREATE INDEX IF NOT EXISTS idx_contract_permissions_department_id 
ON contract_permissions(department_id);

CREATE INDEX IF NOT EXISTS idx_contract_permissions_permission_type 
ON contract_permissions(permission_type);

CREATE INDEX IF NOT EXISTS idx_contract_permissions_is_active 
ON contract_permissions(is_active);

CREATE INDEX IF NOT EXISTS idx_contract_permissions_expires_at 
ON contract_permissions(expires_at);

CREATE INDEX IF NOT EXISTS idx_contract_access_logs_contract_id 
ON contract_access_logs(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_access_logs_user_id 
ON contract_access_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_contract_access_logs_accessed_at 
ON contract_access_logs(accessed_at);

CREATE INDEX IF NOT EXISTS idx_contract_access_logs_action 
ON contract_access_logs(action);

-- 6. 创建外键约束
ALTER TABLE contract_permissions 
ADD CONSTRAINT fk_contract_permissions_contract_id 
FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE contract_permissions 
ADD CONSTRAINT fk_contract_permissions_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE contract_permissions 
ADD CONSTRAINT fk_contract_permissions_role_id 
FOREIGN KEY (role_id) REFERENCES role_permission_templates(role) ON DELETE CASCADE;

ALTER TABLE contract_permissions 
ADD CONSTRAINT fk_contract_permissions_department_id 
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE contract_permissions 
ADD CONSTRAINT fk_contract_permissions_granted_by 
FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE contract_access_logs 
ADD CONSTRAINT fk_contract_access_logs_contract_id 
FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE contract_access_logs 
ADD CONSTRAINT fk_contract_access_logs_user_id 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 7. 创建触发器函数
CREATE OR REPLACE FUNCTION update_contract_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_contract_permission_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 创建触发器
DROP TRIGGER IF EXISTS trigger_update_contract_permissions_updated_at ON contract_permissions;
CREATE TRIGGER trigger_update_contract_permissions_updated_at
  BEFORE UPDATE ON contract_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_permissions_updated_at();

DROP TRIGGER IF EXISTS trigger_update_contract_permission_templates_updated_at ON contract_permission_templates;
CREATE TRIGGER trigger_update_contract_permission_templates_updated_at
  BEFORE UPDATE ON contract_permission_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_permission_templates_updated_at();

DROP TRIGGER IF EXISTS trigger_update_departments_updated_at ON departments;
CREATE TRIGGER trigger_update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_departments_updated_at();

-- 9. 创建RLS策略
ALTER TABLE contract_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_permission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- 合同权限表RLS策略
CREATE POLICY "Users can view their own contract permissions" ON contract_permissions
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = granted_by OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all contract permissions" ON contract_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 合同访问日志表RLS策略
CREATE POLICY "Users can view their own access logs" ON contract_access_logs
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert access logs" ON contract_access_logs
  FOR INSERT WITH CHECK (true);

-- 权限模板表RLS策略
CREATE POLICY "Everyone can view permission templates" ON contract_permission_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage permission templates" ON contract_permission_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 部门表RLS策略
CREATE POLICY "Everyone can view departments" ON departments
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage departments" ON departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 10. 插入默认数据
INSERT INTO departments (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', '财务部', '负责财务管理相关工作'),
  ('00000000-0000-0000-0000-000000000002', '业务部', '负责业务拓展和客户管理'),
  ('00000000-0000-0000-0000-000000000003', '法务部', '负责合同审核和法律事务'),
  ('00000000-0000-0000-0000-000000000004', '运营部', '负责日常运营管理'),
  ('00000000-0000-0000-0000-000000000005', '技术部', '负责技术开发和维护')
ON CONFLICT (name) DO NOTHING;

INSERT INTO contract_permission_templates (name, description, permissions, is_default) VALUES
  ('基础查看权限', '只能查看合同基本信息', ARRAY['view'], false),
  ('文件下载权限', '可以下载合同文件', ARRAY['view', 'download'], false),
  ('编辑权限', '可以编辑合同信息', ARRAY['view', 'download', 'edit'], false),
  ('完整权限', '拥有所有权限', ARRAY['view', 'download', 'edit', 'delete', 'manage', 'sensitive', 'approve', 'archive', 'audit'], true),
  ('财务权限', '财务相关权限', ARRAY['view', 'download', 'sensitive', 'approve'], false),
  ('业务权限', '业务操作权限', ARRAY['view', 'download', 'edit', 'archive'], false)
ON CONFLICT (name) DO NOTHING;

-- 11. 创建权限检查函数
CREATE OR REPLACE FUNCTION check_contract_permission(
  p_user_id UUID,
  p_contract_id UUID,
  p_permission_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN := FALSE;
BEGIN
  -- 检查用户直接权限
  SELECT EXISTS(
    SELECT 1 FROM contract_permissions 
    WHERE contract_id = p_contract_id 
      AND user_id = p_user_id 
      AND permission_type = p_permission_type
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN TRUE;
  END IF;
  
  -- 检查角色权限
  SELECT EXISTS(
    SELECT 1 FROM contract_permissions cp
    JOIN profiles p ON p.id = p_user_id
    WHERE cp.contract_id = p_contract_id 
      AND cp.role_id = p.role
      AND cp.permission_type = p_permission_type
      AND cp.is_active = TRUE
      AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN TRUE;
  END IF;
  
  -- 检查部门权限（需要先实现用户部门关联）
  -- 这里暂时跳过部门权限检查
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. 创建权限审计函数
CREATE OR REPLACE FUNCTION log_contract_access(
  p_contract_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO contract_access_logs (
    contract_id,
    user_id,
    action,
    ip_address,
    user_agent,
    details
  ) VALUES (
    p_contract_id,
    p_user_id,
    p_action,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent',
    p_details
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. 创建权限统计视图
CREATE OR REPLACE VIEW contract_permission_stats AS
SELECT 
  cp.contract_id,
  c.contract_number,
  c.counterparty_company,
  COUNT(*) as total_permissions,
  COUNT(CASE WHEN cp.is_active THEN 1 END) as active_permissions,
  COUNT(CASE WHEN cp.expires_at < NOW() THEN 1 END) as expired_permissions,
  COUNT(CASE WHEN cp.user_id IS NOT NULL THEN 1 END) as user_permissions,
  COUNT(CASE WHEN cp.role_id IS NOT NULL THEN 1 END) as role_permissions,
  COUNT(CASE WHEN cp.department_id IS NOT NULL THEN 1 END) as department_permissions
FROM contract_permissions cp
JOIN contracts c ON cp.contract_id = c.id
GROUP BY cp.contract_id, c.contract_number, c.counterparty_company;

-- 14. 创建用户权限汇总视图
CREATE OR REPLACE VIEW user_contract_permissions_summary AS
SELECT 
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  COUNT(DISTINCT cp.contract_id) as accessible_contracts,
  COUNT(cp.id) as total_permissions,
  COUNT(CASE WHEN cp.is_active THEN 1 END) as active_permissions,
  COUNT(CASE WHEN cp.expires_at < NOW() THEN 1 END) as expired_permissions,
  array_agg(DISTINCT cp.permission_type) as permission_types
FROM profiles p
LEFT JOIN contract_permissions cp ON p.id = cp.user_id
GROUP BY p.id, p.full_name, p.email, p.role;

-- 15. 验证表创建
SELECT 
  '=== 合同权限管理系统表创建验证 ===' as section;

SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'contract_permissions',
    'contract_access_logs', 
    'contract_permission_templates',
    'departments'
  )
ORDER BY table_name;

-- 16. 验证索引创建
SELECT 
  '=== 索引创建验证 ===' as section;

SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN (
    'contract_permissions',
    'contract_access_logs'
  )
ORDER BY tablename, indexname;

-- 17. 验证函数创建
SELECT 
  '=== 函数创建验证 ===' as section;

SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'check_contract_permission',
    'log_contract_access'
  )
ORDER BY routine_name;

-- 18. 验证视图创建
SELECT 
  '=== 视图创建验证 ===' as section;

SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'contract_permission_stats',
    'user_contract_permissions_summary'
  )
ORDER BY table_name;
