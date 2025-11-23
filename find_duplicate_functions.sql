-- ============================================================================
-- 查找既有原函数又有 _11xx 或 _10xx 后缀的函数
-- ============================================================================
-- 功能：找出数据库中同时存在原函数名和带版本后缀的函数
-- ============================================================================

WITH all_functions AS (
  SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
),
functions_with_suffix AS (
  SELECT 
    schema_name,
    function_name,
    -- 提取基础函数名（去掉 _11xx 或 _10xx 后缀）
    regexp_replace(function_name, '_1[01]\d{2}$', '') AS base_name
  FROM all_functions
  WHERE function_name ~ '_1[01]\d{2}$'  -- 只查找带后缀的函数
),
duplicate_functions AS (
  SELECT 
    fws.base_name,
    fws.schema_name,
    -- 原函数（没有后缀）
    af_original.function_name AS original_function,
    -- 所有带后缀的版本
    array_agg(DISTINCT fws.function_name ORDER BY fws.function_name) AS suffixed_versions
  FROM functions_with_suffix fws
  -- 检查是否存在原函数（没有后缀的版本）
  INNER JOIN all_functions af_original 
    ON af_original.schema_name = fws.schema_name 
    AND af_original.function_name = fws.base_name
  GROUP BY fws.base_name, fws.schema_name, af_original.function_name
)
SELECT 
  base_name AS "基础函数名",
  schema_name AS "Schema",
  original_function AS "原函数名",
  suffixed_versions AS "带后缀版本",
  array_length(suffixed_versions, 1) AS "后缀版本数量"
FROM duplicate_functions
WHERE array_length(suffixed_versions, 1) > 1  -- 只显示后缀版本数量大于1的
ORDER BY base_name;

