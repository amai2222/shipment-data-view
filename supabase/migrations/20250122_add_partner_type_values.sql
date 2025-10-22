-- ==========================================
-- 添加合作方类型枚举值：资方和本公司
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 为已存在的 partner_type_enum 添加新的枚举值
-- 说明: ALTER TYPE ADD VALUE 不能在事务块中执行
-- ==========================================

-- 添加 "资方" 枚举值（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'partner_type_enum'::regtype 
        AND enumlabel = '资方'
    ) THEN
        ALTER TYPE partner_type_enum ADD VALUE '资方';
        RAISE NOTICE '已添加枚举值: 资方';
    ELSE
        RAISE NOTICE '枚举值 "资方" 已存在，跳过';
    END IF;
END $$;

-- 添加 "本公司" 枚举值（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'partner_type_enum'::regtype 
        AND enumlabel = '本公司'
    ) THEN
        ALTER TYPE partner_type_enum ADD VALUE '本公司';
        RAISE NOTICE '已添加枚举值: 本公司';
    ELSE
        RAISE NOTICE '枚举值 "本公司" 已存在，跳过';
    END IF;
END $$;

-- 验证枚举值
DO $$
DECLARE
    enum_values TEXT;
BEGIN
    SELECT string_agg(enumlabel::TEXT, ', ' ORDER BY enumsortorder) INTO enum_values
    FROM pg_enum
    WHERE enumtypid = 'partner_type_enum'::regtype;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '枚举类型更新完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '当前 partner_type_enum 的所有值:';
    RAISE NOTICE '  %', enum_values;
    RAISE NOTICE '';
    RAISE NOTICE '说明:';
    RAISE NOTICE '  - 货主: 支持层级管理';
    RAISE NOTICE '  - 合作商: 独立管理';
    RAISE NOTICE '  - 资方: 独立管理（新增）';
    RAISE NOTICE '  - 本公司: 独立管理（新增）';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

