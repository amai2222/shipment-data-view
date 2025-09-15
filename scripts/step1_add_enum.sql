-- 步骤 1: 仅添加枚举值
-- 这个脚本只负责添加枚举值，不进行其他操作

SELECT '添加 manager 枚举值' as step;

DO $$
BEGIN
    IF NOT check_enum_value('app_role', 'manager') THEN
        PERFORM add_enum_value('app_role', 'manager');
        RAISE NOTICE '成功添加 manager 枚举值';
    ELSE
        RAISE NOTICE 'manager 枚举值已存在';
    END IF;
END $$;

-- 显示当前枚举值
SELECT '当前枚举值' as step;
SELECT enumlabel as role_value 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
ORDER BY enumlabel;
