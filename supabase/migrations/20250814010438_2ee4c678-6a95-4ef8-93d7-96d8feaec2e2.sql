-- 修复语法错误并清理重复数据
DO $$
BEGIN
    -- 检查约束是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'driver_projects_driver_project_unique'
    ) THEN
        -- 清理重复数据
        DELETE FROM public.driver_projects dp1 
        WHERE dp1.id NOT IN (
            SELECT MIN(dp2.id) 
            FROM public.driver_projects dp2 
            WHERE dp2.driver_id = dp1.driver_id 
            AND dp2.project_id = dp1.project_id
        );
        
        -- 添加唯一约束
        ALTER TABLE public.driver_projects 
        ADD CONSTRAINT driver_projects_driver_project_unique 
        UNIQUE (driver_id, project_id);
    END IF;
END
$$;