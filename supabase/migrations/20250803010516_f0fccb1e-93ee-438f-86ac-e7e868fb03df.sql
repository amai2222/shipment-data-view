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

-- Add user_id to business tables for user-based access control (nullable initially)
ALTER TABLE public.projects ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.drivers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.locations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.partners ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.logistics_records ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

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

-- Create secure user-based RLS policies (allowing for legacy data without user_id)
-- Projects policies
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Drivers policies
CREATE POLICY "Users can view own drivers" ON public.drivers
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create own drivers" ON public.drivers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own drivers" ON public.drivers
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete own drivers" ON public.drivers
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Locations policies
CREATE POLICY "Users can view own locations" ON public.locations
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create own locations" ON public.locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own locations" ON public.locations
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete own locations" ON public.locations
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Partners policies
CREATE POLICY "Users can view own partners" ON public.partners
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create own partners" ON public.partners
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own partners" ON public.partners
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete own partners" ON public.partners
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Logistics records policies
CREATE POLICY "Users can view own logistics_records" ON public.logistics_records
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can create own logistics_records" ON public.logistics_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own logistics_records" ON public.logistics_records
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can delete own logistics_records" ON public.logistics_records
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Related tables policies (allow access to legacy data)
CREATE POLICY "Users can view driver_projects" ON public.driver_projects
  FOR SELECT USING (true);
CREATE POLICY "Users can manage driver_projects" ON public.driver_projects
  FOR ALL USING (true);

CREATE POLICY "Users can view location_projects" ON public.location_projects
  FOR SELECT USING (true);
CREATE POLICY "Users can manage location_projects" ON public.location_projects
  FOR ALL USING (true);

CREATE POLICY "Users can view partner_chains" ON public.partner_chains
  FOR SELECT USING (true);
CREATE POLICY "Users can manage partner_chains" ON public.partner_chains
  FOR ALL USING (true);

CREATE POLICY "Users can view project_partners" ON public.project_partners
  FOR SELECT USING (true);
CREATE POLICY "Users can manage project_partners" ON public.project_partners
  FOR ALL USING (true);

CREATE POLICY "Users can view logistics_partner_costs" ON public.logistics_partner_costs
  FOR SELECT USING (true);
CREATE POLICY "Users can manage logistics_partner_costs" ON public.logistics_partner_costs
  FOR ALL USING (true);

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