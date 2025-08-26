-- 为profiles表添加企业微信相关字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS work_wechat_userid TEXT,
ADD COLUMN IF NOT EXISTS work_wechat_department INTEGER[],
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 创建企业微信用户ID的唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_work_wechat_userid 
ON public.profiles(work_wechat_userid) 
WHERE work_wechat_userid IS NOT NULL;

-- 为payment_requests表添加企业微信审批相关字段
ALTER TABLE public.payment_requests 
ADD COLUMN IF NOT EXISTS work_wechat_sp_no TEXT,
ADD COLUMN IF NOT EXISTS approval_result JSONB,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 创建企业微信审批单号的索引
CREATE INDEX IF NOT EXISTS idx_payment_requests_work_wechat_sp_no 
ON public.payment_requests(work_wechat_sp_no) 
WHERE work_wechat_sp_no IS NOT NULL;