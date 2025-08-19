-- Add RLS policies for finance role to view all necessary data

-- Finance can view all logistics records
CREATE POLICY "Finance can view all logistics records" 
ON public.logistics_records 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all projects
CREATE POLICY "Finance can view all projects" 
ON public.projects 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all drivers
CREATE POLICY "Finance can view all drivers" 
ON public.drivers 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all locations
CREATE POLICY "Finance can view all locations" 
ON public.locations 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all logistics partner costs
CREATE POLICY "Finance can view all logistics partner costs" 
ON public.logistics_partner_costs 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all partner chains
CREATE POLICY "Finance can view all partner chains" 
ON public.partner_chains 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all project partners
CREATE POLICY "Finance can view all project partners" 
ON public.project_partners 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all payment records
CREATE POLICY "Finance can view all payment records" 
ON public.payment_records 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all invoice records
CREATE POLICY "Finance can view all invoice records" 
ON public.invoice_records 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all payment requests
CREATE POLICY "Finance can view all payment requests" 
ON public.payment_requests 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all partner payment requests
CREATE POLICY "Finance can view all partner payment requests" 
ON public.partner_payment_requests 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all partner payment items
CREATE POLICY "Finance can view all partner payment items" 
ON public.partner_payment_items 
FOR SELECT 
USING (is_finance_or_admin());

-- Finance can view all billing types
CREATE POLICY "Finance can view all billing types" 
ON public.billing_types 
FOR SELECT 
USING (is_finance_or_admin());