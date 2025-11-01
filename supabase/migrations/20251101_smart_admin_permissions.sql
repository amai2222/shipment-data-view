-- ============================================================================
-- 智能管理员权限系统
-- ============================================================================
-- 功能：
--   1. admin 角色模板自动获得所有新增权限
--   2. 禁止减少 admin 角色模板的权限
--   3. 自动同步最新的权限到 admin 模板
-- ============================================================================

-- 🔒 Step 1: 创建触发器 - 禁止减少 admin 权限
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_admin_permission_reduction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_old_total INTEGER;
    v_new_total INTEGER;
BEGIN
    -- 只检查 admin 角色
    IF NEW.role = 'admin' THEN
        v_old_total := COALESCE(array_length(OLD.menu_permissions, 1), 0) +
                      COALESCE(array_length(OLD.function_permissions, 1), 0) +
                      COALESCE(array_length(OLD.project_permissions, 1), 0) +
                      COALESCE(array_length(OLD.data_permissions, 1), 0);
        
        v_new_total := COALESCE(array_length(NEW.menu_permissions, 1), 0) +
                      COALESCE(array_length(NEW.function_permissions, 1), 0) +
                      COALESCE(array_length(NEW.project_permissions, 1), 0) +
                      COALESCE(array_length(NEW.data_permissions, 1), 0);
        
        -- 如果新权限少于旧权限，阻止修改
        IF v_new_total < v_old_total THEN
            RAISE EXCEPTION '🚫 禁止减少 admin 角色权限！当前: % 个，尝试修改为: % 个。admin 必须拥有完整权限。',
                v_old_total, v_new_total;
        END IF;
        
        -- 如果权限数量相同但内容不同，发出警告
        IF v_new_total = v_old_total THEN
            RAISE NOTICE '⚠️ admin 权限数量未变，但内容可能已修改。请确认修改是否合理。';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_admin_permission_reduction() IS '禁止减少 admin 角色模板的权限数量';

-- 创建触发器
DROP TRIGGER IF EXISTS prevent_admin_reduction_trigger ON public.role_permission_templates;
CREATE TRIGGER prevent_admin_reduction_trigger
    BEFORE UPDATE ON public.role_permission_templates
    FOR EACH ROW
    WHEN (NEW.role = 'admin')
    EXECUTE FUNCTION public.prevent_admin_permission_reduction();

-- ✨ Step 2: 创建智能权限同步函数
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_admin_permissions_smart()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_all_menu_permissions TEXT[];
    v_all_function_permissions TEXT[];
    v_all_project_permissions TEXT[];
    v_all_data_permissions TEXT[];
    v_old_total INTEGER;
    v_new_total INTEGER;
    v_added_count INTEGER;
BEGIN
    -- 获取当前 admin 角色模板的权限数量
    SELECT 
        COALESCE(array_length(menu_permissions, 1), 0) +
        COALESCE(array_length(function_permissions, 1), 0) +
        COALESCE(array_length(project_permissions, 1), 0) +
        COALESCE(array_length(data_permissions, 1), 0)
    INTO v_old_total
    FROM public.role_permission_templates
    WHERE role = 'admin';
    
    -- 从所有 admin 用户的权限中收集所有唯一的权限项
    -- 菜单权限
    SELECT ARRAY_AGG(DISTINCT perm ORDER BY perm)
    INTO v_all_menu_permissions
    FROM (
        SELECT unnest(up.menu_permissions) as perm
        FROM public.user_permissions up
        INNER JOIN public.profiles p ON p.id = up.user_id
        WHERE p.role = 'admin' AND up.project_id IS NULL
        
        UNION
        
        SELECT unnest(rt.menu_permissions) as perm
        FROM public.role_permission_templates rt
        WHERE rt.role = 'admin'
    ) sub
    WHERE perm IS NOT NULL AND perm != '';
    
    -- 功能权限
    SELECT ARRAY_AGG(DISTINCT perm ORDER BY perm)
    INTO v_all_function_permissions
    FROM (
        SELECT unnest(up.function_permissions) as perm
        FROM public.user_permissions up
        INNER JOIN public.profiles p ON p.id = up.user_id
        WHERE p.role = 'admin' AND up.project_id IS NULL
        
        UNION
        
        SELECT unnest(rt.function_permissions) as perm
        FROM public.role_permission_templates rt
        WHERE rt.role = 'admin'
    ) sub
    WHERE perm IS NOT NULL AND perm != '';
    
    -- 项目权限
    SELECT ARRAY_AGG(DISTINCT perm ORDER BY perm)
    INTO v_all_project_permissions
    FROM (
        SELECT unnest(up.project_permissions) as perm
        FROM public.user_permissions up
        INNER JOIN public.profiles p ON p.id = up.user_id
        WHERE p.role = 'admin' AND up.project_id IS NULL
        
        UNION
        
        SELECT unnest(rt.project_permissions) as perm
        FROM public.role_permission_templates rt
        WHERE rt.role = 'admin'
    ) sub
    WHERE perm IS NOT NULL AND perm != '';
    
    -- 数据权限
    SELECT ARRAY_AGG(DISTINCT perm ORDER BY perm)
    INTO v_all_data_permissions
    FROM (
        SELECT unnest(up.data_permissions) as perm
        FROM public.user_permissions up
        INNER JOIN public.profiles p ON p.id = up.user_id
        WHERE p.role = 'admin' AND up.project_id IS NULL
        
        UNION
        
        SELECT unnest(rt.data_permissions) as perm
        FROM public.role_permission_templates rt
        WHERE rt.role = 'admin'
    ) sub
    WHERE perm IS NOT NULL AND perm != '';
    
    -- 计算新的总权限数
    v_new_total := COALESCE(array_length(v_all_menu_permissions, 1), 0) +
                   COALESCE(array_length(v_all_function_permissions, 1), 0) +
                   COALESCE(array_length(v_all_project_permissions, 1), 0) +
                   COALESCE(array_length(v_all_data_permissions, 1), 0);
    
    v_added_count := v_new_total - COALESCE(v_old_total, 0);
    
    -- 更新 admin 角色模板
    UPDATE public.role_permission_templates
    SET 
        menu_permissions = v_all_menu_permissions,
        function_permissions = v_all_function_permissions,
        project_permissions = v_all_project_permissions,
        data_permissions = v_all_data_permissions,
        updated_at = NOW()
    WHERE role = 'admin';
    
    -- 如果 admin 角色模板不存在，创建它
    IF NOT FOUND THEN
        INSERT INTO public.role_permission_templates (
            role,
            menu_permissions,
            function_permissions,
            project_permissions,
            data_permissions
        ) VALUES (
            'admin',
            v_all_menu_permissions,
            v_all_function_permissions,
            v_all_project_permissions,
            v_all_data_permissions
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'old_total', v_old_total,
        'new_total', v_new_total,
        'added_count', v_added_count,
        'message', format('admin 角色权限已同步：%s 个 → %s 个，新增 %s 个', 
                         COALESCE(v_old_total, 0), v_new_total, v_added_count)
    );
END;
$$;

COMMENT ON FUNCTION public.sync_admin_permissions_smart() IS '智能同步 admin 角色权限：自动收集所有 admin 用户的权限，合并到角色模板';

-- 🔄 Step 3: 创建定时同步触发器（当有新的 admin 用户权限时）
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_sync_admin_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_result JSONB;
BEGIN
    -- 检查是否是 admin 用户的权限变更
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- 如果是 admin 用户的全局权限变更，自动同步到角色模板
    IF v_is_admin AND NEW.project_id IS NULL THEN
        -- 异步调用同步函数（不阻塞当前操作）
        BEGIN
            v_result := public.sync_admin_permissions_smart();
            RAISE NOTICE '✅ admin 权限已自动同步: %', v_result->>'message';
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '自动同步 admin 权限失败: %', SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_sync_admin_permissions() IS '当 admin 用户权限变更时，自动同步到角色模板';

-- 创建触发器
DROP TRIGGER IF EXISTS auto_sync_admin_trigger ON public.user_permissions;
CREATE TRIGGER auto_sync_admin_trigger
    AFTER INSERT OR UPDATE ON public.user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_sync_admin_permissions();

-- 🎯 Step 4: 立即执行一次同步
-- ============================================================================

SELECT '====== 立即同步 admin 权限 ======' as info;

SELECT public.sync_admin_permissions_smart() as "同步结果";

-- ✅ Step 5: 验证智能权限系统
-- ============================================================================

SELECT '====== 验证智能权限系统 ======' as info;

-- 1. 检查防减少触发器
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'prevent_admin_reduction_trigger'
        ) THEN '✅ 已部署：禁止减少 admin 权限'
        ELSE '❌ 未部署'
    END as "防减少触发器";

-- 2. 检查自动同步触发器
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'auto_sync_admin_trigger'
        ) THEN '✅ 已部署：自动同步 admin 权限'
        ELSE '❌ 未部署'
    END as "自动同步触发器";

-- 3. 检查 admin 角色模板权限数
SELECT 
    role,
    COALESCE(array_length(menu_permissions, 1), 0) as "菜单",
    COALESCE(array_length(function_permissions, 1), 0) as "功能",
    COALESCE(array_length(project_permissions, 1), 0) as "项目",
    COALESCE(array_length(data_permissions, 1), 0) as "数据",
    (COALESCE(array_length(menu_permissions, 1), 0) +
     COALESCE(array_length(function_permissions, 1), 0) +
     COALESCE(array_length(project_permissions, 1), 0) +
     COALESCE(array_length(data_permissions, 1), 0)) as "总权限数",
    CASE 
        WHEN (COALESCE(array_length(menu_permissions, 1), 0) +
              COALESCE(array_length(function_permissions, 1), 0) +
              COALESCE(array_length(project_permissions, 1), 0) +
              COALESCE(array_length(data_permissions, 1), 0)) >= 90
        THEN '✅ 权限完整'
        ELSE '⚠️ 权限不足'
    END as "状态"
FROM public.role_permission_templates
WHERE role = 'admin';

-- 4. 显示所有用户的最终权限
SELECT 
    p.email,
    p.role,
    CASE 
        WHEN up.id IS NOT NULL THEN '🔧 自定义权限'
        ELSE '📋 角色模板'
    END as "权限来源",
    COALESCE(
        COALESCE(array_length(up.menu_permissions, 1), 0) +
        COALESCE(array_length(up.function_permissions, 1), 0) +
        COALESCE(array_length(up.project_permissions, 1), 0) +
        COALESCE(array_length(up.data_permissions, 1), 0),
        COALESCE(array_length(rt.menu_permissions, 1), 0) +
        COALESCE(array_length(rt.function_permissions, 1), 0) +
        COALESCE(array_length(rt.project_permissions, 1), 0) +
        COALESCE(array_length(rt.data_permissions, 1), 0)
    ) as "总权限数"
FROM public.profiles p
LEFT JOIN public.user_permissions up ON up.user_id = p.id AND up.project_id IS NULL
LEFT JOIN public.role_permission_templates rt ON rt.role = p.role
ORDER BY p.email;

-- ============================================================================
-- 使用说明
-- ============================================================================

COMMENT ON FUNCTION public.sync_admin_permissions_smart() IS 
'智能同步 admin 权限：
1. 自动从所有 admin 用户的权限中收集所有权限项
2. 合并去重后更新到 admin 角色模板
3. 确保 admin 角色模板始终拥有最完整的权限';

COMMENT ON FUNCTION public.prevent_admin_permission_reduction() IS 
'防止减少 admin 权限：
1. 禁止任何减少 admin 角色模板权限的操作
2. 阻止误操作导致权限丢失
3. 确保 admin 始终拥有完整权限';

COMMENT ON FUNCTION public.auto_sync_admin_permissions() IS 
'自动同步 admin 权限：
1. 当任何 admin 用户的权限变更时自动触发
2. 自动同步新权限到 admin 角色模板
3. 确保 admin 模板始终是最新最完整的';

-- ============================================================================
-- 手动同步使用方法
-- ============================================================================

/*

### 🎯 功能说明：

#### 1. 自动同步（推荐）
当任何 admin 用户的权限被修改时，系统会自动：
- 收集所有 admin 用户的权限
- 合并去重
- 更新到 admin 角色模板
- admin 角色模板始终拥有最完整的权限

#### 2. 防止减少
任何尝试减少 admin 角色模板权限的操作都会被阻止：
```sql
-- 这个操作会失败：
UPDATE role_permission_templates 
SET menu_permissions = ARRAY['dashboard']  -- 只有1个权限
WHERE role = 'admin';

-- 错误: 🚫 禁止减少 admin 角色权限！当前: 93 个，尝试修改为: 1 个
```

#### 3. 手动同步
如果需要手动触发同步：
```sql
SELECT public.sync_admin_permissions_smart();
```

### ⚡ 工作流程：

**场景 1: 系统添加了新功能**
1. 开发人员在代码中添加了新的权限项（如 'new_feature.view'）
2. 管理员在界面上给某个 admin 用户添加了这个权限
3. 触发器自动触发
4. admin 角色模板自动获得这个新权限 ✅
5. 所有使用角色模板的 admin 用户自动获得新权限 ✅

**场景 2: 误操作尝试删除权限**
1. 有人尝试减少 admin 角色模板的权限
2. 触发器检测到权限减少
3. 阻止操作，抛出错误 ✅
4. admin 权限得到保护 ✅

### 🔄 定期维护（可选）：

建议每月执行一次手动同步，确保权限最新：
```sql
SELECT public.sync_admin_permissions_smart();
```

*/

