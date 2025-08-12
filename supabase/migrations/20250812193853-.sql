BEGIN;

-- Recreate table if not exists with user_id nullable (for legacy rows)
CREATE TABLE IF NOT EXISTS public.partner_bank_details (
  partner_id uuid PRIMARY KEY REFERENCES public.partners(id) ON DELETE CASCADE,
  bank_account text,
  bank_name text,
  branch_name text,
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_bank_details_updated_at ON public.partner_bank_details;
CREATE TRIGGER trg_partner_bank_details_updated_at
BEFORE UPDATE ON public.partner_bank_details
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS and add strict policies
ALTER TABLE public.partner_bank_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage all bank details" ON public.partner_bank_details;
DROP POLICY IF EXISTS "Finance view all bank details" ON public.partner_bank_details;
DROP POLICY IF EXISTS "Finance manage all bank details" ON public.partner_bank_details;
DROP POLICY IF EXISTS "Users manage own bank details" ON public.partner_bank_details;

CREATE POLICY "Admins manage all bank details"
ON public.partner_bank_details FOR ALL TO authenticated
USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Finance view all bank details"
ON public.partner_bank_details FOR SELECT TO authenticated
USING (is_finance_or_admin());

CREATE POLICY "Finance manage all bank details"
ON public.partner_bank_details FOR INSERT TO authenticated
WITH CHECK (is_finance_or_admin());

CREATE POLICY "Users manage own bank details"
ON public.partner_bank_details FOR ALL TO authenticated
USING (user_id IS NOT NULL AND auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Migrate data
INSERT INTO public.partner_bank_details (partner_id, bank_account, bank_name, branch_name, user_id)
SELECT id, bank_account, bank_name, branch_name, user_id
FROM public.partners
WHERE (bank_account IS NOT NULL AND bank_account <> '')
   OR (bank_name IS NOT NULL AND bank_name <> '')
   OR (branch_name IS NOT NULL AND branch_name <> '')
ON CONFLICT (partner_id) DO UPDATE
SET bank_account = EXCLUDED.bank_account,
    bank_name = EXCLUDED.bank_name,
    branch_name = EXCLUDED.branch_name,
    user_id = COALESCE(public.partner_bank_details.user_id, EXCLUDED.user_id);

-- Update RPC to read bank fields from partner_bank_details
CREATE OR REPLACE FUNCTION public.get_payment_request_data_v2(p_record_ids uuid[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result_json jsonb;
    v_can_view boolean := public.is_finance_or_admin();
BEGIN
    SELECT jsonb_build_object(
        'records', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', v.id,
                'auto_number', v.auto_number,
                'project_name', v.project_name,
                'driver_name', v.driver_name,
                'loading_location', v.loading_location,
                'unloading_location', v.unloading_location,
                'loading_date', to_char(v.loading_date, 'YYYY-MM-DD'),
                'unloading_date', COALESCE(to_char(v.unloading_date, 'YYYY-MM-DD'), null),
                'loading_weight', v.loading_weight,
                'unloading_weight', v.unloading_weight,
                'current_cost', v.current_cost,
                'extra_cost', v.extra_cost,
                'payable_cost', v.payable_cost,
                'license_plate', v.license_plate,
                'driver_phone', v.driver_phone,
                'transport_type', v.transport_type,
                'remarks', v.remarks,
                'chain_name', v.chain_name,
                'cargo_type', lr.cargo_type,
                'payment_status', lr.payment_status,
                'partner_costs', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'partner_id', lpc.partner_id,
                            'partner_name', p.name,
                            'level', lpc.level,
                            'payable_amount', lpc.payable_amount,
                            'full_name', CASE WHEN v_can_view THEN p.full_name ELSE NULL END,
                            'bank_account', CASE WHEN v_can_view THEN bd.bank_account ELSE NULL END,
                            'bank_name', CASE WHEN v_can_view THEN bd.bank_name ELSE NULL END,
                            'branch_name', CASE WHEN v_can_view THEN bd.branch_name ELSE NULL END
                        ) ORDER BY lpc.level
                    ), '[]'::jsonb)
                    FROM public.logistics_partner_costs lpc
                    JOIN public.partners p ON lpc.partner_id = p.id
                    LEFT JOIN public.partner_bank_details bd ON bd.partner_id = p.id
                    WHERE lpc.logistics_record_id = v.id
                )
            ) ORDER BY v.loading_date DESC
        ), '[]'::jsonb)
    )
    INTO result_json
    FROM public.logistics_records_view v
    JOIN public.logistics_records lr ON v.id = lr.id
    WHERE v.id = ANY(p_record_ids);

    RETURN result_json::json;
END;
$$;

-- Remove bank columns from partners
ALTER TABLE public.partners
  DROP COLUMN IF EXISTS bank_account,
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS branch_name;

COMMIT;