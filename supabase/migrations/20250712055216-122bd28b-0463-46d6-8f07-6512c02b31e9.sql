-- 更新现有记录的装车日期，只保留日期部分（去掉时间）
UPDATE public.logistics_records 
SET loading_date = TO_CHAR(TO_DATE(loading_date, 'YYYY-MM-DD'), 'YYYY-MM-DD')
WHERE loading_date ~ '^\d{4}-\d{2}-\d{2}';

-- 对于包含时间的记录，提取日期部分
UPDATE public.logistics_records 
SET loading_date = TO_CHAR(TO_TIMESTAMP(loading_date, 'YYYY-MM-DD"T"HH24:MI:SS'), 'YYYY-MM-DD')
WHERE loading_date ~ '^\d{4}-\d{2}-\d{2}T';