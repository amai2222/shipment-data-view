-- 为drivers表添加照片字段
-- 支持身份证、驾驶证、从业资格证的多张照片上传

-- 添加照片URL字段（JSONB数组格式）
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS id_card_photos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS driver_license_photos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS qualification_certificate_photos jsonb DEFAULT '[]'::jsonb;

-- 添加字段注释
COMMENT ON COLUMN public.drivers.id_card_photos IS '身份证照片URL数组';
COMMENT ON COLUMN public.drivers.driver_license_photos IS '驾驶证照片URL数组';
COMMENT ON COLUMN public.drivers.qualification_certificate_photos IS '从业资格证照片URL数组';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_drivers_id_card_photos ON public.drivers USING gin (id_card_photos);
CREATE INDEX IF NOT EXISTS idx_drivers_driver_license_photos ON public.drivers USING gin (driver_license_photos);
CREATE INDEX IF NOT EXISTS idx_drivers_qualification_certificate_photos ON public.drivers USING gin (qualification_certificate_photos);

-- 添加RLS策略（如果需要）
-- 注意：drivers表可能已经有RLS策略，这里只是确保新字段也被覆盖

-- 查看当前RLS策略
-- SELECT * FROM pg_policies WHERE tablename = 'drivers';

-- 如果需要，可以更新现有的RLS策略以包含新字段
-- 这里假设drivers表已经有合适的RLS策略，新字段会自动继承

-- 验证字段添加
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'id_card_photos'
  ) THEN
    RAISE NOTICE '✅ 身份证照片字段添加成功';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'driver_license_photos'
  ) THEN
    RAISE NOTICE '✅ 驾驶证照片字段添加成功';
  END IF;
  
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'drivers' 
    AND column_name = 'qualification_certificate_photos'
  ) THEN
    RAISE NOTICE '✅ 从业资格证照片字段添加成功';
  END IF;
END $$;
