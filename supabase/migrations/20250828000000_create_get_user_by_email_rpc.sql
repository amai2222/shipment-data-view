-- supabase/migrations/20250828000000_create_get_user_by_email_rpc.sql

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM auth.users WHERE email = p_email LIMIT 1;
  RETURN user_id;
END;
$$;
