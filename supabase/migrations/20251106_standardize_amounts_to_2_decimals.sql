-- ============================================================================
-- 统一金额字段为2位小数（四舍五入）
-- 创建日期：2025-11-06
-- ============================================================================

-- ============================================================================
-- 第一步：删除所有依赖的视图和规则
-- ============================================================================

-- 删除所有视图（CASCADE会自动删除依赖的规则）
DROP VIEW IF EXISTS logistics_records_status_summary CASCADE;
DROP VIEW IF EXISTS logistics_records_view CASCADE;
DROP VIEW IF EXISTS logistics_partner_costs_view CASCADE;

-- 额外检查：删除可能存在的其他视图
DO $$
DECLARE
    v_view_name TEXT;
BEGIN
    -- 查找并删除所有引用logistics_records的视图
    FOR v_view_name IN
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
        AND (definition LIKE '%logistics_records%' OR definition LIKE '%logistics_partner_costs%')
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', v_view_name);
        RAISE NOTICE '已删除视图: %', v_view_name;
    END LOOP;
END $$;

-- ============================================================================
-- 第二步：修改表结构 - 将NUMERIC改为NUMERIC(10,2)
-- ============================================================================

-- 1. logistics_records表
ALTER TABLE logistics_records
    ALTER COLUMN loading_weight TYPE NUMERIC(10,2),
    ALTER COLUMN unloading_weight TYPE NUMERIC(10,2),
    ALTER COLUMN current_cost TYPE NUMERIC(10,2),
    ALTER COLUMN extra_cost TYPE NUMERIC(10,2),
    ALTER COLUMN payable_cost TYPE NUMERIC(10,2);

-- 2. logistics_partner_costs表
ALTER TABLE logistics_partner_costs
    ALTER COLUMN base_amount TYPE NUMERIC(10,2),
    ALTER COLUMN payable_amount TYPE NUMERIC(10,2),
    ALTER COLUMN tax_rate TYPE NUMERIC(6,4);  -- 税率保留4位小数（如0.0613）

-- 3. project_partners表（如果有金额字段）
ALTER TABLE project_partners
    ALTER COLUMN profit_rate TYPE NUMERIC(10,2),
    ALTER COLUMN tax_rate TYPE NUMERIC(6,4);

-- 4. payment_requests表（如果表和列都存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_requests' 
        AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE payment_requests
            ALTER COLUMN total_amount TYPE NUMERIC(10,2);
        RAISE NOTICE '✓ payment_requests.total_amount 已修改为NUMERIC(10,2)';
    ELSE
        RAISE NOTICE '⚠ payment_requests表或total_amount列不存在，跳过';
    END IF;
END $$;

-- 5. invoice_requests表（如果表和列都存在）
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'invoice_requests' 
        AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE invoice_requests
            ALTER COLUMN total_amount TYPE NUMERIC(10,2);
        RAISE NOTICE '✓ invoice_requests.total_amount 已修改为NUMERIC(10,2)';
    ELSE
        RAISE NOTICE '⚠ invoice_requests表或total_amount列不存在，跳过';
    END IF;
END $$;

-- ============================================================================
-- 第三步：修改计算函数 - 添加ROUND(value, 2)
-- ============================================================================

-- 先删除旧函数（可能有多个重载版本）
DROP FUNCTION IF EXISTS calculate_partner_costs_for_project_v2(numeric, text, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS calculate_partner_costs_for_project_v2(numeric, text) CASCADE;
DROP FUNCTION IF EXISTS calculate_partner_costs_for_project_v2 CASCADE;

-- 修改 calculate_partner_costs_for_project_v2 函数（基于您提供的原函数，只添加ROUND）
CREATE OR REPLACE FUNCTION calculate_partner_costs_for_project_v2(
  p_base_amount numeric,
  p_project_id text,
  p_loading_weight numeric DEFAULT NULL,
  p_unloading_weight numeric DEFAULT NULL
)
RETURNS TABLE (
  partner_id uuid,
  partner_name text,
  level integer,
  base_amount numeric,
  payable_amount numeric,
  tax_rate numeric,
  calculation_method text,
  profit_rate numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  partner_record RECORD;
  effective_weight numeric;
BEGIN
  -- 计算有效重量：取不为空且不为0的最小值
  effective_weight := COALESCE(
    NULLIF(LEAST(
      COALESCE(p_loading_weight, 999999), 
      COALESCE(p_unloading_weight, 999999)
    ), 999999),
    COALESCE(p_loading_weight, p_unloading_weight, 0)
  );

  -- 按级别顺序获取项目的合作方，包含计算方法信息
  FOR partner_record IN 
    SELECT 
      pp.partner_id,
      p.name as partner_name,
      pp.level,
      pp.tax_rate,
      pp.calculation_method,
      COALESCE(pp.profit_rate, 0) as profit_rate
    FROM public.project_partners pp
    JOIN public.partners p ON pp.partner_id = p.id
    WHERE pp.project_id = p_project_id
    ORDER BY pp.level ASC
  LOOP
    partner_id := partner_record.partner_id;
    partner_name := partner_record.partner_name;
    level := partner_record.level;
    base_amount := p_base_amount;
    tax_rate := partner_record.tax_rate;
    calculation_method := partner_record.calculation_method;
    profit_rate := partner_record.profit_rate;
    
    -- 根据计算方法计算应付金额
    IF partner_record.calculation_method = 'profit' THEN
      -- 利润计算方法：重量 * (司机运费/重量 + 设置的利润)
      IF effective_weight > 0 THEN
        payable_amount := effective_weight * ((p_base_amount / effective_weight) + partner_record.profit_rate);
      ELSE
        payable_amount := p_base_amount + partner_record.profit_rate;
      END IF;
    ELSE
      -- 税点计算方法：运费金额 / (1 - 税点)
      payable_amount := p_base_amount / (1 - partner_record.tax_rate);
    END IF;
    
    -- ✅ 唯一修改：四舍五入到2位小数
    payable_amount := ROUND(payable_amount, 2);
    
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION calculate_partner_costs_for_project_v2 IS '计算项目合作方成本V2（金额保留2位小数）';

-- ============================================================================
-- 第四步：更新现有数据 - 四舍五入到2位小数
-- ============================================================================

DO $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 开始更新现有数据为2位小数';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- 更新 logistics_records 表
    UPDATE logistics_records
    SET 
        loading_weight = ROUND(loading_weight, 2),
        unloading_weight = ROUND(unloading_weight, 2),
        current_cost = ROUND(current_cost, 2),
        extra_cost = ROUND(extra_cost, 2),
        payable_cost = ROUND(payable_cost, 2)
    WHERE 
        loading_weight IS NOT NULL
        OR unloading_weight IS NOT NULL
        OR current_cost IS NOT NULL
        OR extra_cost IS NOT NULL
        OR payable_cost IS NOT NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '✅ logistics_records: 已更新 % 条记录', v_updated_count;
    
    -- 更新 logistics_partner_costs 表
    UPDATE logistics_partner_costs
    SET 
        base_amount = ROUND(base_amount, 2),
        payable_amount = ROUND(payable_amount, 2),
        tax_rate = ROUND(tax_rate, 4)  -- 税率保留4位
    WHERE 
        base_amount IS NOT NULL
        OR payable_amount IS NOT NULL;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '✅ logistics_partner_costs: 已更新 % 条记录', v_updated_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 所有数据已统一为2位小数';
    RAISE NOTICE '========================================';
    
END $$;

-- ============================================================================
-- 第五步：添加触发器 - 自动四舍五入新插入的数据
-- ============================================================================

-- 创建触发器函数：自动四舍五入金额
CREATE OR REPLACE FUNCTION round_amounts_to_2_decimals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 四舍五入所有金额字段到2位小数
    NEW.loading_weight := ROUND(NEW.loading_weight, 2);
    NEW.unloading_weight := ROUND(NEW.unloading_weight, 2);
    NEW.current_cost := ROUND(NEW.current_cost, 2);
    NEW.extra_cost := ROUND(NEW.extra_cost, 2);
    NEW.payable_cost := ROUND(NEW.payable_cost, 2);
    
    RETURN NEW;
END;
$$;

-- 在 logistics_records 表上创建触发器
DROP TRIGGER IF EXISTS trigger_round_amounts ON logistics_records;
CREATE TRIGGER trigger_round_amounts
    BEFORE INSERT OR UPDATE ON logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION round_amounts_to_2_decimals();

-- 创建触发器函数：自动四舍五入合作方成本
CREATE OR REPLACE FUNCTION round_partner_costs_to_2_decimals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.base_amount := ROUND(NEW.base_amount, 2);
    NEW.payable_amount := ROUND(NEW.payable_amount, 2);
    NEW.tax_rate := ROUND(NEW.tax_rate, 4);  -- 税率保留4位
    
    RETURN NEW;
END;
$$;

-- 在 logistics_partner_costs 表上创建触发器
DROP TRIGGER IF EXISTS trigger_round_partner_costs ON logistics_partner_costs;
CREATE TRIGGER trigger_round_partner_costs
    BEFORE INSERT OR UPDATE ON logistics_partner_costs
    FOR EACH ROW
    EXECUTE FUNCTION round_partner_costs_to_2_decimals();

-- ============================================================================
-- 验证结果
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 迁移完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '已完成：';
    RAISE NOTICE '  ✓ 修改表字段为NUMERIC(10,2)';
    RAISE NOTICE '  ✓ 更新现有数据为2位小数';
    RAISE NOTICE '  ✓ 添加自动四舍五入触发器';
    RAISE NOTICE '  ✓ 修改计算函数使用ROUND(value, 2)';
    RAISE NOTICE '';
    RAISE NOTICE '从现在开始：';
    RAISE NOTICE '  • 所有金额自动保留2位小数';
    RAISE NOTICE '  • 第三位及之后四舍五入';
    RAISE NOTICE '  • 数据库和前端显示一致';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

