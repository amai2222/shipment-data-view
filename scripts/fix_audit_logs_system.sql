-- 修复权限审计日志系统
-- 解决 permission_change_log 表不存在的问题

-- 1. 确保 permission_audit_logs 表存在且结构正确
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('grant', 'revoke', 'modify', 'inherit', 'create', 'update', 'delete', 'activate', 'deactivate')),
  permission_type text NOT NULL CHECK (permission_type IN ('menu', 'function', 'project', 'data', 'role', 'user')),
  permission_key text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 2. 确保 RLS 策略正确
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.permission_audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.permission_audit_logs;
DROP POLICY IF EXISTS "Admins can create audit logs" ON public.permission_audit_logs;

-- 创建新策略
CREATE POLICY "Admins can view all audit logs" 
ON public.permission_audit_logs 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Users can view their own audit logs" 
ON public.permission_audit_logs 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = target_user_id);

CREATE POLICY "Admins can create audit logs" 
ON public.permission_audit_logs 
FOR INSERT 
WITH CHECK (is_admin());

-- 3. 确保索引存在
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_id ON public.permission_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at ON public.permission_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_action ON public.permission_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_permission_type ON public.permission_audit_logs(permission_type);

-- 4. 确保日志记录函数存在
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

-- 5. 插入一些示例数据（如果表为空）
INSERT INTO public.permission_audit_logs (
  user_id,
  action,
  permission_type,
  permission_key,
  reason,
  created_by
)
SELECT 
  p.id,
  'grant',
  'menu',
  'dashboard',
  '系统初始化',
  p.id
FROM public.profiles p
WHERE p.role = 'admin'
  AND NOT EXISTS (SELECT 1 FROM public.permission_audit_logs LIMIT 1)
LIMIT 1;

-- 6. 验证修复结果
SELECT 
  '权限审计日志表状态' as status,
  COUNT(*) as total_logs,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT action) as unique_actions
FROM public.permission_audit_logs;

-- 7. 显示最近的审计日志
SELECT 
  pal.id,
  pal.action,
  pal.permission_type,
  pal.permission_key,
  pal.reason,
  pal.created_at,
  p.full_name as user_name
FROM public.permission_audit_logs pal
LEFT JOIN public.profiles p ON pal.user_id = p.id
ORDER BY pal.created_at DESC
LIMIT 10;

-- 8. 检查表结构
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'permission_audit_logs'
  AND table_schema = 'public'
ORDER BY ordinal_position;
