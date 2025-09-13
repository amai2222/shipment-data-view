-- 紧急修复：将 external_tracking_numbers 字段从 JSONB 迁移到 TEXT[]
-- 解决导入时的类型不匹配错误

-- 1. 检查当前字段类型
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
  AND column_name = 'external_tracking_numbers';

-- 2. 检查并完成迁移到 TEXT[]
DO $$
BEGIN
    -- 检查是否已经存在 external_tracking_numbers_new 字段
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
          AND column_name = 'external_tracking_numbers_new'
    ) THEN
        -- 如果新字段已存在，完成迁移过程
        RAISE NOTICE 'external_tracking_numbers_new field already exists, completing migration...';
        
        -- 迁移数据：将 JSONB 数组转换为 TEXT[] 数组（如果还没有迁移）
        UPDATE public.logistics_records 
        SET external_tracking_numbers_new = (
            SELECT array_agg(value::text) 
            FROM jsonb_array_elements_text(external_tracking_numbers)
            WHERE value::text != ''
        )
        WHERE external_tracking_numbers IS NOT NULL 
          AND external_tracking_numbers != '[]'::jsonb
          AND external_tracking_numbers_new IS NULL;
        
        -- 删除依赖的视图
        DROP VIEW IF EXISTS public.logistics_records_with_external_tracking CASCADE;
        DROP VIEW IF EXISTS public.logistics_records_with_platforms CASCADE;
        
        -- 删除旧的 JSONB 字段
        ALTER TABLE public.logistics_records DROP COLUMN IF EXISTS external_tracking_numbers;
        
        -- 重命名新字段
        ALTER TABLE public.logistics_records RENAME COLUMN external_tracking_numbers_new TO external_tracking_numbers;
        
        -- 重新创建索引
        DROP INDEX IF EXISTS idx_logistics_records_external_tracking;
        CREATE INDEX IF NOT EXISTS idx_logistics_records_external_tracking 
        ON public.logistics_records USING GIN (external_tracking_numbers);
        
        -- 重新创建视图（适配 TEXT[] 类型）
        CREATE OR REPLACE VIEW public.logistics_records_with_external_tracking AS
        SELECT 
            lr.*,
            CASE 
                WHEN lr.external_tracking_numbers IS NOT NULL AND array_length(lr.external_tracking_numbers, 1) > 0 
                THEN true 
                ELSE false 
            END as has_external_tracking
        FROM public.logistics_records lr;
        
        CREATE OR REPLACE VIEW public.logistics_records_with_platforms AS
        SELECT 
            lr.*,
            CASE 
                WHEN lr.other_platform_names IS NOT NULL AND array_length(lr.other_platform_names, 1) > 0 
                THEN true 
                ELSE false 
            END as has_platforms
        FROM public.logistics_records lr;
        
        RAISE NOTICE 'Successfully completed migration from JSONB to TEXT[]';
        
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'logistics_records' 
          AND column_name = 'external_tracking_numbers'
          AND data_type = 'jsonb'
    ) THEN
        -- 如果原字段是 JSONB，开始新的迁移
        RAISE NOTICE 'Starting migration from JSONB to TEXT[]...';
        
        -- 添加新的 TEXT[] 字段
        ALTER TABLE public.logistics_records ADD COLUMN external_tracking_numbers_new TEXT[] DEFAULT '{}';
        
        -- 迁移数据：将 JSONB 数组转换为 TEXT[] 数组
        UPDATE public.logistics_records 
        SET external_tracking_numbers_new = (
            SELECT array_agg(value::text) 
            FROM jsonb_array_elements_text(external_tracking_numbers)
            WHERE value::text != ''
        )
        WHERE external_tracking_numbers IS NOT NULL 
          AND external_tracking_numbers != '[]'::jsonb;
        
        -- 删除依赖的视图
        DROP VIEW IF EXISTS public.logistics_records_with_external_tracking CASCADE;
        DROP VIEW IF EXISTS public.logistics_records_with_platforms CASCADE;
        
        -- 删除旧的 JSONB 字段
        ALTER TABLE public.logistics_records DROP COLUMN external_tracking_numbers;
        
        -- 重命名新字段
        ALTER TABLE public.logistics_records RENAME COLUMN external_tracking_numbers_new TO external_tracking_numbers;
        
        -- 重新创建索引
        DROP INDEX IF EXISTS idx_logistics_records_external_tracking;
        CREATE INDEX IF NOT EXISTS idx_logistics_records_external_tracking 
        ON public.logistics_records USING GIN (external_tracking_numbers);
        
        -- 重新创建视图（适配 TEXT[] 类型）
        CREATE OR REPLACE VIEW public.logistics_records_with_external_tracking AS
        SELECT 
            lr.*,
            CASE 
                WHEN lr.external_tracking_numbers IS NOT NULL AND array_length(lr.external_tracking_numbers, 1) > 0 
                THEN true 
                ELSE false 
            END as has_external_tracking
        FROM public.logistics_records lr;
        
        CREATE OR REPLACE VIEW public.logistics_records_with_platforms AS
        SELECT 
            lr.*,
            CASE 
                WHEN lr.other_platform_names IS NOT NULL AND array_length(lr.other_platform_names, 1) > 0 
                THEN true 
                ELSE false 
            END as has_platforms
        FROM public.logistics_records lr;
        
        RAISE NOTICE 'Successfully migrated external_tracking_numbers from JSONB to TEXT[]';
    ELSE
        RAISE NOTICE 'external_tracking_numbers field is already TEXT[] or does not exist';
    END IF;
END $$;

-- 3. 验证迁移结果
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
  AND column_name = 'external_tracking_numbers';

-- 4. 测试数据格式
SELECT 
    auto_number,
    external_tracking_numbers,
    array_length(external_tracking_numbers, 1) as array_length
FROM logistics_records 
WHERE external_tracking_numbers IS NOT NULL 
  AND array_length(external_tracking_numbers, 1) > 0
ORDER BY created_at DESC
LIMIT 5;
