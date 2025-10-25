-- 删除旧的text参数版本的函数
DROP FUNCTION IF EXISTS public.get_project_available_chains(TEXT);

-- 确保只有UUID版本的函数存在
-- 这个函数应该已经存在了，只是确保它正确