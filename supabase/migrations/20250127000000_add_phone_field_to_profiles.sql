-- 为profiles表添加手机号字段
-- 文件: supabase/migrations/20250127000000_add_phone_field_to_profiles.sql

-- 添加手机号和企业微信昵称字段
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS work_wechat_name TEXT;

-- 创建手机号的唯一索引（可选，如果需要确保手机号唯一性）
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone 
-- ON public.profiles(phone) 
-- WHERE phone IS NOT NULL;

-- 添加注释
COMMENT ON COLUMN public.profiles.phone IS '用户手机号码，从企业微信获取';
COMMENT ON COLUMN public.profiles.work_wechat_name IS '企业微信用户昵称，从企业微信API获取';
