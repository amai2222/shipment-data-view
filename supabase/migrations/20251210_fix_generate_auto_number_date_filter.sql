-- ============================================================================
-- 修复 generate_auto_number 函数的日期过滤问题
-- ============================================================================
-- 问题：函数在查询最大序号时使用了 loading_date 字段过滤，但在检查编号是否存在时
--       只检查 auto_number，导致当存在脏数据（日期不匹配但编号匹配）时出现死循环
-- 解决：删除 MAX 查询中的日期条件，因为 auto_number 本身已包含日期信息
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_auto_number(loading_date_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    date_part TEXT;
    next_number INTEGER;
    padded_number TEXT;
    final_number TEXT;
    max_attempts INTEGER := 1000;
    attempt_count INTEGER := 0;
    existing_count INTEGER;
    lock_key BIGINT; -- 🔒 [1] 声明锁变量
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

    -- 🔒 [2] 获取事务级咨询锁（防止并发冲突）
    -- 将日期转为数字作为锁的 Key，确保同一天同一时刻只有一个事务在计算序号
    lock_key := date_part::bigint;
    PERFORM pg_advisory_xact_lock(lock_key);
    
    LOOP
        attempt_count := attempt_count + 1;
        
        -- 获取当天的下一个序号
        -- ✅ 修复保留：只根据 auto_number 字符串判断，不依赖 loading_date 字段
        SELECT COALESCE(MAX(CAST(substring(auto_number from 13 for 3) AS INTEGER)), 0) + 1
        INTO next_number
        FROM public.logistics_records
        WHERE auto_number LIKE 'YDN' || date_part || '-%'
        AND auto_number ~ '^YDN[0-9]{8}-[0-9]{3}$';
        
        -- 补零到3位数
        padded_number := LPAD(next_number::TEXT, 3, '0');
        
        -- 生成完整编号
        final_number := 'YDN' || date_part || '-' || padded_number;
        
        -- 检查编号是否已存在（双重保险，处理锁获取前的极小概率边界或手动插入的数据）
        SELECT COUNT(*) INTO existing_count
        FROM public.logistics_records 
        WHERE auto_number = final_number;
        
        IF existing_count = 0 THEN
            RETURN final_number;
        END IF;
        
        -- 如果编号已存在（可能是之前的脏数据占用了这个号），尝试下一个号
        next_number := next_number + 1;
        
        -- 防止无限循环
        IF attempt_count >= max_attempts THEN
            RAISE EXCEPTION '无法在 % 天内找到可用的运单编号，已尝试 % 次', 
                date_part, max_attempts;
        END IF;
    END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.generate_auto_number(text) IS 
'生成运单自动编号（格式：YDN + YYYYMMDD + - + 3位序号）
逻辑说明：
1. 使用 pg_advisory_xact_lock 确保并发安全
2. 仅通过 auto_number 字符串结构计算最大序号，忽略 loading_date 字段，防止因脏数据导致死循环';

-- 验证
SELECT '✅ 函数已修复：generate_auto_number，已删除日期过滤条件' AS status;
