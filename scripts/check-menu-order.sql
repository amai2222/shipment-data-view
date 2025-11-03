-- 检查菜单顺序
-- 查看实际的 order_index 值

-- 1. 查看所有分组的顺序
SELECT 
    title,
    key,
    order_index,
    is_active
FROM menu_config
WHERE is_group = true
ORDER BY order_index;

-- 2. 查看每个分组下的菜单项顺序
SELECT 
    parent_key AS 所属分组,
    title AS 菜单标题,
    order_index AS 排序值,
    is_active AS 是否启用
FROM menu_config
WHERE is_group = false
ORDER BY parent_key, order_index;

