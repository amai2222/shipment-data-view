-- ============================================================
-- 快速修复脚本：基于您的检查结果
-- 当前状态：45个表，20个有字段，11个有触发器，11个完整配置
-- 目标：让所有45个表都完整配置
-- ============================================================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- 一键修复所有表
DO $$
DECLARE
    table_record RECORD;
    processed INTEGER := 0;
BEGIN
    FOR table_record IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
        processed := processed + 1;
        
        -- 添加字段（如果不存在）
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()', 
                      table_record.schemaname, table_record.tablename);
        
        -- 为现有记录设置值
        EXECUTE format('UPDATE %I.%I SET updated_at = NOW() WHERE updated_at IS NULL', 
                      table_record.schemaname, table_record.tablename);
        
        -- 删除旧触发器
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I.%I', 
                      table_record.tablename, table_record.schemaname, table_record.tablename);
        
        -- 创建新触发器
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 
                      table_record.tablename, table_record.schemaname, table_record.tablename);
        
        RAISE NOTICE '[%/%] 已处理表: %', processed, 45, table_record.tablename;
    END LOOP;
    
    RAISE NOTICE '✅ 所有45个表已处理完成！';
END $$;

-- 验证结果
SELECT 
    '修复完成！' AS status,
    COUNT(*) AS "总表数",
    COUNT(CASE WHEN c.column_name IS NOT NULL THEN 1 END) AS "有字段数",
    COUNT(CASE WHEN tr.trigger_name IS NOT NULL THEN 1 END) AS "有触发器数",
    COUNT(CASE WHEN c.column_name IS NOT NULL AND tr.trigger_name IS NOT NULL THEN 1 END) AS "完整配置数"
FROM pg_tables t
LEFT JOIN information_schema.columns c ON (c.table_schema = t.schemaname AND c.table_name = t.tablename AND c.column_name = 'updated_at')
LEFT JOIN information_schema.triggers tr ON (tr.trigger_schema = t.schemaname AND tr.event_object_table = t.tablename AND tr.trigger_name LIKE '%updated_at%')
WHERE t.schemaname = 'public';
