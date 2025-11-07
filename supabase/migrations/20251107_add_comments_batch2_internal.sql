-- ============================================================================
-- 为内部车辆管理表添加字段中文注释 - 第2批（基于实际查询结果）
-- 创建日期：2025-11-07
-- ============================================================================

-- ============================================================================
-- 1. internal_driver_monthly_salary（司机月度工资表）- 14个字段
-- ============================================================================

COMMENT ON TABLE internal_driver_monthly_salary IS '司机月度工资表';

COMMENT ON COLUMN internal_driver_monthly_salary.id IS '主键ID';
COMMENT ON COLUMN internal_driver_monthly_salary.driver_id IS '司机ID（关联internal_drivers表）';
COMMENT ON COLUMN internal_driver_monthly_salary.year_month IS '年月（格式：YYYY-MM）';
COMMENT ON COLUMN internal_driver_monthly_salary.base_salary IS '基本工资（元，2位小数）';
COMMENT ON COLUMN internal_driver_monthly_salary.trip_count IS '运输趟次（当月完成运单数）';
COMMENT ON COLUMN internal_driver_monthly_salary.trip_commission IS '趟次提成（元，按趟次计算的奖金）';
COMMENT ON COLUMN internal_driver_monthly_salary.total_income IS '总收入（基本工资+趟次提成，元）';
COMMENT ON COLUMN internal_driver_monthly_salary.deductions IS '扣款金额（罚款、预支等，元）';
COMMENT ON COLUMN internal_driver_monthly_salary.net_salary IS '实发工资（总收入-扣款，元）';
COMMENT ON COLUMN internal_driver_monthly_salary.status IS '工资状态：Pending-待发放, Paid-已发放';
COMMENT ON COLUMN internal_driver_monthly_salary.payment_date IS '实际发放日期';
COMMENT ON COLUMN internal_driver_monthly_salary.remarks IS '备注信息';
COMMENT ON COLUMN internal_driver_monthly_salary.created_at IS '创建时间';
COMMENT ON COLUMN internal_driver_monthly_salary.updated_at IS '最后更新时间';

-- ============================================================================
-- 2. internal_driver_vehicle_relations（司机车辆关系表）- 7个字段
-- ============================================================================

COMMENT ON TABLE internal_driver_vehicle_relations IS '司机车辆分配关系表（记录司机使用哪辆车）';

COMMENT ON COLUMN internal_driver_vehicle_relations.id IS '主键ID';
COMMENT ON COLUMN internal_driver_vehicle_relations.driver_id IS '司机ID（关联internal_drivers表）';
COMMENT ON COLUMN internal_driver_vehicle_relations.vehicle_id IS '车辆ID（关联internal_vehicles表）';
COMMENT ON COLUMN internal_driver_vehicle_relations.valid_from IS '分配开始日期';
COMMENT ON COLUMN internal_driver_vehicle_relations.valid_until IS '分配结束日期（NULL表示仍在使用）';
COMMENT ON COLUMN internal_driver_vehicle_relations.created_at IS '创建时间';
COMMENT ON COLUMN internal_driver_vehicle_relations.updated_at IS '更新时间';

-- ============================================================================
-- 3. internal_drivers（内部司机表）- 3个字段
-- ============================================================================

COMMENT ON COLUMN internal_drivers.id IS '主键ID';
COMMENT ON COLUMN internal_drivers.created_at IS '创建时间';
COMMENT ON COLUMN internal_drivers.updated_at IS '最后更新时间';

-- ============================================================================
-- 4. internal_vehicle_certificates（车辆证件表）- 13个字段
-- ============================================================================

COMMENT ON TABLE internal_vehicle_certificates IS '车辆证件管理表（证件到期提醒）';

COMMENT ON COLUMN internal_vehicle_certificates.id IS '主键ID';
COMMENT ON COLUMN internal_vehicle_certificates.vehicle_id IS '车辆ID（关联internal_vehicles表）';
COMMENT ON COLUMN internal_vehicle_certificates.cert_type IS '证件类型：registration-行驶证, insurance-保险, inspection-年检, road_permit-道路运输证';
COMMENT ON COLUMN internal_vehicle_certificates.cert_number IS '证件编号';
COMMENT ON COLUMN internal_vehicle_certificates.issue_date IS '发证日期';
COMMENT ON COLUMN internal_vehicle_certificates.expire_date IS '到期日期';
COMMENT ON COLUMN internal_vehicle_certificates.file_url IS '证件照片/文件URL';
COMMENT ON COLUMN internal_vehicle_certificates.issuing_authority IS '发证机关';
COMMENT ON COLUMN internal_vehicle_certificates.alert_days IS '提前提醒天数（到期前N天提醒）';
COMMENT ON COLUMN internal_vehicle_certificates.remarks IS '备注信息';
COMMENT ON COLUMN internal_vehicle_certificates.created_by IS '创建人ID（关联auth.users表）';
COMMENT ON COLUMN internal_vehicle_certificates.created_at IS '创建时间';
COMMENT ON COLUMN internal_vehicle_certificates.updated_at IS '最后更新时间';

-- ============================================================================
-- 5. internal_vehicle_change_applications（换车申请表）- 12个字段
-- ============================================================================

COMMENT ON TABLE internal_vehicle_change_applications IS '司机换车申请表';

COMMENT ON COLUMN internal_vehicle_change_applications.id IS '主键ID';
COMMENT ON COLUMN internal_vehicle_change_applications.application_number IS '申请单编号';
COMMENT ON COLUMN internal_vehicle_change_applications.driver_id IS '司机ID（关联internal_drivers表）';
COMMENT ON COLUMN internal_vehicle_change_applications.current_vehicle_id IS '当前使用车辆ID';
COMMENT ON COLUMN internal_vehicle_change_applications.requested_vehicle_id IS '申请换的车辆ID';
COMMENT ON COLUMN internal_vehicle_change_applications.reason IS '换车原因';
COMMENT ON COLUMN internal_vehicle_change_applications.status IS '申请状态：Pending-待审核, Approved-已批准, Rejected-已驳回';
COMMENT ON COLUMN internal_vehicle_change_applications.reviewer_id IS '审核人ID（关联auth.users表）';
COMMENT ON COLUMN internal_vehicle_change_applications.review_time IS '审核时间';
COMMENT ON COLUMN internal_vehicle_change_applications.review_comment IS '审核意见';
COMMENT ON COLUMN internal_vehicle_change_applications.created_at IS '申请创建时间';
COMMENT ON COLUMN internal_vehicle_change_applications.updated_at IS '最后更新时间';

-- ============================================================================
-- 6. internal_vehicle_expense_details（车辆费用明细表）- 11个字段
-- ============================================================================

COMMENT ON TABLE internal_vehicle_expense_details IS '车辆费用明细表（记录每笔费用支出）';

COMMENT ON COLUMN internal_vehicle_expense_details.id IS '主键ID';
COMMENT ON COLUMN internal_vehicle_expense_details.vehicle_id IS '车辆ID（关联internal_vehicles表）';
COMMENT ON COLUMN internal_vehicle_expense_details.month_period IS '月份（格式：YYYY-MM）';
COMMENT ON COLUMN internal_vehicle_expense_details.expense_category IS '费用分类：油费、维修费、过路费等';
COMMENT ON COLUMN internal_vehicle_expense_details.item_number IS '项目序号（当月该类别的第N项）';
COMMENT ON COLUMN internal_vehicle_expense_details.date IS '费用发生日期';
COMMENT ON COLUMN internal_vehicle_expense_details.expense_item IS '费用项目名称';
COMMENT ON COLUMN internal_vehicle_expense_details.amount IS '金额（元，2位小数）';
COMMENT ON COLUMN internal_vehicle_expense_details.payer IS '付款人';
COMMENT ON COLUMN internal_vehicle_expense_details.voucher IS '凭证号/票据号';
COMMENT ON COLUMN internal_vehicle_expense_details.created_at IS '创建时间';

-- ============================================================================
-- 7. internal_vehicle_ledger（车辆收支流水表）- 14个字段
-- ============================================================================

COMMENT ON TABLE internal_vehicle_ledger IS '车辆收支流水账表（记账簿格式）';

COMMENT ON COLUMN internal_vehicle_ledger.id IS '主键ID';
COMMENT ON COLUMN internal_vehicle_ledger.vehicle_id IS '车辆ID（关联internal_vehicles表）';
COMMENT ON COLUMN internal_vehicle_ledger.transaction_date IS '交易日期';
COMMENT ON COLUMN internal_vehicle_ledger.sequence_number IS '流水序号（当天第N笔）';
COMMENT ON COLUMN internal_vehicle_ledger.description IS '摘要/说明';
COMMENT ON COLUMN internal_vehicle_ledger.debit IS '借方金额（收入，元）';
COMMENT ON COLUMN internal_vehicle_ledger.credit IS '贷方金额（支出，元）';
COMMENT ON COLUMN internal_vehicle_ledger.balance IS '余额（元）';
COMMENT ON COLUMN internal_vehicle_ledger.transaction_type IS '交易类型：income-收入, expense-支出';
COMMENT ON COLUMN internal_vehicle_ledger.category IS '类别：运费收入、油费、维修费等';
COMMENT ON COLUMN internal_vehicle_ledger.source_type IS '来源类型：waybill-运单, expense-费用申请, manual-手工录入';
COMMENT ON COLUMN internal_vehicle_ledger.source_id IS '来源单据ID';
COMMENT ON COLUMN internal_vehicle_ledger.created_by IS '创建人ID';
COMMENT ON COLUMN internal_vehicle_ledger.created_at IS '创建时间';

-- ============================================================================
-- 8. internal_vehicle_monthly_summary（车辆月度汇总表）- 20个字段
-- ============================================================================

COMMENT ON TABLE internal_vehicle_monthly_summary IS '车辆月度运营汇总表';

COMMENT ON COLUMN internal_vehicle_monthly_summary.id IS '主键ID';
COMMENT ON COLUMN internal_vehicle_monthly_summary.vehicle_id IS '车辆ID（关联internal_vehicles表）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.driver_id IS '司机ID（当月主要使用司机）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.month_period IS '月份（格式：YYYY-MM）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.freight_income IS '运费收入（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.salary_public_transfer IS '工资-对公转账（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.salary_overtime IS '工资-加班费（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.salary_subsidy IS '工资-补贴（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.salary_total IS '工资合计（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.driver_fuel IS '司机加油费（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.company_fuel IS '公司加油费（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.traffic_fine IS '交通罚款（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.maintenance_fee IS '维修保养费（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.urea_welding IS '尿素焊接费（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.etc_fee IS 'ETC通行费（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.total_expense IS '总支出（元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.gross_profit IS '毛利润（运费收入-总支出，元）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.mileage IS '当月行驶里程（公里）';
COMMENT ON COLUMN internal_vehicle_monthly_summary.created_at IS '创建时间';
COMMENT ON COLUMN internal_vehicle_monthly_summary.updated_at IS '最后更新时间';

-- ============================================================================
-- 9. internal_vehicles（内部车辆表）- 部分字段（只列出缺少注释的）
-- ============================================================================

COMMENT ON TABLE internal_vehicles IS '内部车辆档案表';

COMMENT ON COLUMN internal_vehicles.id IS '主键ID';
COMMENT ON COLUMN internal_vehicles.vehicle_brand IS '车辆品牌（如：解放、东风）';
COMMENT ON COLUMN internal_vehicles.vehicle_model IS '车型型号';
COMMENT ON COLUMN internal_vehicles.vehicle_color IS '车辆颜色';
COMMENT ON COLUMN internal_vehicles.manufacture_year IS '出厂年份';
COMMENT ON COLUMN internal_vehicles.load_capacity IS '核定载重（吨）';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 第2批：内部车辆管理表注释已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已完成表：';
    RAISE NOTICE '  ✓ internal_driver_monthly_salary (14个字段)';
    RAISE NOTICE '  ✓ internal_driver_vehicle_relations (7个字段)';
    RAISE NOTICE '  ✓ internal_drivers (3个字段)';
    RAISE NOTICE '  ✓ internal_vehicle_certificates (13个字段)';
    RAISE NOTICE '  ✓ internal_vehicle_change_applications (12个字段)';
    RAISE NOTICE '  ✓ internal_vehicle_expense_details (11个字段)';
    RAISE NOTICE '  ✓ internal_vehicle_ledger (14个字段)';
    RAISE NOTICE '  ✓ internal_vehicle_monthly_summary (20个字段)';
    RAISE NOTICE '  ✓ internal_vehicles (6个字段)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

