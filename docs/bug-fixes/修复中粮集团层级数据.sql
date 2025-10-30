-- ==========================================
-- 修复中粮集团层级数据
-- ==========================================
-- 问题：hierarchy_depth = 100（异常值）
-- 原因：可能存在循环引用或数据损坏
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步：检查问题
-- ============================================================

-- 查看中粮集团的当前状态
SELECT 
    '中粮集团当前状态' as "检查项",
    id,
    name,
    parent_partner_id,
    hierarchy_path,
    hierarchy_depth,
    is_root,
    (SELECT name FROM partners WHERE id = partners.parent_partner_id) as parent_name
FROM partners
WHERE name = '中粮集团' AND partner_type = '货主';

-- 检查是否有循环引用
WITH RECURSIVE check_loop AS (
    SELECT 
        id,
        name,
        parent_partner_id,
        ARRAY[id] as visited_ids,
        0 as depth
    FROM partners
    WHERE name = '中粮集团' AND partner_type = '货主'
    
    UNION ALL
    
    SELECT 
        p.id,
        p.name,
        p.parent_partner_id,
        c.visited_ids || p.id,
        c.depth + 1
    FROM partners p
    JOIN check_loop c ON p.id = c.parent_partner_id
    WHERE NOT (p.id = ANY(c.visited_ids))  -- 检测循环
      AND c.depth < 20  -- 限制递归深度
)
SELECT 
    '循环检查' as "检查类型",
    name,
    depth as "实际深度",
    array_length(visited_ids, 1) as "访问节点数",
    CASE 
        WHEN depth >= 19 THEN '⚠️ 可能存在循环或过深'
        ELSE '✓ 正常'
    END as "状态"
FROM check_loop
ORDER BY depth DESC
LIMIT 1;

-- ============================================================
-- 第二步：重置中粮集团的层级数据
-- ============================================================

-- 方案A：完全重置（推荐）
UPDATE partners
SET 
    parent_partner_id = NULL,
    hierarchy_path = '/' || id::TEXT,
    hierarchy_depth = 0,
    is_root = TRUE,
    updated_at = NOW()
WHERE name = '中粮集团' AND partner_type = '货主';

-- 验证修复结果
SELECT 
    '修复后状态' as "检查项",
    id,
    name,
    parent_partner_id,
    hierarchy_path,
    hierarchy_depth,
    is_root
FROM partners
WHERE name = '中粮集团' AND partner_type = '货主';

-- ============================================================
-- 第三步：检查并修复所有异常深度的货主
-- ============================================================

-- 查找所有深度异常的货主（>10）
SELECT 
    '深度异常的货主' as "检查项",
    id,
    name,
    hierarchy_depth,
    parent_partner_id,
    is_root
FROM partners
WHERE partner_type = '货主'
  AND hierarchy_depth > 10
ORDER BY hierarchy_depth DESC;

-- 重置所有深度异常的货主
UPDATE partners
SET 
    parent_partner_id = NULL,
    hierarchy_path = '/' || id::TEXT,
    hierarchy_depth = 0,
    is_root = FALSE,  -- 设为FALSE，让用户手动选择设为根节点
    updated_at = NOW()
WHERE partner_type = '货主'
  AND hierarchy_depth > 10;

-- 报告修复结果
SELECT 
    '修复完成' as "状态",
    COUNT(*) as "修复的货主数量"
FROM partners
WHERE partner_type = '货主'
  AND hierarchy_depth <= 10
  AND updated_at > NOW() - INTERVAL '1 minute';

COMMIT;

-- ============================================================
-- 第四步：重新触发层级计算（可选）
-- ============================================================

-- 如果有货主仍然有 parent_partner_id，需要重新计算层级
-- 可以通过更新一个无关字段来触发触发器
-- UPDATE partners 
-- SET updated_at = NOW() 
-- WHERE partner_type = '货主' AND parent_partner_id IS NOT NULL;

-- ============================================================
-- 验证最终结果
-- ============================================================

-- 查看所有货主的层级统计
SELECT 
    '最终统计' as "报告",
    COUNT(*) as "总货主数",
    COUNT(CASE WHEN is_root = TRUE THEN 1 END) as "根节点数",
    MAX(hierarchy_depth) as "最大深度",
    ROUND(AVG(hierarchy_depth), 2) as "平均深度",
    COUNT(CASE WHEN hierarchy_depth > 10 THEN 1 END) as "深度异常数"
FROM partners
WHERE partner_type = '货主';

-- 查看层级分布
SELECT 
    hierarchy_depth as "深度",
    COUNT(*) as "货主数量"
FROM partners
WHERE partner_type = '货主'
GROUP BY hierarchy_depth
ORDER BY hierarchy_depth;

