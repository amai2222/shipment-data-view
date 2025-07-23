-- 删除现有的单个项目关联字段
ALTER TABLE public.drivers DROP COLUMN IF EXISTS project_id;
ALTER TABLE public.locations DROP COLUMN IF EXISTS project_id;

-- 创建司机项目关联表（多对多）
CREATE TABLE public.driver_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(driver_id, project_id)
);

-- 创建地点项目关联表（多对多）
CREATE TABLE public.location_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(location_id, project_id)
);

-- 启用RLS
ALTER TABLE public.driver_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_projects ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Allow all operations on driver_projects" 
ON public.driver_projects 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on location_projects" 
ON public.location_projects 
FOR ALL 
USING (true) 
WITH CHECK (true);