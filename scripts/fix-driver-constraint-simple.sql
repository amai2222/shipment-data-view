-- 简化版：删除司机姓名和车牌号的唯一约束
-- 修复语法错误，使用正确的SQL语法

BEGIN;

-- 1. 检查当前 drivers 表的约束
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.drivers'::regclass
    AND contype = 'u'  -- 唯一约束
ORDER BY conname;

-- 2. 删除 drivers_name_license_plate_key 约束（如果存在）
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_name_license_plate_key;

-- 3. 删除其他可能的司机相关唯一约束
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_name_license_plate_unique;
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_unique;
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS name_license_plate_key;

-- 4. 使用动态SQL删除所有包含name和license_plate的唯一约束
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- 查找所有包含name和license_plate的唯一约束
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.drivers'::regclass
            AND contype = 'u'
            AND (
                conname ILIKE '%name%license%' 
                OR conname ILIKE '%driver%license%'
                OR conname ILIKE '%name%plate%'
                OR conname ILIKE '%license%name%'
            )
    LOOP
        EXECUTE 'ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS ' || constraint_name;
        RAISE NOTICE '已删除约束: %', constraint_name;
    END LOOP;
END $$;

-- 5. 验证约束已删除
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.drivers'::regclass
    AND contype = 'u';

-- 6. 测试：查看是否还有唯一约束
SELECT 
    CASE 
        WHEN COUNT(*) = 0 
        THEN '✅ 所有司机姓名+车牌号唯一约束已删除' 
        ELSE '⚠️ 仍有 ' || COUNT(*) || ' 个唯一约束存在' 
    END as status
FROM pg_constraint 
WHERE conrelid = 'public.drivers'::regclass
    AND contype = 'u'
    AND (
        conname ILIKE '%name%license%' 
        OR conname ILIKE '%driver%license%'
        OR conname ILIKE '%name%plate%'
    );

COMMIT;
