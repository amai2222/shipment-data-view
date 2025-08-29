-- 修改权限策略：为所有认证用户提供除删除外的所有权限

-- 1. 先创建一个通用的认证用户检查函数
CREATE OR REPLACE FUNCTION public.is_authenticated_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- 2. 删除旧的限制性策略并创建新的更宽松的策略

-- 对于 billing_types 表
DROP POLICY IF EXISTS "Users can manage their own billing types" ON public.billing_types;
CREATE POLICY "Authenticated users can read and modify billing types" 
ON public.billing_types 
FOR ALL 
USING (is_authenticated_user())
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete billing types" 
ON public.billing_types 
FOR DELETE 
USING (is_admin());

-- 对于 drivers 表
DROP POLICY IF EXISTS "Users can manage their own drivers" ON public.drivers;
CREATE POLICY "Authenticated users can read and modify drivers" 
ON public.drivers 
FOR ALL 
USING (is_authenticated_user())
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete drivers" 
ON public.drivers 
FOR DELETE 
USING (is_admin());

-- 对于 locations 表  
DROP POLICY IF EXISTS "Users can manage their own locations" ON public.locations;
CREATE POLICY "Authenticated users can read and modify locations" 
ON public.locations 
FOR ALL 
USING (is_authenticated_user())
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete locations" 
ON public.locations 
FOR DELETE 
USING (is_admin());

-- 对于 partners 表
DROP POLICY IF EXISTS "Users can manage their own partners" ON public.partners;
CREATE POLICY "Authenticated users can read and modify partners" 
ON public.partners 
FOR ALL 
USING (is_authenticated_user())
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete partners" 
ON public.partners 
FOR DELETE 
USING (is_admin());

-- 对于 projects 表
DROP POLICY IF EXISTS "Non-Admins can manage their own projects" ON public.projects;
DROP POLICY IF EXISTS "Allow users to access their own projects" ON public.projects;
CREATE POLICY "Authenticated users can read and modify projects" 
ON public.projects 
FOR ALL 
USING (is_authenticated_user())
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete projects" 
ON public.projects 
FOR DELETE 
USING (is_admin());

-- 对于 logistics_records 表
DROP POLICY IF EXISTS "Owners can view and manage their own logistics records" ON public.logistics_records;
DROP POLICY IF EXISTS "Allow users to access records of their own projects" ON public.logistics_records;
CREATE POLICY "Authenticated users can read and modify logistics records" 
ON public.logistics_records 
FOR ALL 
USING (is_authenticated_user())
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete logistics records" 
ON public.logistics_records 
FOR DELETE 
USING (is_admin());

-- 对于 logistics_partner_costs 表
DROP POLICY IF EXISTS "Users can manage their own logistics_partner_costs" ON public.logistics_partner_costs;
CREATE POLICY "Authenticated users can read and modify logistics partner costs" 
ON public.logistics_partner_costs 
FOR ALL 
USING (is_authenticated_user())
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete logistics partner costs" 
ON public.logistics_partner_costs 
FOR DELETE 
USING (is_admin());

-- 对于 scale_records 表
DROP POLICY IF EXISTS "Users can manage their own scale_records" ON public.scale_records;
CREATE POLICY "Authenticated users can read and modify scale records" 
ON public.scale_records 
FOR ALL 
USING (is_authenticated_user())
WITH CHECK (is_authenticated_user());

CREATE POLICY "Only admins can delete scale records" 
ON public.scale_records 
FOR DELETE 
USING (is_admin());