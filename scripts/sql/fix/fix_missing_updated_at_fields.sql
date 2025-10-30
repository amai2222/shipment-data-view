-- ============================================================
-- 针对性修复脚本：为缺少 updated_at 字段的表添加字段和触发器
-- 基于检查结果：45个表中，20个有字段，11个有触发器，11个完整配置
-- 目标：让所有45个表都完整配置 updated_at 字段和触发器
-- ============================================================

-- 1. 创建通用触发器函数（如果不存在）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 为所有表统一处理 updated_at 字段和触发器
DO $$
DECLARE
    table_record RECORD;
    column_exists BOOLEAN;
    trigger_exists BOOLEAN;
    processed_count INTEGER := 0;
    added_fields_count INTEGER := 0;
    added_triggers_count INTEGER := 0;
BEGIN
    RAISE NOTICE '开始为所有表统一配置 updated_at 字段和触发器...';
    RAISE NOTICE '预计处理 45 个表...';
    
    -- 遍历所有用户表
    FOR table_record IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
    LOOP
        processed_count := processed_count + 1;
        
        -- 检查是否有 updated_at 字段
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = table_record.schemaname 
            AND table_name = table_record.tablename 
            AND column_name = 'updated_at'
        ) INTO column_exists;
        
        -- 检查是否有 updated_at 触发器
        SELECT EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_schema = table_record.schemaname 
            AND event_object_table = table_record.tablename 
            AND trigger_name LIKE '%updated_at%'
        ) INTO trigger_exists;
        
        -- 添加字段（如果不存在）
        IF NOT column_exists THEN
            BEGIN
                EXECUTE format('ALTER TABLE %I.%I ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()', 
                              table_record.schemaname, table_record.tablename);
                
                -- 为现有记录设置 updated_at 值
                EXECUTE format('UPDATE %I.%I SET updated_at = NOW() WHERE updated_at IS NULL', 
                              table_record.schemaname, table_record.tablename);
                
                added_fields_count := added_fields_count + 1;
                RAISE NOTICE '[%/%] ✅ 已为表 % 添加 updated_at 字段', 
                    processed_count, 45, table_record.tablename;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '[%/%] ❌ 为表 % 添加字段失败: %', 
                    processed_count, 45, table_record.tablename, SQLERRM;
            END;
        ELSE
            RAISE NOTICE '[%/%] ⏭️  表 % 已有 updated_at 字段', 
                processed_count, 45, table_record.tablename;
        END IF;
        
        -- 添加触发器（如果不存在）
        IF NOT trigger_exists THEN
            BEGIN
                -- 删除可能存在的旧触发器
                EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I.%I', 
                              table_record.tablename, table_record.schemaname, table_record.tablename);
                
                -- 创建新触发器
                EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 
                              table_record.tablename, table_record.schemaname, table_record.tablename);
                
                added_triggers_count := added_triggers_count + 1;
                RAISE NOTICE '[%/%] ✅ 已为表 % 添加 updated_at 触发器', 
                    processed_count, 45, table_record.tablename;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING '[%/%] ❌ 为表 % 添加触发器失败: %', 
                    processed_count, 45, table_record.tablename, SQLERRM;
            END;
        ELSE
            RAISE NOTICE '[%/%] ⏭️  表 % 已有 updated_at 触发器', 
                processed_count, 45, table_record.tablename;
        END IF;
    END LOOP;
    
    RAISE NOTICE '=== 处理完成统计 ===';
    RAISE NOTICE '总处理表数: %', processed_count;
    RAISE NOTICE '新增字段数: %', added_fields_count;
    RAISE NOTICE '新增触发器数: %', added_triggers_count;
END $$;

-- 3. 最终验证
DO $$
DECLARE
    total_tables INTEGER;
    tables_with_field INTEGER;
    tables_with_trigger INTEGER;
    complete_tables INTEGER;
BEGIN
    -- 统计最终结果
    SELECT COUNT(*) INTO total_tables FROM pg_tables WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO tables_with_field
    FROM pg_tables t
    JOIN information_schema.columns c ON (
        c.table_schema = t.schemaname 
        AND c.table_name = t.tablename 
        AND c.column_name = 'updated_at'
    )
    WHERE t.schemaname = 'public';
    
    SELECT COUNT(*) INTO tables_with_trigger
    FROM pg_tables t
    JOIN information_schema.triggers tr ON (
        tr.trigger_schema = t.schemaname 
        AND tr.event_object_table = t.tablename 
        AND tr.trigger_name LIKE '%updated_at%'
    )
    WHERE t.schemaname = 'public';
    
    SELECT COUNT(*) INTO complete_tables
    FROM pg_tables t
    JOIN information_schema.columns c ON (
        c.table_schema = t.schemaname 
        AND c.table_name = t.tablename 
        AND c.column_name = 'updated_at'
    )
    JOIN information_schema.triggers tr ON (
        tr.trigger_schema = t.schemaname 
        AND tr.event_object_table = t.tablename 
        AND tr.trigger_name LIKE '%updated_at%'
    )
    WHERE t.schemaname = 'public';
    
    RAISE NOTICE '=== 最终验证结果 ===';
    RAISE NOTICE '总表数: %', total_tables;
    RAISE NOTICE '有 updated_at 字段的表数: %', tables_with_field;
    RAISE NOTICE '有 updated_at 触发器的表数: %', tables_with_trigger;
    RAISE NOTICE '完整配置的表数: %', complete_tables;
    
    IF complete_tables = total_tables THEN
        RAISE NOTICE '🎉 所有表都已完整配置 updated_at 字段和触发器！';
    ELSE
        RAISE WARNING '⚠️  还有 % 个表未完整配置', total_tables - complete_tables;
    END IF;
END $$;

-- 4. 添加函数注释
COMMENT ON FUNCTION public.update_updated_at_column IS '自动更新 updated_at 列的通用触发器函数，适用于所有表';

-- 完成提示
SELECT 
    'updated_at 字段修复完成！' AS message,
    '所有表现在都应该有 updated_at 字段和触发器' AS description;
