-- ============================================================================
-- 增强付款申请筛选器 - 后端函数升级
-- ============================================================================
-- 功能：为 get_payment_request_data 函数添加高级筛选参数
-- 参考：运单管理的 get_logistics_summary_and_records_enhanced 函数
-- 新增参数：司机、车牌号、电话、运单编号、其他平台名称
-- ============================================================================
-- 执行日期: 2025-10-26
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. 删除旧版本函数（避免冲突）
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_payment_request_data(uuid, date, date, uuid, text[], integer, integer);
DROP FUNCTION IF EXISTS public.get_payment_request_data(text, text, text, text, text[], integer, integer, text, text, text, text, text);

-- ============================================================================
-- 2. 创建增强版 get_payment_request_data 函数
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_payment_request_data(
    -- 常规筛选参数
    p_project_id uuid DEFAULT NULL::uuid, 
    p_start_date date DEFAULT NULL::date, 
    p_end_date date DEFAULT NULL::date, 
    p_payment_status_array text[] DEFAULT NULL::text[],
    
    -- 高级筛选参数（新增）
    p_partner_id uuid DEFAULT NULL::uuid,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL,
    
    -- 分页参数
    p_page_size integer DEFAULT 50, 
    p_page_number integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    result_json jsonb;
    v_offset integer;
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 解析运单编号字符串为数组（支持批量搜索）
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;
    
    -- 解析司机名称字符串为数组（支持批量搜索）
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := string_to_array(p_driver_name, ',');
        v_driver_array := array(SELECT trim(unnest(v_driver_array)));
    END IF;
    
    -- 解析车牌号字符串为数组（支持批量搜索）
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := string_to_array(p_license_plate, ',');
        v_license_array := array(SELECT trim(unnest(v_license_array)));
    END IF;
    
    -- 解析电话字符串为数组（支持批量搜索）
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := string_to_array(p_driver_phone, ',');
        v_phone_array := array(SELECT trim(unnest(v_phone_array)));
    END IF;

    WITH filtered_records AS (
        SELECT 
            v.id, v.auto_number, v.project_name, v.project_id, v.driver_name,
            v.loading_location, v.unloading_location, v.loading_date, v.unloading_date,
            v.loading_weight, v.unloading_weight, v.current_cost, v.payable_cost, v.extra_cost,
            v.license_plate, v.driver_phone, v.transport_type, v.remarks, v.chain_name,
            v.billing_type_id, v.invoice_status,
            lr.payment_status  -- 明确指定从 lr 表获取
        FROM public.logistics_records_view AS v
        JOIN public.logistics_records lr ON v.id = lr.id
        WHERE
            -- ========== 常规筛选 ==========
            -- 项目筛选
            (p_project_id IS NULL OR v.project_id = p_project_id) AND
            
            -- 日期范围筛选
            (p_start_date IS NULL OR v.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR v.loading_date::date <= p_end_date) AND
            
            -- 支付状态筛选
            (
                p_payment_status_array IS NULL OR
                array_length(p_payment_status_array, 1) IS NULL OR
                LOWER(lr.payment_status) = ANY(ARRAY(SELECT lower(unnest) FROM unnest(p_payment_status_array)))
            ) AND
            
            -- ========== 高级筛选（新增） ==========
            -- 合作方筛选
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = v.id AND lpc.partner_id = p_partner_id
            )) AND
            
            -- 司机筛选（支持批量，OR逻辑）
            (p_driver_name IS NULL OR p_driver_name = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE v.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            
            -- 车牌号筛选（支持批量，OR逻辑）
            (p_license_plate IS NULL OR p_license_plate = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            
            -- 电话筛选（支持批量，OR逻辑）
            (p_driver_phone IS NULL OR p_driver_phone = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            
            -- 运单编号筛选（支持批量 + 搜索其他平台运单号）
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array) OR
             (lr.external_tracking_numbers IS NOT NULL AND 
              lr.external_tracking_numbers && v_waybill_array)) AND
            
            -- 其他平台名称筛选
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END)
    ),
    paginated_records AS (
        SELECT id
        FROM filtered_records
        ORDER BY loading_date DESC
        LIMIT p_page_size
        OFFSET v_offset
    )
    SELECT jsonb_build_object(
        'count', (SELECT COUNT(*) FROM filtered_records),
        'overview', (
            SELECT jsonb_build_object(
                'total_records', COALESCE(COUNT(*), 0),
                'total_current_cost', COALESCE(SUM(current_cost), 0),
                'total_extra_cost', COALESCE(SUM(extra_cost), 0),
                'total_payable_cost', COALESCE(SUM(payable_cost), 0)
            )
            FROM filtered_records
        ),
        'partner_payables', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.partner_name), '[]'::jsonb) FROM (
                SELECT
                    lpc.partner_id, p.name AS partner_name,
                    COUNT(DISTINCT lpc.logistics_record_id) AS records_count,
                    SUM(lpc.payable_amount) AS total_payable
                FROM public.logistics_partner_costs lpc
                JOIN public.partners p ON lpc.partner_id = p.id
                WHERE lpc.logistics_record_id IN (SELECT id FROM filtered_records)
                GROUP BY lpc.partner_id, p.name
            ) t
        ),
        'records', (
            SELECT COALESCE(jsonb_agg(t ORDER BY t.loading_date DESC), '[]'::jsonb) FROM (
                SELECT
                    fr.id, fr.auto_number, fr.project_name, fr.project_id, fr.driver_name, 
                    fr.loading_location, fr.unloading_location,
                    to_char(fr.loading_date, 'YYYY-MM-DD') AS loading_date,
                    to_char(fr.unloading_date, 'YYYY-MM-DD') AS unloading_date,
                    fr.loading_weight, fr.unloading_weight, fr.current_cost, fr.payable_cost, fr.extra_cost,
                    fr.license_plate, fr.driver_phone, fr.transport_type, fr.remarks, fr.chain_name,
                    fr.payment_status, fr.invoice_status,
                    fr.billing_type_id,
                    (SELECT COALESCE(jsonb_agg(sub ORDER BY sub.level), '[]'::jsonb) FROM (
                        SELECT 
                            lpc.partner_id, 
                            par.name AS partner_name, 
                            par.full_name,
                            pbd.bank_account,
                            pbd.bank_name,
                            pbd.branch_name,
                            lpc.level, 
                            lpc.payable_amount
                        FROM public.logistics_partner_costs lpc
                        JOIN public.partners par ON lpc.partner_id = par.id
                        LEFT JOIN public.partner_bank_details pbd ON par.id = pbd.partner_id
                        WHERE lpc.logistics_record_id = fr.id
                     ) sub
                    ) AS partner_costs
                FROM filtered_records fr
                WHERE fr.id IN (SELECT id FROM paginated_records)
            ) t
        )
    )
    INTO result_json;

    RETURN result_json;
END;
$function$;

-- ============================================================================
-- 3. 同步修改跨页全选函数 get_filtered_unpaid_ids
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_filtered_unpaid_ids(uuid, date, date, uuid);
DROP FUNCTION IF EXISTS public.get_filtered_unpaid_ids(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_filtered_unpaid_ids(
    -- 常规筛选参数
    p_project_id uuid DEFAULT NULL::uuid,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    
    -- 高级筛选参数（新增）
    p_partner_id uuid DEFAULT NULL::uuid,
    p_driver_name text DEFAULT NULL,
    p_license_plate text DEFAULT NULL,
    p_driver_phone text DEFAULT NULL,
    p_waybill_numbers text DEFAULT NULL,
    p_other_platform_name text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_waybill_array text[];
    v_driver_array text[];
    v_license_array text[];
    v_phone_array text[];
BEGIN
    -- 解析运单编号字符串为数组
    IF p_waybill_numbers IS NOT NULL AND p_waybill_numbers != '' THEN
        v_waybill_array := string_to_array(p_waybill_numbers, ',');
        v_waybill_array := array(SELECT trim(unnest(v_waybill_array)));
    END IF;
    
    -- 解析司机名称字符串为数组
    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_driver_array := string_to_array(p_driver_name, ',');
        v_driver_array := array(SELECT trim(unnest(v_driver_array)));
    END IF;
    
    -- 解析车牌号字符串为数组
    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_license_array := string_to_array(p_license_plate, ',');
        v_license_array := array(SELECT trim(unnest(v_license_array)));
    END IF;
    
    -- 解析电话字符串为数组
    IF p_driver_phone IS NOT NULL AND p_driver_phone != '' THEN
        v_phone_array := string_to_array(p_driver_phone, ',');
        v_phone_array := array(SELECT trim(unnest(v_phone_array)));
    END IF;

    RETURN ARRAY(
        SELECT lr.id::text
        FROM public.logistics_records lr
        WHERE
            -- 只返回未支付的运单
            lr.payment_status = 'Unpaid' AND
            
            -- 常规筛选
            (p_project_id IS NULL OR lr.project_id = p_project_id) AND
            (p_start_date IS NULL OR lr.loading_date::date >= p_start_date) AND
            (p_end_date IS NULL OR lr.loading_date::date <= p_end_date) AND
            
            -- 高级筛选
            (p_partner_id IS NULL OR EXISTS (
                SELECT 1 FROM public.logistics_partner_costs lpc
                WHERE lpc.logistics_record_id = lr.id AND lpc.partner_id = p_partner_id
            )) AND
            -- 司机筛选（支持批量，OR逻辑）
            (p_driver_name IS NULL OR p_driver_name = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_driver_array) AS driver_name
                 WHERE lr.driver_name ILIKE '%' || driver_name || '%'
             )) AND
            -- 车牌号筛选（支持批量，OR逻辑）
            (p_license_plate IS NULL OR p_license_plate = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_license_array) AS plate
                 WHERE lr.license_plate ILIKE '%' || plate || '%'
             )) AND
            -- 电话筛选（支持批量，OR逻辑）
            (p_driver_phone IS NULL OR p_driver_phone = '' OR 
             EXISTS (
                 SELECT 1 FROM unnest(v_phone_array) AS phone
                 WHERE lr.driver_phone ILIKE '%' || phone || '%'
             )) AND
            (p_waybill_numbers IS NULL OR p_waybill_numbers = '' OR 
             lr.auto_number = ANY(v_waybill_array) OR
             (lr.external_tracking_numbers IS NOT NULL AND 
              lr.external_tracking_numbers && v_waybill_array)) AND
            (p_other_platform_name IS NULL OR p_other_platform_name = '' OR 
             CASE 
                 WHEN p_other_platform_name = '本平台' THEN 
                     (lr.other_platform_names IS NULL OR array_length(lr.other_platform_names, 1) IS NULL)
                 ELSE 
                     EXISTS (SELECT 1 FROM unnest(lr.other_platform_names) AS platform_name 
                            WHERE platform_name ILIKE '%' || p_other_platform_name || '%')
             END)
        ORDER BY lr.loading_date DESC
    );
END;
$function$;

-- ============================================================================
-- 4. 验证函数创建成功
-- ============================================================================
SELECT 'Enhanced payment request filter functions created successfully' as status;

-- ============================================================================
-- 5. 测试函数
-- ============================================================================

-- 测试基础查询
SELECT public.get_payment_request_data(
    p_page_size := 5,
    p_page_number := 1
) as test_basic;

-- 测试运单号筛选（包括其他平台运单号）
SELECT public.get_payment_request_data(
    p_waybill_numbers := '2021991438,HDA0648',
    p_page_size := 10,
    p_page_number := 1
) as test_waybill;

-- 测试平台名称筛选
SELECT public.get_payment_request_data(
    p_other_platform_name := '可乐公司',
    p_page_size := 10,
    p_page_number := 1
) as test_platform;

-- 测试司机筛选
SELECT public.get_payment_request_data(
    p_driver_name := '张三',
    p_page_size := 10,
    p_page_number := 1
) as test_driver;

-- 测试批量司机搜索
SELECT public.get_payment_request_data(
    p_driver_name := '张三,李四,王五',
    p_page_size := 10,
    p_page_number := 1
) as test_batch_drivers;

-- 测试批量车牌搜索
SELECT public.get_payment_request_data(
    p_license_plate := '京A,京B,沪C',
    p_page_size := 10,
    p_page_number := 1
) as test_batch_plates;

-- 测试批量电话搜索
SELECT public.get_payment_request_data(
    p_driver_phone := '138,139,186',
    p_page_size := 10,
    p_page_number := 1
) as test_batch_phones;

-- 测试综合批量筛选
SELECT public.get_payment_request_data(
    p_project_id := NULL,
    p_start_date := '2025-01-01',
    p_end_date := '2025-12-31',
    p_payment_status_array := ARRAY['Unpaid'],
    p_driver_name := '张三,李四',
    p_license_plate := '京A,京B',
    p_waybill_numbers := 'HDA0648,2021991438',
    p_other_platform_name := '可乐公司',
    p_page_size := 10,
    p_page_number := 1
) as test_combined;

COMMIT;

-- ============================================================================
-- 修改说明
-- ============================================================================
-- 
-- 🎯 新增参数：
-- 1. p_driver_name        - 司机名称（✅ 支持批量，OR逻辑）
-- 2. p_license_plate      - 车牌号（✅ 支持批量，OR逻辑）
-- 3. p_driver_phone       - 电话（✅ 支持批量，OR逻辑）
-- 4. p_waybill_numbers    - 运单编号（✅ 支持批量，同时搜索本平台和其他平台）
-- 5. p_other_platform_name - 其他平台名称（支持"本平台"特殊值）
--
-- 🔍 批量搜索逻辑：
-- - 所有批量字段支持逗号分隔多个值（如：张三,李四,王五）
-- - 使用 OR 逻辑：只要匹配任意一个值就返回
-- - 所有文本搜索使用 ILIKE 实现模糊匹配（不区分大小写）
--
-- 📝 搜索示例：
-- - 司机: "张三,李四" → 搜索 张三 OR 李四
-- - 车牌: "京A,京B" → 搜索包含京A OR 京B的车牌
-- - 电话: "138,139" → 搜索包含138 OR 139的电话
-- - 运单号: "HDA0648,2021991438" → 搜索本平台运单号 OR 其他平台运单号
--
-- ✅ 兼容性：
-- - 所有新增参数都有默认值 NULL
-- - 不影响现有调用
-- - 向后兼容
--
-- 🔧 数据表关联：
-- - logistics_records_view (v) - 运单视图
-- - logistics_records (lr) - 运单表（payment_status, license_plate等）
-- - logistics_partner_costs (lpc) - 合作方成本
-- - partners (par) - 合作方基本信息
-- - partner_bank_details (pbd) - 银行账户信息
--
-- ============================================================================

