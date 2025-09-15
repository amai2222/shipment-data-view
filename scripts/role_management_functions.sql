-- 角色管理数据库函数
-- 支持动态角色创建和管理

-- 1. 检查枚举值是否存在
CREATE OR REPLACE FUNCTION check_enum_value(enum_name text, enum_value text)
RETURNS boolean AS $$
DECLARE
    result boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = enum_name 
        AND enumlabel = enum_value
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 添加枚举值
CREATE OR REPLACE FUNCTION add_enum_value(enum_name text, enum_value text)
RETURNS void AS $$
DECLARE
    type_oid oid;
    sql_statement text;
BEGIN
    -- 获取枚举类型的 OID
    SELECT oid INTO type_oid
    FROM pg_type 
    WHERE typname = enum_name;
    
    IF type_oid IS NULL THEN
        RAISE EXCEPTION '枚举类型 % 不存在', enum_name;
    END IF;
    
    -- 检查值是否已存在
    IF EXISTS(
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = type_oid 
        AND enumlabel = enum_value
    ) THEN
        RAISE EXCEPTION '枚举值 % 已存在于类型 % 中', enum_value, enum_name;
    END IF;
    
    -- 使用动态 SQL 添加枚举值
    sql_statement := format('ALTER TYPE %I ADD VALUE %L', enum_name, enum_value);
    EXECUTE sql_statement;
    
    RAISE NOTICE '成功添加枚举值 % 到类型 %', enum_value, enum_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 创建角色（完整流程）
CREATE OR REPLACE FUNCTION create_role_complete(
    role_key text,
    role_label text,
    role_color text DEFAULT 'bg-gray-500',
    role_description text DEFAULT '',
    menu_permissions text[] DEFAULT '{}',
    function_permissions text[] DEFAULT '{}',
    project_permissions text[] DEFAULT '{}',
    data_permissions text[] DEFAULT '{}'
)
RETURNS void AS $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- 1. 检查角色是否已存在
    IF check_enum_value('app_role', role_key) THEN
        RAISE EXCEPTION '角色 % 已存在', role_key;
    END IF;
    
    -- 2. 添加角色到枚举类型
    PERFORM add_enum_value('app_role', role_key);
    
    -- 3. 创建权限模板
    INSERT INTO public.role_permission_templates (
        role,
        menu_permissions,
        function_permissions,
        project_permissions,
        data_permissions,
        created_at,
        updated_at
    ) VALUES (
        role_key,
        menu_permissions,
        function_permissions,
        project_permissions,
        data_permissions,
        NOW(),
        NOW()
    );
    
    -- 4. 获取管理员用户ID
    SELECT id INTO admin_user_id
    FROM public.profiles
    WHERE role = 'admin'
    LIMIT 1;
    
    -- 5. 为新角色创建默认项目分配
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO public.user_projects (
            user_id,
            project_id,
            role,
            can_view,
            can_edit,
            can_delete,
            created_by
        )
        SELECT 
            admin_user_id,
            p.id,
            role_key::app_role,
            true,  -- 默认可以查看
            CASE 
                WHEN role_key = 'admin' THEN true
                ELSE false
            END,  -- 根据角色设置编辑权限
            CASE 
                WHEN role_key = 'admin' THEN true
                ELSE false
            END,  -- 根据角色设置删除权限
            admin_user_id
        FROM public.projects p
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_projects up 
            WHERE up.user_id = admin_user_id 
            AND up.project_id = p.id 
            AND up.role = role_key::app_role
        );
    END IF;
    
    RAISE NOTICE '角色 % 创建成功', role_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 删除角色（完整流程）
CREATE OR REPLACE FUNCTION delete_role_complete(role_key text)
RETURNS void AS $$
DECLARE
    user_count integer;
BEGIN
    -- 1. 检查是否有用户使用该角色
    SELECT COUNT(*) INTO user_count
    FROM public.profiles
    WHERE role = role_key;
    
    IF user_count > 0 THEN
        RAISE WARNING '有 % 个用户正在使用角色 %，将自动改为操作员角色', user_count, role_key;
        
        -- 更新用户角色为操作员
        UPDATE public.profiles
        SET role = 'operator'
        WHERE role = role_key;
    END IF;
    
    -- 2. 删除权限模板
    DELETE FROM public.role_permission_templates
    WHERE role = role_key;
    
    -- 3. 删除项目分配
    DELETE FROM public.user_projects
    WHERE role = role_key::app_role;
    
    -- 注意：无法从枚举类型中删除值，这是 PostgreSQL 的限制
    RAISE WARNING '角色 % 已从系统中删除，但枚举类型中的值需要手动清理', role_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 获取所有角色信息
CREATE OR REPLACE FUNCTION get_all_roles()
RETURNS TABLE(
    role_key text,
    role_label text,
    user_count bigint,
    template_exists boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.enumlabel::text as role_key,
        COALESCE(r.label, e.enumlabel::text) as role_label,
        COALESCE(p.user_count, 0) as user_count,
        CASE WHEN rt.role IS NOT NULL THEN true ELSE false END as template_exists
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    LEFT JOIN (
        SELECT role, COUNT(*) as user_count
        FROM public.profiles
        GROUP BY role
    ) p ON e.enumlabel = p.role
    LEFT JOIN public.role_permission_templates rt ON e.enumlabel = rt.role
    LEFT JOIN (
        SELECT 'admin' as role, '系统管理员' as label
        UNION ALL SELECT 'finance', '财务人员'
        UNION ALL SELECT 'business', '业务人员'
        UNION ALL SELECT 'operator', '操作员'
        UNION ALL SELECT 'partner', '合作方'
        UNION ALL SELECT 'viewer', '查看者'
    ) r ON e.enumlabel = r.role
    WHERE t.typname = 'app_role'
    ORDER BY e.enumsortorder;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 验证角色创建结果
CREATE OR REPLACE FUNCTION verify_role_creation(role_key text)
RETURNS TABLE(
    check_type text,
    status text,
    details text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        '枚举类型检查'::text,
        CASE 
            WHEN check_enum_value('app_role', role_key) THEN '通过'::text
            ELSE '失败'::text
        END,
        CASE 
            WHEN check_enum_value('app_role', role_key) THEN '角色已添加到枚举类型'::text
            ELSE '角色未添加到枚举类型'::text
        END
    UNION ALL
    SELECT 
        '权限模板检查'::text,
        CASE 
            WHEN EXISTS(SELECT 1 FROM public.role_permission_templates WHERE role = role_key) THEN '通过'::text
            ELSE '失败'::text
        END,
        CASE 
            WHEN EXISTS(SELECT 1 FROM public.role_permission_templates WHERE role = role_key) THEN '权限模板已创建'::text
            ELSE '权限模板未创建'::text
        END
    UNION ALL
    SELECT 
        '项目分配检查'::text,
        CASE 
            WHEN EXISTS(SELECT 1 FROM public.user_projects WHERE role::text = role_key) THEN '通过'::text
            ELSE '警告'::text
        END,
        CASE 
            WHEN EXISTS(SELECT 1 FROM public.user_projects WHERE role::text = role_key) THEN '项目分配已创建'::text
            ELSE '项目分配未创建（可能没有项目）'::text
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
