-- 紧急修复：彻底清理所有 permission_change_log 表的引用
-- 这个脚本会删除所有可能引用这个表的对象

-- 1. 删除所有可能引用 permission_change_log 的函数
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_definition LIKE '%permission_change_log%'
        AND routine_schema = 'public'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.routine_name || ' CASCADE';
        RAISE NOTICE 'Deleted function: %', func_record.routine_name;
    END LOOP;
END $$;

-- 2. 删除所有可能引用 permission_change_log 的视图
DO $$
DECLARE
    view_record RECORD;
BEGIN
    FOR view_record IN 
        SELECT table_name 
        FROM information_schema.views 
        WHERE view_definition LIKE '%permission_change_log%'
        AND table_schema = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || view_record.table_name || ' CASCADE';
        RAISE NOTICE 'Deleted view: %', view_record.table_name;
    END LOOP;
END $$;

-- 3. 删除所有可能引用 permission_change_log 的触发器
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE action_statement LIKE '%permission_change_log%'
        AND trigger_schema = 'public'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON public.' || trigger_record.event_object_table || ' CASCADE';
        RAISE NOTICE 'Deleted trigger: %', trigger_record.trigger_name;
    END LOOP;
END $$;

-- 4. 删除所有可能引用 permission_change_log 的索引
DO $$
DECLARE
    index_record RECORD;
BEGIN
    FOR index_record IN 
        SELECT indexname, tablename
        FROM pg_indexes 
        WHERE indexdef LIKE '%permission_change_log%'
        AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || index_record.indexname || ' CASCADE';
        RAISE NOTICE 'Deleted index: %', index_record.indexname;
    END LOOP;
END $$;

-- 5. 删除所有可能引用 permission_change_log 的序列
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN 
        SELECT sequence_name
        FROM information_schema.sequences 
        WHERE sequence_name LIKE '%permission_change_log%'
        AND sequence_schema = 'public'
    LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || seq_record.sequence_name || ' CASCADE';
        RAISE NOTICE 'Deleted sequence: %', seq_record.sequence_name;
    END LOOP;
END $$;

-- 6. 最后再次删除表（确保彻底删除）
DROP TABLE IF EXISTS public.permission_change_log CASCADE;

-- 7. 验证清理结果
SELECT 
  'Cleanup completed' as status,
  'All permission_change_log references have been removed' as message;

-- 8. 显示剩余的权限相关表
SELECT 
  'Remaining permission tables' as category,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%permission%' 
    OR table_name LIKE '%audit%'
    OR table_name LIKE '%role%'
  )
ORDER BY table_name;
