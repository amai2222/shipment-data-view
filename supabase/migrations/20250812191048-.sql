-- Strengthen RLS for sensitive partner financial data
-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Allow finance or admin to view all partners (for financial operations)
DROP POLICY IF EXISTS "Finance can view all partners" ON public.partners;
CREATE POLICY "Finance can view all partners"
ON public.partners
FOR SELECT
TO authenticated
USING (public.is_finance_or_admin());

-- Keep existing policies intact:
--  - "Admins can manage all partners" (ALL using is_admin())
--  - "Users can manage their own partners" (ALL using auth.uid() = user_id)

-- Optional hardening: prevent anonymous access explicitly
REVOKE ALL ON public.partners FROM anon;