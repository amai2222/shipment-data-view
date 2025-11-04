-- 测试货主项目查询

-- 1. 查看 project_partners 表的字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_partners'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. 查看"中粮可乐"的ID
SELECT id, name, partner_type
FROM partners
WHERE name = '中粮可乐';

-- 3. 使用中粮可乐的ID查询关联项目（替换为实际ID）
-- 先手动找到中粮可乐的ID，然后在下面替换
SELECT 
    pp.*,
    p.name AS project_name
FROM project_partners pp
LEFT JOIN projects p ON p.id = pp.project_id
WHERE pp.partner_id = (SELECT id FROM partners WHERE name = '中粮可乐' LIMIT 1);

-- 4. 测试前端使用的嵌套查询
-- 这个查询模拟前端Supabase的查询方式
SELECT 
    pp.project_id,
    p.id,
    p.name
FROM project_partners pp
LEFT JOIN projects p ON p.id = pp.project_id  
WHERE pp.partner_id = (SELECT id FROM partners WHERE name = '中粮可乐' LIMIT 1);

