-- Phase 1: Create user profiles system
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies - users can only see their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Add user_id to business tables for user-based access control
ALTER TABLE public.projects ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.drivers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.locations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.partners ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.logistics_records ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing records to have a system user (will need manual assignment later)
UPDATE public.projects SET user_id = '00000000-0000-0000-0000-000000000000'::uuid WHERE user_id IS NULL;
UPDATE public.drivers SET user_id = '00000000-0000-0000-0000-000000000000'::uuid WHERE user_id IS NULL;
UPDATE public.locations SET user_id = '00000000-0000-0000-0000-000000000000'::uuid WHERE user_id IS NULL;
UPDATE public.partners SET user_id = '00000000-0000-0000-0000-000000000000'::uuid WHERE user_id IS NULL;
UPDATE public.logistics_records SET user_id = '00000000-0000-0000-0000-000000000000'::uuid WHERE user_id IS NULL;

-- Make user_id NOT NULL after setting defaults
ALTER TABLE public.projects ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.drivers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.locations ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.partners ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.logistics_records ALTER COLUMN user_id SET NOT NULL;

-- Drop all existing dangerous "true" policies
DROP POLICY IF EXISTS "Allow all operations on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow all operations on drivers" ON public.drivers;
DROP POLICY IF EXISTS "Allow all operations on locations" ON public.locations;
DROP POLICY IF EXISTS "Allow all operations on partners" ON public.partners;
DROP POLICY IF EXISTS "Allow all operations on logistics_records" ON public.logistics_records;
DROP POLICY IF EXISTS "Allow all operations on driver_projects" ON public.driver_projects;
DROP POLICY IF EXISTS "Allow all operations on location_projects" ON public.location_projects;
DROP POLICY IF EXISTS "Allow all operations on partner_chains" ON public.partner_chains;
DROP POLICY IF EXISTS "Allow all operations on project_partners" ON public.project_partners;
DROP POLICY IF EXISTS "Allow all operations on logistics_partner_costs" ON public.logistics_partner_costs;

-- Create secure user-based RLS policies
-- Projects policies
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Drivers policies
CREATE POLICY "Users can view own drivers" ON public.drivers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own drivers" ON public.drivers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own drivers" ON public.drivers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own drivers" ON public.drivers
  FOR DELETE USING (auth.uid() = user_id);

-- Locations policies
CREATE POLICY "Users can view own locations" ON public.locations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own locations" ON public.locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own locations" ON public.locations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own locations" ON public.locations
  FOR DELETE USING (auth.uid() = user_id);

-- Partners policies
CREATE POLICY "Users can view own partners" ON public.partners
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own partners" ON public.partners
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own partners" ON public.partners
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own partners" ON public.partners
  FOR DELETE USING (auth.uid() = user_id);

-- Logistics records policies
CREATE POLICY "Users can view own logistics_records" ON public.logistics_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own logistics_records" ON public.logistics_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own logistics_records" ON public.logistics_records
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own logistics_records" ON public.logistics_records
  FOR DELETE USING (auth.uid() = user_id);

-- Related tables policies (based on project/parent ownership)
CREATE POLICY "Users can view related driver_projects" ON public.driver_projects
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can manage related driver_projects" ON public.driver_projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view related location_projects" ON public.location_projects
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can manage related location_projects" ON public.location_projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view related partner_chains" ON public.partner_chains
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can manage related partner_chains" ON public.partner_chains
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view related project_partners" ON public.project_partners
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can manage related project_partners" ON public.project_partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view related logistics_partner_costs" ON public.logistics_partner_costs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.logistics_records WHERE id = logistics_record_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can manage related logistics_partner_costs" ON public.logistics_partner_costs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.logistics_records WHERE id = logistics_record_id AND user_id = auth.uid())
  );

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update database functions to be user-aware and secure
CREATE OR REPLACE FUNCTION public.get_user_logistics_records(
  p_page_size integer,
  p_offset integer,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result_json jsonb;
  v_total_count integer;
  search_query_like text;
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Access denied: User not authenticated';
  END IF;

  -- Prepare search query
  search_query_like := '%' || COALESCE(p_search_query, '') || '%';

  -- Count total records for the user
  SELECT COUNT(*)
  INTO v_total_count
  FROM public.logistics_records lr
  WHERE
    lr.user_id = current_user_id AND
    (p_start_date IS NULL OR lr.loading_date >= p_start_date::timestamp with time zone) AND
    (p_end_date IS NULL OR lr.loading_date <= (p_end_date::date + interval '1 day - 1 second')::timestamp with time zone) AND
    (p_project_id IS NULL OR lr.project_id = p_project_id) AND
    (p_search_query IS NULL OR p_search_query = '' OR (
      lr.auto_number ILIKE search_query_like OR
      lr.project_name ILIKE search_query_like OR
      lr.driver_name ILIKE search_query_like OR
      lr.loading_location ILIKE search_query_like OR
      lr.unloading_location ILIKE search_query_like
    ));

  -- Get paginated records for the user
  SELECT jsonb_build_object(
    'total_count', v_total_count,
    'records', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT *
        FROM public.logistics_records lr
        WHERE
          lr.user_id = current_user_id AND
          (p_start_date IS NULL OR lr.loading_date >= p_start_date::timestamp with time zone) AND
          (p_end_date IS NULL OR lr.loading_date <= (p_end_date::date + interval '1 day - 1 second')::timestamp with time zone) AND
          (p_project_id IS NULL OR lr.project_id = p_project_id) AND
          (p_search_query IS NULL OR p_search_query = '' OR (
            lr.auto_number ILIKE search_query_like OR
            lr.project_name ILIKE search_query_like OR
            lr.driver_name ILIKE search_query_like OR
            lr.loading_location ILIKE search_query_like OR
            lr.unloading_location ILIKE search_query_like
          ))
        ORDER BY lr.created_at DESC
        LIMIT p_page_size
        OFFSET p_offset
      ) t
    )
  )
  INTO result_json;

  RETURN result_json;
END;
$$;