-- Create tables for the logistics management system

-- Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create drivers table  
CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  license_plate TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  manager TEXT NOT NULL,
  loading_address TEXT NOT NULL,
  unloading_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create logistics_records table
CREATE TABLE public.logistics_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auto_number TEXT NOT NULL UNIQUE,
  project_id UUID REFERENCES public.projects(id),
  project_name TEXT NOT NULL,
  loading_time TEXT NOT NULL,
  loading_location TEXT NOT NULL,
  unloading_location TEXT NOT NULL,
  driver_id UUID REFERENCES public.drivers(id),
  driver_name TEXT NOT NULL,
  license_plate TEXT NOT NULL,
  driver_phone TEXT NOT NULL,
  loading_weight DECIMAL,
  unloading_date TEXT,
  unloading_weight DECIMAL,
  transport_type TEXT NOT NULL CHECK (transport_type IN ('实际运输', '退货')),
  current_cost DECIMAL,
  extra_cost DECIMAL,
  payable_cost DECIMAL,
  remarks TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (though we'll make it permissive for now)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_records ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for all tables (allow all operations for now)
CREATE POLICY "Allow all operations on locations" ON public.locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on drivers" ON public.drivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on logistics_records" ON public.logistics_records FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_logistics_records_auto_number ON public.logistics_records(auto_number);
CREATE INDEX idx_logistics_records_project_id ON public.logistics_records(project_id);
CREATE INDEX idx_logistics_records_driver_id ON public.logistics_records(driver_id);
CREATE INDEX idx_logistics_records_created_at ON public.logistics_records(created_at);
CREATE INDEX idx_projects_created_at ON public.projects(created_at);
CREATE INDEX idx_drivers_created_at ON public.drivers(created_at);
CREATE INDEX idx_locations_created_at ON public.locations(created_at);