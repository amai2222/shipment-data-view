-- 删除司机姓名和车牌号的唯一约束
-- 因为司机可能换车开，所以不需要这个约束

BEGIN;

-- 1. 检查当前 drivers 表的约束
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.drivers'::regclass
    AND conname LIKE '%name%license%' 
    OR conname LIKE '%driver%'
    OR contype = 'u';  -- 唯一约束

-- 2. 检查是否有 drivers_name_license_plate_key 约束
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.drivers'::regclass
    AND conname = 'drivers_name_license_plate_key';

-- 3. 删除 drivers_name_license_plate_key 约束（如果存在）
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_name_license_plate_key;

-- 4. 删除所有可能的司机姓名+车牌号唯一约束
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- 查找所有包含 name 和 license_plate 的唯一约束
    FOR constraint_record IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.drivers'::regclass
            AND contype = 'u'
            AND (
                conname LIKE '%name%license%' 
                OR conname LIKE '%driver%license%'
                OR conname LIKE '%name%plate%'
            )
    LOOP
        EXECUTE 'ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
        RAISE NOTICE '已删除约束: %', constraint_record.conname;
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

-- 6. 测试：尝试插入相同的司机姓名和车牌号（应该成功）
-- 注意：这只是测试，实际不会插入数据
SELECT '约束删除完成，现在可以插入相同的司机姓名和车牌号组合' as status;

COMMIT;
