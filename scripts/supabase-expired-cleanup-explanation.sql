-- Supabase 权限变更确认系统自动过期清理说明
-- 详细解释自动过期清理机制

-- 1. 自动过期清理机制说明
SELECT 
    '=== 自动过期清理机制说明 ===' as section,
    '清理时间: ' || now() as explanation_time;

-- 2. 过期清理原理
SELECT 
    '=== 过期清理原理 ===' as section,
    '1. 权限变更确认记录有10分钟有效期' as principle_1,
    '2. 超过10分钟的记录自动失效' as principle_2,
    '3. 系统定期清理过期记录' as principle_3,
    '4. 防止数据库积累无用数据' as principle_4;

-- 3. 权限变更确认表结构
SELECT 
    '=== 权限变更确认表结构 ===' as section,
    '表名: permission_change_confirmations' as table_name,
    'created_at: 创建时间' as field_1,
    'expires_at: 过期时间（创建时间+10分钟）' as field_2,
    'confirmed_at: 确认时间' as field_3,
    'executed_at: 执行时间' as field_4;

-- 4. 过期清理函数
CREATE OR REPLACE FUNCTION cleanup_expired_permission_confirmations()
RETURNS void AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 删除过期的确认记录
    DELETE FROM public.permission_change_confirmations
    WHERE expires_at < now();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE '已清理 % 条过期的权限变更确认记录', deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 手动清理过期记录示例
SELECT 
    '=== 手动清理过期记录示例 ===' as section;

-- 查看当前确认记录
SELECT 
    '当前确认记录' as category,
    confirmation_token,
    change_summary,
    created_at,
    expires_at,
    confirmed_at,
    executed_at,
    CASE 
        WHEN expires_at < now() THEN '已过期'
        WHEN executed_at IS NOT NULL THEN '已执行'
        WHEN confirmed_at IS NOT NULL THEN '已确认'
        ELSE '等待确认'
    END as status
FROM public.permission_change_confirmations
ORDER BY created_at DESC;

-- 6. 自动清理触发器
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_confirmations()
RETURNS TRIGGER AS $$
BEGIN
    -- 每次插入新记录时，清理过期记录
    PERFORM cleanup_expired_permission_confirmations();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_cleanup_on_insert ON public.permission_change_confirmations;
CREATE TRIGGER trigger_cleanup_on_insert
    AFTER INSERT ON public.permission_change_confirmations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_expired_confirmations();

-- 7. 定时清理任务（需要数据库管理员权限）
-- 注意：以下代码需要数据库管理员权限才能执行
-- 创建定时清理任务（每小时执行一次）
-- SELECT cron.schedule(
--     'cleanup-expired-permission-confirmations',
--     '0 * * * *', -- 每小时执行一次
--     'SELECT cleanup_expired_permission_confirmations();'
-- );

-- 8. 过期清理的好处
SELECT 
    '=== 过期清理的好处 ===' as section,
    '1. 防止数据库积累无用数据' as benefit_1,
    '2. 提高查询性能' as benefit_2,
    '3. 节省存储空间' as benefit_3,
    '4. 保持数据整洁' as benefit_4,
    '5. 避免安全风险' as benefit_5;

-- 9. 过期清理的时机
SELECT 
    '=== 过期清理的时机 ===' as section,
    '1. 插入新确认记录时' as timing_1,
    '2. 定时任务执行时' as timing_2,
    '3. 手动执行清理时' as timing_3,
    '4. 系统维护时' as timing_4;

-- 10. 过期清理的影响
SELECT 
    '=== 过期清理的影响 ===' as section,
    '1. 过期的确认记录被删除' as impact_1,
    '2. 已确认但未执行的记录保留' as impact_2,
    '3. 已执行的记录保留' as impact_3,
    '4. 不影响正常的权限变更流程' as impact_4;

-- 11. 过期清理监控
CREATE OR REPLACE FUNCTION monitor_expired_confirmations()
RETURNS TABLE(
    total_records INTEGER,
    expired_records INTEGER,
    pending_records INTEGER,
    confirmed_records INTEGER,
    executed_records INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_records,
        COUNT(CASE WHEN expires_at < now() THEN 1 END)::INTEGER as expired_records,
        COUNT(CASE WHEN expires_at >= now() AND confirmed_at IS NULL THEN 1 END)::INTEGER as pending_records,
        COUNT(CASE WHEN confirmed_at IS NOT NULL AND executed_at IS NULL THEN 1 END)::INTEGER as confirmed_records,
        COUNT(CASE WHEN executed_at IS NOT NULL THEN 1 END)::INTEGER as executed_records
    FROM public.permission_change_confirmations;
END;
$$ LANGUAGE plpgsql;

-- 12. 监控过期记录
SELECT 
    '=== 过期记录监控 ===' as section;

SELECT * FROM monitor_expired_confirmations();

-- 13. 过期清理最佳实践
SELECT 
    '=== 过期清理最佳实践 ===' as section,
    '1. 定期执行清理任务' as practice_1,
    '2. 监控清理效果' as practice_2,
    '3. 设置合理的过期时间' as practice_3,
    '4. 记录清理日志' as practice_4,
    '5. 测试清理功能' as practice_5;

-- 14. 过期清理配置
SELECT 
    '=== 过期清理配置 ===' as section,
    '过期时间: 10分钟' as config_1,
    '清理频率: 每次插入时' as config_2,
    '保留策略: 已执行的记录保留' as config_3,
    '监控: 实时监控' as config_4;

-- 15. 过期清理示例
SELECT 
    '=== 过期清理示例 ===' as section;

-- 示例：查看过期记录
SELECT 
    '过期记录示例' as category,
    confirmation_token,
    change_summary,
    created_at,
    expires_at,
    CASE 
        WHEN expires_at < now() THEN '已过期'
        ELSE '未过期'
    END as status
FROM public.permission_change_confirmations
WHERE expires_at < now()
ORDER BY created_at DESC;

-- 16. 最终说明
SELECT 
    '=== 最终说明 ===' as section,
    '自动过期清理是系统维护功能' as explanation_1,
    '确保数据库数据整洁' as explanation_2,
    '提高系统性能' as explanation_3,
    '不影响正常功能' as explanation_4,
    '建议定期监控' as explanation_5;
