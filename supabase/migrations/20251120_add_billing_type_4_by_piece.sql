-- ============================================================================
-- 添加计费类型4：按件
-- 日期：2025-11-20
-- 说明：在 billing_types 表中添加第4种计费类型"按件"，单位是"件"
-- ============================================================================

-- 检查 billing_types 表是否存在
DO $$
BEGIN
    -- 如果 billing_types 表不存在，创建它
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_types') THEN
        CREATE TABLE public.billing_types (
            billing_type_id bigint NOT NULL,
            type_name text,
            type_code text,
            user_id uuid,
            created_at timestamp with time zone DEFAULT now(),
            PRIMARY KEY (billing_type_id)
        );
        
        -- 插入默认的3种计费类型
        INSERT INTO public.billing_types (billing_type_id, type_name, type_code) VALUES
        (1, '按重量', 'weight'),
        (2, '按车次', 'trip'),
        (3, '按体积', 'volume')
        ON CONFLICT (billing_type_id) DO NOTHING;
    END IF;
END $$;

-- 添加计费类型4：按件
INSERT INTO public.billing_types (billing_type_id, type_name, type_code)
VALUES (4, '按件', 'piece')
ON CONFLICT (billing_type_id) 
DO UPDATE SET 
    type_name = EXCLUDED.type_name,
    type_code = EXCLUDED.type_code;

-- 添加注释
COMMENT ON TABLE public.billing_types IS '计费类型表（重量/车次/体积/件）';
COMMENT ON COLUMN public.billing_types.billing_type_id IS '主键ID：1-按重量(吨), 2-按车次(车), 3-按体积(立方), 4-按件(件)';
COMMENT ON COLUMN public.billing_types.type_name IS '类型名称（中文显示）';
COMMENT ON COLUMN public.billing_types.type_code IS '类型代码：weight-重量, trip-车次, volume-体积, piece-件';

-- 验证插入结果
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.billing_types
    WHERE billing_type_id = 4;
    
    IF v_count = 1 THEN
        RAISE NOTICE '✓ 成功添加计费类型4：按件';
    ELSE
        RAISE EXCEPTION '✗ 添加计费类型4失败';
    END IF;
END $$;

