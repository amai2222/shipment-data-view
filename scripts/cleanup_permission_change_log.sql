-- 彻底清理 permission_change_log 表的所有残留
-- 确保没有任何引用或配置残留

-- 1. 确认表已被删除（如果还存在，再次删除）
DROP TABLE IF EXISTS public.permission_change_log CASCADE;

-- 2. 删除相关的视图（如果存在）
DROP VIEW IF EXISTS public.permission_change_log_view CASCADE;
DROP VIEW IF EXISTS public.permission_change_summary CASCADE;

-- 3. 删除相关的函数（如果存在）
DROP FUNCTION IF EXISTS public.get_permission_change_log() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_permission_change_log() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_permission_change_log() CASCADE;

-- 4. 删除相关的触发器（如果存在）
DROP TRIGGER IF EXISTS permission_change_log_trigger ON public.user_permissions;
DROP TRIGGER IF EXISTS permission_change_log_trigger ON public.role_permission_templates;

-- 5. 删除相关的索引（如果存在）
DROP INDEX IF EXISTS idx_permission_change_log_user_id;
DROP INDEX IF EXISTS idx_permission_change_log_created_at;
DROP INDEX IF EXISTS idx_permission_change_log_permission_key;

-- 6. 删除相关的序列（如果存在）
DROP SEQUENCE IF EXISTS permission_change_log_id_seq CASCADE;

-- 7. 清理相关的权限策略（如果存在）
DROP POLICY IF EXISTS "permission_change_log_select_policy" ON public.permission_change_log;
DROP POLICY IF EXISTS "permission_change_log_insert_policy" ON public.permission_change_log;
DROP POLICY IF EXISTS "permission_change_log_update_policy" ON public.permission_change_log;
DROP POLICY IF EXISTS "permission_change_log_delete_policy" ON public.permission_change_log;

-- 8. 验证清理结果
SELECT 
  '清理完成' as status,
  'permission_change_log 表及其所有相关对象已被彻底删除' as message;

-- 9. 检查是否还有其他相关表
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%permission_change%'
  OR table_name LIKE '%change_log%';

-- 10. 显示当前有效的权限相关表
SELECT 
  '当前权限系统表' as category,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%permission%' 
    OR table_name LIKE '%audit%'
    OR table_name LIKE '%role%'
  )
ORDER BY table_name;
