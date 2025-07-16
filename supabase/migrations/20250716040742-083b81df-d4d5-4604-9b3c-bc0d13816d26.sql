-- 添加合作链路配置表，支持一个项目有多套合作链路
CREATE TABLE public.partner_chains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  chain_name TEXT NOT NULL DEFAULT '默认链路',
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, chain_name)
);

-- 修改项目合作方关联表，添加链路引用
ALTER TABLE public.project_partners 
ADD COLUMN chain_id UUID REFERENCES public.partner_chains(id) ON DELETE CASCADE;

-- 启用RLS
ALTER TABLE public.partner_chains ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "Allow all operations on partner_chains" 
ON public.partner_chains 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 为现有的项目合作方数据创建默认链路
DO $$
DECLARE
    project_record RECORD;
    new_chain_id UUID;
BEGIN
    -- 为每个有合作方的项目创建默认链路
    FOR project_record IN 
        SELECT DISTINCT project_id FROM public.project_partners
    LOOP
        -- 创建默认链路
        INSERT INTO public.partner_chains (project_id, chain_name, is_default)
        VALUES (project_record.project_id, '默认链路', true)
        RETURNING id INTO new_chain_id;
        
        -- 更新现有的合作方关联到这个链路
        UPDATE public.project_partners 
        SET chain_id = new_chain_id 
        WHERE project_id = project_record.project_id;
    END LOOP;
END $$;

-- 现在可以安全地将chain_id设为非空
ALTER TABLE public.project_partners 
ALTER COLUMN chain_id SET NOT NULL;