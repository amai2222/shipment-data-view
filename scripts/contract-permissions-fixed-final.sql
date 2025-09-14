-- 修复后的合同权限管理脚本
-- 文件: scripts/contract-permissions-fixed-final.sql
-- 修复了DO块内函数定义的语法错误

-- 1. 检查并创建必要的表和字段
DO $$
DECLARE
    contracts_exists BOOLEAN;
    user_id_exists BOOLEAN;
    contract_category_exists BOOLEAN;
    owner_permissions_exists BOOLEAN;
    category_templates_exists BOOLEAN;
BEGIN
    -- 检查contracts表是否存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'contracts' AND table_schema = 'public'
    ) INTO contracts_exists;
    
    -- 检查user_id字段是否存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'user_id' AND table_schema = 'public'
    ) INTO user_id_exists;
    
    -- 检查contract_category枚举
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'contract_category'
    ) INTO contract_category_exists;
    
    -- 检查权限表是否已存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'contract_owner_permissions' AND table_schema = 'public'
    ) INTO owner_permissions_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'contract_category_permission_templates' AND table_schema = 'public'
    ) INTO category_templates_exists;
    
    -- 输出检查结果
    RAISE NOTICE '=== 数据库结构检查结果 ===';
    RAISE NOTICE 'contracts表存在: %', contracts_exists;
    RAISE NOTICE 'user_id字段存在: %', user_id_exists;
    RAISE NOTICE 'contract_category枚举存在: %', contract_category_exists;
    RAISE NOTICE 'contract_owner_permissions表存在: %', owner_permissions_exists;
    RAISE NOTICE 'contract_category_permission_templates表存在: %', category_templates_exists;
    
    -- 如果没有contract_category枚举，创建它
    IF NOT contract_category_exists THEN
        CREATE TYPE contract_category AS ENUM ('行政合同', '内部合同', '业务合同');
        RAISE NOTICE '已创建contract_category枚举类型';
    END IF;
    
    -- 如果没有contracts表，创建它
    IF NOT contracts_exists THEN
        CREATE TABLE public.contracts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            contract_number TEXT UNIQUE,
            category contract_category NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            counterparty_company TEXT NOT NULL,
            our_company TEXT NOT NULL,
            contract_amount DECIMAL(15,2),
            contract_original_url TEXT,
            attachment_url TEXT,
            remarks TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated', 'archived')),
            priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
            responsible_person TEXT,
            department TEXT,
            is_confidential BOOLEAN NOT NULL DEFAULT false,
            last_accessed_at TIMESTAMPTZ,
            access_count INTEGER NOT NULL DEFAULT 0,
            user_id UUID REFERENCES public.profiles(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE '已创建contracts表';
    END IF;
    
    -- 如果contracts表存在但没有user_id字段，添加它
    IF contracts_exists AND NOT user_id_exists THEN
        ALTER TABLE public.contracts ADD COLUMN user_id UUID REFERENCES public.profiles(id);
        RAISE NOTICE '已为contracts表添加user_id字段';
    END IF;
    
    -- 创建合同所有者权限表（如果不存在）
    IF NOT owner_permissions_exists THEN
        CREATE TABLE public.contract_owner_permissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
            owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            permissions TEXT[] DEFAULT ARRAY['view', 'edit', 'delete', 'download', 'manage']::TEXT[],
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(contract_id)
        );
        RAISE NOTICE '已创建contract_owner_permissions表';
    END IF;
    
    -- 创建合同分类权限模板表（如果不存在）
    IF NOT category_templates_exists THEN
        CREATE TABLE public.contract_category_permission_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category contract_category NOT NULL,
            template_name TEXT NOT NULL,
            description TEXT,
            default_permissions TEXT[] DEFAULT '{}'::TEXT[],
            role_permissions JSONB DEFAULT '{}'::JSONB,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(category)
        );
        RAISE NOTICE '已创建contract_category_permission_templates表';
    END IF;
    
END $$;

-- 2. 启用RLS
ALTER TABLE public.contract_owner_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_category_permission_templates ENABLE ROW LEVEL SECURITY;

-- 3. 创建RLS策略
DROP POLICY IF EXISTS "Admins can manage all contract owner permissions" ON public.contract_owner_permissions;
CREATE POLICY "Admins can manage all contract owner permissions" 
ON public.contract_owner_permissions 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Contract owners can view their own permissions" ON public.contract_owner_permissions;
CREATE POLICY "Contract owners can view their own permissions" 
ON public.contract_owner_permissions 
FOR SELECT 
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can view contract owner permissions for their contracts" ON public.contract_owner_permissions;
CREATE POLICY "Users can view contract owner permissions for their contracts" 
ON public.contract_owner_permissions 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.contracts c 
        WHERE c.id = contract_owner_permissions.contract_id 
        AND c.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Admins can manage all category templates" ON public.contract_category_permission_templates;
CREATE POLICY "Admins can manage all category templates" 
ON public.contract_category_permission_templates 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view active category templates" ON public.contract_category_permission_templates;
CREATE POLICY "Users can view active category templates" 
ON public.contract_category_permission_templates 
FOR SELECT 
USING (is_active = true);

-- 4. 创建触发器函数（在DO块外部）
CREATE OR REPLACE FUNCTION auto_create_contract_owner_permissions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        INSERT INTO public.contract_owner_permissions (contract_id, owner_id)
        VALUES (NEW.id, NEW.user_id)
        ON CONFLICT (contract_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS auto_create_contract_owner_permissions_trigger ON public.contracts;
CREATE TRIGGER auto_create_contract_owner_permissions_trigger
    AFTER INSERT ON public.contracts
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_contract_owner_permissions();

-- 6. 插入默认模板
INSERT INTO public.contract_category_permission_templates (
    category, template_name, description, default_permissions, role_permissions
) VALUES 
(
    '行政合同', '行政合同默认权限', '行政合同的标准权限配置',
    ARRAY['view', 'download']::TEXT[],
    jsonb_build_object(
        'admin', ARRAY['view', 'edit', 'delete', 'download', 'manage']::TEXT[],
        'manager', ARRAY['view', 'download']::TEXT[],
        'user', ARRAY['view']::TEXT[]
    )
),
(
    '内部合同', '内部合同默认权限', '内部合同的标准权限配置',
    ARRAY['view', 'edit', 'download']::TEXT[],
    jsonb_build_object(
        'admin', ARRAY['view', 'edit', 'delete', 'download', 'manage']::TEXT[],
        'manager', ARRAY['view', 'edit', 'download']::TEXT[],
        'user', ARRAY['view', 'download']::TEXT[]
    )
),
(
    '业务合同', '业务合同默认权限', '业务合同的标准权限配置',
    ARRAY['view']::TEXT[],
    jsonb_build_object(
        'admin', ARRAY['view', 'edit', 'delete', 'download', 'manage']::TEXT[],
        'manager', ARRAY['view', 'download']::TEXT[],
        'user', ARRAY['view']::TEXT[]
    )
)
ON CONFLICT (category) DO UPDATE SET
    template_name = EXCLUDED.template_name,
    description = EXCLUDED.description,
    default_permissions = EXCLUDED.default_permissions,
    role_permissions = EXCLUDED.role_permissions,
    updated_at = NOW();

-- 7. 为现有合同创建所有者权限
DO $$
DECLARE
    has_user_id_column BOOLEAN;
    inserted_count INTEGER;
BEGIN
    -- 检查user_id字段是否存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contracts' AND column_name = 'user_id' AND table_schema = 'public'
    ) INTO has_user_id_column;
    
    -- 如果user_id字段存在，为现有合同创建所有者权限
    IF has_user_id_column THEN
        INSERT INTO public.contract_owner_permissions (contract_id, owner_id)
        SELECT c.id as contract_id, c.user_id as owner_id
        FROM public.contracts c
        WHERE c.user_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.contract_owner_permissions cop 
            WHERE cop.contract_id = c.id
        );
        
        GET DIAGNOSTICS inserted_count = ROW_COUNT;
        RAISE NOTICE '已为 % 个现有合同创建所有者权限', inserted_count;
    ELSE
        RAISE NOTICE 'contracts表没有user_id字段，跳过所有者权限创建';
    END IF;
END $$;

-- 8. 创建权限管理函数
CREATE OR REPLACE FUNCTION create_contract_permission(
    p_contract_id UUID,
    p_permission_type TEXT,
    p_user_id UUID DEFAULT NULL,
    p_role_id UUID DEFAULT NULL,
    p_department_id UUID DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    permission_id UUID;
BEGIN
    -- 验证权限类型
    IF p_permission_type NOT IN ('view', 'download', 'edit', 'delete', 'manage', 'sensitive', 'approve', 'archive', 'audit') THEN
        RAISE EXCEPTION '无效的权限类型: %', p_permission_type;
    END IF;
    
    -- 确保至少指定一个目标（用户、角色或部门）
    IF p_user_id IS NULL AND p_role_id IS NULL AND p_department_id IS NULL THEN
        RAISE EXCEPTION '必须指定用户、角色或部门中的至少一个';
    END IF;
    
    -- 创建权限记录
    INSERT INTO public.contract_permissions (
        contract_id,
        user_id,
        role_id,
        department_id,
        permission_type,
        expires_at,
        description,
        granted_by,
        granted_at,
        is_active
    ) VALUES (
        p_contract_id,
        p_user_id,
        p_role_id,
        p_department_id,
        p_permission_type,
        p_expires_at,
        p_description,
        auth.uid(),
        NOW(),
        true
    ) RETURNING id INTO permission_id;
    
    RETURN permission_id;
END;
$$ LANGUAGE plpgsql;

-- 9. 创建权限查询函数
CREATE OR REPLACE FUNCTION get_user_contract_permissions(
    p_user_id UUID,
    p_contract_id UUID DEFAULT NULL
)
RETURNS TABLE (
    contract_id UUID,
    permission_type TEXT,
    source TEXT,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    -- 用户直接权限
    SELECT cp.contract_id, cp.permission_type, 'user'::TEXT, cp.expires_at
    FROM contract_permissions cp
    WHERE cp.user_id = p_user_id
    AND cp.is_active = true
    AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
    AND (p_contract_id IS NULL OR cp.contract_id = p_contract_id)
    
    UNION ALL
    
    -- 角色权限
    SELECT cp.contract_id, cp.permission_type, 'role'::TEXT, cp.expires_at
    FROM contract_permissions cp
    JOIN profiles p ON p.id = p_user_id
    JOIN user_roles ur ON ur.id = cp.role_id
    WHERE ur.role = p.role
    AND cp.is_active = true
    AND (cp.expires_at IS NULL OR cp.expires_at > NOW())
    AND (p_contract_id IS NULL OR cp.contract_id = p_contract_id)
    
    UNION ALL
    
    -- 所有者权限
    SELECT cop.contract_id, unnest(cop.permissions)::TEXT, 'owner'::TEXT, NULL::TIMESTAMPTZ
    FROM contract_owner_permissions cop
    WHERE cop.owner_id = p_user_id
    AND (p_contract_id IS NULL OR cop.contract_id = p_contract_id);
END;
$$ LANGUAGE plpgsql;

-- 10. 创建合同所有者权限查询函数
CREATE OR REPLACE FUNCTION get_contract_owner_permissions()
RETURNS TABLE (
    id UUID,
    contract_id UUID,
    owner_id UUID,
    permissions TEXT[],
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    owner_name TEXT,
    contract_title TEXT,
    contract_category contract_category
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cop.id,
        cop.contract_id,
        cop.owner_id,
        cop.permissions,
        cop.created_at,
        cop.updated_at,
        COALESCE(p.full_name, '未知用户') as owner_name,
        CONCAT(COALESCE(c.counterparty_company, '未知公司'), ' - ', COALESCE(c.our_company, '未知公司')) as contract_title,
        c.category as contract_category
    FROM public.contract_owner_permissions cop
    LEFT JOIN public.profiles p ON cop.owner_id = p.id
    LEFT JOIN public.contracts c ON cop.contract_id = c.id
    ORDER BY cop.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 11. 创建合同分类模板查询函数
CREATE OR REPLACE FUNCTION get_contract_category_templates()
RETURNS TABLE (
    id UUID,
    category contract_category,
    template_name TEXT,
    description TEXT,
    default_permissions TEXT[],
    role_permissions JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ccpt.id,
        ccpt.category,
        ccpt.template_name,
        ccpt.description,
        ccpt.default_permissions,
        ccpt.role_permissions,
        ccpt.is_active,
        ccpt.created_at,
        ccpt.updated_at
    FROM public.contract_category_permission_templates ccpt
    WHERE ccpt.is_active = true
    ORDER BY ccpt.category, ccpt.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 12. 创建权限统计函数
CREATE OR REPLACE FUNCTION get_contract_permission_stats()
RETURNS TABLE (
    total_permissions BIGINT,
    active_permissions BIGINT,
    expired_permissions BIGINT,
    user_permissions BIGINT,
    role_permissions BIGINT,
    department_permissions BIGINT,
    owner_permissions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM contract_permissions) as total_permissions,
        (SELECT COUNT(*) FROM contract_permissions WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())) as active_permissions,
        (SELECT COUNT(*) FROM contract_permissions WHERE expires_at IS NOT NULL AND expires_at <= NOW()) as expired_permissions,
        (SELECT COUNT(*) FROM contract_permissions WHERE user_id IS NOT NULL) as user_permissions,
        (SELECT COUNT(*) FROM contract_permissions WHERE role_id IS NOT NULL) as role_permissions,
        (SELECT COUNT(*) FROM contract_permissions WHERE department_id IS NOT NULL) as department_permissions,
        (SELECT COUNT(*) FROM contract_owner_permissions) as owner_permissions;
END;
$$ LANGUAGE plpgsql;

-- 完成
SELECT '合同权限管理系统安装完成！' as status;
