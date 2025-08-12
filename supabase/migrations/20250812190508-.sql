-- Fix: Ensure views run with invoker rights to respect the querying user's RLS
ALTER VIEW public.logistics_records_view SET (security_invoker = true);
ALTER VIEW public.logistics_records_secure_view SET (security_invoker = true);

-- Optional: document the rationale
COMMENT ON VIEW public.logistics_records_view IS 'Security: runs with security_invoker=true to apply querying user\'s RLS.';
COMMENT ON VIEW public.logistics_records_secure_view IS 'Security: runs with security_invoker=true to apply querying user\'s RLS.';