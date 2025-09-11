-- 验证有效数量类型字段是否正确添加
-- 在 Supabase SQL Editor 中执行此脚本来检查

-- 1. 检查 projects 表结构
SELECT 
    'projects 表结构检查' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND table_schema = 'public'
  AND column_name IN ('effective_quantity_type', 'quantity_calculation_method', 'loading_quantity_calculation_type')
ORDER BY column_name;

-- 2. 检查枚举类型
SELECT 
    '枚举类型检查' as check_type,
    typname as enum_name,
    enumlabel as enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'effective_quantity_type'
ORDER BY e.enumsortorder;

-- 3. 检查现有项目数据
SELECT 
    '现有项目数据检查' as check_type,
    id,
    name,
    effective_quantity_type
FROM public.projects 
LIMIT 10;

-- 4. 测试计算函数是否存在
SELECT 
    '函数检查' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'calculate_effective_quantity',
    'calculate_partner_costs_v3',
    'bulk_calculate_partner_costs'
)
AND routine_schema = 'public';
