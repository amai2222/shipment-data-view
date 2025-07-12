-- Add tax_rate column to project_partners table for project-specific tax rates
ALTER TABLE public.project_partners 
ADD COLUMN tax_rate numeric NOT NULL DEFAULT 0;

-- Remove level column from partners table since it's project-specific
ALTER TABLE public.partners 
DROP COLUMN level;