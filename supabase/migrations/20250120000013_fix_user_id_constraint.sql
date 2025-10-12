-- 修复司机项目关联功能中的user_id字段问题
-- 文件: supabase/migrations/20250120000013_fix_user_id_constraint.sql

-- 重新创建批量关联函数，添加user_id字段
CREATE OR REPLACE FUNCTION public.batch_associate_driver_projects(
    p_driver_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
    v_updated_count integer := 0;
    v_skipped_count integer := 0;
    driver_info RECORD;
    v_project_id uuid; -- 明确指定变量名，避免与字段名冲突
    v_current_user_id uuid;
BEGIN
    -- 获取当前用户ID
    v_current_user_id := auth.uid();
    
    -- 检查用户是否已登录
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION '用户未登录，无法执行批量关联操作';
    END IF;

    -- 查找每个司机对应的项目
    FOR driver_info IN 
        SELECT * FROM public.find_driver_projects(p_driver_ids)
    LOOP
        -- 如果找到项目，在driver_projects表中创建关联
        IF array_length(driver_info.project_ids, 1) > 0 THEN
            -- 先删除该司机的现有项目关联
            DELETE FROM public.driver_projects 
            WHERE driver_id = driver_info.driver_id;
            
            -- 插入新的项目关联，包含user_id
            FOREACH v_project_id IN ARRAY driver_info.project_ids
            LOOP
                INSERT INTO public.driver_projects (driver_id, project_id, user_id)
                VALUES (driver_info.driver_id, v_project_id, v_current_user_id)
                ON CONFLICT (driver_id, project_id) DO NOTHING;
            END LOOP;
            
            v_updated_count := v_updated_count + 1;
        ELSE
            v_skipped_count := v_skipped_count + 1;
        END IF;
    END LOOP;

    -- 返回结果
    SELECT jsonb_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'skipped_count', v_skipped_count,
        'total_processed', array_length(p_driver_ids, 1),
        'message', format('成功更新 %s 个司机的项目关联，跳过 %s 个未找到项目的司机', v_updated_count, v_skipped_count)
    ) INTO v_result;

    RETURN v_result;
END;
$function$;
