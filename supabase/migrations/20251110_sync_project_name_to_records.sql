-- ============================================================
-- 同步项目名称到运单记录
-- ============================================================
-- 创建时间: 2025-11-10
-- 功能: 当项目名称修改时，自动同步更新所有相关运单的项目名称
-- 问题: logistics_records 表中冗余存储了 project_name 字段，
--       修改 projects 表的 name 字段时不会自动同步
-- ============================================================

BEGIN;

-- ============================================================
-- 创建触发器函数：同步项目名称
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_project_name_to_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- 只有当项目名称发生变化时才执行同步
    IF OLD.name IS DISTINCT FROM NEW.name THEN
        
        RAISE NOTICE '项目名称变更: "%" → "%"', OLD.name, NEW.name;
        
        -- 更新所有使用该项目的运单记录
        UPDATE public.logistics_records
        SET project_name = NEW.name,
            updated_at = NOW()
        WHERE project_id = NEW.id
          AND project_name != NEW.name;  -- 只更新名称不一致的记录
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        
        RAISE NOTICE '已同步更新 % 条运单记录的项目名称', v_updated_count;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_project_name_to_records IS '当项目名称修改时，自动同步更新所有相关运单的项目名称';

-- ============================================================
-- 创建触发器
-- ============================================================

-- 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS trigger_sync_project_name ON public.projects;

-- 创建触发器（AFTER UPDATE）
CREATE TRIGGER trigger_sync_project_name
    AFTER UPDATE ON public.projects
    FOR EACH ROW
    WHEN (OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION public.sync_project_name_to_records();

COMMENT ON TRIGGER trigger_sync_project_name ON public.projects
    IS '项目名称变更时，自动同步更新所有相关运单的项目名称';

-- ============================================================
-- 手动同步函数（可选）：修复历史数据
-- ============================================================

CREATE OR REPLACE FUNCTION public.fix_inconsistent_project_names()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_total_records INTEGER := 0;
    v_fixed_records INTEGER := 0;
BEGIN
    -- 查找项目名称不一致的运单
    SELECT COUNT(*) INTO v_total_records
    FROM public.logistics_records lr
    INNER JOIN public.projects p ON lr.project_id = p.id
    WHERE lr.project_name != p.name;
    
    RAISE NOTICE '发现 % 条运单的项目名称不一致', v_total_records;
    
    -- 修复不一致的记录
    IF v_total_records > 0 THEN
        UPDATE public.logistics_records lr
        SET project_name = p.name,
            updated_at = NOW()
        FROM public.projects p
        WHERE lr.project_id = p.id
          AND lr.project_name != p.name;
        
        GET DIAGNOSTICS v_fixed_records = ROW_COUNT;
        
        RAISE NOTICE '已修复 % 条运单的项目名称', v_fixed_records;
    END IF;
    
    RETURN json_build_object(
        'total_inconsistent', v_total_records,
        'fixed_count', v_fixed_records,
        'message', format('发现 %s 条不一致记录，已修复 %s 条', v_total_records, v_fixed_records)
    );
END;
$$;

COMMENT ON FUNCTION public.fix_inconsistent_project_names IS '手动修复运单表中与项目表不一致的项目名称';

-- ============================================================
-- 立即修复历史数据
-- ============================================================

DO $$
DECLARE
    v_result JSON;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '开始修复历史数据中的项目名称不一致问题';
    RAISE NOTICE '========================================';
    
    -- 调用修复函数
    v_result := public.fix_inconsistent_project_names();
    
    RAISE NOTICE '修复结果: %', v_result->>'message';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================
-- 验证安装
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '项目名称同步功能安装完成';
    RAISE NOTICE '';
    RAISE NOTICE '已创建：';
    RAISE NOTICE '  1. ✓ 触发器函数: sync_project_name_to_records()';
    RAISE NOTICE '  2. ✓ 触发器: trigger_sync_project_name';
    RAISE NOTICE '  3. ✓ 手动修复函数: fix_inconsistent_project_names()';
    RAISE NOTICE '';
    RAISE NOTICE '功能说明：';
    RAISE NOTICE '  - 修改项目名称时，自动同步更新所有相关运单';
    RAISE NOTICE '  - 已自动修复历史数据中的不一致问题';
    RAISE NOTICE '';
    RAISE NOTICE '手动修复命令（如需要）：';
    RAISE NOTICE '  SELECT fix_inconsistent_project_names();';
    RAISE NOTICE '========================================';
END $$;

