-- ============================================================================
-- 创建自动计算 payable_cost 的触发器
-- ============================================================================
-- 问题：logistics_records 表缺少自动计算 payable_cost 的触发器
-- 导致：Excel 导入时 payable_cost = 0
-- 解决：在 INSERT 或 UPDATE 时自动计算 payable_cost = current_cost + extra_cost
-- ============================================================================

-- 第一步：创建触发器函数
CREATE OR REPLACE FUNCTION public.auto_calculate_payable_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 自动计算 payable_cost = current_cost + extra_cost
    NEW.payable_cost := COALESCE(NEW.current_cost, 0) + COALESCE(NEW.extra_cost, 0);
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_calculate_payable_cost IS '
自动计算运单的 payable_cost（司机应收合计）
- 触发时机：BEFORE INSERT OR UPDATE
- 计算公式：payable_cost = current_cost + extra_cost
- 说明：确保 payable_cost 始终等于 current_cost + extra_cost
';

-- 第二步：创建触发器
DROP TRIGGER IF EXISTS trigger_auto_calculate_payable_cost ON public.logistics_records;

CREATE TRIGGER trigger_auto_calculate_payable_cost
    BEFORE INSERT OR UPDATE OF current_cost, extra_cost
    ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_calculate_payable_cost();

COMMENT ON TRIGGER trigger_auto_calculate_payable_cost ON public.logistics_records IS '
自动计算 payable_cost = current_cost + extra_cost
- 触发时机：在插入或更新 current_cost/extra_cost 之前
- 确保 payable_cost 始终保持同步
';

-- 验证
SELECT '✅ 触发器创建成功：trigger_auto_calculate_payable_cost' AS status;

-- 显示所有触发器
SELECT 
    t.tgname AS trigger_name,
    CASE t.tgtype & 2 
        WHEN 2 THEN 'BEFORE' 
        ELSE 'AFTER' 
    END AS timing,
    CASE t.tgtype & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 20 THEN 'INSERT, UPDATE'
        WHEN 28 THEN 'INSERT, UPDATE, DELETE'
    END AS event
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'logistics_records'
  AND t.tgname = 'trigger_auto_calculate_payable_cost';

