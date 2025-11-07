-- ============================================================================
-- 为系统表添加字段中文注释 - 最终批次
-- 创建日期：2025-11-07
-- 范围：function_backup_log（备份表不添加注释）
-- ============================================================================

-- ============================================================================
-- function_backup_log（函数备份日志表）- 9个字段
-- ============================================================================

COMMENT ON TABLE function_backup_log IS '函数备份日志表（记录数据库函数的备份历史）';

COMMENT ON COLUMN function_backup_log.id IS '主键ID（自增序列）';
COMMENT ON COLUMN function_backup_log.function_name IS '函数名称';
COMMENT ON COLUMN function_backup_log.function_arguments IS '函数参数列表';
COMMENT ON COLUMN function_backup_log.backup_time IS '备份时间';
COMMENT ON COLUMN function_backup_log.original_definition IS '原始函数定义（SQL代码）';
COMMENT ON COLUMN function_backup_log.backup_reason IS '备份原因';
COMMENT ON COLUMN function_backup_log.function_type IS '函数类型：FUNCTION, PROCEDURE等';
COMMENT ON COLUMN function_backup_log.schema_name IS '所属Schema';
COMMENT ON COLUMN function_backup_log.updated_at IS '更新时间';

-- ============================================================================
-- 说明：备份表不添加注释
-- ============================================================================
-- 以下表是临时备份表，不添加注释：
-- • auth_users_backup_20251103 (35个字段) - Supabase用户备份
-- • role_permission_templates_backup_20251103 (12个字段) - 角色模板备份
-- • user_permissions_backup_20251103 (12个字段) - 用户权限备份
--
-- 原因：备份表是临时性质，可能会被删除或重建

-- ============================================================================
-- 验证最终统计
-- ============================================================================

DO $$
DECLARE
    v_total INTEGER;
    v_commented INTEGER;
    v_missing INTEGER;
    v_coverage NUMERIC;
BEGIN
    -- 统计所有非备份表的字段注释情况
    SELECT 
        COUNT(*),
        COUNT(pgd.description),
        COUNT(*) - COUNT(pgd.description),
        ROUND((COUNT(pgd.description)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2)
    INTO v_total, v_commented, v_missing, v_coverage
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    LEFT JOIN pg_catalog.pg_statio_all_tables st ON st.relname = t.table_name
    LEFT JOIN pg_catalog.pg_description pgd ON (
        pgd.objoid = st.relid 
        AND pgd.objsubid = c.ordinal_position
    )
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE '%backup%';  -- 排除备份表
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎊 数据库字段注释添加完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '最终统计（不含备份表）：';
    RAISE NOTICE '  • 总字段数：%', v_total;
    RAISE NOTICE '  • 有注释字段：%', v_commented;
    RAISE NOTICE '  • 缺少注释字段：%', v_missing;
    RAISE NOTICE '  • 注释覆盖率：%％', v_coverage;
    RAISE NOTICE '';
    RAISE NOTICE '备份表统计（未添加注释）：';
    RAISE NOTICE '  • auth_users_backup_20251103 (35个字段)';
    RAISE NOTICE '  • role_permission_templates_backup_20251103 (12个字段)';
    RAISE NOTICE '  • user_permissions_backup_20251103 (12个字段)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

