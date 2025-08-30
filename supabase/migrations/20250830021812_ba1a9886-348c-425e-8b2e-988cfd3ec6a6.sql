-- 修复 get_user_id_by_email 函数，使其能够正确访问 auth.users 表
DROP FUNCTION IF EXISTS public.get_user_id_by_email(text);

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
-- 设置搜索路径包含 auth 模式
SET search_path = auth, public
AS $$
DECLARE
    user_id uuid;
BEGIN
    -- 从 auth.users 表中查找用户ID，使用完整的表名限定
    SELECT au.id INTO user_id
    FROM auth.users au
    WHERE au.email = p_email
    LIMIT 1;
    
    -- 如果没找到，返回 NULL
    RETURN user_id;
END;
$$;