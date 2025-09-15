-- 动态角色数据库更新脚本
-- 自动支持系统所有角色，无需硬编码

-- 1. 添加 role 列（如果不存在）并处理类型转换
DO $$
BEGIN
    -- 检查列是否存在
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_projects' 
        AND column_name = 'role'
    ) THEN
        -- 列不存在，直接添加为 app_role 类型
        ALTER TABLE public.user_projects 
        ADD COLUMN role app_role DEFAULT 'operator'::app_role;
        
        RAISE NOTICE 'Added role column as app_role type';
    ELSE
        -- 列存在，检查类型
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'user_projects' 
            AND column_name = 'role'
            AND data_type = 'text'
        ) THEN
            -- 列是 text 类型，需要转换为 app_role
            -- 先更新数据确保都是有效值
            UPDATE public.user_projects 
            SET role = (CASE 
                WHEN role IN ('admin', 'finance', 'business', 'operator', 'partner', 'viewer') 
                THEN role
                ELSE 'operator'
            END)::app_role
            WHERE role IS NOT NULL;
            
            -- 先删除默认值约束
            ALTER TABLE public.user_projects 
            ALTER COLUMN role DROP DEFAULT;
            
            -- 转换类型
            ALTER TABLE public.user_projects 
            ALTER COLUMN role TYPE app_role USING role::app_role;
            
            -- 重新设置默认值
            ALTER TABLE public.user_projects 
            ALTER COLUMN role SET DEFAULT 'operator'::app_role;
            
            RAISE NOTICE 'Converted role column from text to app_role type';
        ELSE
            RAISE NOTICE 'role column already exists with correct type';
        END IF;
    END IF;
END $$;

-- 2. 添加列注释
COMMENT ON COLUMN public.user_projects.role IS '项目角色: 使用 app_role 枚举类型，支持所有系统角色';

-- 3. 为现有记录设置默认角色
UPDATE public.user_projects 
SET role = (CASE 
  WHEN can_delete = true THEN 'admin'
  WHEN can_edit = true THEN 'operator' 
  ELSE 'viewer'
END)::app_role
WHERE role IS NULL;

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_user_projects_role ON public.user_projects(role);

-- 5. 创建函数：为新用户自动分配所有项目权限（动态角色支持）
CREATE OR REPLACE FUNCTION auto_assign_projects_to_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 为新用户分配所有现有项目
  -- 检查 role 列是否存在
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_projects' 
    AND column_name = 'role'
  ) THEN
    INSERT INTO public.user_projects (user_id, project_id, role, can_view, can_edit, can_delete, created_by)
    SELECT 
      NEW.id,
      p.id,
      'operator'::app_role, -- 默认角色
      true,
      true,
      false,
      (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
    FROM public.projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_projects up 
      WHERE up.user_id = NEW.id AND up.project_id = p.id
    );
  ELSE
    INSERT INTO public.user_projects (user_id, project_id, can_view, can_edit, can_delete, created_by)
    SELECT 
      NEW.id,
      p.id,
      true,
      true,
      false,
      (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
    FROM public.projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_projects up 
      WHERE up.user_id = NEW.id AND up.project_id = p.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 创建函数：为新项目自动分配给所有用户（动态角色支持）
CREATE OR REPLACE FUNCTION auto_assign_new_project_to_users()
RETURNS TRIGGER AS $$
BEGIN
  -- 为新项目分配给所有现有用户
  -- 检查 role 列是否存在
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_projects' 
    AND column_name = 'role'
  ) THEN
    INSERT INTO public.user_projects (user_id, project_id, role, can_view, can_edit, can_delete, created_by)
    SELECT 
      p.id,
      NEW.id,
      'operator'::app_role, -- 默认角色
      true,
      true,
      false,
      (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_projects up 
      WHERE up.user_id = p.id AND up.project_id = NEW.id
    );
  ELSE
    INSERT INTO public.user_projects (user_id, project_id, can_view, can_edit, can_delete, created_by)
    SELECT 
      p.id,
      NEW.id,
      true,
      true,
      false,
      (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
    FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_projects up 
      WHERE up.user_id = p.id AND up.project_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 创建触发器：当新用户创建时自动分配项目权限
DROP TRIGGER IF EXISTS trigger_auto_assign_projects ON public.profiles;
CREATE TRIGGER trigger_auto_assign_projects
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION auto_assign_projects_to_new_user();

-- 8. 创建触发器：当新项目创建时自动分配给所有用户
DROP TRIGGER IF EXISTS trigger_auto_assign_users ON public.projects;
CREATE TRIGGER trigger_auto_assign_users
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION auto_assign_new_project_to_users();

-- 9. 验证表结构
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_projects'
ORDER BY ordinal_position;

-- 10. 显示角色分布统计
SELECT 
    role,
    COUNT(*) as count,
    COUNT(CASE WHEN can_view = true THEN 1 END) as can_view_count,
    COUNT(CASE WHEN can_edit = true THEN 1 END) as can_edit_count,
    COUNT(CASE WHEN can_delete = true THEN 1 END) as can_delete_count
FROM public.user_projects
GROUP BY role
ORDER BY role;

-- 11. 显示支持的角色信息
SELECT 
    'Supported roles in system:' as info,
    string_agg(role_text, ', ' ORDER BY role_text) as roles
FROM (
    SELECT DISTINCT role::text as role_text FROM public.profiles
    UNION
    SELECT DISTINCT role::text as role_text FROM public.user_projects WHERE role IS NOT NULL
) t;
