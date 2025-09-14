-- 合同权限自动分配和分类权限管理脚本
-- 解决用户自己合同全权限和合同分类权限问题

-- 1. 创建合同分类权限模板表
CREATE TABLE IF NOT EXISTS contract_category_permission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category contract_category NOT NULL,
  role TEXT NOT NULL,
  permissions TEXT[] NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, role)
);

-- 2. 创建合同所有者权限表（用于记录合同创建者的全权限）
CREATE TABLE IF NOT EXISTS contract_owner_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_id, owner_id)
);

-- 3. 创建合同分类权限检查函数
CREATE OR REPLACE FUNCTION check_contract_category_permission(
  p_user_id UUID,
  p_contract_id UUID,
  p_permission_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  contract_category_val contract_category;
  user_role TEXT;
  has_permission BOOLEAN := FALSE;
BEGIN
  -- 获取合同分类和用户角色
  SELECT c.category, p.role INTO contract_category_val, user_role
  FROM contracts c
  JOIN profiles p ON p.id = p_user_id
  WHERE c.id = p_contract_id;
  
  IF contract_category_val IS NULL OR user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 检查合同所有者权限（最高优先级）
  IF EXISTS(
    SELECT 1 FROM contract_owner_permissions 
    WHERE contract_id = p_contract_id 
      AND owner_id = p_user_id 
      AND is_active = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- 检查分类权限模板
  SELECT EXISTS(
    SELECT 1 FROM contract_category_permission_templates
    WHERE category = contract_category_val
      AND role = user_role
      AND p_permission_type = ANY(permissions)
      AND is_default = TRUE
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN TRUE;
  END IF;
  
  -- 检查直接权限
  SELECT EXISTS(
    SELECT 1 FROM contract_permissions 
    WHERE contract_id = p_contract_id 
      AND user_id = p_user_id 
      AND permission_type = p_permission_type
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 创建合同创建时自动分配所有者权限的触发器函数
CREATE OR REPLACE FUNCTION auto_grant_contract_owner_permissions()
RETURNS TRIGGER AS $$
BEGIN
  -- 自动为合同创建者分配所有者权限
  INSERT INTO contract_owner_permissions (contract_id, owner_id)
  VALUES (NEW.id, NEW.user_id)
  ON CONFLICT (contract_id, owner_id) DO NOTHING;
  
  -- 根据合同分类自动分配权限
  INSERT INTO contract_permissions (
    contract_id,
    user_id,
    permission_type,
    granted_by,
    granted_at
  )
  SELECT 
    NEW.id,
    NEW.user_id,
    unnest(permissions),
    NEW.user_id,
    NOW()
  FROM contract_category_permission_templates
  WHERE category = NEW.category
    AND role = (SELECT role FROM profiles WHERE id = NEW.user_id)
    AND is_default = TRUE
  ON CONFLICT (contract_id, user_id, role_id, department_id, permission_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS trigger_auto_grant_contract_owner_permissions ON contracts;
CREATE TRIGGER trigger_auto_grant_contract_owner_permissions
  AFTER INSERT ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION auto_grant_contract_owner_permissions();

-- 6. 插入合同分类权限模板数据
INSERT INTO contract_category_permission_templates (category, role, permissions, is_default) VALUES
  -- 行政合同权限模板
  ('行政合同', 'admin', ARRAY['view', 'download', 'edit', 'delete', 'manage', 'sensitive', 'approve', 'archive', 'audit'], true),
  ('行政合同', 'finance', ARRAY['view', 'download', 'sensitive', 'approve'], true),
  ('行政合同', 'business', ARRAY['view', 'download', 'edit', 'archive'], true),
  ('行政合同', 'operator', ARRAY['view', 'download'], true),
  ('行政合同', 'viewer', ARRAY['view', 'download'], true),
  
  -- 内部合同权限模板
  ('内部合同', 'admin', ARRAY['view', 'download', 'edit', 'delete', 'manage', 'sensitive', 'approve', 'archive', 'audit'], true),
  ('内部合同', 'finance', ARRAY['view', 'download', 'sensitive'], true),
  ('内部合同', 'business', ARRAY['view', 'download', 'edit', 'archive'], true),
  ('内部合同', 'operator', ARRAY['view', 'download'], true),
  ('内部合同', 'viewer', ARRAY['view', 'download'], true),
  
  -- 业务合同权限模板
  ('业务合同', 'admin', ARRAY['view', 'download', 'edit', 'delete', 'manage', 'sensitive', 'approve', 'archive', 'audit'], true),
  ('业务合同', 'finance', ARRAY['view', 'download', 'sensitive', 'approve'], true),
  ('业务合同', 'business', ARRAY['view', 'download', 'edit', 'archive'], true),
  ('业务合同', 'operator', ARRAY['view', 'download'], true),
  ('业务合同', 'viewer', ARRAY['view', 'download'], true)
ON CONFLICT (category, role) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- 7. 创建合同分类权限管理视图
CREATE OR REPLACE VIEW contract_category_permission_summary AS
SELECT 
  c.category,
  p.role,
  cct.permissions as template_permissions,
  COUNT(DISTINCT c.id) as contract_count,
  COUNT(DISTINCT cp.id) as assigned_permissions,
  cct.is_default
FROM contracts c
CROSS JOIN profiles p
LEFT JOIN contract_category_permission_templates cct ON cct.category = c.category AND cct.role = p.role
LEFT JOIN contract_permissions cp ON cp.contract_id = c.id AND cp.user_id = p.id
GROUP BY c.category, p.role, cct.permissions, cct.is_default
ORDER BY c.category, p.role;

-- 8. 创建合同所有者权限视图
CREATE OR REPLACE VIEW contract_owner_permission_summary AS
SELECT 
  c.id as contract_id,
  c.contract_number,
  c.category,
  c.counterparty_company,
  cop.owner_id,
  p.full_name as owner_name,
  p.email as owner_email,
  cop.granted_at,
  cop.is_active
FROM contracts c
JOIN contract_owner_permissions cop ON cop.contract_id = c.id
JOIN profiles p ON p.id = cop.owner_id
ORDER BY c.created_at DESC;

-- 9. 创建权限检查函数（增强版）
CREATE OR REPLACE FUNCTION check_enhanced_contract_permission(
  p_user_id UUID,
  p_contract_id UUID,
  p_permission_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  contract_category_val contract_category;
  user_role TEXT;
  has_permission BOOLEAN := FALSE;
BEGIN
  -- 获取合同分类和用户角色
  SELECT c.category, p.role INTO contract_category_val, user_role
  FROM contracts c
  JOIN profiles p ON p.id = p_user_id
  WHERE c.id = p_contract_id;
  
  IF contract_category_val IS NULL OR user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 1. 检查合同所有者权限（最高优先级）
  IF EXISTS(
    SELECT 1 FROM contract_owner_permissions 
    WHERE contract_id = p_contract_id 
      AND owner_id = p_user_id 
      AND is_active = TRUE
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- 2. 检查分类权限模板
  SELECT EXISTS(
    SELECT 1 FROM contract_category_permission_templates
    WHERE category = contract_category_val
      AND role = user_role
      AND p_permission_type = ANY(permissions)
      AND is_default = TRUE
  ) INTO has_permission;
  
  IF has_permission THEN
    RETURN TRUE;
  END IF;
  
  -- 3. 检查直接权限
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
  
  -- 4. 检查角色权限
  SELECT EXISTS(
    SELECT 1 FROM contract_permissions cp
    WHERE cp.contract_id = p_contract_id 
      AND cp.role_id = user_role
      AND cp.permission_type = p_permission_type
      AND cp.is_active = TRUE
      AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. 创建RLS策略
ALTER TABLE contract_category_permission_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_owner_permissions ENABLE ROW LEVEL SECURITY;

-- 合同分类权限模板RLS策略
CREATE POLICY "Everyone can view category permission templates" ON contract_category_permission_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage category permission templates" ON contract_category_permission_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 合同所有者权限RLS策略
CREATE POLICY "Users can view their own owner permissions" ON contract_owner_permissions
  FOR SELECT USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can insert owner permissions" ON contract_owner_permissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage owner permissions" ON contract_owner_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 11. 创建索引
CREATE INDEX IF NOT EXISTS idx_contract_category_permission_templates_category_role 
ON contract_category_permission_templates(category, role);

CREATE INDEX IF NOT EXISTS idx_contract_owner_permissions_contract_id 
ON contract_owner_permissions(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_owner_permissions_owner_id 
ON contract_owner_permissions(owner_id);

-- 12. 验证表创建
SELECT 
  '=== 合同分类权限管理表创建验证 ===' as section;

SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'contract_category_permission_templates',
    'contract_owner_permissions'
  )
ORDER BY table_name;

-- 13. 验证数据插入
SELECT 
  '=== 合同分类权限模板数据验证 ===' as section;

SELECT 
  category,
  role,
  array_length(permissions, 1) as permission_count,
  permissions
FROM contract_category_permission_templates
ORDER BY category, role;

-- 14. 验证函数创建
SELECT 
  '=== 权限检查函数验证 ===' as section;

SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'check_contract_category_permission',
    'check_enhanced_contract_permission'
  )
ORDER BY routine_name;
