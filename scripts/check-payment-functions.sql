-- 检查付款相关函数的状态
-- 执行此脚本来诊断 get_payment_request_data 函数问题

-- 1. 检查所有付款相关的函数
SELECT 
    routine_name,
    routine_type,
    data_type as return_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%payment%'
ORDER BY routine_name;

-- 2. 检查 get_payment_request_data 函数的具体定义
SELECT 
    routine_name,
    parameter_name,
    parameter_mode,
    data_type,
    ordinal_position
FROM information_schema.parameters 
WHERE specific_schema = 'public' 
    AND routine_name = 'get_payment_request_data'
ORDER BY ordinal_position;

-- 3. 检查函数是否存在
SELECT 
    proname as function_name,
    proargnames as argument_names,
    proargtypes::regtype[] as argument_types,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname = 'get_payment_request_data';

-- 4. 检查所有相关的付款函数
SELECT 
    proname as function_name,
    proargnames as argument_names,
    proargtypes::regtype[] as argument_types,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname LIKE '%payment%'
ORDER BY proname;
