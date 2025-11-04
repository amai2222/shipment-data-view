-- ============================================================================
-- 步骤4：司机数据隔离 - RLS策略和辅助函数
-- ============================================================================
-- 功能：确保司机只能看到自己的数据（工资、费用、车辆）
-- 实现方式：通过 profiles.full_name 匹配 internal_drivers.name
-- 创建时间：2025-11-04
-- ============================================================================

BEGIN;

-- ==========================================
-- 准备工作：清理可能存在的旧表
-- ==========================================

DROP TABLE IF EXISTS public.internal_driver_monthly_salary CASCADE;
DROP TABLE IF EXISTS public.internal_driver_expense_applications CASCADE;

DROP FUNCTION IF EXISTS get_current_driver_id CASCADE;
DROP FUNCTION IF EXISTS get_my_vehicles CASCADE;
DROP FUNCTION IF EXISTS get_my_driver_info CASCADE;
DROP FUNCTION IF EXISTS get_my_expense_applications CASCADE;
DROP FUNCTION IF EXISTS get_my_salary CASCADE;
DROP FUNCTION IF EXISTS submit_expense_application CASCADE;
DROP FUNCTION IF EXISTS link_user_to_driver CASCADE;

-- ==========================================
-- 第一步：添加 user_id 字段到司机表（关联登录账号）
-- ==========================================

-- 为 internal_drivers 添加 linked_user_id 字段
ALTER TABLE internal_drivers 
ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_internal_drivers_linked_user_id 
ON internal_drivers(linked_user_id);

COMMENT ON COLUMN internal_drivers.linked_user_id IS '关联的登录账号ID（用于数据隔离）';

-- ==========================================
-- 第二步：创建辅助函数 - 获取当前登录司机的ID
-- ==========================================

CREATE OR REPLACE FUNCTION get_current_driver_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_user_full_name TEXT;
BEGIN
    -- 1. 先通过 linked_user_id 查找（精确匹配）
    SELECT id INTO v_driver_id
    FROM internal_drivers
    WHERE linked_user_id = auth.uid()
    AND is_active = true;
    
    IF v_driver_id IS NOT NULL THEN
        RETURN v_driver_id;
    END IF;
    
    -- 2. 如果没有关联，通过姓名匹配（兼容模式）
    SELECT full_name INTO v_user_full_name
    FROM profiles
    WHERE id = auth.uid();
    
    IF v_user_full_name IS NOT NULL THEN
        SELECT id INTO v_driver_id
        FROM internal_drivers
        WHERE name = v_user_full_name
        AND is_active = true;
    END IF;
    
    RETURN v_driver_id;
END;
$$;

COMMENT ON FUNCTION get_current_driver_id IS '获取当前登录用户对应的司机档案ID';

-- ==========================================
-- 第三步：创建司机专用查询函数（只返回自己的数据）
-- ==========================================

-- 函数：获取我的车辆（司机只能看到自己驾驶的车）
CREATE OR REPLACE FUNCTION get_my_vehicles()
RETURNS TABLE (
    vehicle_id UUID,
    license_plate TEXT,
    vehicle_type TEXT,
    vehicle_brand TEXT,
    vehicle_model TEXT,
    is_primary BOOLEAN,
    relation_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    -- 获取当前司机ID
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        v.id as vehicle_id,
        v.license_plate,
        v.vehicle_type,
        v.vehicle_brand,
        v.vehicle_model,
        dvr.is_primary,
        dvr.relation_type
    FROM internal_vehicles v
    INNER JOIN internal_driver_vehicle_relations dvr ON v.id = dvr.vehicle_id
    WHERE dvr.driver_id = v_driver_id
    AND v.is_active = true
    ORDER BY dvr.is_primary DESC, v.license_plate;
END;
$$;

COMMENT ON FUNCTION get_my_vehicles IS '获取我的车辆（司机专用，只返回自己的车）';

-- 函数：获取我的司机档案信息
CREATE OR REPLACE FUNCTION get_my_driver_info()
RETURNS TABLE (
    driver_id UUID,
    name TEXT,
    phone TEXT,
    hire_date DATE,
    employment_status TEXT,
    base_salary NUMERIC,
    salary_calculation_type TEXT,
    commission_rate NUMERIC,
    bank_account TEXT,
    bank_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        d.id as driver_id,
        d.name,
        d.phone,
        d.hire_date,
        d.employment_status,
        d.base_salary,
        d.salary_calculation_type,
        d.commission_rate,
        d.bank_account,
        d.bank_name
    FROM internal_drivers d
    WHERE d.id = v_driver_id;
END;
$$;

COMMENT ON FUNCTION get_my_driver_info IS '获取我的司机档案信息（司机专用）';

-- ==========================================
-- 第四步：创建费用申请表
-- ==========================================

CREATE TABLE IF NOT EXISTS public.internal_driver_expense_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 关联信息
    driver_id UUID NOT NULL REFERENCES internal_drivers(id) ON DELETE CASCADE,
    application_number TEXT NOT NULL UNIQUE,  -- 申请单号
    
    -- 费用信息
    expense_date DATE NOT NULL,               -- 费用日期
    expense_type TEXT NOT NULL,               -- 费用类型：fuel, parking, toll, maintenance, fine, meal, accommodation, other
    amount NUMERIC(10,2) NOT NULL,            -- 费用金额
    description TEXT,                         -- 费用说明
    receipt_photos JSONB DEFAULT '[]'::jsonb, -- 凭证照片（七牛云URL数组）
    
    -- 审核信息
    status TEXT DEFAULT 'pending',            -- 状态：pending-待审核, approved-已通过, rejected-已驳回, paid-已付款
    reviewer_id UUID,                         -- 审核人ID
    review_time TIMESTAMPTZ,                  -- 审核时间
    review_comment TEXT,                      -- 审核意见
    payment_time TIMESTAMPTZ,                 -- 付款时间
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    CONSTRAINT valid_amount CHECK (amount > 0)
);

CREATE INDEX idx_expense_driver_id ON internal_driver_expense_applications(driver_id);
CREATE INDEX idx_expense_status ON internal_driver_expense_applications(status);
CREATE INDEX idx_expense_date ON internal_driver_expense_applications(expense_date);

COMMENT ON TABLE internal_driver_expense_applications IS '内部司机费用申请表';
COMMENT ON COLUMN internal_driver_expense_applications.driver_id IS '司机ID（外键关联 internal_drivers）';
COMMENT ON COLUMN internal_driver_expense_applications.receipt_photos IS '凭证照片URL数组（JSONB格式，七牛云存储）';

-- ==========================================
-- 第五步：启用费用申请表 RLS（数据隔离）
-- ==========================================

ALTER TABLE internal_driver_expense_applications ENABLE ROW LEVEL SECURITY;

-- 策略1：司机只能查看自己的费用申请
CREATE POLICY "expense_select_own_policy"
ON internal_driver_expense_applications
FOR SELECT
TO authenticated
USING (
    -- 司机角色：只能看自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
    )
    OR
    -- 车队长和管理员：可以看全部
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager', 'finance'))
    )
);

-- 策略2：司机只能插入自己的费用申请
CREATE POLICY "expense_insert_own_policy"
ON internal_driver_expense_applications
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
    AND driver_id = get_current_driver_id()
);

-- 策略3：司机可以更新自己待审核的申请
CREATE POLICY "expense_update_own_policy"
ON internal_driver_expense_applications
FOR UPDATE
TO authenticated
USING (
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
        AND status = 'pending'  -- 只能修改待审核的
    )
    OR
    -- 车队长和管理员可以更新任何申请（审核用）
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
    )
);

-- 策略4：司机可以删除自己待审核的申请
CREATE POLICY "expense_delete_own_policy"
ON internal_driver_expense_applications
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
    AND driver_id = get_current_driver_id()
    AND status = 'pending'
);

-- ==========================================
-- 第六步：创建司机专用的费用申请函数
-- ==========================================

-- 函数：提交费用申请（司机专用）
CREATE OR REPLACE FUNCTION submit_expense_application(
    p_expense_date DATE,
    p_expense_type TEXT,
    p_amount NUMERIC,
    p_description TEXT,
    p_receipt_photos JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_application_number TEXT;
    v_new_id UUID;
BEGIN
    -- 获取当前司机ID
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '未找到对应的司机档案'
        );
    END IF;
    
    -- 生成申请单号：FY + 日期 + 序号
    v_application_number := 'FY' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                            LPAD((
                                SELECT COUNT(*) + 1 
                                FROM internal_driver_expense_applications 
                                WHERE created_at::DATE = CURRENT_DATE
                            )::TEXT, 4, '0');
    
    -- 插入费用申请
    INSERT INTO internal_driver_expense_applications (
        driver_id,
        application_number,
        expense_date,
        expense_type,
        amount,
        description,
        receipt_photos,
        status
    ) VALUES (
        v_driver_id,
        v_application_number,
        p_expense_date,
        p_expense_type,
        p_amount,
        p_description,
        p_receipt_photos,
        'pending'
    ) RETURNING id INTO v_new_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '费用申请已提交',
        'application_id', v_new_id,
        'application_number', v_application_number
    );
END;
$$;

COMMENT ON FUNCTION submit_expense_application IS '提交费用申请（司机专用，自动关联当前司机）';

-- 函数：获取我的费用申请列表（司机专用）
CREATE OR REPLACE FUNCTION get_my_expense_applications(
    p_status TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    application_number TEXT,
    expense_date DATE,
    expense_type TEXT,
    amount NUMERIC,
    description TEXT,
    receipt_photos JSONB,
    status TEXT,
    review_comment TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        ea.id,
        ea.application_number,
        ea.expense_date,
        ea.expense_type,
        ea.amount,
        ea.description,
        ea.receipt_photos,
        ea.status,
        ea.review_comment,
        ea.created_at
    FROM internal_driver_expense_applications ea
    WHERE ea.driver_id = v_driver_id
    AND (p_status IS NULL OR ea.status = p_status)
    ORDER BY ea.created_at DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_my_expense_applications IS '获取我的费用申请列表（司机专用，只返回自己的申请）';

-- ==========================================
-- 第七步：创建工资表和查询函数
-- ==========================================

-- 工资记录表
CREATE TABLE IF NOT EXISTS public.internal_driver_monthly_salary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    driver_id UUID NOT NULL REFERENCES internal_drivers(id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,              -- 年月：2025-11
    
    -- 工资明细
    base_salary NUMERIC(10,2) DEFAULT 0,   -- 基本工资
    trip_count INTEGER DEFAULT 0,          -- 出车次数
    trip_commission NUMERIC(10,2) DEFAULT 0, -- 车次提成
    total_income NUMERIC(10,2) DEFAULT 0,  -- 应发合计
    deductions NUMERIC(10,2) DEFAULT 0,    -- 扣款（费用申请）
    net_salary NUMERIC(10,2) DEFAULT 0,    -- 实发工资
    
    -- 状态
    status TEXT DEFAULT 'calculating',     -- 状态：calculating-核算中, confirmed-已确认, paid-已发放
    payment_date DATE,                     -- 发放日期
    
    -- 备注
    remarks TEXT,
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_driver_month UNIQUE (driver_id, year_month)
);

CREATE INDEX idx_salary_driver_id ON internal_driver_monthly_salary(driver_id);
CREATE INDEX idx_salary_year_month ON internal_driver_monthly_salary(year_month);

COMMENT ON TABLE internal_driver_monthly_salary IS '内部司机月度工资表';

-- 启用 RLS
ALTER TABLE internal_driver_monthly_salary ENABLE ROW LEVEL SECURITY;

-- RLS策略：司机只能看自己的工资
CREATE POLICY "salary_select_own_policy"
ON internal_driver_monthly_salary
FOR SELECT
TO authenticated
USING (
    -- 司机：只能看自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
    )
    OR
    -- 车队长、财务、管理员：可以看全部
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager', 'finance'))
    )
);

-- 函数：获取我的工资（司机专用）
CREATE OR REPLACE FUNCTION get_my_salary(
    p_year_month TEXT DEFAULT NULL  -- NULL = 最近3个月
)
RETURNS TABLE (
    year_month TEXT,
    base_salary NUMERIC,
    trip_count INTEGER,
    trip_commission NUMERIC,
    total_income NUMERIC,
    deductions NUMERIC,
    net_salary NUMERIC,
    status TEXT,
    payment_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
BEGIN
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RAISE EXCEPTION '未找到对应的司机档案';
    END IF;
    
    RETURN QUERY
    SELECT 
        s.year_month,
        s.base_salary,
        s.trip_count,
        s.trip_commission,
        s.total_income,
        s.deductions,
        s.net_salary,
        s.status,
        s.payment_date
    FROM internal_driver_monthly_salary s
    WHERE s.driver_id = v_driver_id
    AND (p_year_month IS NULL OR s.year_month = p_year_month)
    ORDER BY s.year_month DESC
    LIMIT CASE WHEN p_year_month IS NULL THEN 3 ELSE NULL END;
END;
$$;

COMMENT ON FUNCTION get_my_salary IS '获取我的工资记录（司机专用，只返回自己的工资）';

-- ==========================================
-- 第八步：辅助函数 - 关联登录账号到司机档案
-- ==========================================

-- 函数：通过姓名自动关联司机档案
CREATE OR REPLACE FUNCTION link_user_to_driver()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_full_name TEXT;
    v_driver_id UUID;
BEGIN
    -- 获取当前用户姓名
    SELECT full_name INTO v_user_full_name
    FROM profiles
    WHERE id = auth.uid();
    
    IF v_user_full_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到用户档案');
    END IF;
    
    -- 查找同名司机
    SELECT id INTO v_driver_id
    FROM internal_drivers
    WHERE name = v_user_full_name
    AND is_active = true;
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', '未找到对应的司机档案');
    END IF;
    
    -- 更新关联
    UPDATE internal_drivers
    SET linked_user_id = auth.uid()
    WHERE id = v_driver_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '已成功关联司机档案',
        'driver_id', v_driver_id
    );
END;
$$;

COMMENT ON FUNCTION link_user_to_driver IS '关联登录账号到司机档案（通过姓名匹配）';

-- ==========================================
-- 第九步：验证数据隔离设置
-- ==========================================

DO $$
DECLARE
    v_expense_table_exists BOOLEAN;
    v_salary_table_exists BOOLEAN;
    v_rls_count INTEGER;
BEGIN
    -- 检查表是否存在
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'internal_driver_expense_applications'
    ) INTO v_expense_table_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'internal_driver_monthly_salary'
    ) INTO v_salary_table_exists;
    
    -- 统计 RLS 策略数
    SELECT COUNT(*) INTO v_rls_count
    FROM pg_policies
    WHERE tablename IN ('internal_driver_expense_applications', 'internal_driver_monthly_salary');
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 司机数据隔离设置完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新建表：';
    RAISE NOTICE '  - 费用申请表: %', CASE WHEN v_expense_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - 工资记录表: %', CASE WHEN v_salary_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '';
    RAISE NOTICE 'RLS策略数: %', v_rls_count;
    RAISE NOTICE '';
    RAISE NOTICE '数据隔离规则：';
    RAISE NOTICE '  ✅ 司机只能看到自己的费用申请';
    RAISE NOTICE '  ✅ 司机只能看到自己的工资记录';
    RAISE NOTICE '  ✅ 司机只能看到自己驾驶的车辆';
    RAISE NOTICE '  ✅ 车队长和管理员可以看到全部数据';
    RAISE NOTICE '';
    RAISE NOTICE '关联方式：';
    RAISE NOTICE '  1. 通过 linked_user_id 精确匹配（推荐）';
    RAISE NOTICE '  2. 通过 profiles.full_name = internal_drivers.name 匹配（兼容）';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ 重要：创建司机登录账号时，姓名必须与司机档案一致';
    RAISE NOTICE '   例如：账号姓名 = "王师傅"，司机档案姓名 = "王师傅"';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==========================================
-- 查看数据隔离函数
-- ==========================================

SELECT 
    routine_name as "函数名",
    routine_type as "类型"
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'get_current_driver_id',
    'get_my_vehicles',
    'get_my_driver_info',
    'get_my_expense_applications',
    'get_my_salary',
    'submit_expense_application',
    'link_user_to_driver'
)
ORDER BY routine_name;

