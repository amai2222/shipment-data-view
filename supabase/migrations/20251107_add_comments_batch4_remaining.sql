-- ============================================================================
-- 为剩余业务表添加字段中文注释 - 第4批
-- 创建日期：2025-11-07
-- 范围：合同、权限、用户、通知等辅助表
-- ============================================================================

-- ============================================================================
-- 1. contracts（合同表）- 21个字段
-- ============================================================================

COMMENT ON TABLE contracts IS '合同档案表';

COMMENT ON COLUMN contracts.id IS '主键ID';
COMMENT ON COLUMN contracts.category IS '合同类别：采购、销售、服务等（枚举类型）';
COMMENT ON COLUMN contracts.start_date IS '合同开始日期';
COMMENT ON COLUMN contracts.end_date IS '合同结束日期';
COMMENT ON COLUMN contracts.counterparty_company IS '对方公司名称';
COMMENT ON COLUMN contracts.our_company IS '我方公司名称';
COMMENT ON COLUMN contracts.contract_amount IS '合同金额（元）';
COMMENT ON COLUMN contracts.contract_original_url IS '合同原件URL';
COMMENT ON COLUMN contracts.attachment_url IS '附件URL';
COMMENT ON COLUMN contracts.remarks IS '备注';
COMMENT ON COLUMN contracts.contract_number IS '合同编号';
COMMENT ON COLUMN contracts.status IS '合同状态：draft-草稿, active-生效中, expired-已到期, terminated-已终止';
COMMENT ON COLUMN contracts.priority IS '优先级：high-高, medium-中, low-低';
COMMENT ON COLUMN contracts.responsible_person IS '责任人';
COMMENT ON COLUMN contracts.department IS '所属部门';
COMMENT ON COLUMN contracts.is_confidential IS '是否机密（true-机密, false-普通）';
COMMENT ON COLUMN contracts.last_accessed_at IS '最后访问时间';
COMMENT ON COLUMN contracts.access_count IS '访问次数';
COMMENT ON COLUMN contracts.created_at IS '创建时间';
COMMENT ON COLUMN contracts.updated_at IS '更新时间';
COMMENT ON COLUMN contracts.user_id IS '创建用户ID';

-- ============================================================================
-- 2. profiles（用户配置表）- 11个字段
-- ============================================================================

COMMENT ON TABLE profiles IS '用户配置表（扩展auth.users的用户信息）';

COMMENT ON COLUMN profiles.id IS '主键ID（关联auth.users.id）';
COMMENT ON COLUMN profiles.email IS '邮箱';
COMMENT ON COLUMN profiles.full_name IS '真实姓名';
COMMENT ON COLUMN profiles.created_at IS '创建时间';
COMMENT ON COLUMN profiles.updated_at IS '更新时间';
COMMENT ON COLUMN profiles.username IS '用户名（登录用）';
COMMENT ON COLUMN profiles.is_active IS '是否激活（true-启用, false-停用）';
COMMENT ON COLUMN profiles.role IS '用户角色：admin, finance, operator, driver等（枚举类型）';
COMMENT ON COLUMN profiles.work_wechat_userid IS '企业微信用户ID';
COMMENT ON COLUMN profiles.work_wechat_department IS '企业微信所属部门（数组）';
COMMENT ON COLUMN profiles.avatar_url IS '头像URL';

-- ============================================================================
-- 3. menu_config（菜单配置表）- 9个字段
-- ============================================================================

COMMENT ON TABLE menu_config IS '菜单配置表（动态菜单管理）';

COMMENT ON COLUMN menu_config.id IS '主键ID';
COMMENT ON COLUMN menu_config.title IS '菜单标题（显示名称）';
COMMENT ON COLUMN menu_config.url IS '菜单路径（如：/dashboard/finance）';
COMMENT ON COLUMN menu_config.icon IS '菜单图标（lucide-react图标名）';
COMMENT ON COLUMN menu_config.order_index IS '排序序号（数字越小越靠前）';
COMMENT ON COLUMN menu_config.is_active IS '是否激活（true-显示, false-隐藏）';
COMMENT ON COLUMN menu_config.description IS '菜单描述';
COMMENT ON COLUMN menu_config.created_at IS '创建时间';
COMMENT ON COLUMN menu_config.updated_at IS '更新时间';

-- ============================================================================
-- 4. notifications（通知表）- 13个字段
-- ============================================================================

COMMENT ON TABLE notifications IS '系统通知表';

COMMENT ON COLUMN notifications.id IS '主键ID';
COMMENT ON COLUMN notifications.user_id IS '接收用户ID（关联auth.users表）';
COMMENT ON COLUMN notifications.type IS '通知类型：info-信息, warning-警告, error-错误, success-成功';
COMMENT ON COLUMN notifications.category IS '通知分类：payment-付款, invoice-开票, certificate-证件等';
COMMENT ON COLUMN notifications.title IS '通知标题';
COMMENT ON COLUMN notifications.message IS '通知内容';
COMMENT ON COLUMN notifications.link IS '跳转链接';
COMMENT ON COLUMN notifications.related_id IS '关联单据ID';
COMMENT ON COLUMN notifications.is_read IS '是否已读（true-已读, false-未读）';
COMMENT ON COLUMN notifications.created_at IS '创建时间';
COMMENT ON COLUMN notifications.read_at IS '阅读时间';
COMMENT ON COLUMN notifications.metadata IS '元数据（JSONB格式）';
COMMENT ON COLUMN notifications.updated_at IS '更新时间';

-- ============================================================================
-- 5. scale_records（过磅记录表）- 15个字段
-- ============================================================================

COMMENT ON TABLE scale_records IS '过磅记录表（记录装卸货过磅数据）';

COMMENT ON COLUMN scale_records.id IS '主键ID';
COMMENT ON COLUMN scale_records.project_id IS '项目ID（关联projects表）';
COMMENT ON COLUMN scale_records.project_name IS '项目名称（冗余字段）';
COMMENT ON COLUMN scale_records.loading_date IS '装货日期';
COMMENT ON COLUMN scale_records.trip_number IS '趟次编号';
COMMENT ON COLUMN scale_records.valid_quantity IS '有效数量（吨/次/立方）';
COMMENT ON COLUMN scale_records.billing_type_id IS '计费类型ID（关联billing_types表）';
COMMENT ON COLUMN scale_records.image_urls IS '过磅单照片URL数组';
COMMENT ON COLUMN scale_records.license_plate IS '车牌号';
COMMENT ON COLUMN scale_records.driver_name IS '司机姓名';
COMMENT ON COLUMN scale_records.created_at IS '创建时间';
COMMENT ON COLUMN scale_records.updated_at IS '更新时间';
COMMENT ON COLUMN scale_records.created_by_user_id IS '创建人用户ID';
COMMENT ON COLUMN scale_records.user_id IS '关联用户ID';
COMMENT ON COLUMN scale_records.logistics_number IS '物流单号（关联运单）';

-- ============================================================================
-- 6. billing_types（计费类型表）- 6个字段
-- ============================================================================

COMMENT ON TABLE billing_types IS '计费类型表（重量/趟次/体积）';

COMMENT ON COLUMN billing_types.billing_type_id IS '主键ID';
COMMENT ON COLUMN billing_types.type_code IS '类型代码：weight-重量, trip-趟次, volume-体积';
COMMENT ON COLUMN billing_types.type_name IS '类型名称（中文显示）';
COMMENT ON COLUMN billing_types.user_id IS '创建用户ID';
COMMENT ON COLUMN billing_types.created_at IS '创建时间';
COMMENT ON COLUMN billing_types.updated_at IS '更新时间';

-- ============================================================================
-- 7. user_permissions（用户权限表）- 12个字段
-- ============================================================================

COMMENT ON TABLE user_permissions IS '用户权限表（记录用户的详细权限配置）';

COMMENT ON COLUMN user_permissions.id IS '主键ID';
COMMENT ON COLUMN user_permissions.user_id IS '用户ID（关联auth.users表）';
COMMENT ON COLUMN user_permissions.project_id IS '项目ID（数据权限范围）';
COMMENT ON COLUMN user_permissions.menu_permissions IS '菜单权限数组';
COMMENT ON COLUMN user_permissions.function_permissions IS '功能权限数组';
COMMENT ON COLUMN user_permissions.created_at IS '创建时间';
COMMENT ON COLUMN user_permissions.updated_at IS '更新时间';
COMMENT ON COLUMN user_permissions.created_by IS '创建人ID';
COMMENT ON COLUMN user_permissions.project_permissions IS '项目权限数组';
COMMENT ON COLUMN user_permissions.data_permissions IS '数据权限数组';
COMMENT ON COLUMN user_permissions.inherit_role IS '是否继承角色权限';
COMMENT ON COLUMN user_permissions.custom_settings IS '自定义设置（JSONB）';

-- ============================================================================
-- 8. invoice_request_details（开票申请明细表）- 13个字段
-- ============================================================================

COMMENT ON TABLE invoice_request_details IS '开票申请明细表（申请单包含的运单列表）';

COMMENT ON COLUMN invoice_request_details.id IS '主键ID';
COMMENT ON COLUMN invoice_request_details.invoice_request_id IS '开票申请单ID（关联invoice_requests表）';
COMMENT ON COLUMN invoice_request_details.logistics_record_id IS '运单ID（关联logistics_records表）';
COMMENT ON COLUMN invoice_request_details.invoiceable_amount IS '可开票金额（元，2位小数）';
COMMENT ON COLUMN invoice_request_details.created_at IS '创建时间';
COMMENT ON COLUMN invoice_request_details.auto_number IS '运单编号（冗余字段）';
COMMENT ON COLUMN invoice_request_details.project_name IS '项目名称（冗余字段）';
COMMENT ON COLUMN invoice_request_details.driver_name IS '司机姓名（冗余字段）';
COMMENT ON COLUMN invoice_request_details.loading_location IS '装货地点（冗余字段）';
COMMENT ON COLUMN invoice_request_details.unloading_location IS '卸货地点（冗余字段）';
COMMENT ON COLUMN invoice_request_details.loading_date IS '装货日期（冗余字段）';
COMMENT ON COLUMN invoice_request_details.amount IS '金额（元）';
COMMENT ON COLUMN invoice_request_details.updated_at IS '更新时间';

-- ============================================================================
-- 9. internal_vehicles（内部车辆表）- 剩余24个字段
-- ============================================================================

COMMENT ON COLUMN internal_vehicles.vehicle_length IS '车长（米）';
COMMENT ON COLUMN internal_vehicles.vehicle_width IS '车宽（米）';
COMMENT ON COLUMN internal_vehicles.vehicle_height IS '车高（米）';
COMMENT ON COLUMN internal_vehicles.fuel_type IS '燃料类型：汽油、柴油、电动、混合动力';
COMMENT ON COLUMN internal_vehicles.engine_number IS '发动机号';
COMMENT ON COLUMN internal_vehicles.driving_license_number IS '行驶证号';
COMMENT ON COLUMN internal_vehicles.transport_license_number IS '道路运输证号';
COMMENT ON COLUMN internal_vehicles.insurance_company IS '保险公司';
COMMENT ON COLUMN internal_vehicles.insurance_policy_number IS '保险单号';
COMMENT ON COLUMN internal_vehicles.insurance_type IS '保险类型：交强险、商业险等';
COMMENT ON COLUMN internal_vehicles.insurance_amount IS '保险金额（元）';
COMMENT ON COLUMN internal_vehicles.insurance_start_date IS '保险开始日期';
COMMENT ON COLUMN internal_vehicles.purchase_date IS '购买日期';
COMMENT ON COLUMN internal_vehicles.purchase_price IS '购买价格（元）';
COMMENT ON COLUMN internal_vehicles.purchase_type IS '购买方式：全款、贷款、租赁';
COMMENT ON COLUMN internal_vehicles.last_maintenance_date IS '上次保养日期';
COMMENT ON COLUMN internal_vehicles.next_maintenance_date IS '下次保养日期';
COMMENT ON COLUMN internal_vehicles.maintenance_mileage IS '保养里程间隔（公里）';
COMMENT ON COLUMN internal_vehicles.current_mileage IS '当前总里程（公里）';
COMMENT ON COLUMN internal_vehicles.is_active IS '是否在用（true-在用, false-停用）';
COMMENT ON COLUMN internal_vehicles.remarks IS '备注信息';
COMMENT ON COLUMN internal_vehicles.user_id IS '创建用户ID';
COMMENT ON COLUMN internal_vehicles.created_at IS '创建时间';
COMMENT ON COLUMN internal_vehicles.updated_at IS '更新时间';

-- ============================================================================
-- 10. internal_vehicle_monthly_income（车辆月度收入表）- 12个字段
-- ============================================================================

COMMENT ON TABLE internal_vehicle_monthly_income IS '车辆月度收入录入表';

COMMENT ON COLUMN internal_vehicle_monthly_income.id IS '主键ID';
COMMENT ON COLUMN internal_vehicle_monthly_income.vehicle_id IS '车辆ID（关联internal_vehicles表）';
COMMENT ON COLUMN internal_vehicle_monthly_income.month_period IS '月份（格式：YYYY-MM）';
COMMENT ON COLUMN internal_vehicle_monthly_income.income_date IS '收入日期';
COMMENT ON COLUMN internal_vehicle_monthly_income.income_source IS '收入来源';
COMMENT ON COLUMN internal_vehicle_monthly_income.income_type IS '收入类型：运费、其他';
COMMENT ON COLUMN internal_vehicle_monthly_income.income_amount IS '收入金额（元）';
COMMENT ON COLUMN internal_vehicle_monthly_income.related_project_id IS '关联项目ID';
COMMENT ON COLUMN internal_vehicle_monthly_income.related_logistics_ids IS '关联运单ID数组';
COMMENT ON COLUMN internal_vehicle_monthly_income.remarks IS '备注';
COMMENT ON COLUMN internal_vehicle_monthly_income.input_by IS '录入人ID';
COMMENT ON COLUMN internal_vehicle_monthly_income.created_at IS '创建时间';

-- ============================================================================
-- 11. payment_records（付款记录表）- 11个字段
-- ============================================================================

COMMENT ON TABLE payment_records IS '付款记录表（历史付款流水）';

COMMENT ON COLUMN payment_records.id IS '主键ID';
COMMENT ON COLUMN payment_records.logistics_record_id IS '运单ID（关联logistics_records表）';
COMMENT ON COLUMN payment_records.partner_id IS '合作方ID';
COMMENT ON COLUMN payment_records.payment_amount IS '付款金额（元）';
COMMENT ON COLUMN payment_records.payment_date IS '付款日期';
COMMENT ON COLUMN payment_records.remarks IS '备注';
COMMENT ON COLUMN payment_records.created_at IS '创建时间';
COMMENT ON COLUMN payment_records.updated_at IS '更新时间';
COMMENT ON COLUMN payment_records.user_id IS '创建用户ID';
COMMENT ON COLUMN payment_records.bank_receipt_number IS '银行回单号';
COMMENT ON COLUMN payment_records.payment_image_urls IS '付款凭证照片URL数组';

-- ============================================================================
-- 12. invoice_records（开票记录表）- 11个字段
-- ============================================================================

COMMENT ON TABLE invoice_records IS '开票记录表（历史开票流水）';

COMMENT ON COLUMN invoice_records.id IS '主键ID';
COMMENT ON COLUMN invoice_records.logistics_record_id IS '运单ID（关联logistics_records表）';
COMMENT ON COLUMN invoice_records.partner_id IS '合作方ID';
COMMENT ON COLUMN invoice_records.invoice_amount IS '开票金额（元）';
COMMENT ON COLUMN invoice_records.invoice_number IS '发票号码';
COMMENT ON COLUMN invoice_records.invoice_date IS '开票日期';
COMMENT ON COLUMN invoice_records.remarks IS '备注';
COMMENT ON COLUMN invoice_records.created_at IS '创建时间';
COMMENT ON COLUMN invoice_records.updated_at IS '更新时间';
COMMENT ON COLUMN invoice_records.user_id IS '创建用户ID';
COMMENT ON COLUMN invoice_records.invoice_image_urls IS '发票照片URL数组';

-- ============================================================================
-- 13. operation_logs（操作日志表）- 8个字段
-- ============================================================================

COMMENT ON TABLE operation_logs IS '操作日志表（记录用户操作行为）';

COMMENT ON COLUMN operation_logs.id IS '主键ID';
COMMENT ON COLUMN operation_logs.operation_type IS '操作类型：create-创建, update-更新, delete-删除';
COMMENT ON COLUMN operation_logs.table_name IS '操作的表名';
COMMENT ON COLUMN operation_logs.record_id IS '操作的记录ID';
COMMENT ON COLUMN operation_logs.record_info IS '记录信息（JSONB格式）';
COMMENT ON COLUMN operation_logs.operated_by IS '操作人ID（关联auth.users表）';
COMMENT ON COLUMN operation_logs.operated_at IS '操作时间';
COMMENT ON COLUMN operation_logs.updated_at IS '更新时间';

-- ============================================================================
-- 14. 关联表（driver_projects, location_projects, user_projects）
-- ============================================================================

-- driver_projects
COMMENT ON TABLE driver_projects IS '司机项目关联表';
COMMENT ON COLUMN driver_projects.id IS '主键ID';
COMMENT ON COLUMN driver_projects.driver_id IS '司机ID（关联drivers表）';
COMMENT ON COLUMN driver_projects.project_id IS '项目ID（关联projects表）';
COMMENT ON COLUMN driver_projects.created_at IS '创建时间';
COMMENT ON COLUMN driver_projects.user_id IS '创建用户ID';
COMMENT ON COLUMN driver_projects.updated_at IS '更新时间';

-- location_projects
COMMENT ON TABLE location_projects IS '地点项目关联表';
COMMENT ON COLUMN location_projects.id IS '主键ID';
COMMENT ON COLUMN location_projects.location_id IS '地点ID（关联locations表）';
COMMENT ON COLUMN location_projects.project_id IS '项目ID（关联projects表）';
COMMENT ON COLUMN location_projects.created_at IS '创建时间';
COMMENT ON COLUMN location_projects.user_id IS '创建用户ID';
COMMENT ON COLUMN location_projects.updated_at IS '更新时间';

-- user_projects
COMMENT ON TABLE user_projects IS '用户项目权限关联表';
COMMENT ON COLUMN user_projects.id IS '主键ID';
COMMENT ON COLUMN user_projects.user_id IS '用户ID（关联auth.users表）';
COMMENT ON COLUMN user_projects.project_id IS '项目ID（关联projects表）';
COMMENT ON COLUMN user_projects.can_view IS '是否可查看';
COMMENT ON COLUMN user_projects.can_edit IS '是否可编辑';
COMMENT ON COLUMN user_projects.can_delete IS '是否可删除';
COMMENT ON COLUMN user_projects.created_at IS '创建时间';
COMMENT ON COLUMN user_projects.updated_at IS '更新时间';
COMMENT ON COLUMN user_projects.created_by IS '创建人ID';

-- ============================================================================
-- 15. external_platforms（外部平台表）- 6个字段
-- ============================================================================

COMMENT ON TABLE external_platforms IS '外部平台表（其他物流平台）';

COMMENT ON COLUMN external_platforms.id IS '主键ID';
COMMENT ON COLUMN external_platforms.platform_name IS '平台名称';
COMMENT ON COLUMN external_platforms.platform_code IS '平台代码';
COMMENT ON COLUMN external_platforms.is_active IS '是否启用';
COMMENT ON COLUMN external_platforms.created_at IS '创建时间';
COMMENT ON COLUMN external_platforms.updated_at IS '更新时间';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 第4批：辅助业务表注释已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已完成表：';
    RAISE NOTICE '  ✓ contracts - 合同表 (21个字段)';
    RAISE NOTICE '  ✓ profiles - 用户配置表 (11个字段)';
    RAISE NOTICE '  ✓ menu_config - 菜单配置表 (9个字段)';
    RAISE NOTICE '  ✓ notifications - 通知表 (13个字段)';
    RAISE NOTICE '  ✓ scale_records - 过磅记录表 (15个字段)';
    RAISE NOTICE '  ✓ billing_types - 计费类型表 (6个字段)';
    RAISE NOTICE '  ✓ user_permissions - 用户权限表 (12个字段)';
    RAISE NOTICE '  ✓ invoice_request_details - 开票申请明细 (13个字段)';
    RAISE NOTICE '  ✓ internal_vehicles - 剩余字段 (24个字段)';
    RAISE NOTICE '  ✓ internal_vehicle_monthly_income - 月度收入 (12个字段)';
    RAISE NOTICE '  ✓ payment_records - 付款记录 (11个字段)';
    RAISE NOTICE '  ✓ invoice_records - 开票记录 (11个字段)';
    RAISE NOTICE '  ✓ operation_logs - 操作日志 (8个字段)';
    RAISE NOTICE '  ✓ driver_projects - 司机项目关联 (6个字段)';
    RAISE NOTICE '  ✓ location_projects - 地点项目关联 (6个字段)';
    RAISE NOTICE '  ✓ user_projects - 用户项目权限 (9个字段)';
    RAISE NOTICE '  ✓ external_platforms - 外部平台 (6个字段)';
    RAISE NOTICE '';
    RAISE NOTICE '剩余合同相关表将在第5批添加';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

