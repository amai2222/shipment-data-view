-- ============================================================
-- 安全检查和添加 updated_at 字段的完整脚本
-- 功能：检查所有表，为缺少 updated_at 字段的表安全添加该字段
-- 特点：使用 IF NOT EXISTS 确保安全，不影响现有程序运行
-- ============================================================

-- 1. 首先检查当前数据库中所有表的情况
DO $$
DECLARE
    table_record RECORD;
    column_exists BOOLEAN;
    tables_without_updated_at TEXT[] := '{}';
    tables_with_updated_at TEXT[] := '{}';
BEGIN
    RAISE NOTICE '开始检查所有表的 updated_at 字段情况...';
    
    -- 遍历所有用户表（排除系统表）
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    LOOP
        -- 检查该表是否有 updated_at 字段
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = table_record.schemaname 
            AND table_name = table_record.tablename 
            AND column_name = 'updated_at'
        ) INTO column_exists;
        
        IF column_exists THEN
            tables_with_updated_at := array_append(tables_with_updated_at, table_record.tablename);
            RAISE NOTICE '表 % 已有 updated_at 字段', table_record.tablename;
        ELSE
            tables_without_updated_at := array_append(tables_without_updated_at, table_record.tablename);
            RAISE NOTICE '表 % 缺少 updated_at 字段', table_record.tablename;
        END IF;
    END LOOP;
    
    RAISE NOTICE '检查完成！';
    RAISE NOTICE '已有 updated_at 字段的表: %', array_to_string(tables_with_updated_at, ', ');
    RAISE NOTICE '缺少 updated_at 字段的表: %', array_to_string(tables_without_updated_at, ', ');
END $$;

-- 2. 为缺少 updated_at 字段的表安全添加该字段
DO $$
DECLARE
    table_record RECORD;
    column_exists BOOLEAN;
    sql_command TEXT;
BEGIN
    RAISE NOTICE '开始为缺少 updated_at 字段的表添加该字段...';
    
    -- 遍历所有用户表
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    LOOP
        -- 检查该表是否有 updated_at 字段
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = table_record.schemaname 
            AND table_name = table_record.tablename 
            AND column_name = 'updated_at'
        ) INTO column_exists;
        
        -- 如果没有 updated_at 字段，则添加
        IF NOT column_exists THEN
            sql_command := format('ALTER TABLE %I.%I ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()', 
                                table_record.schemaname, table_record.tablename);
            
            BEGIN
                EXECUTE sql_command;
                RAISE NOTICE '成功为表 % 添加 updated_at 字段', table_record.tablename;
                
                -- 为现有记录设置 updated_at 值
                sql_command := format('UPDATE %I.%I SET updated_at = NOW() WHERE updated_at IS NULL', 
                                    table_record.schemaname, table_record.tablename);
                EXECUTE sql_command;
                RAISE NOTICE '已为表 % 的现有记录设置 updated_at 值', table_record.tablename;
                
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '为表 % 添加 updated_at 字段失败: %', table_record.tablename, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'updated_at 字段添加完成！';
END $$;

-- 3. 为所有表创建或更新 updated_at 触发器
DO $$
DECLARE
    table_record RECORD;
    trigger_exists BOOLEAN;
    sql_command TEXT;
BEGIN
    RAISE NOTICE '开始为所有表创建 updated_at 触发器...';
    
    -- 确保触发器函数存在
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- 为每个表创建触发器
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    LOOP
        -- 检查该表是否有 updated_at 字段
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = table_record.schemaname 
            AND table_name = table_record.tablename 
            AND column_name = 'updated_at'
        ) THEN
            -- 删除现有触发器（如果存在）
            sql_command := format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I.%I', 
                                table_record.tablename, table_record.schemaname, table_record.tablename);
            EXECUTE sql_command;
            
            -- 创建新触发器
            sql_command := format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 
                                table_record.tablename, table_record.schemaname, table_record.tablename);
            EXECUTE sql_command;
            
            RAISE NOTICE '成功为表 % 创建 updated_at 触发器', table_record.tablename;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'updated_at 触发器创建完成！';
END $$;

-- 4. 最终验证和报告
DO $$
DECLARE
    table_record RECORD;
    column_exists BOOLEAN;
    trigger_exists BOOLEAN;
    total_tables INTEGER := 0;
    tables_with_updated_at INTEGER := 0;
    tables_with_trigger INTEGER := 0;
BEGIN
    RAISE NOTICE '开始最终验证...';
    
    -- 统计所有表
    SELECT COUNT(*) INTO total_tables FROM pg_tables WHERE schemaname = 'public';
    
    -- 遍历所有表进行最终检查
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    LOOP
        -- 检查 updated_at 字段
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = table_record.schemaname 
            AND table_name = table_record.tablename 
            AND column_name = 'updated_at'
        ) INTO column_exists;
        
        IF column_exists THEN
            tables_with_updated_at := tables_with_updated_at + 1;
        END IF;
        
        -- 检查触发器
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.triggers 
            WHERE trigger_schema = table_record.schemaname 
            AND event_object_table = table_record.tablename 
            AND trigger_name LIKE '%updated_at%'
        ) INTO trigger_exists;
        
        IF trigger_exists THEN
            tables_with_trigger := tables_with_trigger + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '=== 最终验证报告 ===';
    RAISE NOTICE '总表数: %', total_tables;
    RAISE NOTICE '有 updated_at 字段的表数: %', tables_with_updated_at;
    RAISE NOTICE '有 updated_at 触发器的表数: %', tables_with_trigger;
    
    IF tables_with_updated_at = total_tables AND tables_with_trigger = total_tables THEN
        RAISE NOTICE '✅ 所有表都已正确配置 updated_at 字段和触发器！';
    ELSE
        RAISE WARNING '⚠️  部分表可能未正确配置，请检查上述报告';
    END IF;
END $$;

-- 5. 添加注释
COMMENT ON FUNCTION public.update_updated_at_column IS '自动更新 updated_at 列的通用触发器函数，适用于所有表';

-- 完成提示
SELECT 'updated_at 字段检查和添加脚本执行完成！' AS result;
