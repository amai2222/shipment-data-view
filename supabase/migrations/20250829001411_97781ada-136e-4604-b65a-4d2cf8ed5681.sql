-- 创建一个安全的函数来通过邮箱查找用户ID
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_uuid uuid;
BEGIN
    -- 从 auth.users 表中查找用户
    SELECT id INTO user_uuid
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;
    
    RETURN user_uuid;
END;
$$;