-- 修复 set_project_auto_code 函数的安全问题，设置固定的搜索路径
CREATE OR REPLACE FUNCTION public.set_project_auto_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    IF NEW.auto_code IS NULL THEN
        NEW.auto_code := generate_project_code();
    END IF;
    RETURN NEW;
END;
$function$;