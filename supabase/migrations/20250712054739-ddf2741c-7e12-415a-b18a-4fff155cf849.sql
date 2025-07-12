-- 修改logistics_records表，将loading_time改为loading_date
ALTER TABLE public.logistics_records 
RENAME COLUMN loading_time TO loading_date;

-- 创建函数来生成基于日期的自动编号
CREATE OR REPLACE FUNCTION generate_auto_number(loading_date_input TEXT)
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    next_number INTEGER;
    padded_number TEXT;
BEGIN
    -- 提取日期部分 (YYYYMMDD格式)
    date_part := to_char(to_date(loading_date_input, 'YYYY-MM-DD'), 'YYYYMMDD');
    
    -- 获取当天的下一个序号
    SELECT COALESCE(MAX(CAST(RIGHT(auto_number, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.logistics_records
    WHERE auto_number LIKE date_part || '%';
    
    -- 补零到4位数
    padded_number := LPAD(next_number::TEXT, 4, '0');
    
    RETURN date_part || padded_number;
END;
$$ LANGUAGE plpgsql;

-- 更新现有记录的auto_number格式
UPDATE public.logistics_records 
SET auto_number = generate_auto_number(loading_date)
WHERE loading_date IS NOT NULL;