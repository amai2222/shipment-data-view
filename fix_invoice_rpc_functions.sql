-- 修复开票申请RPC函数的SQL命令
-- 请在Supabase SQL编辑器中执行以下命令

-- 1. 先删除已存在的函数（如果存在）
DROP FUNCTION IF EXISTS get_filtered_uninvoiced_record_ids(uuid,date,date,uuid);
DROP FUNCTION IF EXISTS get_invoice_request_data(uuid,date,date,uuid,text[],integer,integer);
DROP FUNCTION IF EXISTS get_invoice_request_data_v2(text[]);
DROP FUNCTION IF EXISTS save_invoice_request(json);

-- 2. 添加invoice_status字段到logistics_records表（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'logistics_records' 
    AND column_name = 'invoice_status'
  ) THEN
    ALTER TABLE logistics_records 
    ADD COLUMN invoice_status TEXT DEFAULT 'Uninvoiced' 
    CHECK (invoice_status IN ('Uninvoiced', 'Processing', 'Invoiced'));
    
    -- 为现有记录设置默认值
    UPDATE logistics_records SET invoice_status = 'Uninvoiced' WHERE invoice_status IS NULL;
  END IF;
END $$;

-- 3. 重新创建获取开票申请数据的主函数
CREATE OR REPLACE FUNCTION get_invoice_request_data(
  p_project_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL,
  p_invoice_status_array TEXT[] DEFAULT NULL,
  p_page_size INTEGER DEFAULT 50,
  p_page_number INTEGER DEFAULT 1
) RETURNS JSON AS $$
DECLARE
  result JSON;
  total_count INTEGER;
  offset_value INTEGER;
BEGIN
  -- 计算偏移量
  offset_value := (p_page_number - 1) * p_page_size;
  
  -- 获取总记录数
  SELECT COUNT(DISTINCT lr.id) INTO total_count
  FROM logistics_records lr
  LEFT JOIN projects p ON lr.project_id = p.id
  LEFT JOIN project_partners pp ON lr.project_id = pp.project_id
  WHERE 1=1
    AND (p_project_id IS NULL OR lr.project_id = p_project_id)
    AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
    AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
    AND (p_partner_id IS NULL OR pp.partner_id = p_partner_id)
    AND (p_invoice_status_array IS NULL OR lr.invoice_status = ANY(p_invoice_status_array));

  -- 获取分页数据
  WITH logistics_data AS (
    SELECT DISTINCT
      lr.id,
      lr.auto_number,
      lr.project_id,
      p.name as project_name,
      lr.driver_id,
      lr.driver_name,
      lr.loading_location,
      lr.unloading_location,
      lr.loading_date,
      lr.unloading_date,
      lr.license_plate,
      lr.driver_phone,
      lr.payable_cost,
      lr.invoice_status,
      lr.cargo_type,
      lr.loading_weight,
      lr.unloading_weight,
      lr.remarks,
      lr.billing_type_id
    FROM logistics_records lr
    LEFT JOIN projects p ON lr.project_id = p.id
    LEFT JOIN project_partners pp ON lr.project_id = pp.project_id
    WHERE 1=1
      AND (p_project_id IS NULL OR lr.project_id = p_project_id)
      AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
      AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
      AND (p_partner_id IS NULL OR pp.partner_id = p_partner_id)
      AND (p_invoice_status_array IS NULL OR lr.invoice_status = ANY(p_invoice_status_array))
    ORDER BY lr.loading_date DESC, lr.auto_number DESC
    LIMIT p_page_size OFFSET offset_value
  ),
  partner_costs AS (
    SELECT 
      ld.id as record_id,
      pp.partner_id,
      pt.name as partner_name,
      pp.level,
      CASE 
        WHEN lr.billing_type_id = 1 THEN -- 计重
          ROUND((COALESCE(lr.loading_weight, 0) * pp.rate_per_ton), 2)
        WHEN lr.billing_type_id = 2 THEN -- 计车
          pp.rate_per_trip
        WHEN lr.billing_type_id = 3 THEN -- 计体积
          ROUND((COALESCE(lr.loading_volume, 0) * pp.rate_per_cubic), 2)
        ELSE 0
      END as payable_amount
    FROM logistics_data ld
    JOIN logistics_records lr ON ld.id = lr.id
    JOIN project_partners pp ON lr.project_id = pp.project_id
    JOIN partners pt ON pp.partner_id = pt.id
  ),
  records_with_costs AS (
    SELECT 
      ld.*,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'partner_id', pc.partner_id,
            'partner_name', pc.partner_name,
            'level', pc.level,
            'payable_amount', pc.payable_amount
          )
        ) FILTER (WHERE pc.partner_id IS NOT NULL),
        '[]'::json
      ) as partner_costs
    FROM logistics_data ld
    LEFT JOIN partner_costs pc ON ld.id = pc.record_id
    GROUP BY ld.id, ld.auto_number, ld.project_id, ld.project_name, ld.driver_id, 
             ld.driver_name, ld.loading_location, ld.unloading_location, ld.loading_date,
             ld.unloading_date, ld.license_plate, ld.driver_phone, ld.payable_cost,
             ld.invoice_status, ld.cargo_type, ld.loading_weight, ld.unloading_weight,
             ld.remarks, ld.billing_type_id
    ORDER BY ld.loading_date DESC, ld.auto_number DESC
  ),
  overview_stats AS (
    SELECT 
      COUNT(DISTINCT lr.id) as total_records,
      COALESCE(SUM(lr.payable_cost), 0) as total_invoiceable_cost
    FROM logistics_records lr
    LEFT JOIN project_partners pp ON lr.project_id = pp.project_id
    WHERE 1=1
      AND (p_project_id IS NULL OR lr.project_id = p_project_id)
      AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
      AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
      AND (p_partner_id IS NULL OR pp.partner_id = p_partner_id)
      AND (p_invoice_status_array IS NULL OR lr.invoice_status = ANY(p_invoice_status_array))
  ),
  partner_invoiceables AS (
    SELECT 
      pp.partner_id,
      pt.name as partner_name,
      pp.level,
      COALESCE(SUM(
        CASE 
          WHEN lr.billing_type_id = 1 THEN 
            ROUND((COALESCE(lr.loading_weight, 0) * pp.rate_per_ton), 2)
          WHEN lr.billing_type_id = 2 THEN 
            pp.rate_per_trip
          WHEN lr.billing_type_id = 3 THEN 
            ROUND((COALESCE(lr.loading_volume, 0) * pp.rate_per_cubic), 2)
          ELSE 0
        END
      ), 0) as total_invoiceable
    FROM logistics_records lr
    JOIN project_partners pp ON lr.project_id = pp.project_id
    JOIN partners pt ON pp.partner_id = pt.id
    WHERE 1=1
      AND (p_project_id IS NULL OR lr.project_id = p_project_id)
      AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
      AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
      AND (p_partner_id IS NULL OR pp.partner_id = p_partner_id)
      AND (p_invoice_status_array IS NULL OR lr.invoice_status = ANY(p_invoice_status_array))
    GROUP BY pp.partner_id, pt.name, pp.level
    HAVING SUM(
      CASE 
        WHEN lr.billing_type_id = 1 THEN 
          ROUND((COALESCE(lr.loading_weight, 0) * pp.rate_per_ton), 2)
        WHEN lr.billing_type_id = 2 THEN 
          pp.rate_per_trip
        WHEN lr.billing_type_id = 3 THEN 
          ROUND((COALESCE(lr.loading_volume, 0) * pp.rate_per_cubic), 2)
        ELSE 0
      END
    ) > 0
    ORDER BY pp.level
  )
  
  SELECT JSON_BUILD_OBJECT(
    'records', COALESCE(JSON_AGG(rwc.*), '[]'::json),
    'count', total_count,
    'overview', JSON_BUILD_OBJECT(
      'total_records', os.total_records,
      'total_invoiceable_cost', os.total_invoiceable_cost
    ),
    'partner_invoiceables', COALESCE(
      (SELECT JSON_AGG(pi.*) FROM partner_invoiceables pi),
      '[]'::json
    )
  ) INTO result
  FROM records_with_costs rwc, overview_stats os;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. 重新创建获取未开票记录ID的函数
CREATE OR REPLACE FUNCTION get_filtered_uninvoiced_record_ids(
  p_project_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL
) RETURNS TEXT[] AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT lr.id::TEXT)
  INTO result
  FROM logistics_records lr
  LEFT JOIN project_partners pp ON lr.project_id = pp.project_id
  WHERE 1=1
    AND lr.invoice_status = 'Uninvoiced'
    AND (p_project_id IS NULL OR lr.project_id = p_project_id)
    AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
    AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
    AND (p_partner_id IS NULL OR pp.partner_id = p_partner_id);
    
  RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- 5. 重新创建获取开票申请数据v2的函数
CREATE OR REPLACE FUNCTION get_invoice_request_data_v2(
  p_record_ids TEXT[]
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH logistics_data AS (
    SELECT 
      lr.id,
      lr.auto_number,
      lr.project_id,
      p.name as project_name,
      lr.driver_id,
      lr.driver_name,
      lr.loading_location,
      lr.unloading_location,
      lr.loading_date,
      lr.unloading_date,
      lr.license_plate,
      lr.driver_phone,
      lr.payable_cost,
      lr.invoice_status,
      lr.cargo_type,
      lr.loading_weight,
      lr.unloading_weight,
      lr.remarks,
      lr.billing_type_id
    FROM logistics_records lr
    JOIN projects p ON lr.project_id = p.id
    WHERE lr.id::TEXT = ANY(p_record_ids)
  ),
  partner_costs AS (
    SELECT 
      ld.id as record_id,
      pp.partner_id,
      pt.name as partner_name,
      pp.level,
      pt.full_name,
      pt.bank_account,
      pt.bank_name,
      pt.branch_name,
      CASE 
        WHEN lr.billing_type_id = 1 THEN 
          ROUND((COALESCE(lr.loading_weight, 0) * pp.rate_per_ton), 2)
        WHEN lr.billing_type_id = 2 THEN 
          pp.rate_per_trip
        WHEN lr.billing_type_id = 3 THEN 
          ROUND((COALESCE(lr.loading_volume, 0) * pp.rate_per_cubic), 2)
        ELSE 0
      END as payable_amount
    FROM logistics_data ld
    JOIN logistics_records lr ON ld.id = lr.id
    JOIN project_partners pp ON lr.project_id = pp.project_id
    JOIN partners pt ON pp.partner_id = pt.id
  ),
  records_with_costs AS (
    SELECT 
      ld.*,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'partner_id', pc.partner_id,
            'partner_name', pc.partner_name,
            'level', pc.level,
            'payable_amount', pc.payable_amount,
            'full_name', pc.full_name,
            'bank_account', pc.bank_account,
            'bank_name', pc.bank_name,
            'branch_name', pc.branch_name
          )
        ) FILTER (WHERE pc.partner_id IS NOT NULL),
        '[]'::json
      ) as partner_costs
    FROM logistics_data ld
    LEFT JOIN partner_costs pc ON ld.id = pc.record_id
    GROUP BY ld.id, ld.auto_number, ld.project_id, ld.project_name, ld.driver_id, 
             ld.driver_name, ld.loading_location, ld.unloading_location, ld.loading_date,
             ld.unloading_date, ld.license_plate, ld.driver_phone, ld.payable_cost,
             ld.invoice_status, ld.cargo_type, ld.loading_weight, ld.unloading_weight,
             ld.remarks, ld.billing_type_id
    ORDER BY ld.loading_date DESC, ld.auto_number DESC
  )
  
  SELECT JSON_BUILD_OBJECT(
    'records', COALESCE(JSON_AGG(rwc.*), '[]'::json)
  ) INTO result
  FROM records_with_costs rwc;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. 重新创建获取未开票记录ID的函数
CREATE OR REPLACE FUNCTION get_filtered_uninvoiced_record_ids(
  p_project_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL
) RETURNS TEXT[] AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT lr.id::TEXT)
  INTO result
  FROM logistics_records lr
  LEFT JOIN project_partners pp ON lr.project_id = pp.project_id
  WHERE 1=1
    AND lr.invoice_status = 'Uninvoiced'
    AND (p_project_id IS NULL OR lr.project_id = p_project_id)
    AND (p_start_date IS NULL OR lr.loading_date >= p_start_date)
    AND (p_end_date IS NULL OR lr.loading_date <= p_end_date)
    AND (p_partner_id IS NULL OR pp.partner_id = p_partner_id);
    
  RETURN COALESCE(result, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- 7. 重新创建获取开票申请数据v2的函数
CREATE OR REPLACE FUNCTION get_invoice_request_data_v2(
  p_record_ids TEXT[]
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH logistics_data AS (
    SELECT 
      lr.id,
      lr.auto_number,
      lr.project_id,
      p.name as project_name,
      lr.driver_id,
      lr.driver_name,
      lr.loading_location,
      lr.unloading_location,
      lr.loading_date,
      lr.unloading_date,
      lr.license_plate,
      lr.driver_phone,
      lr.payable_cost,
      lr.invoice_status,
      lr.cargo_type,
      lr.loading_weight,
      lr.unloading_weight,
      lr.remarks,
      lr.billing_type_id
    FROM logistics_records lr
    JOIN projects p ON lr.project_id = p.id
    WHERE lr.id::TEXT = ANY(p_record_ids)
  ),
  partner_costs AS (
    SELECT 
      ld.id as record_id,
      pp.partner_id,
      pt.name as partner_name,
      pp.level,
      pt.full_name,
      pt.bank_account,
      pt.bank_name,
      pt.branch_name,
      CASE 
        WHEN lr.billing_type_id = 1 THEN 
          ROUND((COALESCE(lr.loading_weight, 0) * pp.rate_per_ton), 2)
        WHEN lr.billing_type_id = 2 THEN 
          pp.rate_per_trip
        WHEN lr.billing_type_id = 3 THEN 
          ROUND((COALESCE(lr.loading_volume, 0) * pp.rate_per_cubic), 2)
        ELSE 0
      END as payable_amount
    FROM logistics_data ld
    JOIN logistics_records lr ON ld.id = lr.id
    JOIN project_partners pp ON lr.project_id = pp.project_id
    JOIN partners pt ON pp.partner_id = pt.id
  ),
  records_with_costs AS (
    SELECT 
      ld.*,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'partner_id', pc.partner_id,
            'partner_name', pc.partner_name,
            'level', pc.level,
            'payable_amount', pc.payable_amount,
            'full_name', pc.full_name,
            'bank_account', pc.bank_account,
            'bank_name', pc.bank_name,
            'branch_name', pc.branch_name
          )
        ) FILTER (WHERE pc.partner_id IS NOT NULL),
        '[]'::json
      ) as partner_costs
    FROM logistics_data ld
    LEFT JOIN partner_costs pc ON ld.id = pc.record_id
    GROUP BY ld.id, ld.auto_number, ld.project_id, ld.project_name, ld.driver_id, 
             ld.driver_name, ld.loading_location, ld.unloading_location, ld.loading_date,
             ld.unloading_date, ld.license_plate, ld.driver_phone, ld.payable_cost,
             ld.invoice_status, ld.cargo_type, ld.loading_weight, ld.unloading_weight,
             ld.remarks, ld.billing_type_id
    ORDER BY ld.loading_date DESC, ld.auto_number DESC
  )
  
  SELECT JSON_BUILD_OBJECT(
    'records', COALESCE(JSON_AGG(rwc.*), '[]'::json)
  ) INTO result
  FROM records_with_costs rwc;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 8. 重新创建保存开票申请的函数
CREATE OR REPLACE FUNCTION save_invoice_request(
  p_invoice_data JSON
) RETURNS JSON AS $$
DECLARE
  result JSON;
  record_ids TEXT[];
  updated_count INTEGER;
BEGIN
  -- 从传入的数据中提取记录ID
  SELECT ARRAY_AGG(id::TEXT) INTO record_ids
  FROM JSON_ARRAY_ELEMENTS_TEXT(p_invoice_data->'all_record_ids') AS id;
  
  -- 更新运单的开票状态为"已申请开票"
  UPDATE logistics_records 
  SET 
    invoice_status = 'Processing',
    updated_at = NOW()
  WHERE id::TEXT = ANY(record_ids);
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- 返回成功结果
  SELECT JSON_BUILD_OBJECT(
    'success', true,
    'updated_records', updated_count,
    'message', '开票申请已成功创建'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 9. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_logistics_records_invoice_status ON logistics_records(invoice_status);
CREATE INDEX IF NOT EXISTS idx_logistics_records_loading_date ON logistics_records(loading_date);
CREATE INDEX IF NOT EXISTS idx_logistics_records_project_invoice ON logistics_records(project_id, invoice_status);

-- 执行完成后，请刷新开票申请页面测试功能
