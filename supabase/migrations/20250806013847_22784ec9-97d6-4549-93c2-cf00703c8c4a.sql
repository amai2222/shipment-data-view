-- 创建角色枚举类型
CREATE TYPE public.app_role AS ENUM ('admin', 'finance', 'business', 'partner', 'operator');

-- 更新 profiles 表，添加角色字段
ALTER TABLE public.profiles 
ADD COLUMN role public.app_role DEFAULT 'operator',
ADD COLUMN username text UNIQUE,
ADD COLUMN is_active boolean DEFAULT true;

-- 创建用户角色安全函数，避免RLS递归
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.app_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 创建用户名查找函数
CREATE OR REPLACE FUNCTION public.get_user_by_username(username_input text)
RETURNS uuid
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.profiles WHERE username = username_input AND is_active = true LIMIT 1;
$$;

-- 创建初始管理员账户的函数
CREATE OR REPLACE FUNCTION public.create_initial_admin(admin_email text, admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  result jsonb;
BEGIN
  -- 检查是否已存在管理员
  IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', '管理员账户已存在');
  END IF;

  -- 在 auth.users 中创建用户（这需要通过应用层调用）
  -- 这里只是准备 profiles 记录的逻辑
  RETURN jsonb_build_object(
    'success', true, 
    'message', '请通过应用层调用 Supabase Auth 创建管理员用户',
    'email', admin_email
  );
END;
$$;

-- 为所有现有记录设置用户ID（数据修复）
UPDATE public.logistics_records 
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE user_id IS NULL;

UPDATE public.projects 
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE user_id IS NULL;

UPDATE public.drivers 
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE user_id IS NULL;

UPDATE public.locations 
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE user_id IS NULL;

UPDATE public.partners 
SET user_id = '00000000-0000-0000-0000-000000000000'::uuid 
WHERE user_id IS NULL;

-- 创建基于角色的RLS策略

-- 修改 profiles 表的 RLS 策略
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view accessible profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR 
    public.get_current_user_role() IN ('admin', 'finance')
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- 更新 logistics_records 的 RLS 策略
DROP POLICY IF EXISTS "Users can view own logistics_records" ON public.logistics_records;
DROP POLICY IF EXISTS "Users can create own logistics_records" ON public.logistics_records;
DROP POLICY IF EXISTS "Users can update own logistics_records" ON public.logistics_records;
DROP POLICY IF EXISTS "Users can delete own logistics_records" ON public.logistics_records;

CREATE POLICY "Role-based logistics_records access" ON public.logistics_records
  FOR ALL USING (
    CASE public.get_current_user_role()
      WHEN 'admin' THEN true
      WHEN 'finance' THEN true
      WHEN 'business' THEN true
      WHEN 'operator' THEN user_id = auth.uid() OR user_id IS NULL
      WHEN 'partner' THEN 
        EXISTS (
          SELECT 1 FROM public.logistics_partner_costs lpc
          JOIN public.project_partners pp ON lpc.partner_id = pp.partner_id
          WHERE lpc.logistics_record_id = logistics_records.id
        )
      ELSE false
    END
  );

-- 更新其他表的 RLS 策略为基于角色
-- Projects 表
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Role-based projects access" ON public.projects
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'finance', 'business') OR
    (public.get_current_user_role() = 'operator' AND (user_id = auth.uid() OR user_id IS NULL))
  );

-- Drivers 表
DROP POLICY IF EXISTS "Users can view own drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can create own drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can update own drivers" ON public.drivers;
DROP POLICY IF EXISTS "Users can delete own drivers" ON public.drivers;

CREATE POLICY "Role-based drivers access" ON public.drivers
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'finance', 'business', 'operator') OR
    user_id = auth.uid() OR user_id IS NULL
  );

-- Partners 表
DROP POLICY IF EXISTS "Users can view own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can create own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can update own partners" ON public.partners;
DROP POLICY IF EXISTS "Users can delete own partners" ON public.partners;

CREATE POLICY "Role-based partners access" ON public.partners
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'finance', 'business') OR
    (public.get_current_user_role() = 'partner' AND user_id = auth.uid()) OR
    user_id IS NULL
  );

-- 创建权限检查函数
CREATE OR REPLACE FUNCTION public.check_permission(required_roles public.app_role[])
RETURNS boolean
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT public.get_current_user_role() = ANY(required_roles);
$$;

-- 为 Edge Function 添加 JWT 验证配置注释
COMMENT ON FUNCTION public.get_current_user_role() IS 'Security function for role-based access control';