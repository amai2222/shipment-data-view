-- 修复所有函数的search_path安全问题
-- 文件: scripts/fix_function_search_path_security.sql

-- 1. 修复 update_updated_at_column 函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 2. 修复 get_logistics_summary_and_records_enhanced 函数
CREATE OR REPLACE FUNCTION public.get_logistics_summary_and_records_enhanced(
    p_start_date text DEFAULT NULL,
    p_end_date text DEFAULT NULL,
    p_project_name text DEFAULT NULL,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_has_scale_record text DEFAULT NULL,
    p_page_number integer DEFAULT 1,
    p_page_size integer DEFAULT 25,
    p_sort_field text DEFAULT 'auto_number',
    p_sort_direction text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_offset integer;
    v_result jsonb;
    v_waybill_array text[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;

    WITH filtered_records AS (
        SELECT lr.*,
               pc.chain_name,
               CASE 
                   WHEN EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number) 
                   THEN true 
                   ELSE false 
               END as has_scale_record
        FROM public.logistics_records lr
        LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id
        WHERE
            (p_start_date IS NULL OR p_start_date = '' OR lr.loading_date >= p_start_date::date) AND
            (p_end_date IS NULL OR p_end_date = '' OR lr.loading_date <= p_end_date::date) AND
            (p_project_name IS NULL OR p_project_name = '' OR lr.project_name = p_project_name) AND
            (p_driver_name IS NULL OR p_driver_name = '' OR lr.driver_name ILIKE '%' || p_driver_name || '%') AND
            (p_license_plate IS NULL OR p_license_plate = '' OR lr.license_plate ILIKE '%' || p_license_plate || '%') AND
            (p_driver_phone IS NULL OR p_driver_phone = '' OR lr.driver_phone ILIKE '%' || p_driver_phone || '%') AND
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END) AND
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array)) AND
            (p_has_scale_record IS NULL OR p_has_scale_record = '' OR
             CASE 
                 WHEN p_has_scale_record = 'yes' THEN 
                     EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 WHEN p_has_scale_record = 'no' THEN 
                     NOT EXISTS (SELECT 1 FROM public.scale_records sr WHERE sr.logistics_number = lr.auto_number)
                 ELSE true
             END)
    )
    SELECT jsonb_build_object(
        'summary', (
            SELECT jsonb_build_object(
                'totalCurrentCost', COALESCE(SUM(current_cost), 0),
                'totalExtraCost', COALESCE(SUM(extra_cost), 0),
                'totalDriverPayableCost', COALESCE(SUM(payable_cost), 0),
                'actualCount', COUNT(*) FILTER (WHERE transport_type = '实际运输'),
                'returnCount', COUNT(*) FILTER (WHERE transport_type = '退货'),
                'totalWeightLoading', COALESCE(SUM(loading_weight), 0),
                'totalWeightUnloading', COALESCE(SUM(unloading_weight), 0),
                'totalTripsLoading', COUNT(*) FILTER (WHERE billing_type_id = 2),
                'totalVolumeLoading', COALESCE(SUM(loading_weight) FILTER (WHERE billing_type_id = 3), 0),
                'totalVolumeUnloading', COALESCE(SUM(unloading_weight) FILTER (WHERE billing_type_id = 3), 0)
            )
            FROM filtered_records
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(fr.* ORDER BY 
                CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN fr.auto_number END ASC,
                CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN fr.auto_number END DESC,
                CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN fr.loading_date END ASC,
                CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN fr.loading_date END DESC,
                CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'asc' THEN fr.driver_name END ASC,
                CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'desc' THEN fr.driver_name END DESC,
                CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'asc' THEN fr.current_cost END ASC,
                CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'desc' THEN fr.current_cost END DESC,
                CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'asc' THEN fr.payable_cost END ASC,
                CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'desc' THEN fr.payable_cost END DESC,
                fr.loading_date DESC, fr.created_at DESC
            ), '[]'::jsonb)
            FROM (
                SELECT *
                FROM filtered_records
                ORDER BY 
                    CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'asc' THEN auto_number END ASC,
                    CASE WHEN p_sort_field = 'auto_number' AND p_sort_direction = 'desc' THEN auto_number END DESC,
                    CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'asc' THEN loading_date END ASC,
                    CASE WHEN p_sort_field = 'loading_date' AND p_sort_direction = 'desc' THEN loading_date END DESC,
                    CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'asc' THEN driver_name END ASC,
                    CASE WHEN p_sort_field = 'driver_name' AND p_sort_direction = 'desc' THEN driver_name END DESC,
                    CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'asc' THEN current_cost END ASC,
                    CASE WHEN p_sort_field = 'current_cost' AND p_sort_direction = 'desc' THEN current_cost END DESC,
                    CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'asc' THEN payable_cost END ASC,
                    CASE WHEN p_sort_field = 'payable_cost' AND p_sort_direction = 'desc' THEN payable_cost END DESC,
                    loading_date DESC, created_at DESC
                LIMIT p_page_size OFFSET v_offset
            ) fr
        ),
        'totalCount', (
            SELECT COUNT(*)
            FROM filtered_records
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- 3. 修复 parse_location_string 函数
CREATE OR REPLACE FUNCTION public.parse_location_string(location_string text)
RETURNS text[]
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF location_string IS NULL OR location_string = '' THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    RETURN string_to_array(location_string, '|');
END;
$$;

-- 4. 修复 update_sync_status 函数
CREATE OR REPLACE FUNCTION public.update_sync_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.sync_status = 'pending';
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 5. 修复 get_permission_sync_status 函数
CREATE OR REPLACE FUNCTION public.get_permission_sync_status()
RETURNS TABLE(
    total_users bigint,
    synced_users bigint,
    pending_users bigint,
    last_sync timestamp with time zone
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE sync_status = 'synced') as synced_users,
        COUNT(*) FILTER (WHERE sync_status = 'pending') as pending_users,
        MAX(updated_at) as last_sync
    FROM public.profiles;
END;
$$;

-- 6. 修复 monitor_permission_realtime 函数
CREATE OR REPLACE FUNCTION public.monitor_permission_realtime()
RETURNS TABLE(
    user_id uuid,
    permission_count bigint,
    last_updated timestamp with time zone
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.user_id,
        COUNT(*) as permission_count,
        MAX(up.updated_at) as last_updated
    FROM public.user_permissions up
    GROUP BY up.user_id
    ORDER BY last_updated DESC;
END;
$$;

-- 7. 修复 handle_role_template_change 函数
CREATE OR REPLACE FUNCTION public.handle_role_template_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
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
        COALESCE(NEW.user_id, OLD.user_id),
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'create'
            WHEN TG_OP = 'UPDATE' THEN 'modify'
            WHEN TG_OP = 'DELETE' THEN 'delete'
        END,
        'role_template',
        COALESCE(NEW.template_name, OLD.template_name),
        CASE WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        'Role template change via trigger',
        auth.uid()
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8. 修复 sync_user_permissions_with_role 函数
CREATE OR REPLACE FUNCTION public.sync_user_permissions_with_role(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_role_name text;
    v_template_permissions jsonb;
    v_permission_record record;
BEGIN
    -- 获取用户角色
    SELECT role INTO v_role_name
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF v_role_name IS NULL THEN
        RETURN false;
    END IF;
    
    -- 获取角色模板权限
    SELECT permissions INTO v_template_permissions
    FROM public.role_permission_templates
    WHERE template_name = v_role_name;
    
    IF v_template_permissions IS NULL THEN
        RETURN false;
    END IF;
    
    -- 删除用户现有权限
    DELETE FROM public.user_permissions
    WHERE user_id = p_user_id;
    
    -- 插入新权限
    FOR v_permission_record IN 
        SELECT key, value
        FROM jsonb_each(v_template_permissions)
    LOOP
        INSERT INTO public.user_permissions (
            user_id,
            permission_key,
            permission_value,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            v_permission_record.key,
            v_permission_record.value,
            NOW(),
            NOW()
        );
    END LOOP;
    
    -- 更新用户同步状态
    UPDATE public.profiles
    SET sync_status = 'synced', updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN true;
END;
$$;

-- 9. 修复 handle_user_permission_change 函数
CREATE OR REPLACE FUNCTION public.handle_user_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- 记录权限变更日志
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
        COALESCE(NEW.user_id, OLD.user_id),
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'grant'
            WHEN TG_OP = 'UPDATE' THEN 'modify'
            WHEN TG_OP = 'DELETE' THEN 'revoke'
        END,
        'user_permission',
        COALESCE(NEW.permission_key, OLD.permission_key),
        CASE WHEN TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END,
        'User permission change via trigger',
        auth.uid()
    );
    
    -- 更新用户同步状态
    UPDATE public.profiles
    SET sync_status = 'pending', updated_at = NOW()
    WHERE id = COALESCE(NEW.user_id, OLD.user_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 10. 修复 get_platform_usage_statistics 函数
CREATE OR REPLACE FUNCTION public.get_platform_usage_statistics()
RETURNS TABLE(
    platform_name text,
    usage_count bigint,
    last_used timestamp with time zone
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        platform_name,
        COUNT(*) as usage_count,
        MAX(created_at) as last_used
    FROM (
        SELECT unnest(other_platform_names) as platform_name, created_at
        FROM public.logistics_records
        WHERE other_platform_names IS NOT NULL
    ) platform_data
    GROUP BY platform_name
    ORDER BY usage_count DESC;
END;
$$;

-- 添加注释说明修复内容
COMMENT ON FUNCTION public.update_updated_at_column() IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.get_logistics_summary_and_records_enhanced(text, text, text, text, text, text, text, text, text, integer, integer, text, text) IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.parse_location_string(text) IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.update_sync_status() IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.get_permission_sync_status() IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.monitor_permission_realtime() IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.handle_role_template_change() IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.sync_user_permissions_with_role(uuid) IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.handle_user_permission_change() IS '修复了search_path安全问题';
COMMENT ON FUNCTION public.get_platform_usage_statistics() IS '修复了search_path安全问题';
