-- ============================================================================
-- 创建车辆轨迹ID映射表
-- 创建日期：2025-12-03
-- 功能：存储车牌号与外部轨迹系统车辆ID的映射关系
-- ============================================================================

-- 创建车辆轨迹ID映射表
CREATE TABLE IF NOT EXISTS public.vehicle_tracking_id_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========== 映射关系 ==========
    license_plate TEXT NOT NULL,                -- 车牌号
    external_tracking_id TEXT NOT NULL,         -- 外部轨迹系统的车辆ID（格式：#26:4140）
    
    -- ========== 额外信息 ==========
    vehicle_desc TEXT,                          -- 车辆描述（从外部API获取）
    dept_id TEXT,                               -- 部门ID（从外部API获取）
    
    -- ========== 元数据 ==========
    created_at TIMESTAMPTZ DEFAULT NOW(),       -- 创建时间
    updated_at TIMESTAMPTZ DEFAULT NOW(),      -- 更新时间
    last_synced_at TIMESTAMPTZ,                 -- 最后同步时间
    
    -- ========== 约束 ==========
    CONSTRAINT vehicle_tracking_mapping_license_plate_unique UNIQUE (license_plate),
    CONSTRAINT vehicle_tracking_mapping_external_id_unique UNIQUE (external_tracking_id)
);

-- 创建索引以便快速查询
CREATE INDEX IF NOT EXISTS idx_vehicle_tracking_mapping_license_plate 
ON public.vehicle_tracking_id_mappings(license_plate);

CREATE INDEX IF NOT EXISTS idx_vehicle_tracking_mapping_external_id 
ON public.vehicle_tracking_id_mappings(external_tracking_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_tracking_mapping_last_synced 
ON public.vehicle_tracking_id_mappings(last_synced_at);

-- 添加注释
COMMENT ON TABLE public.vehicle_tracking_id_mappings IS '车辆轨迹ID映射表：存储车牌号与外部轨迹系统车辆ID的对应关系';
COMMENT ON COLUMN public.vehicle_tracking_id_mappings.license_plate IS '车牌号（唯一）';
COMMENT ON COLUMN public.vehicle_tracking_id_mappings.external_tracking_id IS '外部轨迹系统的车辆ID（格式：#26:4140，唯一）';
COMMENT ON COLUMN public.vehicle_tracking_id_mappings.vehicle_desc IS '车辆描述（从外部API获取）';
COMMENT ON COLUMN public.vehicle_tracking_id_mappings.dept_id IS '部门ID（从外部API获取）';
COMMENT ON COLUMN public.vehicle_tracking_id_mappings.last_synced_at IS '最后同步时间';

-- ============================================================================
-- 创建同步车辆ID映射的函数
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_vehicle_tracking_ids(
    p_vehicle_mappings JSONB,
    p_dept_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mapping JSONB;
    v_license_plate TEXT;
    v_external_id TEXT;
    v_vehicle_desc TEXT;
    v_updated_count INTEGER := 0;
    v_inserted_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_errors TEXT[] := ARRAY[]::TEXT[];
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.has_function_permission('contracts.vehicle_tracking') THEN
        RAISE EXCEPTION '权限不足：您没有同步车辆ID的权限';
    END IF;

    -- 遍历传入的映射数据
    FOR v_mapping IN SELECT * FROM jsonb_array_elements(p_vehicle_mappings)
    LOOP
        BEGIN
            v_license_plate := v_mapping->>'serialno';
            v_external_id := v_mapping->>'id';
            v_vehicle_desc := v_mapping->>'desc';

            -- 验证数据
            IF v_license_plate IS NULL OR v_external_id IS NULL THEN
                v_error_count := v_error_count + 1;
                v_errors := array_append(v_errors, format('缺少必需字段: serialno=%s, id=%s', v_license_plate, v_external_id));
                CONTINUE;
            END IF;

            -- 检查记录是否已存在
            IF EXISTS (
                SELECT 1 FROM public.vehicle_tracking_id_mappings 
                WHERE license_plate = v_license_plate
            ) THEN
                -- 更新现有记录
                UPDATE public.vehicle_tracking_id_mappings
                SET
                    external_tracking_id = v_external_id,
                    vehicle_desc = v_vehicle_desc,
                    dept_id = COALESCE(p_dept_id, dept_id),
                    updated_at = NOW(),
                    last_synced_at = NOW()
                WHERE license_plate = v_license_plate;
                
                v_updated_count := v_updated_count + 1;
            ELSE
                -- 插入新记录
                INSERT INTO public.vehicle_tracking_id_mappings (
                    license_plate,
                    external_tracking_id,
                    vehicle_desc,
                    dept_id,
                    last_synced_at
                )
                VALUES (
                    v_license_plate,
                    v_external_id,
                    v_vehicle_desc,
                    p_dept_id,
                    NOW()
                );
                
                v_inserted_count := v_inserted_count + 1;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_errors := array_append(v_errors, format('处理车牌号 %s 时出错: %s', v_license_plate, SQLERRM));
        END;
    END LOOP;

    -- 构建返回结果
    v_result := jsonb_build_object(
        'success', true,
        'updated', v_updated_count,
        'inserted', v_inserted_count,
        'errors', v_error_count,
        'error_messages', v_errors,
        'total', jsonb_array_length(p_vehicle_mappings)
    );

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION sync_vehicle_tracking_ids IS '同步外部轨迹系统的车辆ID映射关系到 vehicle_tracking_id_mappings 表';

-- ============================================================================
-- 启用RLS（行级安全）
-- ============================================================================

ALTER TABLE public.vehicle_tracking_id_mappings ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：所有已认证用户都可以读取
CREATE POLICY "允许已认证用户读取车辆轨迹ID映射"
ON public.vehicle_tracking_id_mappings
FOR SELECT
TO authenticated
USING (true);

-- 创建RLS策略：只有有权限的用户可以插入/更新
CREATE POLICY "允许有权限用户管理车辆轨迹ID映射"
ON public.vehicle_tracking_id_mappings
FOR ALL
TO authenticated
USING (
    public.has_function_permission('contracts.vehicle_tracking')
);

