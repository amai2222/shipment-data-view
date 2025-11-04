-- ============================================================================
-- 步骤5：司机换车申请和审批流程
-- ============================================================================
-- 功能：司机申请换车，车队长审批
-- 规则：司机不能自己修改车辆关联，必须通过申请流程
-- 创建时间：2025-11-04
-- ============================================================================

BEGIN;

-- ==========================================
-- 准备工作：清理可能存在的旧表
-- ==========================================

DROP TABLE IF EXISTS public.internal_vehicle_change_applications CASCADE;

DROP FUNCTION IF EXISTS submit_vehicle_change_application CASCADE;
DROP FUNCTION IF EXISTS approve_vehicle_change CASCADE;
DROP FUNCTION IF EXISTS get_pending_vehicle_change_applications CASCADE;
DROP FUNCTION IF EXISTS get_my_vehicle_change_applications CASCADE;

-- ==========================================
-- 第一步：修改司机-车辆关联表的 RLS 策略
-- ==========================================

-- 删除旧的管理策略
DROP POLICY IF EXISTS "internal_driver_vehicle_manage_policy" ON internal_driver_vehicle_relations;

-- 策略：只有车队长和管理员可以修改关联关系
CREATE POLICY "driver_vehicle_insert_policy"
ON internal_driver_vehicle_relations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

CREATE POLICY "driver_vehicle_update_policy"
ON internal_driver_vehicle_relations
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

CREATE POLICY "driver_vehicle_delete_policy"
ON internal_driver_vehicle_relations
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

-- ==========================================
-- 第二步：创建换车申请表
-- ==========================================

CREATE TABLE IF NOT EXISTS public.internal_vehicle_change_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 申请信息
    application_number TEXT NOT NULL UNIQUE,  -- 申请单号
    driver_id UUID NOT NULL REFERENCES internal_drivers(id) ON DELETE CASCADE,
    
    -- 换车信息
    current_vehicle_id UUID REFERENCES internal_vehicles(id) ON DELETE SET NULL,  -- 当前车辆
    requested_vehicle_id UUID NOT NULL REFERENCES internal_vehicles(id) ON DELETE CASCADE, -- 申请换的车
    
    -- 申请原因
    reason TEXT NOT NULL,                     -- 申请原因
    application_type TEXT DEFAULT 'change',   -- 申请类型：change-换车, add-增加车辆, remove-移除车辆
    
    -- 审批信息
    status TEXT DEFAULT 'pending',            -- 状态：pending-待审批, approved-已通过, rejected-已驳回
    reviewer_id UUID,                         -- 审批人ID
    review_time TIMESTAMPTZ,                  -- 审批时间
    review_comment TEXT,                      -- 审批意见
    
    -- 元数据
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_change_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_vehicle_change_driver ON internal_vehicle_change_applications(driver_id);
CREATE INDEX idx_vehicle_change_status ON internal_vehicle_change_applications(status);

COMMENT ON TABLE internal_vehicle_change_applications IS '内部司机换车申请表';
COMMENT ON COLUMN internal_vehicle_change_applications.application_type IS '申请类型：change-换车, add-增加车辆, remove-移除车辆';

-- ==========================================
-- 第三步：启用换车申请表 RLS
-- ==========================================

ALTER TABLE internal_vehicle_change_applications ENABLE ROW LEVEL SECURITY;

-- 策略：司机只能查看和创建自己的申请
CREATE POLICY "vehicle_change_select_policy"
ON internal_vehicle_change_applications
FOR SELECT
TO authenticated
USING (
    -- 司机：只能看自己的
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
        AND driver_id = get_current_driver_id()
    )
    OR
    -- 车队长和管理员：可以看全部
    (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
    )
);

CREATE POLICY "vehicle_change_insert_policy"
ON internal_vehicle_change_applications
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'driver')
    AND driver_id = get_current_driver_id()
);

-- 策略：只有车队长和管理员可以审批（更新状态）
CREATE POLICY "vehicle_change_update_policy"
ON internal_vehicle_change_applications
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'fleet_manager'))
);

-- ==========================================
-- 第四步：创建换车申请函数
-- ==========================================

-- 函数：提交换车申请（司机专用）
CREATE OR REPLACE FUNCTION submit_vehicle_change_application(
    p_current_vehicle_id UUID,
    p_requested_vehicle_id UUID,
    p_reason TEXT,
    p_application_type TEXT DEFAULT 'change'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_application_number TEXT;
    v_new_id UUID;
    v_current_plate TEXT;
    v_requested_plate TEXT;
BEGIN
    -- 获取当前司机ID
    v_driver_id := get_current_driver_id();
    
    IF v_driver_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '未找到对应的司机档案'
        );
    END IF;
    
    -- 检查申请的车辆是否存在
    SELECT license_plate INTO v_requested_plate
    FROM internal_vehicles
    WHERE id = p_requested_vehicle_id;
    
    IF v_requested_plate IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '申请的车辆不存在'
        );
    END IF;
    
    -- 获取当前车牌号
    IF p_current_vehicle_id IS NOT NULL THEN
        SELECT license_plate INTO v_current_plate
        FROM internal_vehicles
        WHERE id = p_current_vehicle_id;
    END IF;
    
    -- 生成申请单号：VC + 日期 + 序号
    v_application_number := 'VC' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                            LPAD((
                                SELECT COUNT(*) + 1 
                                FROM internal_vehicle_change_applications 
                                WHERE created_at::DATE = CURRENT_DATE
                            )::TEXT, 4, '0');
    
    -- 插入申请
    INSERT INTO internal_vehicle_change_applications (
        application_number,
        driver_id,
        current_vehicle_id,
        requested_vehicle_id,
        reason,
        application_type,
        status
    ) VALUES (
        v_application_number,
        v_driver_id,
        p_current_vehicle_id,
        p_requested_vehicle_id,
        p_reason,
        p_application_type,
        'pending'
    ) RETURNING id INTO v_new_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', '换车申请已提交',
        'application_id', v_new_id,
        'application_number', v_application_number,
        'current_vehicle', v_current_plate,
        'requested_vehicle', v_requested_plate
    );
END;
$$;

COMMENT ON FUNCTION submit_vehicle_change_application IS '提交换车申请（司机专用）';

-- 函数：审批换车申请（车队长专用）
CREATE OR REPLACE FUNCTION approve_vehicle_change(
    p_application_id UUID,
    p_approved BOOLEAN,
    p_review_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_application RECORD;
    v_driver_name TEXT;
    v_requested_plate TEXT;
BEGIN
    -- 检查权限
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'fleet_manager')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '无权限审批'
        );
    END IF;
    
    -- 获取申请信息
    SELECT * INTO v_application
    FROM internal_vehicle_change_applications
    WHERE id = p_application_id;
    
    IF v_application IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '申请不存在'
        );
    END IF;
    
    IF v_application.status != 'pending' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', '该申请已被处理'
        );
    END IF;
    
    -- 更新申请状态
    UPDATE internal_vehicle_change_applications
    SET 
        status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
        reviewer_id = auth.uid(),
        review_time = NOW(),
        review_comment = p_review_comment,
        updated_at = NOW()
    WHERE id = p_application_id;
    
    -- 如果审批通过，执行换车操作
    IF p_approved THEN
        -- 移除旧车关联（如果有）
        IF v_application.current_vehicle_id IS NOT NULL THEN
            DELETE FROM internal_driver_vehicle_relations
            WHERE driver_id = v_application.driver_id
            AND vehicle_id = v_application.current_vehicle_id;
        END IF;
        
        -- 添加新车关联
        INSERT INTO internal_driver_vehicle_relations (
            driver_id,
            vehicle_id,
            is_primary,
            relation_type,
            valid_from
        ) VALUES (
            v_application.driver_id,
            v_application.requested_vehicle_id,
            true,  -- 换车后默认为主驾驶
            'regular',
            CURRENT_DATE
        ) ON CONFLICT (driver_id, vehicle_id) DO UPDATE SET
            is_primary = true,
            valid_from = CURRENT_DATE;
    END IF;
    
    -- 获取司机姓名和车牌
    SELECT name INTO v_driver_name
    FROM internal_drivers
    WHERE id = v_application.driver_id;
    
    SELECT license_plate INTO v_requested_plate
    FROM internal_vehicles
    WHERE id = v_application.requested_vehicle_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', CASE 
            WHEN p_approved THEN '换车申请已通过，车辆关联已更新'
            ELSE '换车申请已驳回'
        END,
        'driver_name', v_driver_name,
        'new_vehicle', v_requested_plate,
        'approved', p_approved
    );
END;
$$;

COMMENT ON FUNCTION approve_vehicle_change IS '审批换车申请（车队长专用，通过后自动更新车辆关联）';

-- 函数：获取待审批的换车申请（车队长专用）
CREATE OR REPLACE FUNCTION get_pending_vehicle_change_applications()
RETURNS TABLE (
    id UUID,
    application_number TEXT,
    driver_name TEXT,
    current_vehicle TEXT,
    requested_vehicle TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 检查权限
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'fleet_manager')
    ) THEN
        RAISE EXCEPTION '无权限查看';
    END IF;
    
    RETURN QUERY
    SELECT 
        vca.id,
        vca.application_number,
        d.name as driver_name,
        cv.license_plate as current_vehicle,
        rv.license_plate as requested_vehicle,
        vca.reason,
        vca.created_at
    FROM internal_vehicle_change_applications vca
    INNER JOIN internal_drivers d ON vca.driver_id = d.id
    LEFT JOIN internal_vehicles cv ON vca.current_vehicle_id = cv.id
    INNER JOIN internal_vehicles rv ON vca.requested_vehicle_id = rv.id
    WHERE vca.status = 'pending'
    ORDER BY vca.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_pending_vehicle_change_applications IS '获取待审批的换车申请（车队长专用）';

-- ==========================================
-- 第五步：创建我的换车申请查询函数
-- ==========================================

CREATE OR REPLACE FUNCTION get_my_vehicle_change_applications()
RETURNS TABLE (
    id UUID,
    application_number TEXT,
    current_vehicle TEXT,
    requested_vehicle TEXT,
    reason TEXT,
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
        vca.id,
        vca.application_number,
        cv.license_plate as current_vehicle,
        rv.license_plate as requested_vehicle,
        vca.reason,
        vca.status,
        vca.review_comment,
        vca.created_at
    FROM internal_vehicle_change_applications vca
    LEFT JOIN internal_vehicles cv ON vca.current_vehicle_id = cv.id
    INNER JOIN internal_vehicles rv ON vca.requested_vehicle_id = rv.id
    WHERE vca.driver_id = v_driver_id
    ORDER BY vca.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_my_vehicle_change_applications IS '获取我的换车申请记录（司机专用）';

-- ==========================================
-- 第六步：验证设置
-- ==========================================

DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_policy_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'internal_vehicle_change_applications'
    ) INTO v_table_exists;
    
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'internal_vehicle_change_applications';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 换车申请审批流程创建完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '换车申请表: %', CASE WHEN v_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE 'RLS策略数: %', v_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '业务规则：';
    RAISE NOTICE '  ❌ 司机不能自己修改车辆关联';
    RAISE NOTICE '  ✅ 司机只能提交换车申请';
    RAISE NOTICE '  ✅ 车队长审批通过后，自动更新车辆关联';
    RAISE NOTICE '';
    RAISE NOTICE '申请流程：';
    RAISE NOTICE '  1. 司机提交：submit_vehicle_change_application()';
    RAISE NOTICE '  2. 车队长查看：get_pending_vehicle_change_applications()';
    RAISE NOTICE '  3. 车队长审批：approve_vehicle_change()';
    RAISE NOTICE '  4. 通过后自动更新 internal_driver_vehicle_relations 表';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ==========================================
-- 查看换车申请相关函数
-- ==========================================

SELECT 
    routine_name as "函数名",
    CASE routine_name
        WHEN 'submit_vehicle_change_application' THEN '司机提交换车申请'
        WHEN 'approve_vehicle_change' THEN '车队长审批换车申请'
        WHEN 'get_pending_vehicle_change_applications' THEN '获取待审批申请'
        WHEN 'get_my_vehicle_change_applications' THEN '获取我的申请记录'
        ELSE ''
    END as "说明"
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%vehicle_change%'
ORDER BY routine_name;

