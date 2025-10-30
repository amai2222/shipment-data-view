-- ============================================================
-- 快速添加 updated_at 字段脚本（简化版）
-- 特点：安全、快速、不影响现有程序运行
-- ============================================================

-- 1. 创建通用触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 为所有表安全添加 updated_at 字段和触发器
DO $$
DECLARE
    table_record RECORD;
    column_exists BOOLEAN;
    sql_command TEXT;
BEGIN
    -- 遍历所有用户表
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    LOOP
        -- 检查是否有 updated_at 字段
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = table_record.schemaname 
            AND table_name = table_record.tablename 
            AND column_name = 'updated_at'
        ) INTO column_exists;
        
        -- 如果没有，则添加
        IF NOT column_exists THEN
            -- 添加字段
            EXECUTE format('ALTER TABLE %I.%I ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()', 
                          table_record.schemaname, table_record.tablename);
            
            -- 为现有记录设置值
            EXECUTE format('UPDATE %I.%I SET updated_at = NOW() WHERE updated_at IS NULL', 
                          table_record.schemaname, table_record.tablename);
            
            RAISE NOTICE '已为表 % 添加 updated_at 字段', table_record.tablename;
        END IF;
        
        -- 为所有表创建/更新触发器
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I.%I', 
                      table_record.tablename, table_record.schemaname, table_record.tablename);
        
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 
                      table_record.tablename, table_record.schemaname, table_record.tablename);
        
        RAISE NOTICE '已为表 % 配置 updated_at 触发器', table_record.tablename;
    END LOOP;
    
    RAISE NOTICE '所有表的 updated_at 字段配置完成！';
END $$;

-- 3. 添加函数注释
COMMENT ON FUNCTION public.update_updated_at_column IS '自动更新 updated_at 列的通用触发器函数';

-- 完成
SELECT 'updated_at 字段快速添加完成！' AS result;
