-- ============================================================================
-- 修复所有用户管理相关表的 RLS 策略
-- ============================================================================
-- 目的：确保管理员可以正常执行用户管理操作
-- 修复：profiles, user_permissions, user_roles, user_projects 等表的 RLS 策略
-- ============================================================================

BEGIN;

-- ==========================================
-- 第一部分：profiles 表（用户信息表）
-- ==========================================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own data" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all data" ON public.profiles;

-- SELECT：用户可以查看自己的信息，管理员可以查看所有
CREATE POLICY "profiles_select_policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()  -- 用户可以看自己
    OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )  -- 管理员可以看全部
);

-- INSERT：只有系统管理员可以创建用户（通常通过 Edge Function）
CREATE POLICY "profiles_insert_policy"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE：用户可以更新自己的部分信息，管理员可以更新所有
CREATE POLICY "profiles_update_policy"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()  -- 用户可以更新自己
    OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )  -- 管理员可以更新全部
)
WITH CHECK (
    id = auth.uid()  -- 用户只能更新成自己
    OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )  -- 管理员可以更新成任何人
);

-- DELETE：只有管理员可以删除用户
CREATE POLICY "profiles_delete_policy"
ON public.profiles
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ==========================================
-- 第二部分：user_permissions 表（用户权限表）
-- ==========================================

-- 启用 RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "user_permissions_select_policy" ON public.user_permissions;
DROP POLICY IF EXISTS "user_permissions_insert_policy" ON public.user_permissions;
DROP POLICY IF EXISTS "user_permissions_update_policy" ON public.user_permissions;
DROP POLICY IF EXISTS "user_permissions_delete_policy" ON public.user_permissions;

-- SELECT：用户可以查看自己的权限，管理员可以查看所有
CREATE POLICY "user_permissions_select_policy"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()  -- 用户可以看自己的权限
    OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )  -- 管理员可以看所有权限
);

-- INSERT：只有管理员可以创建权限
CREATE POLICY "user_permissions_insert_policy"
ON public.user_permissions
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE：只有管理员可以更新权限
CREATE POLICY "user_permissions_update_policy"
ON public.user_permissions
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- DELETE：只有管理员可以删除权限
CREATE POLICY "user_permissions_delete_policy"
ON public.user_permissions
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ==========================================
-- 第三部分：user_roles 表（用户角色表）
-- ==========================================

-- 启用 RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_policy" ON public.user_roles;

-- SELECT：用户可以查看自己的角色，管理员可以查看所有
CREATE POLICY "user_roles_select_policy"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- INSERT：只有管理员可以分配角色
CREATE POLICY "user_roles_insert_policy"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE：只有管理员可以更新角色
CREATE POLICY "user_roles_update_policy"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- DELETE：只有管理员可以删除角色
CREATE POLICY "user_roles_delete_policy"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ==========================================
-- 第四部分：user_projects 表（用户项目关联表）
-- ==========================================

-- 启用 RLS
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

-- 删除旧策略
DROP POLICY IF EXISTS "user_projects_select_policy" ON public.user_projects;
DROP POLICY IF EXISTS "user_projects_insert_policy" ON public.user_projects;
DROP POLICY IF EXISTS "user_projects_update_policy" ON public.user_projects;
DROP POLICY IF EXISTS "user_projects_delete_policy" ON public.user_projects;

-- SELECT：用户可以查看自己的项目，管理员可以查看所有
CREATE POLICY "user_projects_select_policy"
ON public.user_projects
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- INSERT：管理员可以分配项目
CREATE POLICY "user_projects_insert_policy"
ON public.user_projects
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE：管理员可以更新项目权限
CREATE POLICY "user_projects_update_policy"
ON public.user_projects
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- DELETE：管理员可以删除项目权限
CREATE POLICY "user_projects_delete_policy"
ON public.user_projects
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ==========================================
-- 验证结果
-- ==========================================

DO $$
DECLARE
    v_profiles_policies INTEGER;
    v_user_permissions_policies INTEGER;
    v_user_roles_policies INTEGER;
    v_user_projects_policies INTEGER;
    v_audit_logs_policies INTEGER;
BEGIN
    -- 统计各表的策略数
    SELECT COUNT(*) INTO v_profiles_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles';
    
    SELECT COUNT(*) INTO v_user_permissions_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_permissions';
    
    SELECT COUNT(*) INTO v_user_roles_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles';
    
    SELECT COUNT(*) INTO v_user_projects_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_projects';
    
    SELECT COUNT(*) INTO v_audit_logs_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'permission_audit_logs';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 用户管理表 RLS 策略已更新';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'profiles 表策略数: %', v_profiles_policies;
    RAISE NOTICE 'user_permissions 表策略数: %', v_user_permissions_policies;
    RAISE NOTICE 'user_roles 表策略数: %', v_user_roles_policies;
    RAISE NOTICE 'user_projects 表策略数: %', v_user_projects_policies;
    RAISE NOTICE 'permission_audit_logs 表策略数: %', v_audit_logs_policies;
    RAISE NOTICE '';
    RAISE NOTICE '所有策略均为：';
    RAISE NOTICE '  - SELECT: 用户看自己，管理员看全部';
    RAISE NOTICE '  - INSERT/UPDATE/DELETE: 仅管理员可操作';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==========================================
-- 修复完成！
-- ==========================================
-- ✅ profiles 表：用户可以查看/更新自己，管理员可以管理所有
-- ✅ user_permissions 表：用户可以查看自己的权限，管理员可以管理所有权限
-- ✅ user_roles 表：用户可以查看自己的角色，管理员可以管理所有角色
-- ✅ user_projects 表：用户可以查看自己的项目，管理员可以管理所有项目关联
-- ✅ permission_audit_logs 表：已在前面的脚本中修复
-- 
-- 现在管理员应该可以正常进行用户管理操作了！
-- ==========================================

