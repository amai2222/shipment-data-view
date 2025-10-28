-- ==========================================
-- 修复 projects 表的 RLS 策略以支持移动端访问
-- ==========================================
-- 创建时间: 2025-10-28
-- 问题: 移动端无法看到项目列表
-- 原因: 现有 RLS 策略可能过于严格或有冲突
-- 解决: 优化策略，确保已认证用户可以查看项目
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步：删除所有现有的 projects 表 RLS 策略
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage all projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can read and modify projects" ON public.projects;
DROP POLICY IF EXISTS "Finance can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Only admins can delete projects" ON public.projects;
DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;

-- ============================================================
-- 第二步：创建新的 RLS 策略
-- ============================================================

-- SELECT 策略：允许查看项目
-- 1. 管理员可以看所有项目
-- 2. 有 user_projects 权限的用户可以看对应项目
-- 3. 没有任何 user_projects 记录的用户可以看所有项目（兼容性）
CREATE POLICY "projects_select_policy" ON public.projects
FOR SELECT TO authenticated
USING (
    -- 管理员可以看到所有项目
    (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    OR
    -- 财务可以看到所有项目
    (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'finance'
        )
    )
    OR
    -- 用户可以看到自己有权限的项目
    (
        id IN (
            SELECT project_id 
            FROM public.user_projects 
            WHERE user_id = auth.uid() AND can_view = true
        )
    )
    OR
    -- 如果用户没有任何项目权限记录，默认可以看所有项目（向后兼容）
    (
        NOT EXISTS (
            SELECT 1 FROM public.user_projects 
            WHERE user_id = auth.uid()
        )
    )
);

-- INSERT 策略：只有管理员可以创建项目
CREATE POLICY "projects_insert_policy" ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- UPDATE 策略：管理员和有编辑权限的用户可以更新
CREATE POLICY "projects_update_policy" ON public.projects
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    id IN (
        SELECT project_id 
        FROM public.user_projects 
        WHERE user_id = auth.uid() AND can_edit = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    id IN (
        SELECT project_id 
        FROM public.user_projects 
        WHERE user_id = auth.uid() AND can_edit = true
    )
);

-- DELETE 策略：只有管理员可以删除
CREATE POLICY "projects_delete_policy" ON public.projects
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- 第三步：确保 RLS 已启用
-- ============================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 第四步：添加策略注释
-- ============================================================
COMMENT ON POLICY "projects_select_policy" ON public.projects IS 
    '允许管理员、财务、有权限的用户查看项目。没有权限记录的用户默认可查看所有项目（向后兼容）';

COMMENT ON POLICY "projects_insert_policy" ON public.projects IS 
    '只有管理员可以创建项目';

COMMENT ON POLICY "projects_update_policy" ON public.projects IS 
    '管理员和有编辑权限的用户可以更新项目';

COMMENT ON POLICY "projects_delete_policy" ON public.projects IS 
    '只有管理员可以删除项目';

COMMIT;

-- ============================================================
-- 验证查询（可选，仅用于测试）
-- ============================================================
-- 查看当前用户可以访问的项目数量
-- SELECT COUNT(*) FROM public.projects;

-- 查看当前的 RLS 策略
-- SELECT * FROM pg_policies WHERE tablename = 'projects';

