BEGIN;

-- Ensure restricted table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.partner_bank_details (
  partner_id uuid PRIMARY KEY REFERENCES public.partners(id) ON DELETE CASCADE,
  bank_account text,
  bank_name text,
  branch_name text,
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure trigger exists
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

-- Enable RLS and policies (idempotent drops)
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

-- Migrate data from partners to partner_bank_details (safe if columns still exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='partners' AND column_name='bank_account'
  ) THEN
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
  END IF;
END $$;

-- Drop columns if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='partners' AND column_name='bank_account'
  ) THEN
    ALTER TABLE public.partners
      DROP COLUMN IF EXISTS bank_account,
      DROP COLUMN IF EXISTS bank_name,
      DROP COLUMN IF EXISTS branch_name;
  END IF;
END $$;

COMMIT;