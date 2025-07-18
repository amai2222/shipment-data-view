-- Add chain_id column to logistics_records table for tracking partner chain
ALTER TABLE public.logistics_records 
ADD COLUMN chain_id UUID REFERENCES public.partner_chains(id) ON DELETE SET NULL;