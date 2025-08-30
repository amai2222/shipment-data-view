-- 创建用于根据邮箱查找用户ID的RPC函数
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id uuid;
BEGIN
    -- 从 auth.users 表中查找用户ID
    SELECT au.id INTO user_id
    FROM auth.users au
    WHERE au.email = p_email;
    
    RETURN user_id;
END;
$$;