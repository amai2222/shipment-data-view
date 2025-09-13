-- 修复 user_projects 表缺失问题
-- 创建用户项目关联表

-- 1. 检查 user_projects 表是否存在
SELECT 
    'user_projects表检查' as category,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'user_projects' 
            AND table_schema = 'public'
        ) THEN '✅ 表已存在'
        ELSE '❌ 表不存在，需要创建'
    END as status;

-- 2. 创建 user_projects 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.user_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role text DEFAULT 'member', -- member, admin, viewer
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  
  -- 确保每个用户在每个项目中只有一条记录
  UNIQUE(user_id, project_id)
);

-- 3. 启用 RLS
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

-- 4. 创建 RLS 策略
-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "Admins can manage all user projects" ON public.user_projects;
DROP POLICY IF EXISTS "Users can view their own project assignments" ON public.user_projects;

-- 创建新的 RLS 策略
CREATE POLICY "Admins can manage all user projects" 
ON public.user_projects 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Users can view their own project assignments" 
ON public.user_projects 
FOR SELECT 
USING (auth.uid() = user_id);

-- 5. 创建更新时间触发器
DROP TRIGGER IF EXISTS update_user_projects_updated_at ON public.user_projects;
CREATE TRIGGER update_user_projects_updated_at
  BEFORE UPDATE ON public.user_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON public.user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project_id ON public.user_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_role ON public.user_projects(role);

-- 7. 验证表创建结果
SELECT 
    'user_projects表验证' as category,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'user_projects' 
            AND table_schema = 'public'
        ) THEN '✅ 表创建成功'
        ELSE '❌ 表创建失败'
    END as status;

-- 8. 检查表结构
SELECT 
    'user_projects表结构' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_projects' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. 检查 RLS 策略
SELECT 
    'user_projects RLS策略' as category,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_projects'
  AND schemaname = 'public'
ORDER BY policyname;

-- 10. 检查外键约束
SELECT 
    'user_projects外键约束' as category,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'user_projects'
  AND tc.table_schema = 'public'
ORDER BY tc.constraint_name;
