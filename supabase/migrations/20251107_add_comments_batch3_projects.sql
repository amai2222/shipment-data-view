-- ============================================================================
-- 为项目和合作方表添加字段中文注释 - 第3批（基于实际查询结果）
-- 创建日期：2025-11-07
-- ============================================================================

-- ============================================================================
-- 1. projects（项目表）- 13个字段
-- ============================================================================

COMMENT ON TABLE projects IS '项目表（客户项目管理）';

COMMENT ON COLUMN projects.id IS '主键ID';
COMMENT ON COLUMN projects.name IS '项目名称';
COMMENT ON COLUMN projects.start_date IS '项目开始日期';
COMMENT ON COLUMN projects.end_date IS '项目结束日期';
COMMENT ON COLUMN projects.manager IS '项目经理';
COMMENT ON COLUMN projects.loading_address IS '主要装货地址';
COMMENT ON COLUMN projects.unloading_address IS '主要卸货地址';
COMMENT ON COLUMN projects.created_at IS '创建时间';
COMMENT ON COLUMN projects.auto_code IS '项目自动编码';
COMMENT ON COLUMN projects.user_id IS '创建用户ID';
COMMENT ON COLUMN projects.planned_total_tons IS '计划总吨数';
COMMENT ON COLUMN projects.cargo_type IS '货物类型';
COMMENT ON COLUMN projects.updated_at IS '最后更新时间';

-- ============================================================================
-- 2. partners（合作方表）- 6个字段
-- ============================================================================

COMMENT ON TABLE partners IS '合作方表（合作公司/个人）';

COMMENT ON COLUMN partners.id IS '主键ID';
COMMENT ON COLUMN partners.name IS '合作方简称';
COMMENT ON COLUMN partners.tax_rate IS '税率（如0.06表示6%）';
COMMENT ON COLUMN partners.created_at IS '创建时间';
COMMENT ON COLUMN partners.user_id IS '创建用户ID';
COMMENT ON COLUMN partners.updated_at IS '最后更新时间';

-- ============================================================================
-- 3. drivers（外部司机表）- 9个字段
-- ============================================================================

COMMENT ON TABLE drivers IS '外部司机表（非公司员工的合作司机）';

COMMENT ON COLUMN drivers.id IS '主键ID';
COMMENT ON COLUMN drivers.name IS '司机姓名';
COMMENT ON COLUMN drivers.license_plate IS '车牌号';
COMMENT ON COLUMN drivers.phone IS '司机电话';
COMMENT ON COLUMN drivers.created_at IS '创建时间';
COMMENT ON COLUMN drivers.user_id IS '创建用户ID';
COMMENT ON COLUMN drivers.driving_license_photos IS '驾驶证照片（JSONB数组）';
COMMENT ON COLUMN drivers.transport_license_photos IS '道路运输从业资格证照片（JSONB数组）';
COMMENT ON COLUMN drivers.updated_at IS '最后更新时间';

-- ============================================================================
-- 4. locations（地点表）- 5个字段
-- ============================================================================

COMMENT ON TABLE locations IS '地点表（装货/卸货地点）';

COMMENT ON COLUMN locations.id IS '主键ID';
COMMENT ON COLUMN locations.name IS '地点名称';
COMMENT ON COLUMN locations.created_at IS '创建时间';
COMMENT ON COLUMN locations.user_id IS '创建用户ID';
COMMENT ON COLUMN locations.updated_at IS '最后更新时间';

-- ============================================================================
-- 5. partner_bank_details（合作方银行信息表）- 10个字段
-- ============================================================================

COMMENT ON TABLE partner_bank_details IS '合作方银行账户信息表（开票和付款用）';

COMMENT ON COLUMN partner_bank_details.partner_id IS '合作方ID（关联partners表）';
COMMENT ON COLUMN partner_bank_details.bank_account IS '银行账号';
COMMENT ON COLUMN partner_bank_details.bank_name IS '开户银行';
COMMENT ON COLUMN partner_bank_details.branch_name IS '开户支行';
COMMENT ON COLUMN partner_bank_details.user_id IS '创建用户ID';
COMMENT ON COLUMN partner_bank_details.created_at IS '创建时间';
COMMENT ON COLUMN partner_bank_details.updated_at IS '最后更新时间';
COMMENT ON COLUMN partner_bank_details.full_name IS '公司全称（营业执照名称）';
COMMENT ON COLUMN partner_bank_details.tax_number IS '税号';
COMMENT ON COLUMN partner_bank_details.company_address IS '公司注册地址';

-- ============================================================================
-- 6. partner_chains（合作链路表）- 9个字段
-- ============================================================================

COMMENT ON TABLE partner_chains IS '合作链路表（项目的合作方链路配置）';

COMMENT ON COLUMN partner_chains.id IS '主键ID';
COMMENT ON COLUMN partner_chains.project_id IS '项目ID（关联projects表）';
COMMENT ON COLUMN partner_chains.chain_name IS '链路名称：默认链路、特殊链路等';
COMMENT ON COLUMN partner_chains.description IS '链路描述';
COMMENT ON COLUMN partner_chains.is_default IS '是否为默认链路';
COMMENT ON COLUMN partner_chains.created_at IS '创建时间';
COMMENT ON COLUMN partner_chains.user_id IS '创建用户ID';
COMMENT ON COLUMN partner_chains.billing_type_id IS '计费类型ID（关联billing_types表）';
COMMENT ON COLUMN partner_chains.updated_at IS '最后更新时间';

-- ============================================================================
-- 7. project_partners（项目合作方配置表）- 11个字段
-- ============================================================================

COMMENT ON TABLE project_partners IS '项目合作方配置表（项目中各级合作方的税率和计算方式）';

COMMENT ON COLUMN project_partners.id IS '主键ID';
COMMENT ON COLUMN project_partners.project_id IS '项目ID（关联projects表）';
COMMENT ON COLUMN project_partners.partner_id IS '合作方ID（关联partners表）';
COMMENT ON COLUMN project_partners.level IS '合作方级别（1级、2级、3级等）';
COMMENT ON COLUMN project_partners.created_at IS '创建时间';
COMMENT ON COLUMN project_partners.tax_rate IS '税率（如0.06表示6%）';
COMMENT ON COLUMN project_partners.chain_id IS '所属链路ID（关联partner_chains表）';
COMMENT ON COLUMN project_partners.calculation_method IS '计算方法：tax-税点法, profit-利润法';
COMMENT ON COLUMN project_partners.profit_rate IS '利润率（利润法使用，元/吨或固定金额）';
COMMENT ON COLUMN project_partners.user_id IS '创建用户ID';
COMMENT ON COLUMN project_partners.updated_at IS '最后更新时间';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 第3批：项目和合作方表注释已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已完成表：';
    RAISE NOTICE '  ✓ projects (13个字段)';
    RAISE NOTICE '  ✓ partners (6个字段)';
    RAISE NOTICE '  ✓ drivers (9个字段)';
    RAISE NOTICE '  ✓ locations (5个字段)';
    RAISE NOTICE '  ✓ partner_bank_details (10个字段)';
    RAISE NOTICE '  ✓ partner_chains (9个字段)';
    RAISE NOTICE '  ✓ project_partners (11个字段)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

