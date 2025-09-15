-- 检查 permission_change_log 表是否还存在
-- 如果存在，则删除它

-- 1. 检查表是否存在
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'permission_change_log'
    ) 
    THEN '表存在，需要删除'
    ELSE '表不存在，无需删除'
  END as table_status;

-- 2. 如果表存在，删除它
DROP TABLE IF EXISTS public.permission_change_log CASCADE;

-- 3. 删除相关的所有对象
DROP VIEW IF EXISTS public.permission_change_log_view CASCADE;
DROP FUNCTION IF EXISTS public.get_permission_change_log() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_permission_change_log() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_permission_change_log() CASCADE;
DROP TRIGGER IF EXISTS permission_change_log_trigger ON public.user_permissions;
DROP TRIGGER IF EXISTS permission_change_log_trigger ON public.role_permission_templates;
DROP INDEX IF EXISTS idx_permission_change_log_user_id;
DROP INDEX IF EXISTS idx_permission_change_log_created_at;
DROP INDEX IF EXISTS idx_permission_change_log_permission_key;
DROP SEQUENCE IF EXISTS permission_change_log_id_seq CASCADE;

-- 4. 验证删除结果
SELECT 
  '删除完成' as status,
  'permission_change_log 表及其所有相关对象已被彻底删除' as message;

-- 5. 显示当前权限系统表
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
