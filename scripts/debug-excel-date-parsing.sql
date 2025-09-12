-- 调试Excel日期解析问题
-- 模拟Excel中的日期数据，检查解析逻辑

-- 测试不同的日期格式
SELECT 
  '2025/9/9' as original_date,
  '2025/9/9'::text as text_format,
  '2025/9/9'::date as date_format,
  ('2025/9/9' || ' 00:00:00+08:00')::timestamptz as china_timestamptz,
  (('2025/9/9' || ' 00:00:00+08:00')::timestamptz AT TIME ZONE 'UTC') as utc_timestamptz;

-- 测试Excel可能返回的数字格式（Excel日期序列号）
SELECT 
  45285 as excel_serial_number,
  ('1900-01-01'::date + interval '45285 days')::date as converted_date,
  ('1900-01-01'::date + interval '45285 days')::timestamptz as converted_timestamptz;

-- 测试各种可能的日期格式
WITH test_dates AS (
  SELECT unnest(ARRAY[
    '2025/9/9',
    '2025-09-09', 
    '2025年9月9日',
    '9/9',
    '09/09',
    '2025-9-9',
    '2025.9.9'
  ]) as date_str
)
SELECT 
  date_str,
  CASE 
    WHEN date_str ~ '^\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}$' THEN '标准格式'
    WHEN date_str ~ '^\d{1,2}[/\-\.]\d{1,2}$' THEN '简化格式'
    WHEN date_str ~ '\d{4}年\d{1,2}月\d{1,2}日' THEN '中文格式'
    ELSE '未知格式'
  END as format_type,
  CASE 
    WHEN date_str ~ '^\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}$' THEN date_str::date
    WHEN date_str ~ '^\d{1,2}[/\-\.]\d{1,2}$' THEN (date_str || '/2025')::date
    ELSE NULL
  END as parsed_date
FROM test_dates;
