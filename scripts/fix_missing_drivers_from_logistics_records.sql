-- ============================================================================
-- 修复历史运单中缺失的司机信息
-- 功能：从logistics_records表中提取司机信息，插入到drivers表中
-- 创建日期：2025-01-XX
-- ============================================================================
--
-- 使用说明：
-- 1. 此脚本会从运单表(logistics_records)中提取所有唯一的司机信息
-- 2. 检查这些司机是否已存在于drivers表中（匹配条件：姓名+电话+车牌号）
-- 3. 如果不存在，则插入到drivers表中（driver_type设为'external'）
-- 4. 更新运单表中的driver_id，关联到对应的司机记录
--
-- 匹配逻辑：
-- - 司机匹配基于：姓名 + 电话 + 车牌号
-- - 如果车牌号都为空，也算匹配
-- - 如果车牌号都不为空，则必须完全相等（去除空格后）
--
-- 注意事项：
-- - 此脚本是幂等的，可以安全地多次执行
-- - 不会删除或修改已存在的司机记录
-- - 只会插入缺失的司机和更新缺失的driver_id
-- ============================================================================

-- ============================================================================
-- 第一步：查看需要修复的司机数量（预览）
-- ============================================================================

DO $$
DECLARE
    v_missing_count INTEGER;
    v_total_unique_drivers INTEGER;
BEGIN
    -- 统计运单表中唯一的司机数量
    SELECT COUNT(DISTINCT (driver_name, driver_phone, license_plate))
    INTO v_total_unique_drivers
    FROM public.logistics_records
    WHERE driver_name IS NOT NULL 
      AND driver_name != ''
      AND driver_phone IS NOT NULL 
      AND driver_phone != '';
    
    -- 统计缺失的司机数量（在运单中存在但在drivers表中不存在）
    SELECT COUNT(*)
    INTO v_missing_count
    FROM (
        SELECT DISTINCT 
            TRIM(lr.driver_name) as driver_name,
            TRIM(lr.driver_phone) as driver_phone,
            TRIM(lr.license_plate) as license_plate
        FROM public.logistics_records lr
        WHERE lr.driver_name IS NOT NULL 
          AND lr.driver_name != ''
          AND lr.driver_phone IS NOT NULL 
          AND lr.driver_phone != ''
    ) unique_drivers
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.drivers d
        WHERE TRIM(d.name) = unique_drivers.driver_name
          AND TRIM(d.phone) = unique_drivers.driver_phone
          AND (
              -- 车牌号匹配：如果两个都不为空，则必须相等；如果都为空，也算匹配
              (unique_drivers.license_plate IS NULL OR unique_drivers.license_plate = '')
              AND (d.license_plate IS NULL OR d.license_plate = '')
              OR
              (unique_drivers.license_plate IS NOT NULL 
               AND unique_drivers.license_plate != ''
               AND d.license_plate IS NOT NULL
               AND TRIM(d.license_plate) = TRIM(unique_drivers.license_plate))
          )
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 司机信息修复预览';
    RAISE NOTICE '========================================';
    RAISE NOTICE '运单表中唯一司机数：%', v_total_unique_drivers;
    RAISE NOTICE '缺失的司机数量：%', v_missing_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- 第二步：插入缺失的司机信息到drivers表
-- ============================================================================

-- 使用NOT EXISTS来避免重复插入
-- 注意：数据库唯一约束是 (name, license_plate)，所以匹配条件需要与约束一致
-- 如果已存在相同姓名+车牌号的司机，会更新电话（如果不同）

DO $$
DECLARE
    v_inserted_count INTEGER;
    v_updated_count INTEGER;
BEGIN
    -- 插入缺失的司机（只检查姓名+车牌号，与数据库唯一约束一致）
    WITH inserted_drivers AS (
        INSERT INTO public.drivers (
            name,
            phone,
            license_plate,
            driver_type,
            created_at,
            updated_at
        )
        SELECT DISTINCT
            TRIM(lr.driver_name) as name,
            TRIM(lr.driver_phone) as phone,
            CASE 
                WHEN TRIM(lr.license_plate) IS NULL OR TRIM(lr.license_plate) = '' THEN NULL
                ELSE TRIM(lr.license_plate)
            END as license_plate,
            'external' as driver_type,  -- 历史运单中的司机默认为外部司机
            NOW() as created_at,
            NOW() as updated_at
        FROM public.logistics_records lr
        WHERE lr.driver_name IS NOT NULL 
          AND lr.driver_name != ''
          AND lr.driver_phone IS NOT NULL 
          AND lr.driver_phone != ''
          AND NOT EXISTS (
              -- 检查是否已存在相同的司机（只检查姓名+车牌号，与数据库唯一约束一致）
              SELECT 1 
              FROM public.drivers d
              WHERE TRIM(d.name) = TRIM(lr.driver_name)
                AND (
                    -- 车牌号匹配逻辑
                    (
                        (TRIM(lr.license_plate) IS NULL OR TRIM(lr.license_plate) = '')
                        AND (d.license_plate IS NULL OR d.license_plate = '')
                    )
                    OR
                    (
                        TRIM(lr.license_plate) IS NOT NULL 
                        AND TRIM(lr.license_plate) != ''
                        AND d.license_plate IS NOT NULL
                        AND TRIM(d.license_plate) = TRIM(lr.license_plate)
                    )
                )
          )
        ON CONFLICT ON CONSTRAINT drivers_name_license_plate_unique
        DO UPDATE SET
            phone = EXCLUDED.phone,
            updated_at = NOW()
        WHERE drivers.phone IS DISTINCT FROM EXCLUDED.phone
        RETURNING id
    )
    SELECT COUNT(*) INTO v_inserted_count FROM inserted_drivers;
    
    -- 统计更新的记录数（电话被更新的记录）
    SELECT COUNT(*) INTO v_updated_count
    FROM public.drivers d
    INNER JOIN (
        SELECT DISTINCT
            TRIM(lr.driver_name) as driver_name,
            TRIM(lr.driver_phone) as driver_phone,
            CASE 
                WHEN TRIM(lr.license_plate) IS NULL OR TRIM(lr.license_plate) = '' THEN NULL
                ELSE TRIM(lr.license_plate)
            END as license_plate
        FROM public.logistics_records lr
        WHERE lr.driver_name IS NOT NULL 
          AND lr.driver_name != ''
          AND lr.driver_phone IS NOT NULL 
          AND lr.driver_phone != ''
    ) lr ON (
        TRIM(d.name) = lr.driver_name
        AND (
            (lr.license_plate IS NULL AND d.license_plate IS NULL)
            OR (lr.license_plate IS NOT NULL AND d.license_plate IS NOT NULL AND TRIM(d.license_plate) = lr.license_plate)
        )
        AND TRIM(d.phone) != lr.driver_phone
    );
    
    RAISE NOTICE '✅ 已插入 % 个缺失的司机记录', v_inserted_count;
    IF v_updated_count > 0 THEN
        RAISE NOTICE '✅ 已更新 % 个已存在司机的电话', v_updated_count;
    END IF;
END $$;

-- ============================================================================
-- 第三步：更新运单表中的driver_id（关联到drivers表中的司机）
-- ============================================================================

DO $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    -- 更新所有driver_id为空的运单，关联到对应的司机
    WITH updated_records AS (
        UPDATE public.logistics_records lr
        SET driver_id = d.id
        FROM public.drivers d
        WHERE lr.driver_id IS NULL  -- 只更新driver_id为空的运单
          AND TRIM(lr.driver_name) = TRIM(d.name)
          AND TRIM(lr.driver_phone) = TRIM(d.phone)
          AND (
              -- 车牌号匹配逻辑
              (
                  (TRIM(lr.license_plate) IS NULL OR TRIM(lr.license_plate) = '')
                  AND (d.license_plate IS NULL OR d.license_plate = '')
              )
              OR
              (
                  TRIM(lr.license_plate) IS NOT NULL 
                  AND TRIM(lr.license_plate) != ''
                  AND d.license_plate IS NOT NULL
                  AND TRIM(d.license_plate) = TRIM(lr.license_plate)
              )
          )
        RETURNING lr.id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_records;
    
    RAISE NOTICE '✅ 已更新 % 条运单的driver_id', v_updated_count;
END $$;

-- ============================================================================
-- 第四步：关联司机到项目（根据运单记录中的项目信息）
-- ============================================================================

DO $$
DECLARE
    v_linked_count INTEGER;
BEGIN
    -- 从运单记录中提取司机-项目关系，批量插入到 driver_projects
    -- 注意：此时driver_id已经更新，可以直接使用driver_id关联
    WITH linked_projects AS (
        INSERT INTO public.driver_projects (driver_id, project_id, user_id)
        SELECT DISTINCT 
            lr.driver_id,
            lr.project_id,
            COALESCE(lr.user_id, lr.created_by_user_id) as user_id
        FROM public.logistics_records lr
        WHERE lr.driver_id IS NOT NULL
          AND lr.project_id IS NOT NULL
          AND NOT EXISTS (
              -- 只关联尚未关联的
              SELECT 1 
              FROM public.driver_projects dp 
              WHERE dp.driver_id = lr.driver_id 
                AND dp.project_id = lr.project_id
          )
        RETURNING id
    )
    SELECT COUNT(*) INTO v_linked_count FROM linked_projects;
    
    RAISE NOTICE '✅ 已关联 % 个司机-项目关系', v_linked_count;
END $$;

-- ============================================================================
-- 第五步：验证修复结果
-- ============================================================================

DO $$
DECLARE
    v_updated_count INTEGER;
    v_remaining_null_count INTEGER;
    v_total_drivers INTEGER;
    v_drivers_with_projects INTEGER;
    v_total_project_links INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_drivers FROM public.drivers;
    
    -- 统计已关联项目的司机数量
    SELECT COUNT(DISTINCT driver_id) INTO v_drivers_with_projects
    FROM public.driver_projects;
    
    -- 统计司机-项目关联总数
    SELECT COUNT(*) INTO v_total_project_links
    FROM public.driver_projects;
    
    -- 统计仍然没有driver_id的运单数量
    SELECT COUNT(*) INTO v_remaining_null_count
    FROM public.logistics_records
    WHERE driver_id IS NULL
      AND driver_name IS NOT NULL 
      AND driver_name != ''
      AND driver_phone IS NOT NULL 
      AND driver_phone != '';
    
    -- 统计已关联的运单数量
    SELECT COUNT(*) INTO v_updated_count
    FROM public.logistics_records
    WHERE driver_id IS NOT NULL;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 修复完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'drivers表总司机数：%', v_total_drivers;
    RAISE NOTICE '已关联项目的司机数：%', v_drivers_with_projects;
    RAISE NOTICE '司机-项目关联总数：%', v_total_project_links;
    RAISE NOTICE '已关联driver_id的运单数：%', v_updated_count;
    RAISE NOTICE '仍缺少driver_id的运单数：%', v_remaining_null_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    IF v_remaining_null_count > 0 THEN
        RAISE NOTICE '⚠️  仍有 % 条运单缺少driver_id，可能原因：', v_remaining_null_count;
        RAISE NOTICE '   1. 司机姓名或电话为空';
        RAISE NOTICE '   2. 数据格式问题（空格、特殊字符等）';
        RAISE NOTICE '';
        RAISE NOTICE '建议执行以下查询查看详情：';
        RAISE NOTICE 'SELECT driver_name, driver_phone, license_plate, COUNT(*)';
        RAISE NOTICE 'FROM logistics_records';
        RAISE NOTICE 'WHERE driver_id IS NULL';
        RAISE NOTICE '  AND driver_name IS NOT NULL';
        RAISE NOTICE '  AND driver_phone IS NOT NULL';
        RAISE NOTICE 'GROUP BY driver_name, driver_phone, license_plate';
        RAISE NOTICE 'ORDER BY COUNT(*) DESC;';
    END IF;
    
    RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 第六步：显示一些示例数据（可选，用于验证）
-- ============================================================================

-- 显示最近插入的10个司机（按创建时间）
SELECT 
    name as 司机姓名,
    phone as 电话,
    license_plate as 车牌号,
    driver_type as 司机类型,
    created_at as 创建时间
FROM public.drivers
ORDER BY created_at DESC
LIMIT 10;
