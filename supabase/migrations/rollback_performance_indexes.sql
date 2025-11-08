-- ============================================================================
-- 性能索引回滚脚本
-- 创建时间: 2025-11-08
-- 功能描述: 删除所有性能优化索引（仅在需要回滚时使用）
-- 安全等级: ✅ 低风险（只删除索引，不删除数据）
-- ============================================================================

-- ⚠️ 警告：只在需要回滚时执行此脚本
-- 删除索引不会影响数据，但会降低查询性能

-- ============================================================================
-- 一、logistics_records（物流记录表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_loading_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_project_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_project_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_invoice_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_payment_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_auto_number;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_driver_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_license_plate;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_driver_phone;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_project_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_invoice_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_records_payment_date;

-- ============================================================================
-- 二、projects（项目表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_projects_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_projects_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_projects_manager;
DROP INDEX CONCURRENTLY IF EXISTS idx_projects_created_at;

-- ============================================================================
-- 三、payment_requests（付款申请表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_payment_requests_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_payment_requests_request_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_payment_requests_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_payment_requests_status_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_payment_requests_applicant_id;

-- ============================================================================
-- 四、invoice_requests（开票申请表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_requests_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_requests_request_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_requests_created_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_requests_status_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_requests_applicant_id;

-- ============================================================================
-- 五、scale_records（磅单记录表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_scale_records_loading_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_scale_records_project_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_scale_records_trip_number;
DROP INDEX CONCURRENTLY IF EXISTS idx_scale_records_date_trip;
DROP INDEX CONCURRENTLY IF EXISTS idx_scale_records_license_plate;

-- ============================================================================
-- 六、drivers（司机表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_drivers_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_drivers_license_plate;
DROP INDEX CONCURRENTLY IF EXISTS idx_drivers_phone;

-- ============================================================================
-- 七、partners（合作方表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_partners_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_partners_full_name;

-- ============================================================================
-- 八、logistics_partner_costs（合作方费用表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_partner_costs_record_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_partner_costs_partner_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_logistics_partner_costs_record_partner;

-- ============================================================================
-- 九、internal_drivers（内部司机表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_internal_drivers_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_internal_drivers_driver_id;

-- ============================================================================
-- 十、internal_vehicles（内部车辆表）
-- ============================================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_internal_vehicles_license_plate;
DROP INDEX CONCURRENTLY IF EXISTS idx_internal_vehicles_fleet_manager_id;

-- ============================================================================
-- 完成提示
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 性能索引已全部删除';
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️  警告：查询性能将恢复到优化前的状态';
    RAISE NOTICE '';
    RAISE NOTICE '💡 如需重新创建索引，请执行:';
    RAISE NOTICE '   add_performance_indexes.sql';
    RAISE NOTICE '========================================';
END $$;

