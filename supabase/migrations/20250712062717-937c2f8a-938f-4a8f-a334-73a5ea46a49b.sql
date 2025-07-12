-- 更新单号中的2024为2025
UPDATE public.logistics_records 
SET auto_number = REPLACE(auto_number, '2024', '2025')
WHERE auto_number LIKE '2024%';

-- 更新装车日期中的2024为2025
UPDATE public.logistics_records 
SET loading_date = REPLACE(loading_date, '2024', '2025')
WHERE loading_date LIKE '2024%';

-- 更新卸货日期中的2024为2025
UPDATE public.logistics_records 
SET unloading_date = REPLACE(unloading_date, '2024', '2025')
WHERE unloading_date LIKE '2024%' AND unloading_date IS NOT NULL;