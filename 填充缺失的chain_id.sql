-- ==========================================
-- 填充缺失的 chain_id
-- ==========================================
-- 功能：
--   1. 查找所有 chain_id 为 NULL 的运单
--   2. 使用运单所属项目的默认链路（最早创建的链路）填充
--   3. 只更新 chain_id 字段
-- ==========================================

BEGIN;

-- 创建临时表存储更新结果
CREATE TEMP TABLE IF NOT EXISTS chain_id_update_log (
    record_id UUID,
    auto_number TEXT,
    project_name TEXT,
    old_chain_id UUID,
    new_chain_id UUID,
    new_chain_name TEXT
);

-- 执行更新并记录日志
WITH default_chains AS (
    -- 获取每个项目的默认链路（最早创建的）
    SELECT DISTINCT ON (project_id)
        project_id,
        id as chain_id,
        chain_name
    FROM partner_chains
    ORDER BY project_id, created_at ASC
),
updated_records AS (
    -- 执行更新（只更新 chain_id）
    UPDATE logistics_records lr
    SET 
        chain_id = dc.chain_id
    FROM default_chains dc
    WHERE lr.project_id = dc.project_id
      AND lr.chain_id IS NULL
    RETURNING 
        lr.id,
        lr.auto_number,
        lr.project_name,
        lr.chain_id as new_chain_id
)
INSERT INTO chain_id_update_log
SELECT 
    ur.id,
    ur.auto_number,
    ur.project_name,
    NULL::UUID as old_chain_id,
    ur.new_chain_id,
    pc.chain_name
FROM updated_records ur
LEFT JOIN partner_chains pc ON ur.new_chain_id = pc.id;

-- 显示更新统计
DO $$
DECLARE
    v_updated_count INTEGER;
    v_project_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_updated_count FROM chain_id_update_log;
    SELECT COUNT(DISTINCT project_name) INTO v_project_count FROM chain_id_update_log;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'chain_id 填充完成';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '更新统计：';
    RAISE NOTICE '  ✓ 更新运单数：% 条', v_updated_count;
    RAISE NOTICE '  ✓ 涉及项目：% 个', v_project_count;
    RAISE NOTICE '';
END $$;

-- 显示每个项目的更新详情
SELECT 
    project_name as "项目名称",
    COUNT(*) as "更新数量",
    new_chain_name as "使用的链路"
FROM chain_id_update_log
GROUP BY project_name, new_chain_name
ORDER BY COUNT(*) DESC;

-- 显示前20条更新的运单详情
SELECT 
    auto_number as "运单编号",
    project_name as "项目",
    new_chain_name as "填充的链路"
FROM chain_id_update_log
ORDER BY auto_number
LIMIT 20;

COMMIT;

-- ============================================================
-- 验证更新结果
-- ============================================================

-- 再次检查是否还有 NULL 的 chain_id
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 所有运单的 chain_id 都已填充'
        ELSE '⚠️  还有 ' || COUNT(*) || ' 条运单的 chain_id 为 NULL'
    END as "验证结果"
FROM logistics_records
WHERE chain_id IS NULL
  AND project_id IS NOT NULL;
