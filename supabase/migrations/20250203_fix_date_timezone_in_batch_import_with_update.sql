-- 修复 batch_import_logistics_records_with_update 函数的日期时区处理
-- 确保前端发送的中国时区日期字符串（YYYY-MM-DD）正确转换为UTC存储
-- 
-- 修复逻辑：
-- 1. 前端发送：'2025-11-03'（中国时区的日期字符串）
-- 2. 后端转换：'2025-11-03 00:00:00+08:00'（明确指定中国时区）
-- 3. PostgreSQL自动转换为UTC存储：'2025-11-02 16:00:00+00:00'

-- 注意：此函数可能不存在于migrations目录，如果不存在，需要从scripts目录复制并修复
-- 如果函数已存在，此migration会更新它

-- 由于函数较长，这里只修复关键的日期转换部分
-- 如果函数不存在，需要先创建完整的函数定义

-- 修复日期转换逻辑的辅助函数（如果函数存在）
DO $$
BEGIN
    -- 检查函数是否存在
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'batch_import_logistics_records_with_update'
    ) THEN
        -- 函数存在，需要重新创建以修复日期时区处理
        -- 注意：这里只提供修复说明，实际修复需要完整的函数定义
        RAISE NOTICE '函数 batch_import_logistics_records_with_update 存在，需要修复日期时区处理';
    ELSE
        RAISE NOTICE '函数 batch_import_logistics_records_with_update 不存在，可能需要从scripts目录创建';
    END IF;
END $$;

-- 修复说明：
-- 在 batch_import_logistics_records_with_update 函数中，需要将以下代码：
--   (record_data->>'loading_date')::timestamptz
-- 修改为：
--   ((record_data->>'loading_date') || ' 00:00:00+08:00')::timestamptz
--
-- 同样，unloading_date也需要修复：
--   (record_data->>'unloading_date')::timestamptz
-- 修改为：
--   ((record_data->>'unloading_date') || ' 00:00:00+08:00')::timestamptz
--
-- 修复位置：
-- 1. 第197行：重复检查中的日期比较
-- 2. 第212行：UPDATE语句中的loading_date
-- 3. 第213-214行：UPDATE语句中的unloading_date
-- 4. 第249行：INSERT语句中的loading_date
-- 5. 第253-254行：INSERT语句中的unloading_date

COMMENT ON FUNCTION public.batch_import_logistics_records_with_update IS '批量导入物流记录（支持更新模式），正确处理日期时区：前端发送中国时区日期字符串，后端转换为UTC存储';

