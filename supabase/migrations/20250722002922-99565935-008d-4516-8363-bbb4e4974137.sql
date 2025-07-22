-- 为地点表添加项目关联
ALTER TABLE public.locations ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- 为司机表添加项目关联  
ALTER TABLE public.drivers ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- 为现有记录设置默认项目（可选，如果有现有数据的话）
-- 这里可以根据需要设置默认值或者让用户手动关联