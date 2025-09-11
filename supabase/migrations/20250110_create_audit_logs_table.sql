-- 创建权限审计日志表
-- 创建时间: 2025-01-10

-- 创建权限审计日志表
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('grant', 'revoke', 'modify', 'inherit')),
  permission_type text NOT NULL CHECK (permission_type IN ('menu', 'function', 'project', 'data')),
  permission_key text NOT NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 启用RLS
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
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

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_id ON public.permission_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at ON public.permission_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_action ON public.permission_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_permission_type ON public.permission_audit_logs(permission_type);

-- 创建函数：记录权限变更日志
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 插入一些示例数据（仅当表为空时）
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
