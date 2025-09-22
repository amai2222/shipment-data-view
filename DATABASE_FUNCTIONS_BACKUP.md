# 数据库函数和触发器备份文档

## 📋 目录
1. [RPC函数完整清单](#RPC函数完整清单)
2. [触发器备份](#触发器备份)
3. [视图定义](#视图定义)
4. [索引策略](#索引策略)
5. [RLS策略](#RLS策略)
6. [枚举类型](#枚举类型)

---

## RPC函数完整清单

### 🏠 仪表盘统计函数

#### 1. get_dashboard_stats_with_billing_types
```sql
-- 功能: 获取仪表盘统计数据，按计费类型分组
-- 参数: p_start_date, p_end_date, p_project_id
-- 返回: JSON格式的统计数据
CREATE OR REPLACE FUNCTION get_dashboard_stats_with_billing_types(
    p_start_date TEXT,
    p_end_date TEXT,
    p_project_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    overview_data JSON;
    daily_transport_stats JSON;
    daily_trip_stats JSON;
    daily_volume_stats JSON;
    daily_cost_stats JSON;
    daily_count_stats JSON;
BEGIN
    -- 构建概览数据
    WITH filtered_records AS (
        SELECT lr.*, p.billing_type_id
        FROM logistics_records lr
        LEFT JOIN projects p ON lr.project_id = p.id
        WHERE lr.loading_date BETWEEN p_start_date::timestamp AND p_end_date::timestamp
        AND (p_project_id IS NULL OR lr.project_id = p_project_id)
    )
    SELECT json_build_object(
        'totalRecords', COUNT(*),
        'totalWeight', COALESCE(SUM(CASE WHEN billing_type_id = 1 THEN loading_weight END), 0),
        'totalVolume', COALESCE(SUM(CASE WHEN billing_type_id = 3 THEN loading_weight END), 0),
        'totalTrips', COALESCE(SUM(CASE WHEN billing_type_id = 2 THEN 1 END), 0),
        'totalCost', COALESCE(SUM(driver_payable_cost), 0),
        'actualTransportCount', COUNT(*) FILTER (WHERE transport_type = '实际运输'),
        'returnCount', COUNT(*) FILTER (WHERE transport_type = '空车返回'),
        'weightRecordsCount', COUNT(*) FILTER (WHERE billing_type_id = 1),
        'tripRecordsCount', COUNT(*) FILTER (WHERE billing_type_id = 2),
        'volumeRecordsCount', COUNT(*) FILTER (WHERE billing_type_id = 3)
    ) INTO overview_data
    FROM filtered_records;

    -- 构建每日统计数据
    -- (详细的每日统计查询...)

    -- 组装最终结果
    result := json_build_object(
        'overview', overview_data,
        'dailyTransportStats', daily_transport_stats,
        'dailyTripStats', daily_trip_stats,
        'dailyVolumeStats', daily_volume_stats,
        'dailyCostStats', daily_cost_stats,
        'dailyCountStats', daily_count_stats
    );

    RETURN result;
END;
$$;
```

#### 2. get_project_dashboard_data
```sql
-- 功能: 获取项目看板数据
-- 参数: p_selected_project_id, p_report_date
-- 返回: 项目详细统计数据
CREATE OR REPLACE FUNCTION get_project_dashboard_data(
    p_selected_project_id UUID,
    p_report_date TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    project_details JSON;
    daily_report JSON;
    seven_day_trend JSON;
    summary_stats JSON;
    driver_report_table JSON;
BEGIN
    -- 项目基本信息
    SELECT json_agg(
        json_build_object(
            'id', id,
            'name', name,
            'partner_name', COALESCE(partner_name, '未指定'),
            'start_date', start_date,
            'planned_total_tons', COALESCE(planned_total_tons, 0),
            'billing_type_id', COALESCE(billing_type_id, 1)
        )
    ) INTO project_details
    FROM projects 
    WHERE id = p_selected_project_id;

    -- 当日报告
    SELECT json_build_object(
        'trip_count', COALESCE(COUNT(*), 0),
        'total_tonnage', COALESCE(SUM(loading_weight), 0),
        'daily_receivable_amount', COALESCE(SUM(driver_payable_cost), 0)
    ) INTO daily_report
    FROM logistics_records
    WHERE project_id = p_selected_project_id
    AND DATE(loading_date) = p_report_date::DATE;

    -- 7天趋势数据
    SELECT json_agg(
        json_build_object(
            'date', trend_date,
            'trip_count', trip_count,
            'total_tonnage', total_tonnage,
            'daily_receivable_amount', daily_receivable_amount
        ) ORDER BY trend_date
    ) INTO seven_day_trend
    FROM (
        SELECT 
            DATE(loading_date) as trend_date,
            COUNT(*) as trip_count,
            COALESCE(SUM(loading_weight), 0) as total_tonnage,
            COALESCE(SUM(driver_payable_cost), 0) as daily_receivable_amount
        FROM logistics_records
        WHERE project_id = p_selected_project_id
        AND loading_date >= (p_report_date::DATE - INTERVAL '6 days')
        AND loading_date <= (p_report_date::DATE + INTERVAL '1 day')
        GROUP BY DATE(loading_date)
    ) t;

    -- 汇总统计
    SELECT json_build_object(
        'total_trips', COALESCE(COUNT(*), 0),
        'total_tonnage', COALESCE(SUM(loading_weight), 0),
        'total_cost', COALESCE(SUM(driver_payable_cost), 0),
        'avg_cost', COALESCE(AVG(driver_payable_cost), 0)
    ) INTO summary_stats
    FROM logistics_records
    WHERE project_id = p_selected_project_id;

    -- 司机报表
    SELECT json_agg(
        json_build_object(
            'driver_name', driver_name,
            'license_plate', license_plate,
            'phone', COALESCE(driver_phone, ''),
            'daily_trip_count', daily_trip_count,
            'total_trip_count', total_trip_count,
            'total_tonnage', total_tonnage,
            'total_driver_receivable', total_driver_receivable,
            'total_partner_payable', total_partner_payable
        ) ORDER BY total_tonnage DESC
    ) INTO driver_report_table
    FROM (
        SELECT 
            driver_name,
            license_plate,
            driver_phone,
            COUNT(*) FILTER (WHERE DATE(loading_date) = p_report_date::DATE) as daily_trip_count,
            COUNT(*) as total_trip_count,
            COALESCE(SUM(loading_weight), 0) as total_tonnage,
            COALESCE(SUM(driver_payable_cost), 0) as total_driver_receivable,
            COALESCE(SUM(driver_payable_cost), 0) as total_partner_payable
        FROM logistics_records
        WHERE project_id = p_selected_project_id
        GROUP BY driver_name, license_plate, driver_phone
    ) t;

    -- 组装结果
    result := json_build_object(
        'project_details', project_details,
        'daily_report', daily_report,
        'seven_day_trend', seven_day_trend,
        'summary_stats', summary_stats,
        'driver_report_table', driver_report_table
    );

    RETURN result;
END;
$$;
```

### 🚛 物流记录管理函数

#### 3. add_logistics_record_with_costs
```sql
-- 功能: 添加物流记录并计算成本
-- 参数: 物流记录的所有字段
-- 返回: 无
CREATE OR REPLACE FUNCTION add_logistics_record_with_costs(
    p_project_id UUID,
    p_project_name TEXT,
    p_driver_name TEXT,
    p_license_plate TEXT,
    p_driver_phone TEXT,
    p_loading_date TEXT,
    p_unloading_date TEXT,
    p_loading_location TEXT,
    p_unloading_location TEXT,
    p_loading_weight DECIMAL,
    p_unloading_weight DECIMAL,
    p_transport_type TEXT,
    p_current_cost DECIMAL,
    p_extra_cost DECIMAL,
    p_chain_id UUID,
    p_remarks TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_auto_number TEXT;
    v_payable_cost DECIMAL;
BEGIN
    -- 获取或创建司机记录
    SELECT id INTO v_driver_id
    FROM drivers
    WHERE name = p_driver_name AND license_plate = p_license_plate;
    
    IF v_driver_id IS NULL THEN
        INSERT INTO drivers (name, license_plate, phone, user_id)
        VALUES (p_driver_name, p_license_plate, p_driver_phone, auth.uid())
        RETURNING id INTO v_driver_id;
    END IF;

    -- 生成自动编号
    v_auto_number := 'WB' || TO_CHAR(NOW(), 'YYYYMMDD') || 
                     LPAD(nextval('logistics_records_seq')::TEXT, 4, '0');

    -- 计算应付成本
    v_payable_cost := COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0);

    -- 插入物流记录
    INSERT INTO logistics_records (
        auto_number,
        project_id,
        project_name,
        driver_id,
        driver_name,
        license_plate,
        driver_phone,
        loading_date,
        unloading_date,
        loading_location,
        unloading_location,
        loading_weight,
        unloading_weight,
        transport_type,
        current_cost,
        extra_cost,
        driver_payable_cost,
        chain_id,
        remarks,
        user_id
    ) VALUES (
        v_auto_number,
        p_project_id,
        p_project_name,
        v_driver_id,
        p_driver_name,
        p_license_plate,
        p_driver_phone,
        p_loading_date::TIMESTAMP,
        NULLIF(p_unloading_date, '')::TIMESTAMP,
        p_loading_location,
        p_unloading_location,
        p_loading_weight,
        p_unloading_weight,
        p_transport_type,
        p_current_cost,
        p_extra_cost,
        v_payable_cost,
        p_chain_id,
        p_remarks,
        auth.uid()
    );
END;
$$;
```

#### 4. update_logistics_record_via_recalc
```sql
-- 功能: 更新物流记录并重新计算成本
-- 参数: 记录ID和更新字段
-- 返回: 无
CREATE OR REPLACE FUNCTION update_logistics_record_via_recalc(
    p_record_id UUID,
    p_project_id UUID,
    p_project_name TEXT,
    p_driver_name TEXT,
    p_license_plate TEXT,
    p_driver_phone TEXT,
    p_loading_date TEXT,
    p_unloading_date TEXT,
    p_loading_location TEXT,
    p_unloading_location TEXT,
    p_loading_weight DECIMAL,
    p_unloading_weight DECIMAL,
    p_transport_type TEXT,
    p_current_cost DECIMAL,
    p_extra_cost DECIMAL,
    p_chain_id UUID,
    p_remarks TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_payable_cost DECIMAL;
BEGIN
    -- 获取或创建司机记录
    SELECT id INTO v_driver_id
    FROM drivers
    WHERE name = p_driver_name AND license_plate = p_license_plate;
    
    IF v_driver_id IS NULL THEN
        INSERT INTO drivers (name, license_plate, phone, user_id)
        VALUES (p_driver_name, p_license_plate, p_driver_phone, auth.uid())
        RETURNING id INTO v_driver_id;
    END IF;

    -- 计算应付成本
    v_payable_cost := COALESCE(p_current_cost, 0) + COALESCE(p_extra_cost, 0);

    -- 更新物流记录
    UPDATE logistics_records SET
        project_id = p_project_id,
        project_name = p_project_name,
        driver_id = v_driver_id,
        driver_name = p_driver_name,
        license_plate = p_license_plate,
        driver_phone = p_driver_phone,
        loading_date = p_loading_date::TIMESTAMP,
        unloading_date = NULLIF(p_unloading_date, '')::TIMESTAMP,
        loading_location = p_loading_location,
        unloading_location = p_unloading_location,
        loading_weight = p_loading_weight,
        unloading_weight = p_unloading_weight,
        transport_type = p_transport_type,
        current_cost = p_current_cost,
        extra_cost = p_extra_cost,
        driver_payable_cost = v_payable_cost,
        chain_id = p_chain_id,
        remarks = p_remarks,
        updated_at = NOW()
    WHERE id = p_record_id;
END;
$$;
```

### 📊 批量导入函数

#### 5. preview_import_with_duplicates_check
```sql
-- 功能: 预览导入数据并检查重复
-- 参数: p_records (JSON数组)
-- 返回: 预览结果和重复检查
CREATE OR REPLACE FUNCTION preview_import_with_duplicates_check(
    p_records JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    record_item JSON;
    duplicate_records JSON[] := '{}';
    new_records JSON[] := '{}';
    total_count INTEGER := 0;
    duplicate_count INTEGER := 0;
    new_count INTEGER := 0;
BEGIN
    -- 遍历输入记录
    FOR record_item IN SELECT * FROM json_array_elements(p_records)
    LOOP
        total_count := total_count + 1;
        
        -- 检查是否存在重复记录（基于8个关键字段）
        IF EXISTS (
            SELECT 1 FROM logistics_records
            WHERE project_name = (record_item->>'project_name')
            AND chain_id::TEXT = COALESCE(record_item->>'chain_id', '')
            AND driver_name = (record_item->>'driver_name')
            AND license_plate = (record_item->>'license_plate')
            AND loading_location = (record_item->>'loading_location')
            AND unloading_location = (record_item->>'unloading_location')
            AND DATE(loading_date) = (record_item->>'loading_date')::DATE
            AND loading_weight = (record_item->>'loading_weight')::DECIMAL
        ) THEN
            duplicate_records := duplicate_records || record_item;
            duplicate_count := duplicate_count + 1;
        ELSE
            new_records := new_records || record_item;
            new_count := new_count + 1;
        END IF;
    END LOOP;

    -- 构建返回结果
    result := json_build_object(
        'total_count', total_count,
        'new_count', new_count,
        'duplicate_count', duplicate_count,
        'new_records', array_to_json(new_records),
        'duplicate_records', array_to_json(duplicate_records),
        'preview_successful', true
    );

    RETURN result;
END;
$$;
```

#### 6. batch_import_logistics_records_with_update
```sql
-- 功能: 批量导入物流记录（支持更新模式）
-- 参数: p_records (包含create_records和update_records)
-- 返回: 导入结果统计
CREATE OR REPLACE FUNCTION batch_import_logistics_records_with_update(
    p_records JSON
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    create_records JSON[];
    update_records JSON[];
    record_item JSON;
    v_driver_id UUID;
    v_auto_number TEXT;
    v_payable_cost DECIMAL;
    created_count INTEGER := 0;
    updated_count INTEGER := 0;
    error_count INTEGER := 0;
    errors JSON[] := '{}';
BEGIN
    -- 提取创建和更新记录
    create_records := COALESCE((p_records->>'create_records')::JSON[], '{}');
    update_records := COALESCE((p_records->>'update_records')::JSON[], '{}');

    -- 处理创建记录
    FOR i IN 1..array_length(create_records, 1)
    LOOP
        record_item := create_records[i];
        
        BEGIN
            -- 获取或创建司机
            SELECT id INTO v_driver_id
            FROM drivers
            WHERE name = (record_item->>'driver_name')
            AND license_plate = (record_item->>'license_plate');
            
            IF v_driver_id IS NULL THEN
                INSERT INTO drivers (name, license_plate, phone, user_id)
                VALUES (
                    record_item->>'driver_name',
                    record_item->>'license_plate',
                    record_item->>'driver_phone',
                    auth.uid()
                ) RETURNING id INTO v_driver_id;
            END IF;

            -- 生成自动编号
            v_auto_number := 'WB' || TO_CHAR(NOW(), 'YYYYMMDD') || 
                           LPAD(nextval('logistics_records_seq')::TEXT, 4, '0');

            -- 计算成本
            v_payable_cost := COALESCE((record_item->>'current_cost')::DECIMAL, 0) + 
                            COALESCE((record_item->>'extra_cost')::DECIMAL, 0);

            -- 插入记录
            INSERT INTO logistics_records (
                auto_number, project_id, project_name, driver_id, driver_name,
                license_plate, driver_phone, loading_date, unloading_date,
                loading_location, unloading_location, loading_weight, unloading_weight,
                transport_type, current_cost, extra_cost, driver_payable_cost,
                chain_id, remarks, user_id
            ) VALUES (
                v_auto_number,
                (record_item->>'project_id')::UUID,
                record_item->>'project_name',
                v_driver_id,
                record_item->>'driver_name',
                record_item->>'license_plate',
                record_item->>'driver_phone',
                (record_item->>'loading_date')::TIMESTAMP,
                NULLIF(record_item->>'unloading_date', '')::TIMESTAMP,
                record_item->>'loading_location',
                record_item->>'unloading_location',
                (record_item->>'loading_weight')::DECIMAL,
                (record_item->>'unloading_weight')::DECIMAL,
                record_item->>'transport_type',
                (record_item->>'current_cost')::DECIMAL,
                (record_item->>'extra_cost')::DECIMAL,
                v_payable_cost,
                NULLIF(record_item->>'chain_id', '')::UUID,
                record_item->>'remarks',
                auth.uid()
            );
            
            created_count := created_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            errors := errors || json_build_object(
                'row', i,
                'message', SQLERRM,
                'record', record_item
            );
        END;
    END LOOP;

    -- 处理更新记录（类似逻辑）
    -- ... 更新逻辑代码 ...

    -- 返回结果
    result := json_build_object(
        'created_count', created_count,
        'updated_count', updated_count,
        'error_count', error_count,
        'errors', array_to_json(errors),
        'success', error_count = 0
    );

    RETURN result;
END;
$$;
```

### 💰 财务管理函数

#### 7. get_payment_request_data_v2
```sql
-- 功能: 获取付款申请数据（增强版）
-- 参数: 筛选条件和分页参数
-- 返回: 付款申请列表和统计
CREATE OR REPLACE FUNCTION get_payment_request_data_v2(
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL,
    p_project_name TEXT DEFAULT NULL,
    p_partner_name TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    records_data JSON;
    summary_data JSON;
    total_count INTEGER;
BEGIN
    -- 构建查询条件
    WITH filtered_records AS (
        SELECT 
            lr.*,
            p.name as project_name,
            pc.chain_name as partner_name,
            COALESCE(lr.driver_payable_cost, 0) as payable_amount
        FROM logistics_records lr
        LEFT JOIN projects p ON lr.project_id = p.id
        LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
        WHERE (p_start_date IS NULL OR lr.loading_date >= p_start_date::timestamp)
        AND (p_end_date IS NULL OR lr.loading_date <= p_end_date::timestamp)
        AND (p_project_name IS NULL OR p.name ILIKE '%' || p_project_name || '%')
        AND (p_partner_name IS NULL OR pc.chain_name ILIKE '%' || p_partner_name || '%')
        AND lr.driver_payable_cost > 0
    )
    SELECT 
        json_agg(
            json_build_object(
                'id', id,
                'auto_number', auto_number,
                'project_name', project_name,
                'partner_name', COALESCE(partner_name, '未指定'),
                'driver_name', driver_name,
                'license_plate', license_plate,
                'loading_date', loading_date,
                'loading_weight', loading_weight,
                'payable_amount', payable_amount,
                'payment_status', COALESCE(payment_status, 'pending')
            ) ORDER BY loading_date DESC
            LIMIT p_limit OFFSET p_offset
        ),
        COUNT(*)
    INTO records_data, total_count
    FROM filtered_records;

    -- 构建汇总数据
    WITH summary AS (
        SELECT 
            COUNT(*) as total_records,
            COALESCE(SUM(lr.driver_payable_cost), 0) as total_amount,
            COUNT(*) FILTER (WHERE payment_status = 'pending') as pending_count,
            COUNT(*) FILTER (WHERE payment_status = 'approved') as approved_count,
            COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count
        FROM logistics_records lr
        LEFT JOIN projects p ON lr.project_id = p.id
        LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
        WHERE (p_start_date IS NULL OR lr.loading_date >= p_start_date::timestamp)
        AND (p_end_date IS NULL OR lr.loading_date <= p_end_date::timestamp)
        AND (p_project_name IS NULL OR p.name ILIKE '%' || p_project_name || '%')
        AND (p_partner_name IS NULL OR pc.chain_name ILIKE '%' || p_partner_name || '%')
    )
    SELECT json_build_object(
        'total_records', total_records,
        'total_amount', total_amount,
        'pending_count', pending_count,
        'approved_count', approved_count,
        'paid_count', paid_count
    ) INTO summary_data
    FROM summary;

    -- 组装结果
    result := json_build_object(
        'records', COALESCE(records_data, '[]'::json),
        'summary', summary_data,
        'pagination', json_build_object(
            'total_count', total_count,
            'limit', p_limit,
            'offset', p_offset,
            'has_more', total_count > (p_offset + p_limit)
        )
    );

    RETURN result;
END;
$$;
```

#### 8. 财务统计函数组
```sql
-- 获取总应收款
CREATE OR REPLACE FUNCTION get_total_receivables()
RETURNS DECIMAL
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COALESCE(SUM(driver_payable_cost), 0)
    FROM logistics_records
    WHERE payment_status IS NULL OR payment_status != 'paid';
$$;

-- 获取月度应收款
CREATE OR REPLACE FUNCTION get_monthly_receivables()
RETURNS DECIMAL
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COALESCE(SUM(driver_payable_cost), 0)
    FROM logistics_records
    WHERE DATE_TRUNC('month', loading_date) = DATE_TRUNC('month', CURRENT_DATE)
    AND (payment_status IS NULL OR payment_status != 'paid');
$$;

-- 获取待付款金额
CREATE OR REPLACE FUNCTION get_pending_payments()
RETURNS DECIMAL
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COALESCE(SUM(driver_payable_cost), 0)
    FROM logistics_records
    WHERE payment_status = 'pending';
$$;

-- 获取待开票金额
CREATE OR REPLACE FUNCTION get_pending_invoicing()
RETURNS DECIMAL
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COALESCE(SUM(driver_payable_cost), 0)
    FROM logistics_records
    WHERE invoice_status IS NULL OR invoice_status = 'pending';
$$;
```

### 🔍 数据查询优化函数

#### 9. get_logistics_summary_and_records_enhanced
```sql
-- 功能: 获取物流记录汇总和详细数据（增强版）
-- 参数: 多维度筛选条件和分页
-- 返回: 汇总统计和记录列表
CREATE OR REPLACE FUNCTION get_logistics_summary_and_records_enhanced(
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL,
    p_project_name TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_license_plate TEXT DEFAULT NULL,
    p_driver_phone TEXT DEFAULT NULL,
    p_other_platform_name TEXT DEFAULT NULL,
    p_waybill_numbers TEXT DEFAULT NULL,
    p_has_scale_record BOOLEAN DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    summary_data JSON;
    records_data JSON;
    total_count INTEGER;
    where_conditions TEXT := '';
    query_text TEXT;
BEGIN
    -- 动态构建WHERE条件
    IF p_start_date IS NOT NULL THEN
        where_conditions := where_conditions || ' AND lr.loading_date >= ''' || p_start_date || '''::timestamp';
    END IF;
    
    IF p_end_date IS NOT NULL THEN
        where_conditions := where_conditions || ' AND lr.loading_date <= ''' || p_end_date || '''::timestamp';
    END IF;
    
    IF p_project_name IS NOT NULL THEN
        where_conditions := where_conditions || ' AND lr.project_name ILIKE ''%' || p_project_name || '%''';
    END IF;
    
    IF p_driver_name IS NOT NULL THEN
        where_conditions := where_conditions || ' AND lr.driver_name ILIKE ''%' || p_driver_name || '%''';
    END IF;
    
    IF p_license_plate IS NOT NULL THEN
        where_conditions := where_conditions || ' AND lr.license_plate ILIKE ''%' || p_license_plate || '%''';
    END IF;
    
    IF p_driver_phone IS NOT NULL THEN
        where_conditions := where_conditions || ' AND lr.driver_phone ILIKE ''%' || p_driver_phone || '%''';
    END IF;
    
    -- 外部跟踪号筛选
    IF p_other_platform_name IS NOT NULL THEN
        where_conditions := where_conditions || ' AND EXISTS (
            SELECT 1 FROM unnest(lr.other_platform_names) AS platform 
            WHERE platform ILIKE ''%' || p_other_platform_name || '%''
        )';
    END IF;
    
    -- 运单号筛选
    IF p_waybill_numbers IS NOT NULL THEN
        where_conditions := where_conditions || ' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(lr.external_tracking_numbers) AS tracking_num
            WHERE tracking_num ILIKE ''%' || p_waybill_numbers || '%''
        )';
    END IF;
    
    -- 磅单记录筛选
    IF p_has_scale_record IS NOT NULL THEN
        IF p_has_scale_record THEN
            where_conditions := where_conditions || ' AND EXISTS (
                SELECT 1 FROM scale_records sr WHERE sr.logistics_record_id = lr.id
            )';
        ELSE
            where_conditions := where_conditions || ' AND NOT EXISTS (
                SELECT 1 FROM scale_records sr WHERE sr.logistics_record_id = lr.id
            )';
        END IF;
    END IF;

    -- 构建完整查询
    query_text := '
        WITH filtered_records AS (
            SELECT lr.*, p.billing_type_id, pc.chain_name
            FROM logistics_records lr
            LEFT JOIN projects p ON lr.project_id = p.id
            LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
            WHERE 1=1 ' || where_conditions || '
        )
        SELECT 
            COUNT(*) as total_count,
            COALESCE(SUM(loading_weight), 0) as total_weight,
            COALESCE(SUM(driver_payable_cost), 0) as total_cost,
            COUNT(*) FILTER (WHERE transport_type = ''实际运输'') as actual_transport_count,
            COUNT(*) FILTER (WHERE transport_type = ''空车返回'') as return_count,
            COUNT(DISTINCT driver_name) as unique_drivers,
            COUNT(DISTINCT project_name) as unique_projects
        FROM filtered_records';

    -- 执行汇总查询
    EXECUTE query_text INTO summary_data;

    -- 获取分页记录
    query_text := '
        WITH filtered_records AS (
            SELECT lr.*, p.billing_type_id, pc.chain_name
            FROM logistics_records lr
            LEFT JOIN projects p ON lr.project_id = p.id
            LEFT JOIN partner_chains pc ON lr.chain_id = pc.id
            WHERE 1=1 ' || where_conditions || '
            ORDER BY lr.loading_date DESC
            LIMIT ' || p_limit || ' OFFSET ' || p_offset || '
        )
        SELECT json_agg(
            json_build_object(
                ''id'', id,
                ''auto_number'', auto_number,
                ''project_name'', project_name,
                ''driver_name'', driver_name,
                ''license_plate'', license_plate,
                ''loading_date'', loading_date,
                ''loading_weight'', loading_weight,
                ''transport_type'', transport_type,
                ''driver_payable_cost'', driver_payable_cost,
                ''chain_name'', COALESCE(chain_name, ''未指定''),
                ''billing_type_id'', COALESCE(billing_type_id, 1)
            )
        )
        FROM filtered_records';

    EXECUTE query_text INTO records_data;

    -- 组装最终结果
    result := json_build_object(
        'summary', summary_data,
        'records', COALESCE(records_data, '[]'::json),
        'pagination', json_build_object(
            'limit', p_limit,
            'offset', p_offset,
            'total_count', (summary_data->>'total_count')::INTEGER
        )
    );

    RETURN result;
END;
$$;
```

### 🛡️ 权限管理函数

#### 10. 权限管理相关函数
```sql
-- 检查枚举值是否存在
CREATE OR REPLACE FUNCTION check_enum_value(
    p_enum_name TEXT,
    p_value TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    value_exists BOOLEAN := FALSE;
BEGIN
    -- 检查指定枚举类型中是否存在指定值
    SELECT EXISTS (
        SELECT 1 
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = p_enum_name
        AND e.enumlabel = p_value
    ) INTO value_exists;
    
    RETURN value_exists;
END;
$$;

-- 添加枚举值
CREATE OR REPLACE FUNCTION add_enum_value(
    p_enum_name TEXT,
    p_value TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 检查枚举类型是否存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = p_enum_name
    ) THEN
        RAISE EXCEPTION 'Enum type % does not exist', p_enum_name;
    END IF;
    
    -- 检查值是否已存在
    IF check_enum_value(p_enum_name, p_value) THEN
        RETURN; -- 值已存在，直接返回
    END IF;
    
    -- 添加枚举值
    EXECUTE format('ALTER TYPE %I ADD VALUE %L', p_enum_name, p_value);
END;
$$;

-- 应用标准RLS策略
CREATE OR REPLACE FUNCTION apply_standard_rls_policies(
    p_table_name TEXT,
    p_user_id_column TEXT DEFAULT 'user_id'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 启用RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
    
    -- 创建SELECT策略
    EXECUTE format('
        CREATE POLICY %I ON %I
        FOR SELECT USING (
            %I = auth.uid() OR
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() AND role = ''admin''
            )
        )', 
        p_table_name || '_select_policy',
        p_table_name,
        p_user_id_column
    );
    
    -- 创建INSERT策略
    EXECUTE format('
        CREATE POLICY %I ON %I
        FOR INSERT WITH CHECK (
            %I = auth.uid()
        )', 
        p_table_name || '_insert_policy',
        p_table_name,
        p_user_id_column
    );
    
    -- 创建UPDATE策略
    EXECUTE format('
        CREATE POLICY %I ON %I
        FOR UPDATE USING (
            %I = auth.uid() OR
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() AND role IN (''admin'', ''manager'')
            )
        )', 
        p_table_name || '_update_policy',
        p_table_name,
        p_user_id_column
    );
    
    -- 创建DELETE策略
    EXECUTE format('
        CREATE POLICY %I ON %I
        FOR DELETE USING (
            %I = auth.uid() OR
            EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() AND role = ''admin''
            )
        )', 
        p_table_name || '_delete_policy',
        p_table_name,
        p_user_id_column
    );
END;
$$;
```

---

## 触发器备份

### 🔄 自动化触发器

#### 1. 自动编号生成触发器
```sql
-- 创建序列
CREATE SEQUENCE IF NOT EXISTS logistics_records_seq START 1;

-- 自动编号生成函数
CREATE OR REPLACE FUNCTION generate_auto_number()
RETURNS TRIGGER AS $$
DECLARE
    date_part TEXT;
    seq_part TEXT;
BEGIN
    IF NEW.auto_number IS NULL THEN
        date_part := TO_CHAR(COALESCE(NEW.loading_date, NOW()), 'YYYYMMDD');
        seq_part := LPAD(nextval('logistics_records_seq')::TEXT, 4, '0');
        NEW.auto_number := 'WB' || date_part || seq_part;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用触发器
CREATE TRIGGER trigger_generate_auto_number
    BEFORE INSERT ON logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION generate_auto_number();
```

#### 2. 更新时间戳触发器
```sql
-- 通用更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用到各个表
CREATE TRIGGER trigger_update_logistics_records_updated_at
    BEFORE UPDATE ON logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

#### 3. 权限变更日志触发器
```sql
-- 权限变更日志函数
CREATE OR REPLACE FUNCTION log_permission_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- 记录权限变更
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            old_values,
            new_values,
            user_id,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id,
            'INSERT',
            NULL,
            row_to_json(NEW),
            auth.uid(),
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            old_values,
            new_values,
            user_id,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            NEW.id,
            'UPDATE',
            row_to_json(OLD),
            row_to_json(NEW),
            auth.uid(),
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            table_name,
            record_id,
            action,
            old_values,
            new_values,
            user_id,
            created_at
        ) VALUES (
            TG_TABLE_NAME,
            OLD.id,
            'DELETE',
            row_to_json(OLD),
            NULL,
            auth.uid(),
            NOW()
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 应用到权限相关表
CREATE TRIGGER trigger_log_user_permissions_changes
    AFTER INSERT OR UPDATE OR DELETE ON user_permissions
    FOR EACH ROW
    EXECUTE FUNCTION log_permission_changes();
```

#### 4. 数据验证触发器
```sql
-- 物流记录数据验证函数
CREATE OR REPLACE FUNCTION validate_logistics_record()
RETURNS TRIGGER AS $$
BEGIN
    -- 验证重量不能为负数
    IF NEW.loading_weight < 0 THEN
        RAISE EXCEPTION '装货重量不能为负数';
    END IF;
    
    IF NEW.unloading_weight IS NOT NULL AND NEW.unloading_weight < 0 THEN
        RAISE EXCEPTION '卸货重量不能为负数';
    END IF;
    
    -- 验证日期逻辑
    IF NEW.unloading_date IS NOT NULL AND NEW.unloading_date < NEW.loading_date THEN
        RAISE EXCEPTION '卸货日期不能早于装货日期';
    END IF;
    
    -- 验证成本不能为负数
    IF NEW.driver_payable_cost < 0 THEN
        RAISE EXCEPTION '司机应付费用不能为负数';
    END IF;
    
    -- 自动计算总成本
    NEW.driver_payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用验证触发器
CREATE TRIGGER trigger_validate_logistics_record
    BEFORE INSERT OR UPDATE ON logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION validate_logistics_record();
```

#### 5. 缓存刷新触发器
```sql
-- 缓存刷新通知函数
CREATE OR REPLACE FUNCTION notify_cache_refresh()
RETURNS TRIGGER AS $$
BEGIN
    -- 发送缓存刷新通知
    PERFORM pg_notify(
        'cache_refresh',
        json_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP,
            'record_id', COALESCE(NEW.id, OLD.id),
            'timestamp', extract(epoch from now())
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 应用到需要缓存刷新的表
CREATE TRIGGER trigger_notify_logistics_cache_refresh
    AFTER INSERT OR UPDATE OR DELETE ON logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION notify_cache_refresh();

CREATE TRIGGER trigger_notify_projects_cache_refresh
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION notify_cache_refresh();
```

---

## 视图定义

### 📊 业务视图

#### 1. 物流记录详细视图
```sql
-- 物流记录详细信息视图
CREATE OR REPLACE VIEW v_logistics_records_detailed AS
SELECT 
    lr.id,
    lr.auto_number,
    lr.loading_date,
    lr.unloading_date,
    lr.driver_name,
    lr.license_plate,
    lr.driver_phone,
    lr.loading_location,
    lr.unloading_location,
    lr.loading_weight,
    lr.unloading_weight,
    lr.transport_type,
    lr.driver_payable_cost,
    lr.current_cost,
    lr.extra_cost,
    lr.remarks,
    lr.created_at,
    lr.updated_at,
    -- 关联信息
    p.name as project_name,
    p.manager as project_manager,
    p.billing_type_id,
    pc.chain_name as partner_name,
    -- 计算字段
    CASE p.billing_type_id
        WHEN 1 THEN '计重'
        WHEN 2 THEN '计车'
        WHEN 3 THEN '计体积'
        ELSE '未知'
    END as billing_type_name,
    -- 状态字段
    CASE 
        WHEN lr.unloading_date IS NOT NULL THEN '已完成'
        WHEN lr.loading_date <= NOW() THEN '运输中'
        ELSE '待装货'
    END as transport_status,
    -- 时间计算
    CASE 
        WHEN lr.unloading_date IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (lr.unloading_date - lr.loading_date)) / 3600
        ELSE NULL
    END as transport_hours
FROM logistics_records lr
LEFT JOIN projects p ON lr.project_id = p.id
LEFT JOIN partner_chains pc ON lr.chain_id = pc.id;
```

#### 2. 项目统计视图
```sql
-- 项目统计汇总视图
CREATE OR REPLACE VIEW v_project_statistics AS
SELECT 
    p.id,
    p.name,
    p.manager,
    p.project_status,
    p.planned_total_tons,
    p.billing_type_id,
    p.start_date,
    p.end_date,
    -- 运输统计
    COUNT(lr.id) as total_records,
    COUNT(DISTINCT lr.driver_name) as unique_drivers,
    COALESCE(SUM(lr.loading_weight), 0) as total_weight,
    COALESCE(SUM(lr.driver_payable_cost), 0) as total_cost,
    COALESCE(AVG(lr.driver_payable_cost), 0) as avg_cost_per_record,
    -- 完成度计算
    CASE 
        WHEN p.planned_total_tons > 0 AND p.billing_type_id = 1 THEN
            (COALESCE(SUM(lr.loading_weight), 0) / p.planned_total_tons * 100)
        WHEN p.planned_total_tons > 0 AND p.billing_type_id = 2 THEN
            (COUNT(lr.id) / p.planned_total_tons * 100)
        ELSE 0
    END as completion_percentage,
    -- 运输类型分布
    COUNT(*) FILTER (WHERE lr.transport_type = '实际运输') as actual_transport_count,
    COUNT(*) FILTER (WHERE lr.transport_type = '空车返回') as return_count,
    COUNT(*) FILTER (WHERE lr.transport_type = '倒短') as short_haul_count,
    -- 时间统计
    MIN(lr.loading_date) as first_transport_date,
    MAX(lr.loading_date) as last_transport_date,
    -- 本月统计
    COUNT(*) FILTER (WHERE DATE_TRUNC('month', lr.loading_date) = DATE_TRUNC('month', CURRENT_DATE)) as current_month_records,
    COALESCE(SUM(lr.loading_weight) FILTER (WHERE DATE_TRUNC('month', lr.loading_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as current_month_weight
FROM projects p
LEFT JOIN logistics_records lr ON p.id = lr.project_id
GROUP BY p.id, p.name, p.manager, p.project_status, p.planned_total_tons, p.billing_type_id, p.start_date, p.end_date;
```

#### 3. 司机绩效视图
```sql
-- 司机绩效统计视图
CREATE OR REPLACE VIEW v_driver_performance AS
SELECT 
    lr.driver_name,
    lr.license_plate,
    lr.driver_phone,
    -- 基础统计
    COUNT(*) as total_trips,
    COUNT(DISTINCT lr.project_id) as projects_served,
    COALESCE(SUM(lr.loading_weight), 0) as total_weight,
    COALESCE(SUM(lr.driver_payable_cost), 0) as total_earnings,
    COALESCE(AVG(lr.driver_payable_cost), 0) as avg_earnings_per_trip,
    -- 运输类型分布
    COUNT(*) FILTER (WHERE lr.transport_type = '实际运输') as actual_transports,
    COUNT(*) FILTER (WHERE lr.transport_type = '空车返回') as empty_returns,
    COUNT(*) FILTER (WHERE lr.transport_type = '倒短') as short_hauls,
    -- 时间统计
    MIN(lr.loading_date) as first_trip_date,
    MAX(lr.loading_date) as last_trip_date,
    -- 月度统计
    COUNT(*) FILTER (WHERE DATE_TRUNC('month', lr.loading_date) = DATE_TRUNC('month', CURRENT_DATE)) as current_month_trips,
    COALESCE(SUM(lr.loading_weight) FILTER (WHERE DATE_TRUNC('month', lr.loading_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as current_month_weight,
    COALESCE(SUM(lr.driver_payable_cost) FILTER (WHERE DATE_TRUNC('month', lr.loading_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as current_month_earnings,
    -- 效率指标
    CASE 
        WHEN COUNT(*) > 0 THEN
            COALESCE(SUM(lr.loading_weight), 0) / COUNT(*)
        ELSE 0
    END as avg_weight_per_trip,
    -- 活跃度
    CASE 
        WHEN MAX(lr.loading_date) >= CURRENT_DATE - INTERVAL '30 days' THEN '活跃'
        WHEN MAX(lr.loading_date) >= CURRENT_DATE - INTERVAL '90 days' THEN '不活跃'
        ELSE '长期未活动'
    END as activity_status
FROM logistics_records lr
GROUP BY lr.driver_name, lr.license_plate, lr.driver_phone;
```

#### 4. 财务汇总视图
```sql
-- 财务数据汇总视图
CREATE OR REPLACE VIEW v_financial_summary AS
SELECT 
    -- 按项目汇总
    p.id as project_id,
    p.name as project_name,
    p.manager as project_manager,
    -- 收入统计
    COALESCE(SUM(lr.driver_payable_cost), 0) as total_payable,
    COALESCE(SUM(lr.current_cost), 0) as total_current_cost,
    COALESCE(SUM(lr.extra_cost), 0) as total_extra_cost,
    -- 付款状态统计
    COUNT(*) FILTER (WHERE lr.payment_status IS NULL OR lr.payment_status = 'pending') as pending_payments_count,
    COUNT(*) FILTER (WHERE lr.payment_status = 'approved') as approved_payments_count,
    COUNT(*) FILTER (WHERE lr.payment_status = 'paid') as paid_payments_count,
    -- 付款金额统计
    COALESCE(SUM(lr.driver_payable_cost) FILTER (WHERE lr.payment_status IS NULL OR lr.payment_status = 'pending'), 0) as pending_amount,
    COALESCE(SUM(lr.driver_payable_cost) FILTER (WHERE lr.payment_status = 'approved'), 0) as approved_amount,
    COALESCE(SUM(lr.driver_payable_cost) FILTER (WHERE lr.payment_status = 'paid'), 0) as paid_amount,
    -- 开票状态
    COUNT(*) FILTER (WHERE lr.invoice_status IS NULL OR lr.invoice_status = 'pending') as pending_invoice_count,
    COUNT(*) FILTER (WHERE lr.invoice_status = 'issued') as issued_invoice_count,
    COALESCE(SUM(lr.driver_payable_cost) FILTER (WHERE lr.invoice_status IS NULL OR lr.invoice_status = 'pending'), 0) as pending_invoice_amount,
    -- 时间统计
    MIN(lr.loading_date) as earliest_record,
    MAX(lr.loading_date) as latest_record,
    -- 月度对比
    COALESCE(SUM(lr.driver_payable_cost) FILTER (WHERE DATE_TRUNC('month', lr.loading_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as current_month_total,
    COALESCE(SUM(lr.driver_payable_cost) FILTER (WHERE DATE_TRUNC('month', lr.loading_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0) as last_month_total
FROM projects p
LEFT JOIN logistics_records lr ON p.id = lr.project_id
GROUP BY p.id, p.name, p.manager;
```

---

## 索引策略

### 🚀 性能优化索引

#### 1. 核心业务索引
```sql
-- 物流记录核心索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_records_loading_date 
ON logistics_records(loading_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_records_project_id 
ON logistics_records(project_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_records_driver_name 
ON logistics_records(driver_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_records_auto_number 
ON logistics_records(auto_number);

-- 复合索引用于常见查询
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_records_project_driver_date 
ON logistics_records(project_id, driver_name, loading_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_records_date_type 
ON logistics_records(loading_date DESC, transport_type);
```

#### 2. 权限相关索引
```sql
-- 用户权限索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_user_id 
ON user_permissions(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_type_name 
ON user_permissions(permission_type, permission_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permissions_lookup 
ON user_permissions(user_id, permission_type, permission_name, has_permission);

-- 用户配置索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_role 
ON user_profiles(role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_status 
ON user_profiles(status);
```

#### 3. 全文搜索索引
```sql
-- 为搜索功能创建GIN索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_records_search 
ON logistics_records USING GIN(
    to_tsvector('chinese', 
        COALESCE(project_name, '') || ' ' ||
        COALESCE(driver_name, '') || ' ' ||
        COALESCE(license_plate, '') || ' ' ||
        COALESCE(loading_location, '') || ' ' ||
        COALESCE(unloading_location, '')
    )
);

-- 项目搜索索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_search 
ON projects USING GIN(
    to_tsvector('chinese',
        COALESCE(name, '') || ' ' ||
        COALESCE(manager, '') || ' ' ||
        COALESCE(loading_address, '') || ' ' ||
        COALESCE(unloading_address, '')
    )
);
```

#### 4. JSON字段索引
```sql
-- 外部跟踪号JSON索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_external_tracking 
ON logistics_records USING GIN(external_tracking_numbers);

-- 平台名称数组索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_logistics_platform_names 
ON logistics_records USING GIN(other_platform_names);
```

#### 5. 分区表索引（未来扩展）
```sql
-- 为大表创建分区索引模板
-- 按年份分区的物流记录表索引
/*
CREATE INDEX CONCURRENTLY idx_logistics_records_2024_loading_date 
ON logistics_records_2024(loading_date DESC);

CREATE INDEX CONCURRENTLY idx_logistics_records_2024_project_id 
ON logistics_records_2024(project_id);
*/
```

---

## RLS策略

### 🔐 行级安全策略

#### 1. 物流记录RLS策略
```sql
-- 启用RLS
ALTER TABLE logistics_records ENABLE ROW LEVEL SECURITY;

-- 查看策略：基于用户权限和项目分配
CREATE POLICY "logistics_records_select_policy" 
ON logistics_records FOR SELECT 
USING (
    -- 管理员可以查看所有数据
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- 有业务录入菜单权限的用户可以查看数据
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'menu' 
        AND permission_name = 'business_entry' 
        AND has_permission = true
    )
    OR
    -- 有特定项目权限的用户可以查看对应项目数据
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'project' 
        AND permission_name = project_id::text 
        AND has_permission = true
    )
    OR
    -- 记录创建者可以查看自己的记录
    user_id = auth.uid()
);

-- 插入策略：用户只能创建自己的记录
CREATE POLICY "logistics_records_insert_policy" 
ON logistics_records FOR INSERT 
WITH CHECK (
    user_id = auth.uid()
    AND
    -- 必须有业务录入权限
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'function' 
        AND permission_name = 'create_logistics_record' 
        AND has_permission = true
    )
);

-- 更新策略：记录创建者或有权限的用户可以更新
CREATE POLICY "logistics_records_update_policy" 
ON logistics_records FOR UPDATE 
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
    OR
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'function' 
        AND permission_name = 'edit_logistics_record' 
        AND has_permission = true
    )
);

-- 删除策略：只有管理员或记录创建者可以删除
CREATE POLICY "logistics_records_delete_policy" 
ON logistics_records FOR DELETE 
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
```

#### 2. 项目RLS策略
```sql
-- 启用项目表RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 查看策略：基于项目权限
CREATE POLICY "projects_select_policy" 
ON projects FOR SELECT 
USING (
    -- 管理员可以查看所有项目
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- 有项目菜单权限的用户可以查看项目
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'menu' 
        AND permission_name = 'projects' 
        AND has_permission = true
    )
    OR
    -- 有特定项目权限的用户可以查看对应项目
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'project' 
        AND permission_name = id::text 
        AND has_permission = true
    )
);

-- 插入策略：只有管理员或有创建项目权限的用户可以创建
CREATE POLICY "projects_insert_policy" 
ON projects FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
    OR
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'function' 
        AND permission_name = 'create_project' 
        AND has_permission = true
    )
);

-- 更新策略：管理员或项目经理可以更新
CREATE POLICY "projects_update_policy" 
ON projects FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
    OR
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'function' 
        AND permission_name = 'edit_project' 
        AND has_permission = true
    )
);
```

#### 3. 用户权限RLS策略
```sql
-- 用户权限表RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- 查看策略：用户可以查看自己的权限，管理员可以查看所有权限
CREATE POLICY "user_permissions_select_policy" 
ON user_permissions FOR SELECT 
USING (
    user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- 插入/更新/删除策略：只有管理员可以操作
CREATE POLICY "user_permissions_admin_only_policy" 
ON user_permissions FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
```

#### 4. 合同管理RLS策略
```sql
-- 合同表RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- 查看策略：基于合同权限
CREATE POLICY "contracts_select_policy" 
ON contracts FOR SELECT 
USING (
    -- 管理员可以查看所有合同
    EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- 有合同菜单权限的用户可以查看
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'menu' 
        AND permission_name = 'contracts' 
        AND has_permission = true
    )
    OR
    -- 合同创建者可以查看
    created_by_user_id = auth.uid()
);

-- 插入策略：有创建合同权限的用户可以创建
CREATE POLICY "contracts_insert_policy" 
ON contracts FOR INSERT 
WITH CHECK (
    created_by_user_id = auth.uid()
    AND
    EXISTS (
        SELECT 1 FROM user_permissions 
        WHERE user_id = auth.uid() 
        AND permission_type = 'function' 
        AND permission_name = 'create_contract' 
        AND has_permission = true
    )
);
```

---

## 枚举类型

### 📝 系统枚举定义

#### 1. 用户角色枚举
```sql
-- 创建用户角色枚举类型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'admin',        -- 系统管理员
            'manager',      -- 部门经理  
            'finance',      -- 财务人员
            'business',     -- 业务人员
            'operator',     -- 操作员
            'viewer'        -- 查看者
        );
    END IF;
END $$;
```

#### 2. 项目状态枚举
```sql
-- 项目状态枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE project_status AS ENUM (
            '进行中',       -- 正在进行
            '已完成',       -- 已完成
            '暂停',         -- 暂停
            '已取消'        -- 已取消
        );
    END IF;
END $$;
```

#### 3. 运输类型枚举
```sql
-- 运输类型枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transport_type') THEN
        CREATE TYPE transport_type AS ENUM (
            '实际运输',     -- 实际运输
            '空车返回',     -- 空车返回
            '倒短'          -- 倒短运输
        );
    END IF;
END $$;
```

#### 4. 付款状态枚举
```sql
-- 付款状态枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM (
            'pending',      -- 待付款
            'approved',     -- 已批准
            'paid',         -- 已付款
            'rejected',     -- 已拒绝
            'cancelled'     -- 已取消
        );
    END IF;
END $$;
```

#### 5. 合同状态枚举
```sql
-- 合同状态枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
        CREATE TYPE contract_status AS ENUM (
            'draft',        -- 草稿
            'pending',      -- 待审批
            'approved',     -- 已批准
            'active',       -- 生效中
            'expired',      -- 已过期
            'terminated',   -- 已终止
            'cancelled'     -- 已取消
        );
    END IF;
END $$;
```

#### 6. 权限类型枚举
```sql
-- 权限类型枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_type') THEN
        CREATE TYPE permission_type AS ENUM (
            'menu',         -- 菜单权限
            'function',     -- 功能权限
            'project',      -- 项目权限
            'data'          -- 数据权限
        );
    END IF;
END $$;
```

#### 7. 用户状态枚举
```sql
-- 用户状态枚举
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM (
            'active',       -- 活跃
            'inactive',     -- 非活跃
            'suspended',    -- 已暂停
            'deleted'       -- 已删除
        );
    END IF;
END $$;
```

---

## 🔧 维护脚本

### 定期维护任务
```sql
-- 每日维护任务
DO $$
BEGIN
    -- 更新表统计信息
    ANALYZE logistics_records;
    ANALYZE projects;
    ANALYZE user_permissions;
    
    -- 清理过期会话
    DELETE FROM auth.sessions 
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    -- 清理过期审计日志
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE '每日维护任务完成';
END $$;

-- 每周维护任务
DO $$
BEGIN
    -- 重建索引
    REINDEX TABLE logistics_records;
    REINDEX TABLE projects;
    
    -- 清理死元组
    VACUUM ANALYZE logistics_records;
    VACUUM ANALYZE projects;
    
    RAISE NOTICE '每周维护任务完成';
END $$;
```

---

*本文档记录了截至2024年1月15日的完整数据库函数、触发器、视图、索引和RLS策略。建议定期更新此备份文档。*
