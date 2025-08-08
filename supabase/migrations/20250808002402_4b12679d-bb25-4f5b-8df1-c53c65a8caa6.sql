-- 1) Create a robust admin check that does not rely on JWT custom claims
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = coalesce(_user_id, auth.uid())
      AND role = 'admin'::app_role
  );
$$;

-- 2) Update all admin policies to use public.is_admin() instead of get_my_role()

-- driver_projects
DROP POLICY IF EXISTS "Admins can manage all driver_projects" ON public.driver_projects;
CREATE POLICY "Admins can manage all driver_projects"
ON public.driver_projects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- drivers
DROP POLICY IF EXISTS "Admins can manage all drivers" ON public.drivers;
CREATE POLICY "Admins can manage all drivers"
ON public.drivers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- invoice_records
DROP POLICY IF EXISTS "Admins can manage all invoice_records" ON public.invoice_records;
CREATE POLICY "Admins can manage all invoice_records"
ON public.invoice_records
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- location_projects
DROP POLICY IF EXISTS "Admins can manage all location_projects" ON public.location_projects;
CREATE POLICY "Admins can manage all location_projects"
ON public.location_projects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- locations
DROP POLICY IF EXISTS "Admins can manage all locations" ON public.locations;
CREATE POLICY "Admins can manage all locations"
ON public.locations
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- logistics_partner_costs
DROP POLICY IF EXISTS "Admins can manage all logistics_partner_costs" ON public.logistics_partner_costs;
CREATE POLICY "Admins can manage all logistics_partner_costs"
ON public.logistics_partner_costs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- logistics_records
DROP POLICY IF EXISTS "Admins can manage all logistics_records" ON public.logistics_records;
CREATE POLICY "Admins can manage all logistics_records"
ON public.logistics_records
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- partner_chains
DROP POLICY IF EXISTS "Admins can manage all partner_chains" ON public.partner_chains;
CREATE POLICY "Admins can manage all partner_chains"
ON public.partner_chains
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- partner_payment_items
DROP POLICY IF EXISTS "Admins can manage all payment items" ON public.partner_payment_items;
CREATE POLICY "Admins can manage all payment items"
ON public.partner_payment_items
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- partner_payment_requests
DROP POLICY IF EXISTS "Admins can manage all payment requests" ON public.partner_payment_requests;
CREATE POLICY "Admins can manage all payment requests"
ON public.partner_payment_requests
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- partners
DROP POLICY IF EXISTS "Admins can manage all partners" ON public.partners;
CREATE POLICY "Admins can manage all partners"
ON public.partners
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- payment_records
DROP POLICY IF EXISTS "Admins can manage all payment_records" ON public.payment_records;
CREATE POLICY "Admins can manage all payment_records"
ON public.payment_records
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- payment_request_records
DROP POLICY IF EXISTS "Admins can manage all payment_request_records" ON public.payment_request_records;
CREATE POLICY "Admins can manage all payment_request_records"
ON public.payment_request_records
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- payment_requests
DROP POLICY IF EXISTS "Admins can manage all payment_requests" ON public.payment_requests;
CREATE POLICY "Admins can manage all payment_requests"
ON public.payment_requests
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- projects
DROP POLICY IF EXISTS "Admins can manage all projects" ON public.projects;
CREATE POLICY "Admins can manage all projects"
ON public.projects
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());