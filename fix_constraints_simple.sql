-- 修复用户管理数据库约束问题 - 简化版本

-- 1. 删除现有的 action 约束
ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_action_check;

-- 2. 重新创建更宽松的 action 约束
ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_action_check 
CHECK (action IN ('grant', 'revoke', 'modify', 'inherit', 'create', 'update', 'delete', 'activate', 'deactivate'));

-- 3. 删除现有的 permission_type 约束
ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_permission_type_check;

-- 4. 重新创建 permission_type 约束
ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_permission_type_check 
CHECK (permission_type IN ('menu', 'function', 'project', 'data', 'role', 'user'));

-- 5. 更新 log_permission_change 函数
CREATE OR REPLACE FUNCTION log_permission_change(
  p_user_id uuid,
  p_action text,
  p_permission_type text,
  p_permission_key text,
  p_target_user_id uuid DEFAULT NULL,
  p_target_project_id uuid DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.permission_audit_logs (
    user_id,
    action,
    permission_type,
    permission_key,
    target_user_id,
    target_project_id,
    old_value,
    new_value,
    reason,
    created_by
  ) VALUES (
    p_user_id,
    p_action,
    p_permission_type,
    p_permission_key,
    p_target_user_id,
    p_target_project_id,
    p_old_value,
    p_new_value,
    p_reason,
    auth.uid()
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to log permission change: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 创建用户角色变更触发器
CREATE OR REPLACE FUNCTION log_user_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM log_permission_change(
      NEW.id,
      'update',
      'role',
      'user_role',
      NEW.id,
      NULL,
      to_jsonb(OLD.role),
      to_jsonb(NEW.role),
      '用户角色变更'
    );
  END IF;
  
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    PERFORM log_permission_change(
      NEW.id,
      CASE WHEN NEW.is_active THEN 'activate' ELSE 'deactivate' END,
      'user',
      'user_status',
      NEW.id,
      NULL,
      to_jsonb(OLD.is_active),
      to_jsonb(NEW.is_active),
      '用户状态变更'
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to log user change: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 创建触发器
DROP TRIGGER IF EXISTS user_role_change_trigger ON public.profiles;
CREATE TRIGGER user_role_change_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_user_role_change();

-- 8. 验证修复结果
SELECT '约束修复完成' as status;
