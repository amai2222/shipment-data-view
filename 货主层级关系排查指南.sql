-- ==========================================
-- 货主层级关系排查指南
-- ==========================================
-- 用途：排查货主之间的层级关系
-- 使用：在 Supabase SQL Editor 中执行
-- ==========================================

-- ============================================================
-- 1. 查看"中粮"和"中粮集团"的详细信息
-- ============================================================
SELECT 
    id,
    name,
    parent_partner_id,
    hierarchy_path,
    hierarchy_depth,
    is_root,
    (SELECT name FROM partners WHERE id = partners.parent_partner_id) as parent_name
FROM partners
WHERE partner_type = '货主'
  AND name IN ('中粮', '中粮集团')
ORDER BY name;

-- ============================================================
-- 2. 检查"中粮"的完整层级链
-- ============================================================
WITH RECURSIVE hierarchy AS (
    -- 起点：中粮
    SELECT 
        id,
        name,
        parent_partner_id,
        hierarchy_path,
        hierarchy_depth,
        0 as level_in_chain,
        name as chain
    FROM partners
    WHERE name = '中粮' AND partner_type = '货主'
    
    UNION ALL
    
    -- 递归：向上查找所有祖先
    SELECT 
        p.id,
        p.name,
        p.parent_partner_id,
        p.hierarchy_path,
        p.hierarchy_depth,
        h.level_in_chain + 1,
        p.name || ' → ' || h.chain
    FROM partners p
    JOIN hierarchy h ON p.id = h.parent_partner_id
)
SELECT 
    level_in_chain as "层级",
    name as "节点名称",
    hierarchy_path as "路径",
    chain as "完整链路"
FROM hierarchy
ORDER BY level_in_chain;

-- ============================================================
-- 3. 检查"中粮集团"的完整层级链
-- ============================================================
WITH RECURSIVE hierarchy AS (
    -- 起点：中粮集团
    SELECT 
        id,
        name,
        parent_partner_id,
        hierarchy_path,
        hierarchy_depth,
        0 as level_in_chain,
        name as chain
    FROM partners
    WHERE name = '中粮集团' AND partner_type = '货主'
    
    UNION ALL
    
    -- 递归：向上查找所有祖先
    SELECT 
        p.id,
        p.name,
        p.parent_partner_id,
        p.hierarchy_path,
        p.hierarchy_depth,
        h.level_in_chain + 1,
        p.name || ' → ' || h.chain
    FROM partners p
    JOIN hierarchy h ON p.id = h.parent_partner_id
)
SELECT 
    level_in_chain as "层级",
    name as "节点名称",
    hierarchy_path as "路径",
    chain as "完整链路"
FROM hierarchy
ORDER BY level_in_chain;

-- ============================================================
-- 4. 检查"中粮集团"是否在"中粮"的层级路径中
-- ============================================================
WITH 
中粮_info AS (
    SELECT id, name, hierarchy_path
    FROM partners
    WHERE name = '中粮' AND partner_type = '货主'
    LIMIT 1
),
中粮集团_info AS (
    SELECT id, name, hierarchy_path
    FROM partners
    WHERE name = '中粮集团' AND partner_type = '货主'
    LIMIT 1
)
SELECT 
    '中粮' as "节点1",
    (SELECT hierarchy_path FROM 中粮_info) as "中粮的路径",
    '中粮集团' as "节点2",
    (SELECT hierarchy_path FROM 中粮集团_info) as "中粮集团的路径",
    CASE 
        WHEN (SELECT hierarchy_path FROM 中粮集团_info) LIKE (SELECT hierarchy_path FROM 中粮_info) || '%'
        THEN '✗ 中粮集团是中粮的子孙节点 - 不能拖'
        WHEN (SELECT hierarchy_path FROM 中粮_info) LIKE (SELECT hierarchy_path FROM 中粮集团_info) || '%'
        THEN '✗ 中粮是中粮集团的子孙节点 - 不能拖'
        ELSE '✓ 可以拖拽'
    END as "检查结果";

-- ============================================================
-- 5. 查看所有名字包含"中粮"的货主及其层级关系
-- ============================================================
SELECT 
    id,
    name,
    parent_partner_id,
    (SELECT name FROM partners WHERE id = partners.parent_partner_id) as parent_name,
    hierarchy_path,
    hierarchy_depth,
    is_root,
    (SELECT COUNT(*) FROM partners p2 WHERE p2.parent_partner_id = partners.id) as children_count
FROM partners
WHERE partner_type = '货主'
  AND (name LIKE '%中粮%' OR name LIKE '%中工%')
ORDER BY hierarchy_path NULLS LAST;

-- ============================================================
-- 6. 可视化"中粮"相关的层级树
-- ============================================================
WITH RECURSIVE tree AS (
    -- 找所有根节点
    SELECT 
        id,
        name,
        parent_partner_id,
        hierarchy_depth,
        name as display_name,
        0 as display_level
    FROM partners
    WHERE partner_type = '货主' 
      AND is_root = TRUE
      AND (name LIKE '%中粮%' OR name LIKE '%中工%')
    
    UNION ALL
    
    -- 递归查找所有子节点
    SELECT 
        p.id,
        p.name,
        p.parent_partner_id,
        p.hierarchy_depth,
        REPEAT('  ', t.display_level + 1) || '└── ' || p.name,
        t.display_level + 1
    FROM partners p
    JOIN tree t ON p.parent_partner_id = t.id
    WHERE p.partner_type = '货主'
)
SELECT 
    display_level as "层级",
    display_name as "节点结构",
    hierarchy_depth as "深度",
    id
FROM tree
ORDER BY display_name;

-- ============================================================
-- 7. 排查建议
-- ============================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '排查步骤：';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '1. 执行查询 1-4，查看"中粮"和"中粮集团"的关系';
    RAISE NOTICE '2. 检查 hierarchy_path 是否有问题';
    RAISE NOTICE '3. 如果发现数据异常，可以重置层级信息：';
    RAISE NOTICE '';
    RAISE NOTICE '   -- 重置某个货主的层级信息';
    RAISE NOTICE '   UPDATE partners ';
    RAISE NOTICE '   SET parent_partner_id = NULL, is_root = FALSE';
    RAISE NOTICE '   WHERE name = ''中粮'';';
    RAISE NOTICE '';
    RAISE NOTICE '4. 重新在UI中设置层级关系';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- ============================================================
-- 8. 可能的修复方案
-- ============================================================

-- 如果"中粮"的层级数据有问题，可以重置：
-- UPDATE partners 
-- SET parent_partner_id = NULL, is_root = FALSE, hierarchy_path = NULL
-- WHERE name = '中粮' AND partner_type = '货主';

-- 然后在UI中重新设置层级关系

