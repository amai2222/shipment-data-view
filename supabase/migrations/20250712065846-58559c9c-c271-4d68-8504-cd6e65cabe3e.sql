-- 修复 generate_auto_number 函数的安全问题，设置固定的搜索路径
CREATE OR REPLACE FUNCTION public.generate_auto_number(loading_date_input text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;