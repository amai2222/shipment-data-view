BEGIN;
-- Restrict email harvesting via RPC: disallow anonymous execution
REVOKE EXECUTE ON FUNCTION public.get_user_by_username(text) FROM anon;
COMMIT;