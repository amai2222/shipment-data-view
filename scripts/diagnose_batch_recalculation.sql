-- 诊断批量重算失败的问题
-- 检查所有相关函数和表是否存在

-- 1. 检查 effective_quantity_type 枚举是否存在
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'effective_quantity_type') 
        THEN '✅ effective_quantity_type 枚举存在'
        ELSE '❌ effective_quantity_type 枚举不存在'
    END as enum_check;

-- 2. 检查 projects 表是否有 effective_quantity_type 字段
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name = 'effective_quantity_type'
        ) 
        THEN '✅ projects 表有 effective_quantity_type 字段'
        ELSE '❌ projects 表缺少 effective_quantity_type 字段'
    END as column_check;

-- 3. 检查关键函数是否存在
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_effective_quantity') 
        THEN '✅ calculate_effective_quantity 函数存在'
        ELSE '❌ calculate_effective_quantity 函数不存在'
    END as func1_check;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'batch_recalculate_partner_costs') 
        THEN '✅ batch_recalculate_partner_costs 函数存在'
        ELSE '❌ batch_recalculate_partner_costs 函数不存在'
    END as func2_check;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'batch_recalculate_by_filter') 
        THEN '✅ batch_recalculate_by_filter 函数存在'
        ELSE '❌ batch_recalculate_by_filter 函数不存在'
    END as func3_check;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'bulk_calculate_partner_costs') 
        THEN '✅ bulk_calculate_partner_costs 函数存在'
        ELSE '❌ bulk_calculate_partner_costs 函数不存在'
    END as func4_check;

-- 4. 检查 projects 表中的数据
SELECT 
    id, 
    name, 
    effective_quantity_type,
    CASE 
        WHEN effective_quantity_type IS NULL THEN '❌ 有效数量类型为空'
        ELSE '✅ 有效数量类型: ' || effective_quantity_type::text
    END as status
FROM public.projects 
LIMIT 5;

-- 5. 测试 calculate_effective_quantity 函数
SELECT 
    '测试 calculate_effective_quantity 函数' as test_name,
    public.calculate_effective_quantity(10, 8, 'min_value') as min_value_result,
    public.calculate_effective_quantity(10, 8, 'loading') as loading_result,
    public.calculate_effective_quantity(10, 8, 'unloading') as unloading_result;
