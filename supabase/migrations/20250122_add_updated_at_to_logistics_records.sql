-- 为 logistics_records 表添加 updated_at 列
-- 这样可以解决所有相关函数的 updated_at 列引用问题

-- 添加 updated_at 列
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 为现有记录设置 updated_at 值
UPDATE public.logistics_records 
SET updated_at = NOW() 
WHERE updated_at IS NULL;

-- 创建触发器函数，自动更新 updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_logistics_records_updated_at ON public.logistics_records;
CREATE TRIGGER update_logistics_records_updated_at
    BEFORE UPDATE ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 添加注释
COMMENT ON COLUMN public.logistics_records.updated_at IS '记录最后更新时间，自动维护';
COMMENT ON FUNCTION public.update_updated_at_column IS '自动更新 updated_at 列的触发器函数';
