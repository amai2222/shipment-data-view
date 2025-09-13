-- 添加 platform_trackings 字段到 logistics_records 表
-- 这个脚本会添加平台运单信息字段，支持存储多个平台和对应的运单号

-- 1. 添加 platform_trackings 字段
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS platform_trackings JSONB[] DEFAULT '{}'::JSONB[];

-- 2. 添加字段注释
COMMENT ON COLUMN public.logistics_records.platform_trackings IS '其他平台运单信息数组，每个元素包含平台名称和该平台的运单号列表';

-- 3. 创建GIN索引以提高JSONB数组查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_platform_trackings 
ON public.logistics_records USING GIN (platform_trackings);

-- 4. 验证字段是否添加成功
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'logistics_records' 
  AND column_name = 'platform_trackings'
  AND table_schema = 'public';

-- 5. 显示添加完成信息
SELECT 'platform_trackings 字段添加完成' as status;
