-- 为项目合作方表添加计算方法和利润率字段
ALTER TABLE public.project_partners 
ADD COLUMN calculation_method TEXT DEFAULT 'tax' CHECK (calculation_method IN ('tax', 'profit'));

ALTER TABLE public.project_partners 
ADD COLUMN profit_rate NUMERIC DEFAULT 0;