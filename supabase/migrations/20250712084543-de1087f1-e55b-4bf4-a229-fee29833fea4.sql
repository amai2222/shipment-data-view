-- 为projects表添加auto_code字段
ALTER TABLE public.projects ADD COLUMN auto_code text;

-- 创建项目自动编码生成函数
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    date_part TEXT;
    next_number INTEGER;
    padded_number TEXT;
BEGIN
    -- 提取日期部分 (YYYYMMDD格式)
    date_part := to_char(now(), 'YYYYMMDD');
    
    -- 获取当天的下一个序号
    SELECT COALESCE(MAX(CAST(RIGHT(auto_code, 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.projects
    WHERE auto_code LIKE date_part || '%';
    
    -- 补零到4位数
    padded_number := LPAD(next_number::TEXT, 4, '0');
    
    RETURN date_part || padded_number;
END;
$function$;

-- 创建触发器函数
CREATE OR REPLACE FUNCTION public.set_project_auto_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.auto_code IS NULL THEN
        NEW.auto_code := generate_project_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER trigger_set_project_auto_code
    BEFORE INSERT ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.set_project_auto_code();

-- 为现有项目生成编码
UPDATE public.projects 
SET auto_code = generate_project_code() 
WHERE auto_code IS NULL;