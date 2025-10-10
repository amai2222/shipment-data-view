-- 修复自增逻辑，正确提取运单编号中的序号

-- =====================================================
-- 修复 generate_auto_number 函数的自增逻辑
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_auto_number(loading_date_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    date_part TEXT;
    next_number INTEGER;
    padded_number TEXT;
    final_number TEXT;
    max_attempts INTEGER := 1000;
    attempt_count INTEGER := 0;
    existing_count INTEGER;
BEGIN
    -- 验证输入日期格式
    IF loading_date_input IS NULL OR loading_date_input = '' THEN
        RAISE EXCEPTION '装货日期不能为空';
    END IF;
    
    -- 提取日期部分 (YYYYMMDD格式)
    BEGIN
        date_part := to_char(to_date(loading_date_input, 'YYYY-MM-DD'), 'YYYYMMDD');
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '日期格式错误: %', loading_date_input;
    END;
    
    LOOP
        attempt_count := attempt_count + 1;
        
        -- 获取当天的下一个序号（修复：正确提取序号）
        -- YDN20250818-001 格式：从第13位开始提取3位数字
        SELECT COALESCE(MAX(CAST(substring(auto_number from 13 for 3) AS INTEGER)), 0) + 1
        INTO next_number
        FROM public.logistics_records
        WHERE auto_number LIKE 'YDN' || date_part || '-%'
        AND auto_number ~ '^YDN[0-9]{8}-[0-9]{3}$'  -- 严格匹配标准格式
        AND loading_date::date = loading_date_input::date;
        
        -- 补零到3位数（确保从001开始）
        padded_number := LPAD(next_number::TEXT, 3, '0');
        
        -- 生成完整编号：YDN + 日期 + - + 3位序号
        final_number := 'YDN' || date_part || '-' || padded_number;
        
        -- 检查编号是否已存在
        SELECT COUNT(*) INTO existing_count
        FROM public.logistics_records 
        WHERE auto_number = final_number;
        
        IF existing_count = 0 THEN
            RETURN final_number;
        END IF;
        
        -- 如果编号已存在，增加序号重试
        next_number := next_number + 1;
        
        -- 防止无限循环
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION '无法在 % 天内找到可用的运单编号，已尝试 % 次', 
                date_part, max_attempts;
        END IF;
    END LOOP;
END;
$function$;

-- =====================================================
-- 测试自增逻辑
-- =====================================================

-- 测试生成运单编号
SELECT public.generate_auto_number('2025-08-18') as test_waybill_number;

-- 检查现有运单编号的序号提取
SELECT 
    auto_number,
    substring(auto_number from 13 for 3) as extracted_sequence,
    CAST(substring(auto_number from 13 for 3) AS INTEGER) as sequence_number
FROM public.logistics_records 
WHERE auto_number LIKE 'YDN20250818-%'
AND auto_number ~ '^YDN[0-9]{8}-[0-9]{3}$'
ORDER BY auto_number;

-- 验证修复完成
SELECT '自增逻辑已修复！' as status;
