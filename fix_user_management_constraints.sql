-- 修复用户管理数据库约束问题
-- 解决 permission_audit_logs 表的 action 字段约束问题

-- 1. 检查当前约束
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.permission_audit_logs'::regclass 
AND contype = 'c';

-- 2. 删除现有的 action 约束
ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_action_check;

-- 3. 重新创建更宽松的 action 约束
ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_action_check 
CHECK (action IN ('grant', 'revoke', 'modify', 'inherit', 'create', 'update', 'delete', 'activate', 'deactivate'));

-- 4. 删除现有的 permission_type 约束（如果需要）
ALTER TABLE public.permission_audit_logs 
DROP CONSTRAINT IF EXISTS permission_audit_logs_permission_type_check;

-- 5. 重新创建 permission_type 约束
ALTER TABLE public.permission_audit_logs 
ADD CONSTRAINT permission_audit_logs_permission_type_check 
CHECK (permission_type IN ('menu', 'function', 'project', 'data', 'role', 'user'));

-- 6. 更新 log_permission_change 函数以支持更多操作类型
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
  -- 验证 action 参数
  IF p_action NOT IN ('grant', 'revoke', 'modify', 'inherit', 'create', 'update', 'delete', 'activate', 'deactivate') THEN
    RAISE EXCEPTION 'Invalid action: %. Allowed values: grant, revoke, modify, inherit, create, update, delete, activate, deactivate', p_action;
  END IF;
  
  -- 验证 permission_type 参数
  IF p_permission_type NOT IN ('menu', 'function', 'project', 'data', 'role', 'user') THEN
    RAISE EXCEPTION 'Invalid permission_type: %. Allowed values: menu, function, project, data, role, user', p_permission_type;
  END IF;

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
    -- 记录错误但不阻止主操作
    RAISE WARNING 'Failed to log permission change: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 创建用户角色变更触发器
CREATE OR REPLACE FUNCTION log_user_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 记录角色变更
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
  
  -- 记录状态变更
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
    -- 记录错误但不阻止主操作
    RAISE WARNING 'Failed to log user change: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. 创建用户角色变更触发器
DROP TRIGGER IF EXISTS user_role_change_trigger ON public.profiles;
CREATE TRIGGER user_role_change_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_user_role_change();

-- 9. 验证修复结果
DO $$
DECLARE
    constraint_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint 
    WHERE conrelid = 'public.permission_audit_logs'::regclass 
    AND contype = 'c';
    
    RAISE NOTICE 'permission_audit_logs 表现在有 % 个检查约束', constraint_count;
    
    -- 测试插入
    BEGIN
        INSERT INTO public.permission_audit_logs (
            user_id,
            action,
            permission_type,
            permission_key,
            reason,
            created_by
        ) VALUES (
            (SELECT id FROM public.profiles LIMIT 1),
            'update',
            'role',
            'test_role_change',
            '测试角色变更',
            (SELECT id FROM public.profiles LIMIT 1)
        );
        
        RAISE NOTICE '测试插入成功';
        
        -- 清理测试数据
        DELETE FROM public.permission_audit_logs 
        WHERE permission_key = 'test_role_change';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING '测试插入失败: %', SQLERRM;
    END;
END $$;
