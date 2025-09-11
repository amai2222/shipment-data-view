-- 测试批量重算功能
-- 在 Supabase SQL Editor 中执行此脚本来测试修复

-- 1. 检查函数是否存在
SELECT 
    '函数检查' as test_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'calculate_effective_quantity',
    'bulk_calculate_partner_costs',
    'batch_recalculate_partner_costs',
    'recalculate_and_update_costs_for_record'
)
AND routine_schema = 'public'
ORDER BY routine_name;

-- 2. 测试有效数量计算函数
SELECT 
    '有效数量计算测试' as test_type,
    public.calculate_effective_quantity(10, 8, 'min_value') as min_value_result,
    public.calculate_effective_quantity(10, 8, 'loading') as loading_result,
    public.calculate_effective_quantity(10, 8, 'unloading') as unloading_result;

-- 3. 获取一些测试用的运单ID
SELECT 
    '测试运单ID' as test_type,
    id,
    auto_number,
    project_id,
    loading_weight,
    unloading_weight
FROM public.logistics_records 
LIMIT 3;

-- 4. 测试单个记录重算（使用第一个运单ID）
-- 注意：请将 'your-record-id-here' 替换为上面查询结果中的实际ID
-- SELECT 
--     '单个重算测试' as test_type,
--     public.recalculate_and_update_costs_for_record('your-record-id-here'::uuid);

-- 5. 检查合作方成本表
SELECT 
    '合作方成本检查' as test_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT logistics_record_id) as unique_records
FROM public.logistics_partner_costs;
