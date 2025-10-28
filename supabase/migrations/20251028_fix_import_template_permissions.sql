-- 修复导入模板相关表的权限配置
-- 确保认证用户可以正常使用导入模板功能

BEGIN;

-- 1. 授予import_templates表的权限
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_templates TO authenticated;

-- 2. 授予import_field_mappings表的权限  
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_field_mappings TO authenticated;

-- 3. 授予import_fixed_mappings表的权限
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_fixed_mappings TO authenticated;

-- 注意：这些表使用UUID作为主键，不使用SEQUENCE序列，所以不需要授予序列权限

-- 4. 启用RLS（行级安全）
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_fixed_mappings ENABLE ROW LEVEL SECURITY;

-- 5. 删除旧策略（如果存在）
DROP POLICY IF EXISTS "用户可以查看所有模板" ON public.import_templates;
DROP POLICY IF EXISTS "用户可以创建模板" ON public.import_templates;
DROP POLICY IF EXISTS "用户可以更新自己创建的模板" ON public.import_templates;
DROP POLICY IF EXISTS "用户可以删除自己创建的模板" ON public.import_templates;

DROP POLICY IF EXISTS "用户可以查看字段映射" ON public.import_field_mappings;
DROP POLICY IF EXISTS "用户可以管理字段映射" ON public.import_field_mappings;

DROP POLICY IF EXISTS "用户可以查看固定映射" ON public.import_fixed_mappings;
DROP POLICY IF EXISTS "用户可以管理固定映射" ON public.import_fixed_mappings;

-- 6. 创建import_templates表的RLS策略
-- 所有认证用户可以查看所有模板
CREATE POLICY "用户可以查看所有模板" 
ON public.import_templates 
FOR SELECT 
TO authenticated 
USING (true);

-- 认证用户可以创建模板
CREATE POLICY "用户可以创建模板" 
ON public.import_templates 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 用户可以更新自己创建的模板，或者管理员可以更新所有模板
CREATE POLICY "用户可以更新模板" 
ON public.import_templates 
FOR UPDATE 
TO authenticated 
USING (
    created_by_user_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'finance')
    )
);

-- 用户可以删除自己创建的模板，或者管理员可以删除所有模板
CREATE POLICY "用户可以删除模板" 
ON public.import_templates 
FOR DELETE 
TO authenticated 
USING (
    created_by_user_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'finance')
    )
);

-- 7. 创建import_field_mappings表的RLS策略
-- 所有认证用户可以查看所有字段映射
CREATE POLICY "用户可以查看字段映射" 
ON public.import_field_mappings 
FOR SELECT 
TO authenticated 
USING (true);

-- 认证用户可以管理字段映射
CREATE POLICY "用户可以管理字段映射" 
ON public.import_field_mappings 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 8. 创建import_fixed_mappings表的RLS策略
-- 所有认证用户可以查看所有固定映射
CREATE POLICY "用户可以查看固定映射" 
ON public.import_fixed_mappings 
FOR SELECT 
TO authenticated 
USING (true);

-- 认证用户可以管理固定映射
CREATE POLICY "用户可以管理固定映射" 
ON public.import_fixed_mappings 
FOR ALL 
TO authenticated 
USING (true)
WITH CHECK (true);

COMMIT;

-- 说明：
-- 此迁移脚本修复了导入模板系统的权限问题
-- 1. 授予认证用户对三个表的完整CRUD权限
-- 2. 启用行级安全（RLS）
-- 3. 创建合理的RLS策略：
--    - 所有用户可以查看所有模板
--    - 用户可以创建新模板
--    - 用户只能修改/删除自己创建的模板（除非是管理员/财务）
--    - 字段映射和固定映射允许所有认证用户管理

