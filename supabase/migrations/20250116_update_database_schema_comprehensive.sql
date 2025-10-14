-- 综合数据库架构更新迁移文件
-- 创建时间: 2025-01-16
-- 描述: 根据当前数据表结构更新数据库架构

-- 1. 创建枚举类型
DO $$ 
BEGIN
    -- 创建合同类别枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_category') THEN
        CREATE TYPE contract_category AS ENUM ('service', 'supply', 'purchase', 'cooperation', 'other');
    END IF;
    
    -- 创建地理编码状态枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'geocoding_status') THEN
        CREATE TYPE geocoding_status AS ENUM ('pending', 'success', 'failed');
    END IF;
    
    -- 创建应用角色枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('admin', 'finance', 'operator', 'viewer');
    END IF;
    
    -- 创建有效数量类型枚举
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'effective_quantity_type') THEN
        CREATE TYPE effective_quantity_type AS ENUM ('min_value', 'max_value', 'average');
    END IF;
END $$;

-- 2. 创建序列
CREATE SEQUENCE IF NOT EXISTS function_backup_log_id_seq;

-- 3. 创建核心业务表

-- 计费类型表
CREATE TABLE IF NOT EXISTS public.billing_types (
    billing_type_id bigint NOT NULL,
    type_name text,
    type_code text,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (billing_type_id)
);

-- 司机表
CREATE TABLE IF NOT EXISTS public.drivers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    license_plate text NOT NULL,
    phone text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    id_card_photos jsonb DEFAULT '[]'::jsonb,
    driver_license_photos jsonb DEFAULT '[]'::jsonb,
    qualification_certificate_photos jsonb DEFAULT '[]'::jsonb,
    transport_license_photos jsonb DEFAULT '[]'::jsonb,
    driving_license_photos jsonb DEFAULT '[]'::jsonb,
    PRIMARY KEY (id)
);

-- 地点表
CREATE TABLE IF NOT EXISTS public.locations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    address text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    formatted_address text,
    province text,
    city text,
    district text,
    township text,
    street text,
    street_number text,
    citycode text,
    adcode text,
    user_id uuid,
    geocoding_status geocoding_status DEFAULT 'pending',
    geocoding_error text,
    geocoding_updated_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- 项目表
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    manager text NOT NULL,
    finance_manager text,
    start_date text NOT NULL,
    end_date text NOT NULL,
    loading_address text NOT NULL,
    unloading_address text NOT NULL,
    cargo_type text NOT NULL DEFAULT '货品',
    project_status text NOT NULL DEFAULT '进行中',
    effective_quantity_type effective_quantity_type NOT NULL DEFAULT 'min_value',
    auto_code text,
    user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- 合作方表
CREATE TABLE IF NOT EXISTS public.partners (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    full_name text,
    tax_number text,
    company_address text,
    tax_rate numeric(5,4) NOT NULL,
    user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- 合作方银行详情表
CREATE TABLE IF NOT EXISTS public.partner_bank_details (
    partner_id uuid NOT NULL,
    full_name text,
    tax_number text,
    company_address text,
    bank_name text,
    bank_account text,
    branch_name text,
    user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (partner_id),
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

-- 合作链路表
CREATE TABLE IF NOT EXISTS public.partner_chains (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    chain_name text NOT NULL DEFAULT '默认链路',
    description text,
    is_default boolean NOT NULL DEFAULT false,
    billing_type_id bigint,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- 项目合作方关联表
CREATE TABLE IF NOT EXISTS public.project_partners (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    chain_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    level integer NOT NULL,
    calculation_method text DEFAULT 'tax',
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
    FOREIGN KEY (chain_id) REFERENCES public.partner_chains(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

-- 司机项目关联表
CREATE TABLE IF NOT EXISTS public.driver_projects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    driver_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- 地点项目关联表
CREATE TABLE IF NOT EXISTS public.location_projects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- 运单记录表
CREATE TABLE IF NOT EXISTS public.logistics_records (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    auto_number text NOT NULL,
    project_id uuid,
    project_name text NOT NULL,
    driver_id uuid,
    driver_name text NOT NULL,
    driver_phone text NOT NULL,
    license_plate text NOT NULL,
    loading_location text NOT NULL,
    unloading_location text NOT NULL,
    loading_date timestamp with time zone NOT NULL,
    unloading_date timestamp with time zone,
    transport_type text NOT NULL,
    cargo_type text,
    billing_type_id bigint DEFAULT 1,
    chain_id uuid,
    user_id uuid,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    remarks text,
    external_tracking_numbers text[] DEFAULT '{}',
    loading_location_ids uuid[],
    unloading_location_ids uuid[],
    other_platform_names text[] DEFAULT '{}',
    payment_status text NOT NULL DEFAULT 'Unpaid',
    invoice_status text DEFAULT 'Uninvoiced',
    payment_applied_at timestamp with time zone,
    payment_completed_at timestamp with time zone,
    invoice_applied_at timestamp with time zone,
    invoice_completed_at timestamp with time zone,
    payment_request_id uuid,
    invoice_request_id uuid,
    payment_reference text,
    invoice_number text,
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL,
    FOREIGN KEY (chain_id) REFERENCES public.partner_chains(id) ON DELETE SET NULL
);

-- 运单合作方成本表
CREATE TABLE IF NOT EXISTS public.logistics_partner_costs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    logistics_record_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    level integer NOT NULL,
    base_amount numeric(12,2) NOT NULL,
    payable_amount numeric(12,2) NOT NULL,
    tax_rate numeric(5,4) NOT NULL,
    invoice_status text DEFAULT 'Uninvoiced',
    payment_status text DEFAULT 'Unpaid',
    invoice_applied_at timestamp with time zone,
    invoice_completed_at timestamp with time zone,
    payment_applied_at timestamp with time zone,
    payment_completed_at timestamp with time zone,
    invoice_request_id uuid,
    payment_request_id uuid,
    invoice_number text,
    payment_reference text,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (logistics_record_id) REFERENCES public.logistics_records(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

-- 付款申请表
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    request_id text NOT NULL,
    logistics_record_ids uuid[],
    record_count integer NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    work_wechat_sp_no text,
    approval_result jsonb,
    notes text,
    created_by uuid,
    user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- 付款申请项目表
CREATE TABLE IF NOT EXISTS public.partner_payment_items (
    payment_request_id uuid NOT NULL,
    logistics_record_id uuid NOT NULL,
    user_id uuid,
    PRIMARY KEY (payment_request_id, logistics_record_id),
    FOREIGN KEY (payment_request_id) REFERENCES public.payment_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (logistics_record_id) REFERENCES public.logistics_records(id) ON DELETE CASCADE
);

-- 付款记录表
CREATE TABLE IF NOT EXISTS public.payment_records (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    logistics_record_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    payment_date date NOT NULL DEFAULT CURRENT_DATE,
    bank_receipt_number text,
    payment_image_urls text[],
    remarks text,
    user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (logistics_record_id) REFERENCES public.logistics_records(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

-- 开票申请表
CREATE TABLE IF NOT EXISTS public.invoice_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    request_number text NOT NULL,
    invoicing_partner_id uuid NOT NULL,
    partner_id uuid,
    partner_name text NOT NULL,
    partner_full_name text,
    tax_number text,
    company_address text,
    bank_name text,
    bank_account text,
    invoicing_partner_full_name text,
    invoicing_partner_tax_number text,
    invoicing_partner_company_address text,
    invoicing_partner_bank_name text,
    invoicing_partner_bank_account text,
    total_amount numeric(15,2) NOT NULL DEFAULT 0,
    record_count integer NOT NULL DEFAULT 0,
    status text DEFAULT 'Pending',
    applicant_id uuid,
    applicant_name varchar(100),
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    applied_at timestamp with time zone DEFAULT now(),
    invoice_date date,
    invoice_number text,
    remarks text,
    is_voided boolean DEFAULT false,
    voided_at timestamp with time zone,
    voided_by uuid,
    void_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (invoicing_partner_id) REFERENCES public.partners(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL
);

-- 开票申请详情表
CREATE TABLE IF NOT EXISTS public.invoice_request_details (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    invoice_request_id uuid NOT NULL,
    logistics_record_id uuid NOT NULL,
    auto_number varchar(50),
    project_name varchar(200),
    driver_name varchar(100),
    loading_location varchar(200),
    unloading_location varchar(200),
    loading_date date,
    invoiceable_amount numeric(15,2) NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (invoice_request_id) REFERENCES public.invoice_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (logistics_record_id) REFERENCES public.logistics_records(id) ON DELETE CASCADE
);

-- 开票记录表
CREATE TABLE IF NOT EXISTS public.invoice_records (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    logistics_record_id uuid NOT NULL,
    partner_id uuid NOT NULL,
    invoice_date date NOT NULL DEFAULT CURRENT_DATE,
    invoice_number text,
    invoice_image_urls text[],
    bank_receipt_number text,
    remarks text,
    user_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (logistics_record_id) REFERENCES public.logistics_records(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

-- 4. 创建用户和权限相关表

-- 用户配置文件表
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    email text,
    username text,
    full_name text,
    phone text,
    avatar_url text,
    role app_role DEFAULT 'operator',
    is_active boolean DEFAULT true,
    work_wechat_name text,
    work_wechat_userid text,
    work_wechat_department text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 用户权限表
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    project_id uuid,
    menu_permissions text[] DEFAULT '{}',
    function_permissions text[] DEFAULT '{}',
    project_permissions text[] DEFAULT '{}',
    data_permissions text[] DEFAULT '{}',
    custom_settings jsonb DEFAULT '{}',
    inherit_role boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- 用户项目关联表
CREATE TABLE IF NOT EXISTS public.user_projects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    role app_role DEFAULT 'operator',
    can_view boolean DEFAULT true,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- 用户角色表
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role app_role NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 角色权限模板表
CREATE TABLE IF NOT EXISTS public.role_permission_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    role app_role NOT NULL,
    name text,
    description text,
    color text DEFAULT 'bg-blue-500',
    menu_permissions text[] DEFAULT '{}',
    function_permissions text[] DEFAULT '{}',
    project_permissions text[] DEFAULT '{}',
    data_permissions text[] DEFAULT '{}',
    is_system boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- 5. 创建合同管理相关表

-- 合同表
CREATE TABLE IF NOT EXISTS public.contracts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contract_number text,
    category contract_category NOT NULL,
    our_company text NOT NULL,
    counterparty_company text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    contract_amount numeric(15,2),
    responsible_person text,
    department text,
    status text NOT NULL DEFAULT 'active',
    priority text NOT NULL DEFAULT 'normal',
    is_confidential boolean NOT NULL DEFAULT false,
    contract_original_url text,
    attachment_url text,
    remarks text,
    access_count integer NOT NULL DEFAULT 0,
    last_accessed_at timestamp with time zone,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 合同权限表
CREATE TABLE IF NOT EXISTS public.contract_permissions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contract_id uuid,
    user_id uuid,
    permission_type text NOT NULL,
    department text,
    field_permissions jsonb,
    file_permissions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE
);

-- 合同所有者权限表
CREATE TABLE IF NOT EXISTS public.contract_owner_permissions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    permissions text[] DEFAULT ARRAY['view', 'edit', 'delete', 'download', 'manage'],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE
);

-- 合同标签表
CREATE TABLE IF NOT EXISTS public.contract_tags (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    color text NOT NULL DEFAULT '#3B82F6',
    is_system boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 合同标签关联表
CREATE TABLE IF NOT EXISTS public.contract_tag_relations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES public.contract_tags(id) ON DELETE CASCADE
);

-- 合同文件版本表
CREATE TABLE IF NOT EXISTS public.contract_file_versions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_url text NOT NULL,
    file_size bigint,
    file_hash text,
    version_number integer NOT NULL DEFAULT 1,
    is_current boolean NOT NULL DEFAULT true,
    description text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE
);

-- 合同访问日志表
CREATE TABLE IF NOT EXISTS public.contract_access_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    details jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE
);

-- 合同提醒表
CREATE TABLE IF NOT EXISTS public.contract_reminders (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    contract_id uuid NOT NULL,
    reminder_type text NOT NULL,
    reminder_date date NOT NULL,
    recipient_emails text[],
    is_sent boolean NOT NULL DEFAULT false,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE
);

-- 合同编号规则表
CREATE TABLE IF NOT EXISTS public.contract_numbering_rules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    category contract_category NOT NULL,
    prefix text NOT NULL,
    format text NOT NULL DEFAULT '{prefix}-{year}-{month}-{sequence}',
    current_sequence integer NOT NULL DEFAULT 0,
    year integer NOT NULL DEFAULT EXTRACT(year FROM now()),
    month integer NOT NULL DEFAULT EXTRACT(month FROM now()),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 合同类别权限模板表
CREATE TABLE IF NOT EXISTS public.contract_category_permission_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    category contract_category NOT NULL,
    template_name text NOT NULL,
    description text,
    default_permissions text[] DEFAULT '{}',
    role_permissions jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 6. 创建导入模板相关表

-- 导入模板表
CREATE TABLE IF NOT EXISTS public.import_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    description text,
    platform_type varchar(100) NOT NULL,
    template_config jsonb NOT NULL DEFAULT '{}',
    field_mappings jsonb NOT NULL DEFAULT '[]',
    is_active boolean DEFAULT true,
    is_system boolean DEFAULT false,
    created_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 导入字段映射表
CREATE TABLE IF NOT EXISTS public.import_field_mappings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL,
    excel_column varchar(100) NOT NULL,
    database_field varchar(100) NOT NULL,
    field_type varchar(50) NOT NULL,
    is_required boolean DEFAULT false,
    validation_rules jsonb DEFAULT '{}',
    default_value text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (template_id) REFERENCES public.import_templates(id) ON DELETE CASCADE
);

-- 导入固定映射表
CREATE TABLE IF NOT EXISTS public.import_fixed_mappings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL,
    mapping_type varchar(50) NOT NULL,
    excel_value text NOT NULL,
    database_value text NOT NULL,
    is_case_sensitive boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (template_id) REFERENCES public.import_templates(id) ON DELETE CASCADE
);

-- 7. 创建其他辅助表

-- 外部平台表
CREATE TABLE IF NOT EXISTS public.external_platforms (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    platform_name text NOT NULL,
    platform_code text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- 地磅记录表
CREATE TABLE IF NOT EXISTS public.scale_records (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    project_name text NOT NULL,
    logistics_number text,
    trip_number integer NOT NULL,
    loading_date date NOT NULL,
    driver_name text,
    license_plate text,
    billing_type_id bigint NOT NULL DEFAULT 1,
    image_urls text[] DEFAULT '{}',
    user_id uuid NOT NULL DEFAULT auth.uid(),
    created_by_user_id uuid NOT NULL DEFAULT auth.uid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE
);

-- 通知表
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    type text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    related_id uuid,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS public.operation_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    operation_type text NOT NULL,
    record_id uuid,
    record_info jsonb,
    operated_by uuid,
    operated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- 权限审计日志表
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    target_user_id uuid,
    target_project_id uuid,
    permission_type text NOT NULL,
    permission_key text NOT NULL,
    action text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    reason text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- 保存的搜索表
CREATE TABLE IF NOT EXISTS public.saved_searches (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    search_type text NOT NULL,
    name text NOT NULL,
    filters jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 函数备份日志表
CREATE TABLE IF NOT EXISTS public.function_backup_log (
    id integer NOT NULL DEFAULT nextval('function_backup_log_id_seq'),
    function_name text NOT NULL,
    function_arguments text,
    function_type text DEFAULT 'function',
    schema_name text DEFAULT 'public',
    original_definition text,
    backup_reason text DEFAULT 'Full backup before security fix',
    backup_time timestamp without time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- 8. 创建索引以提高查询性能

-- 运单记录表索引
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_id ON public.logistics_records(project_id);
CREATE INDEX IF NOT EXISTS idx_logistics_records_driver_id ON public.logistics_records(driver_id);
CREATE INDEX IF NOT EXISTS idx_logistics_records_loading_date ON public.logistics_records(loading_date);
CREATE INDEX IF NOT EXISTS idx_logistics_records_auto_number ON public.logistics_records(auto_number);
CREATE INDEX IF NOT EXISTS idx_logistics_records_payment_status ON public.logistics_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_status ON public.logistics_records(invoice_status);

-- 运单合作方成本表索引
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_logistics_record_id ON public.logistics_partner_costs(logistics_record_id);
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_partner_id ON public.logistics_partner_costs(partner_id);
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_invoice_status ON public.logistics_partner_costs(invoice_status);
CREATE INDEX IF NOT EXISTS idx_logistics_partner_costs_payment_status ON public.logistics_partner_costs(payment_status);

-- 开票申请表索引
CREATE INDEX IF NOT EXISTS idx_invoice_requests_invoicing_partner_id ON public.invoice_requests(invoicing_partner_id);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_status ON public.invoice_requests(status);
CREATE INDEX IF NOT EXISTS idx_invoice_requests_created_at ON public.invoice_requests(created_at);

-- 付款申请表索引
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON public.payment_requests(created_at);

-- 用户权限表索引
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_project_id ON public.user_permissions(project_id);

-- 用户项目关联表索引
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON public.user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project_id ON public.user_projects(project_id);

-- 9. 添加必要的约束

-- 添加唯一约束
ALTER TABLE public.logistics_records ADD CONSTRAINT IF NOT EXISTS uk_logistics_records_auto_number UNIQUE (auto_number);
ALTER TABLE public.invoice_requests ADD CONSTRAINT IF NOT EXISTS uk_invoice_requests_request_number UNIQUE (request_number);
ALTER TABLE public.payment_requests ADD CONSTRAINT IF NOT EXISTS uk_payment_requests_request_id UNIQUE (request_id);

-- 添加检查约束
ALTER TABLE public.logistics_records ADD CONSTRAINT IF NOT EXISTS ck_logistics_records_payment_status 
    CHECK (payment_status IN ('Unpaid', 'Processing', 'Paid'));
ALTER TABLE public.logistics_records ADD CONSTRAINT IF NOT EXISTS ck_logistics_records_invoice_status 
    CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));

ALTER TABLE public.logistics_partner_costs ADD CONSTRAINT IF NOT EXISTS ck_logistics_partner_costs_payment_status 
    CHECK (payment_status IN ('Unpaid', 'Processing', 'Paid'));
ALTER TABLE public.logistics_partner_costs ADD CONSTRAINT IF NOT EXISTS ck_logistics_partner_costs_invoice_status 
    CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));

ALTER TABLE public.invoice_requests ADD CONSTRAINT IF NOT EXISTS ck_invoice_requests_status 
    CHECK (status IN ('Pending', 'Processing', 'Approved', 'Cancelled'));

ALTER TABLE public.payment_requests ADD CONSTRAINT IF NOT EXISTS ck_payment_requests_status 
    CHECK (status IN ('pending', 'processing', 'approved', 'rejected'));

-- 10. 创建必要的视图

-- 运单记录视图（包含关联信息）
CREATE OR REPLACE VIEW public.logistics_records_view AS
SELECT 
    lr.*,
    p.name as project_name,
    d.name as driver_name,
    d.phone as driver_phone,
    d.license_plate,
    pc.chain_name
FROM public.logistics_records lr
LEFT JOIN public.projects p ON lr.project_id = p.id
LEFT JOIN public.drivers d ON lr.driver_id = d.id
LEFT JOIN public.partner_chains pc ON lr.chain_id = pc.id;

-- 11. 启用行级安全策略（RLS）
ALTER TABLE public.logistics_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_partner_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- 12. 创建基本的RLS策略
-- 注意：这里只创建基本的策略框架，具体的权限控制逻辑需要根据业务需求进一步完善

-- 用户只能访问自己的数据
CREATE POLICY IF NOT EXISTS "Users can view own data" ON public.logistics_records
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view own data" ON public.logistics_partner_costs
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can view own data" ON public.invoice_requests
    FOR ALL USING (auth.uid() = created_by);

CREATE POLICY IF NOT EXISTS "Users can view own data" ON public.payment_requests
    FOR ALL USING (auth.uid() = user_id);

-- 管理员可以访问所有数据
CREATE POLICY IF NOT EXISTS "Admins can view all data" ON public.logistics_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can view all data" ON public.logistics_partner_costs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can view all data" ON public.invoice_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can view all data" ON public.payment_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 完成迁移
COMMENT ON TABLE public.logistics_records IS '运单记录表 - 存储所有物流运单信息';
COMMENT ON TABLE public.logistics_partner_costs IS '运单合作方成本表 - 存储运单相关的合作方成本信息';
COMMENT ON TABLE public.invoice_requests IS '开票申请表 - 存储开票申请信息';
COMMENT ON TABLE public.payment_requests IS '付款申请表 - 存储付款申请信息';
COMMENT ON TABLE public.profiles IS '用户配置文件表 - 存储用户基本信息';
COMMENT ON TABLE public.projects IS '项目表 - 存储项目信息';
COMMENT ON TABLE public.partners IS '合作方表 - 存储合作方信息';
COMMENT ON TABLE public.drivers IS '司机表 - 存储司机信息';
COMMENT ON TABLE public.locations IS '地点表 - 存储地点信息';
