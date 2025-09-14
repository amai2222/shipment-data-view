-- 删除不需要的权限缓存和状态表
-- 文件: supabase/migrations/20250127000001_remove_unused_permission_tables.sql

-- 删除权限缓存相关表和视图（因为现在使用实时更新，不需要缓存）
DROP TABLE IF EXISTS public.permission_cache CASCADE;
DROP TABLE IF EXISTS public.permission_change_log CASCADE;
DROP TABLE IF EXISTS public.permission_performance_stats CASCADE;
DROP TABLE IF EXISTS public.permission_sync_status CASCADE;

-- 删除相关的视图（如果存在）
DROP VIEW IF EXISTS public.permission_realtime_status CASCADE;
DROP VIEW IF EXISTS public.user_permission_status CASCADE;
DROP VIEW IF EXISTS public.user_permissions_summary CASCADE;

-- 删除相关的函数（如果存在）
DROP FUNCTION IF EXISTS public.refresh_permission_cache() CASCADE;
DROP FUNCTION IF EXISTS public.get_permission_cache_stats() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_permission_cache() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_contract_permission_cache() CASCADE;

-- 添加注释说明
COMMENT ON TABLE public.profiles IS '用户档案表 - 存储用户基本信息和状态';
COMMENT ON TABLE public.user_permissions IS '用户权限表 - 存储用户的具体权限配置';
COMMENT ON TABLE public.role_permission_templates IS '角色权限模板表 - 存储不同角色的默认权限模板';
COMMENT ON TABLE public.projects IS '项目表 - 存储项目信息';
COMMENT ON TABLE public.project_partners IS '项目合作伙伴表 - 存储项目合作伙伴关系';
COMMENT ON TABLE public.saved_searches IS '保存的搜索表 - 存储用户保存的搜索条件';
COMMENT ON TABLE public.scale_records IS '磅单记录表 - 存储磅单相关数据';
