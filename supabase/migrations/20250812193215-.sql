-- Harden security: restrict anon access and fix function search_path
BEGIN;

-- Ensure RLS stays enforced on sensitive table
ALTER TABLE IF EXISTS public.partners ENABLE ROW LEVEL SECURITY;
-- Prevent anonymous (unauthenticated) direct access
REVOKE ALL ON TABLE public.partners FROM anon;

-- Set immutable search_path on SECURITY DEFINER functions (prevents hijacking)
ALTER FUNCTION public.get_my_role() SET search_path = 'public';
ALTER FUNCTION public.get_user_by_username(text) SET search_path = 'public';
ALTER FUNCTION public.process_payment_application_old(uuid[], numeric) SET search_path = 'public';
ALTER FUNCTION public.batch_import_logistics_records(jsonb) SET search_path = 'public';

COMMIT;