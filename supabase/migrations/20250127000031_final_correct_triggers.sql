-- 最终正确的函数和触发器
-- 文件: supabase/migrations/20250127000031_final_correct_triggers.sql

-- 1. 创建完全安全的notify_permission_change函数（只处理profiles表）
CREATE OR REPLACE FUNCTION public.notify_permission_change_safe()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- 发送权限变更通知（只处理profiles表）
    PERFORM pg_notify('permission_changed', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'user_id', COALESCE(NEW.id, OLD.id),
        'role', COALESCE(NEW.role, OLD.role),
        'timestamp', NOW()
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. 创建安全的handle_profile_role_change函数
CREATE OR REPLACE FUNCTION public.handle_profile_role_change_safe()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- 当用户角色变更时，自动应用角色模板权限
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- 删除用户的全局权限配置（让用户使用新的角色模板）
        DELETE FROM public.user_permissions 
        WHERE user_id = NEW.id 
        AND project_id IS NULL;
        
        -- 记录角色变更日志到permission_audit_logs表
        INSERT INTO public.permission_audit_logs (
            user_id, 
            action, 
            permission_type,
            permission_key,
            old_value,
            new_value,
            reason,
            created_by
        ) VALUES (
            NEW.id, 
            'role_changed', 
            'role_template',
            'user_role',
            jsonb_build_object('old_role', OLD.role),
            jsonb_build_object('new_role', NEW.role),
            '用户角色已变更，权限将使用新角色模板',
            NEW.id
        );
        
        RAISE NOTICE '用户 % 角色已从 % 变更为 %，权限将使用新角色模板', 
            NEW.email, OLD.role, NEW.role;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- 3. 创建profiles表触发器
CREATE TRIGGER profiles_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.notify_permission_change_safe();

CREATE TRIGGER trigger_profile_role_change
    AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_profile_role_change_safe();

-- 4. 添加注释说明
COMMENT ON FUNCTION public.notify_permission_change_safe() IS '发送profiles表变更通知，使用id字段而不是user_id字段';
COMMENT ON FUNCTION public.handle_profile_role_change_safe() IS '处理用户角色变更，自动更新权限配置';
COMMENT ON TRIGGER profiles_change_trigger ON public.profiles IS 'profiles表变更通知触发器';
COMMENT ON TRIGGER trigger_profile_role_change ON public.profiles IS '用户角色变更处理触发器';
