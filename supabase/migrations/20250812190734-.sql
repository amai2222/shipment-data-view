-- Ensure public views use invoker rights so RLS of the caller applies
ALTER VIEW public.logistics_records_view SET (security_invoker = true);
ALTER VIEW public.logistics_records_secure_view SET (security_invoker = true);