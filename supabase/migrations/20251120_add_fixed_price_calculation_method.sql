-- ============================================================================
-- 添加定价法（fixed_price）计算方法支持
-- 创建日期：2025-11-20
-- 功能：为 project_partners 表添加 unit_price 字段，并更新约束支持 fixed_price 方法
-- ============================================================================

-- 1. 添加单价字段
ALTER TABLE public.project_partners
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

COMMENT ON COLUMN public.project_partners.unit_price IS '单价（元/单位），用于直接定价法（fixed_price）计算。根据计费类型不同，单位可能是：吨、车、方、件';

-- 2. 更新计算方法约束，增加 'fixed_price' 选项
-- 删除所有可能存在的约束（包括自动生成的约束名称）
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- 查找所有与 calculation_method 相关的 CHECK 约束
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.project_partners'::regclass
        AND contype = 'c'
        AND conname LIKE '%calculation_method%'
    LOOP
        EXECUTE format('ALTER TABLE public.project_partners DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE '已删除约束: %', constraint_name;
    END LOOP;
END $$;

-- 重新创建约束，包含 fixed_price 选项
ALTER TABLE public.project_partners
ADD CONSTRAINT check_calculation_method 
CHECK (calculation_method IN ('tax', 'profit', 'fixed_price'));

COMMENT ON CONSTRAINT check_calculation_method ON public.project_partners IS '计算方法约束：tax-税点法, profit-利润法, fixed_price-定价法';

-- 3. 验证
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ 定价法（fixed_price）功能已添加';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '新增字段：';
    RAISE NOTICE '  • unit_price: 单价（元/单位）';
    RAISE NOTICE '';
    RAISE NOTICE '计算方法：';
    RAISE NOTICE '  • tax: 税点法';
    RAISE NOTICE '  • profit: 利润法';
    RAISE NOTICE '  • fixed_price: 定价法（新增）';
    RAISE NOTICE '';
    RAISE NOTICE '计算公式：';
    RAISE NOTICE '  • 税点法：应付金额 = 基础运价 / (1 - 税点)';
    RAISE NOTICE '  • 利润法：应付金额 = 基础运价 + (利润 × 装货重量)';
    RAISE NOTICE '  • 定价法：应付金额 = 有效数量 × 单价';
    RAISE NOTICE '';
    RAISE NOTICE '单位说明：';
    RAISE NOTICE '  • billing_type_id=1: 元/吨';
    RAISE NOTICE '  • billing_type_id=2: 元/车';
    RAISE NOTICE '  • billing_type_id=3: 元/方';
    RAISE NOTICE '  • billing_type_id=4: 元/件';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

