-- 根据代码优化建议报告 - 高优先级优化 1.3
-- 添加性能优化索引

-- ============================================
-- 权限表索引优化
-- ============================================

-- user_permissions 表索引
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id_project_id 
ON public.user_permissions(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id 
ON public.user_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_permissions_created_at 
ON public.user_permissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_permissions_updated_at 
ON public.user_permissions(updated_at DESC);

-- role_permission_templates 表索引
CREATE INDEX IF NOT EXISTS idx_role_permission_templates_role 
ON public.role_permission_templates(role);

-- ============================================
-- 审计日志索引
-- ============================================

-- permission_audit_logs 表索引
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at 
ON public.permission_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_id 
ON public.permission_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_user_action 
ON public.permission_audit_logs(user_id, action);

CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_action 
ON public.permission_audit_logs(action);

-- ============================================
-- 业务数据索引优化
-- ============================================

-- logistics_records 表索引（如果还没有）
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_id 
ON public.logistics_records(project_id);

CREATE INDEX IF NOT EXISTS idx_logistics_records_loading_date 
ON public.logistics_records(loading_date DESC);

CREATE INDEX IF NOT EXISTS idx_logistics_records_project_loading_date 
ON public.logistics_records(project_id, loading_date DESC);

CREATE INDEX IF NOT EXISTS idx_logistics_records_driver_name 
ON public.logistics_records(driver_name);

CREATE INDEX IF NOT EXISTS idx_logistics_records_created_at 
ON public.logistics_records(created_at DESC);

-- projects 表索引
CREATE INDEX IF NOT EXISTS idx_projects_status 
ON public.projects(project_status);

CREATE INDEX IF NOT EXISTS idx_projects_created_at 
ON public.projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_start_date 
ON public.projects(start_date DESC);

-- payment_requests 表索引
CREATE INDEX IF NOT EXISTS idx_payment_requests_status 
ON public.payment_requests(status);

CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at 
ON public.payment_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id 
ON public.payment_requests(user_id);

-- scale_records 表索引（如果存在）
CREATE INDEX IF NOT EXISTS idx_scale_records_project_id 
ON public.scale_records(project_id);

CREATE INDEX IF NOT EXISTS idx_scale_records_created_at 
ON public.scale_records(created_at DESC);

-- ============================================
-- 合同相关索引
-- ============================================

-- contracts 表索引
CREATE INDEX IF NOT EXISTS idx_contracts_status 
ON public.contracts(status);

CREATE INDEX IF NOT EXISTS idx_contracts_category 
ON public.contracts(category);

CREATE INDEX IF NOT EXISTS idx_contracts_end_date 
ON public.contracts(end_date DESC);

CREATE INDEX IF NOT EXISTS idx_contracts_created_at 
ON public.contracts(created_at DESC);

-- contract_tag_relations 表索引（如果存在）
CREATE INDEX IF NOT EXISTS idx_contract_tag_relations_contract_id 
ON public.contract_tag_relations(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_tag_relations_tag_id 
ON public.contract_tag_relations(tag_id);

-- ============================================
-- 用户和认证相关索引
-- ============================================

-- profiles 表索引
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_profiles_work_wechat_userid 
ON public.profiles(work_wechat_userid);

-- ============================================
-- 复合索引优化（针对常见查询模式）
-- ============================================

-- 项目统计查询优化
CREATE INDEX IF NOT EXISTS idx_logistics_project_date_weight 
ON public.logistics_records(project_id, loading_date, loading_weight);

-- 权限查询优化
CREATE INDEX IF NOT EXISTS idx_user_permissions_composite 
ON public.user_permissions(user_id, project_id, created_at DESC);

-- 审计日志查询优化
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite 
ON public.permission_audit_logs(user_id, action, created_at DESC);

-- ============================================
-- 添加索引说明
-- ============================================

COMMENT ON INDEX idx_user_permissions_user_id_project_id IS '优化用户权限查询性能';
COMMENT ON INDEX idx_logistics_records_project_loading_date IS '优化项目运输记录按日期查询';
COMMENT ON INDEX idx_permission_audit_logs_user_action IS '优化审计日志按用户和操作查询';

-- ============================================
-- 验证索引创建
-- ============================================

-- 查看新创建的索引
DO $$
BEGIN
    RAISE NOTICE '索引创建完成！可以使用以下查询查看索引：';
    RAISE NOTICE 'SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = ''public'' ORDER BY tablename, indexname;';
END $$;

