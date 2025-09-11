-- 重命名有效数量类型字段为更直观的名称
-- 如果您希望字段名更明确地表示"装货数量的计算方式"

-- 方案1：重命名为 quantity_calculation_method
-- ALTER TABLE public.projects 
-- RENAME COLUMN effective_quantity_type TO quantity_calculation_method;

-- 方案2：重命名为 loading_quantity_calculation_type  
-- ALTER TABLE public.projects 
-- RENAME COLUMN effective_quantity_type TO loading_quantity_calculation_type;

-- 方案3：重命名为 quantity_calculation_type
-- ALTER TABLE public.projects 
-- RENAME COLUMN effective_quantity_type TO quantity_calculation_type;

-- 注意：执行重命名后，需要同时更新：
-- 1. 相关的数据库函数
-- 2. TypeScript 类型定义
-- 3. 前端表单字段名

-- 如果您希望使用不同的字段名，请取消注释相应的方案
