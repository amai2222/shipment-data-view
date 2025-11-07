-- ============================================================================
-- 为核心业务表添加字段中文注释（基于实际查询结果）
-- 创建日期：2025-11-07
-- ============================================================================

-- ============================================================================
-- 1. logistics_records（运单记录表）- 25个字段
-- ============================================================================

COMMENT ON TABLE logistics_records IS '物流运单记录表（核心业务表）';

COMMENT ON COLUMN logistics_records.id IS '主键ID';
COMMENT ON COLUMN logistics_records.auto_number IS '运单编号（自动生成，格式：YDN+日期+序号）';
COMMENT ON COLUMN logistics_records.project_id IS '项目ID（关联projects表）';
COMMENT ON COLUMN logistics_records.project_name IS '项目名称（冗余字段）';
COMMENT ON COLUMN logistics_records.loading_date IS '装货日期';
COMMENT ON COLUMN logistics_records.loading_location IS '装货地点';
COMMENT ON COLUMN logistics_records.unloading_location IS '卸货地点';
COMMENT ON COLUMN logistics_records.driver_id IS '司机ID（关联drivers表）';
COMMENT ON COLUMN logistics_records.driver_name IS '司机姓名（冗余字段）';
COMMENT ON COLUMN logistics_records.license_plate IS '车牌号';
COMMENT ON COLUMN logistics_records.driver_phone IS '司机电话';
COMMENT ON COLUMN logistics_records.loading_weight IS '装货重量/数量（吨/次/立方，根据计费类型）';
COMMENT ON COLUMN logistics_records.unloading_date IS '卸货日期';
COMMENT ON COLUMN logistics_records.unloading_weight IS '卸货重量/数量';
COMMENT ON COLUMN logistics_records.transport_type IS '运输类型：实际运输、退货、内部派单等';
COMMENT ON COLUMN logistics_records.current_cost IS '当前运费（司机应收基础运费，元，2位小数）';
COMMENT ON COLUMN logistics_records.extra_cost IS '额外费用（司机额外收入，元，2位小数）';
COMMENT ON COLUMN logistics_records.payable_cost IS '司机应收合计（current_cost + extra_cost，元，2位小数）';
COMMENT ON COLUMN logistics_records.remarks IS '备注信息';
COMMENT ON COLUMN logistics_records.created_by_user_id IS '创建人用户ID';
COMMENT ON COLUMN logistics_records.created_at IS '创建时间';
COMMENT ON COLUMN logistics_records.chain_id IS '合作链路ID（关联partner_chains表）';
COMMENT ON COLUMN logistics_records.user_id IS '关联用户ID';
COMMENT ON COLUMN logistics_records.billing_type_id IS '计费类型ID（关联billing_types表）';
COMMENT ON COLUMN logistics_records.external_tracking_numbers IS '其他平台运单号（JSONB数组格式）';

-- ============================================================================
-- 2. invoice_requests（开票申请单表）- 31个字段
-- ============================================================================

COMMENT ON TABLE invoice_requests IS '开票申请单表';

COMMENT ON COLUMN invoice_requests.id IS '主键ID';
COMMENT ON COLUMN invoice_requests.invoicing_partner_id IS '开票方ID（实际开票的合作方）';
COMMENT ON COLUMN invoice_requests.partner_name IS '合作方简称';
COMMENT ON COLUMN invoice_requests.invoicing_partner_full_name IS '开票方全称（公司营业执照名称）';
COMMENT ON COLUMN invoice_requests.invoicing_partner_tax_number IS '开票方税号';
COMMENT ON COLUMN invoice_requests.invoicing_partner_company_address IS '开票方公司注册地址';
COMMENT ON COLUMN invoice_requests.invoicing_partner_bank_name IS '开票方开户银行';
COMMENT ON COLUMN invoice_requests.invoicing_partner_bank_account IS '开票方银行账号';
COMMENT ON COLUMN invoice_requests.total_amount IS '开票总金额（元，2位小数）';
COMMENT ON COLUMN invoice_requests.record_count IS '包含的运单数量';
COMMENT ON COLUMN invoice_requests.created_at IS '创建时间';
COMMENT ON COLUMN invoice_requests.updated_at IS '最后更新时间';
COMMENT ON COLUMN invoice_requests.applicant_id IS '申请人ID（关联auth.users表）';
COMMENT ON COLUMN invoice_requests.approved_by IS '审批人ID（关联auth.users表）';
COMMENT ON COLUMN invoice_requests.approved_at IS '审批时间';
COMMENT ON COLUMN invoice_requests.invoice_date IS '开票日期';
COMMENT ON COLUMN invoice_requests.invoice_number IS '发票号码';
COMMENT ON COLUMN invoice_requests.remarks IS '备注信息';
COMMENT ON COLUMN invoice_requests.applicant_name IS '申请人姓名';
COMMENT ON COLUMN invoice_requests.applied_at IS '申请时间';
COMMENT ON COLUMN invoice_requests.partner_id IS '合作方ID（关联partners表）';
COMMENT ON COLUMN invoice_requests.partner_full_name IS '合作方全称';
COMMENT ON COLUMN invoice_requests.tax_number IS '税号';
COMMENT ON COLUMN invoice_requests.company_address IS '公司地址';
COMMENT ON COLUMN invoice_requests.bank_name IS '开户银行';
COMMENT ON COLUMN invoice_requests.bank_account IS '银行账号';
COMMENT ON COLUMN invoice_requests.created_by IS '创建人ID（关联auth.users表）';
COMMENT ON COLUMN invoice_requests.is_voided IS '是否已作废';
COMMENT ON COLUMN invoice_requests.voided_at IS '作废时间';
COMMENT ON COLUMN invoice_requests.voided_by IS '作废人ID';
COMMENT ON COLUMN invoice_requests.void_reason IS '作废原因';

-- ============================================================================
-- 3. payment_requests（付款申请单表）- 12个字段
-- ============================================================================

COMMENT ON TABLE payment_requests IS '付款申请单表';

COMMENT ON COLUMN payment_requests.id IS '主键ID';
COMMENT ON COLUMN payment_requests.created_at IS '创建时间';
COMMENT ON COLUMN payment_requests.request_id IS '申请单编号（格式：FKD+日期-序号 或 HBFKD+日期-序号）';
COMMENT ON COLUMN payment_requests.record_count IS '包含的运单数量';
COMMENT ON COLUMN payment_requests.created_by IS '创建人ID（关联auth.users表）';
COMMENT ON COLUMN payment_requests.status IS '申请单状态：Pending-待审核, Approved-已批准, Paid-已付款, Rejected-已驳回, Merged-已合并';
COMMENT ON COLUMN payment_requests.notes IS '备注信息';
COMMENT ON COLUMN payment_requests.user_id IS '关联用户ID';
COMMENT ON COLUMN payment_requests.logistics_record_ids IS '包含的运单ID数组（UUID数组）';
COMMENT ON COLUMN payment_requests.work_wechat_sp_no IS '企业微信审批单号';
COMMENT ON COLUMN payment_requests.approval_result IS '审批结果（企业微信审批返回）';
COMMENT ON COLUMN payment_requests.updated_at IS '最后更新时间';

-- ============================================================================
-- 4. logistics_partner_costs（合作方成本表）- 11个字段
-- ============================================================================

COMMENT ON TABLE logistics_partner_costs IS '合作方成本分摊表（记录每级合作方的应收金额）';

COMMENT ON COLUMN logistics_partner_costs.id IS '主键ID';
COMMENT ON COLUMN logistics_partner_costs.logistics_record_id IS '运单ID（关联logistics_records表）';
COMMENT ON COLUMN logistics_partner_costs.partner_id IS '合作方ID（关联partners表）';
COMMENT ON COLUMN logistics_partner_costs.level IS '合作方级别（1级、2级、3级等，数字越大级别越高）';
COMMENT ON COLUMN logistics_partner_costs.base_amount IS '基础金额（上一级的应付金额，元，2位小数）';
COMMENT ON COLUMN logistics_partner_costs.payable_amount IS '应付金额（本级合作方应收金额，元，2位小数）';
COMMENT ON COLUMN logistics_partner_costs.tax_rate IS '税率（如0.06表示6%，0.03表示3%）';
COMMENT ON COLUMN logistics_partner_costs.created_at IS '创建时间';
COMMENT ON COLUMN logistics_partner_costs.user_id IS '创建用户ID';
COMMENT ON COLUMN logistics_partner_costs.invoice_number IS '发票号码';
COMMENT ON COLUMN logistics_partner_costs.payment_reference IS '付款参考号';

-- ============================================================================
-- 验证
-- ============================================================================

DO $$
DECLARE
    v_lr_count INTEGER;
    v_ir_count INTEGER;
    v_pr_count INTEGER;
    v_lpc_count INTEGER;
BEGIN
    -- 统计每个表有注释的字段数
    SELECT COUNT(*) INTO v_lr_count
    FROM pg_catalog.pg_description pgd
    JOIN pg_catalog.pg_class c ON pgd.objoid = c.oid
    WHERE c.relname = 'logistics_records'
    AND pgd.objsubid > 0;
    
    SELECT COUNT(*) INTO v_ir_count
    FROM pg_catalog.pg_description pgd
    JOIN pg_catalog.pg_class c ON pgd.objoid = c.oid
    WHERE c.relname = 'invoice_requests'
    AND pgd.objsubid > 0;
    
    SELECT COUNT(*) INTO v_pr_count
    FROM pg_catalog.pg_description pgd
    JOIN pg_catalog.pg_class c ON pgd.objoid = c.oid
    WHERE c.relname = 'payment_requests'
    AND pgd.objsubid > 0;
    
    SELECT COUNT(*) INTO v_lpc_count
    FROM pg_catalog.pg_description pgd
    JOIN pg_catalog.pg_class c ON pgd.objoid = c.oid
    WHERE c.relname = 'logistics_partner_costs'
    AND pgd.objsubid > 0;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 核心业务表字段注释已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '统计：';
    RAISE NOTICE '  • logistics_records: % 个字段有注释', v_lr_count;
    RAISE NOTICE '  • invoice_requests: % 个字段有注释', v_ir_count;
    RAISE NOTICE '  • payment_requests: % 个字段有注释', v_pr_count;
    RAISE NOTICE '  • logistics_partner_costs: % 个字段有注释', v_lpc_count;
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

