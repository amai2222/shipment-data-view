-- 确保 projects 表中有 effective_quantity_type 字段
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 首先检查字段是否已存在
DO $$
BEGIN
    -- 检查字段是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
          AND column_name = 'effective_quantity_type'
          AND table_schema = 'public'
    ) THEN
        -- 如果字段不存在，则创建枚举类型（如果不存在）
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'effective_quantity_type') THEN
            CREATE TYPE public.effective_quantity_type AS ENUM (
                'min_value',    -- 装货数量和卸货数量取较小值
                'loading',      -- 取装货数量
                'unloading'     -- 取卸货数量
            );
        END IF;
        
        -- 添加字段
        ALTER TABLE public.projects 
        ADD COLUMN effective_quantity_type public.effective_quantity_type 
        DEFAULT 'min_value' NOT NULL;
        
        -- 为现有项目设置默认值
        UPDATE public.projects 
        SET effective_quantity_type = 'min_value' 
        WHERE effective_quantity_type IS NULL;
        
        -- 添加注释
        COMMENT ON COLUMN public.projects.effective_quantity_type IS '有效数量计算类型：min_value=取较小值，loading=取装货数量，unloading=取卸货数量';
        COMMENT ON TYPE public.effective_quantity_type IS '有效数量计算类型枚举';
        
        RAISE NOTICE '字段 effective_quantity_type 已成功添加到 projects 表';
    ELSE
        RAISE NOTICE '字段 effective_quantity_type 已存在于 projects 表中';
    END IF;
END $$;

-- 2. 验证字段是否添加成功
SELECT 
    '验证结果' as status,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND column_name = 'effective_quantity_type'
  AND table_schema = 'public';

-- 3. 显示现有项目数据（前5条）
SELECT 
    '现有项目数据' as info,
    id,
    name,
    effective_quantity_type
FROM public.projects 
LIMIT 5;
