-- 扩展locations表以支持地理编码信息
-- 添加高德地图地理编码相关字段

-- 1. 创建地理编码状态枚举（必须先创建）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'geocoding_status') THEN
        CREATE TYPE geocoding_status AS ENUM ('pending', 'success', 'failed', 'retry');
    END IF;
END $$;

-- 2. 添加地理编码相关字段
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7) CHECK (latitude >= -90 AND latitude <= 90),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7) CHECK (longitude >= -180 AND longitude <= 180),
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS district TEXT,
ADD COLUMN IF NOT EXISTS township TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS street_number TEXT,
ADD COLUMN IF NOT EXISTS adcode TEXT,
ADD COLUMN IF NOT EXISTS citycode TEXT,
ADD COLUMN IF NOT EXISTS geocoding_status geocoding_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS geocoding_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS geocoding_error TEXT;

-- 3. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_locations_geocoding_status ON public.locations(geocoding_status);
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON public.locations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_locations_adcode ON public.locations(adcode);

-- 4. 创建地理编码更新函数
CREATE OR REPLACE FUNCTION public.update_location_geocoding(
    p_location_id UUID,
    p_address TEXT DEFAULT NULL,
    p_latitude DECIMAL DEFAULT NULL,
    p_longitude DECIMAL DEFAULT NULL,
    p_formatted_address TEXT DEFAULT NULL,
    p_province TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_district TEXT DEFAULT NULL,
    p_township TEXT DEFAULT NULL,
    p_street TEXT DEFAULT NULL,
    p_street_number TEXT DEFAULT NULL,
    p_adcode TEXT DEFAULT NULL,
    p_citycode TEXT DEFAULT NULL,
    p_status geocoding_status DEFAULT 'success',
    p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.locations 
    SET 
        address = COALESCE(p_address, address),
        latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude),
        formatted_address = COALESCE(p_formatted_address, formatted_address),
        province = COALESCE(p_province, province),
        city = COALESCE(p_city, city),
        district = COALESCE(p_district, district),
        township = COALESCE(p_township, township),
        street = COALESCE(p_street, street),
        street_number = COALESCE(p_street_number, street_number),
        adcode = COALESCE(p_adcode, adcode),
        citycode = COALESCE(p_citycode, citycode),
        geocoding_status = p_status,
        geocoding_updated_at = NOW(),
        geocoding_error = p_error
    WHERE id = p_location_id;
    
    RETURN FOUND;
END;
$$;

-- 5. 创建批量地理编码更新函数
CREATE OR REPLACE FUNCTION public.batch_update_location_geocoding(
    p_locations JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    location_item JSONB;
    result JSONB := '{"success": 0, "failed": 0, "errors": []}';
    success_count INTEGER := 0;
    failed_count INTEGER := 0;
    errors JSONB := '[]';
BEGIN
    -- 遍历每个地点
    FOR location_item IN SELECT * FROM jsonb_array_elements(p_locations) LOOP
        BEGIN
            PERFORM public.update_location_geocoding(
                (location_item->>'id')::UUID,
                location_item->>'address',
                (location_item->>'latitude')::DECIMAL,
                (location_item->>'longitude')::DECIMAL,
                location_item->>'formatted_address',
                location_item->>'province',
                location_item->>'city',
                location_item->>'district',
                location_item->>'township',
                location_item->>'street',
                location_item->>'street_number',
                location_item->>'adcode',
                location_item->>'citycode',
                COALESCE((location_item->>'status')::geocoding_status, 'success'),
                location_item->>'error'
            );
            
            success_count := success_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                failed_count := failed_count + 1;
                errors := errors || jsonb_build_object(
                    'location_id', location_item->>'id',
                    'error', SQLERRM
                );
        END;
    END LOOP;
    
    result := jsonb_build_object(
        'success', success_count,
        'failed', failed_count,
        'errors', errors
    );
    
    RETURN result;
END;
$$;

-- 6. 创建获取待地理编码地点的函数
CREATE OR REPLACE FUNCTION public.get_locations_for_geocoding(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    address TEXT,
    geocoding_status geocoding_status,
    geocoding_updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        l.address,
        l.geocoding_status,
        l.geocoding_updated_at
    FROM public.locations l
    WHERE l.geocoding_status IN ('pending', 'failed')
    ORDER BY 
        CASE 
            WHEN l.geocoding_status = 'failed' THEN 1
            WHEN l.geocoding_status = 'pending' THEN 2
        END,
        l.created_at ASC
    LIMIT p_limit;
END;
$$;

-- 7. 创建地点搜索函数（支持地理编码）
CREATE OR REPLACE FUNCTION public.search_locations_with_geocoding(
    p_query TEXT DEFAULT '',
    p_include_coordinates BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    address TEXT,
    latitude DECIMAL,
    longitude DECIMAL,
    formatted_address TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    geocoding_status geocoding_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        l.address,
        CASE WHEN p_include_coordinates THEN l.latitude ELSE NULL END,
        CASE WHEN p_include_coordinates THEN l.longitude ELSE NULL END,
        l.formatted_address,
        l.province,
        l.city,
        l.district,
        l.geocoding_status
    FROM public.locations l
    WHERE 
        (p_query = '' OR p_query IS NULL OR 
         l.name ILIKE '%' || p_query || '%' OR
         l.address ILIKE '%' || p_query || '%' OR
         l.formatted_address ILIKE '%' || p_query || '%')
    ORDER BY 
        CASE 
            WHEN l.geocoding_status = 'success' THEN 1
            WHEN l.geocoding_status = 'pending' THEN 2
            WHEN l.geocoding_status = 'failed' THEN 3
        END,
        l.name ASC;
END;
$$;

-- 8. 创建RLS策略
CREATE POLICY "Enable read access for authenticated users" ON public.locations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON public.locations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.locations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON public.locations FOR DELETE USING (auth.role() = 'authenticated');

-- 9. 添加注释
COMMENT ON COLUMN public.locations.address IS '详细地址';
COMMENT ON COLUMN public.locations.latitude IS '纬度';
COMMENT ON COLUMN public.locations.longitude IS '经度';
COMMENT ON COLUMN public.locations.formatted_address IS '格式化地址';
COMMENT ON COLUMN public.locations.province IS '省份';
COMMENT ON COLUMN public.locations.city IS '城市';
COMMENT ON COLUMN public.locations.district IS '区县';
COMMENT ON COLUMN public.locations.township IS '乡镇';
COMMENT ON COLUMN public.locations.street IS '街道';
COMMENT ON COLUMN public.locations.street_number IS '门牌号';
COMMENT ON COLUMN public.locations.adcode IS '行政区划代码';
COMMENT ON COLUMN public.locations.citycode IS '城市编码';
COMMENT ON COLUMN public.locations.geocoding_status IS '地理编码状态';
COMMENT ON COLUMN public.locations.geocoding_updated_at IS '地理编码更新时间';
COMMENT ON COLUMN public.locations.geocoding_error IS '地理编码错误信息';
