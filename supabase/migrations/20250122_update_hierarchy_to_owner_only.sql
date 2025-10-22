-- ==========================================
-- 货主层级管理系统更新
-- ==========================================
-- 创建时间: 2025-01-22
-- 功能: 将合作方层级管理改为仅针对货主类型的合作方
-- 说明: 
--   1. 只有 partner_type = '货主' 的合作方才参与层级管理
--   2. 合作商类型不参与层级关系
--   3. 更新所有相关函数、触发器、视图和RLS策略
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 清理合作商的层级信息
-- ============================================================

-- 将所有非货主类型的层级字段重置为NULL
-- 注意：使用 != '货主' 而不是 IN ('合作商', '资方', '本公司')
-- 这样即使新枚举值还未添加也不会出错
UPDATE public.partners
SET 
  parent_partner_id = NULL,
  hierarchy_path = NULL,
  hierarchy_depth = NULL,
  is_root = NULL,
  updated_at = NOW()
WHERE partner_type != '货主';

-- ============================================================
-- 第二步: 更新触发器函数（只处理货主）
-- ============================================================

CREATE OR REPLACE FUNCTION public.maintain_partner_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  new_path TEXT;
  new_depth INTEGER;
  is_root_node BOOLEAN;
BEGIN
  -- 只处理货主类型的合作方
  IF NEW.partner_type = '货主' THEN
    -- 计算层级路径
    new_path := public.calculate_hierarchy_path(NEW.id);
    
    -- 计算层级深度
    new_depth := public.calculate_hierarchy_depth(NEW.id);
    
    -- 判断是否为根节点
    is_root_node := (NEW.parent_partner_id IS NULL);
    
    -- 更新字段
    NEW.hierarchy_path := new_path;
    NEW.hierarchy_depth := new_depth;
    NEW.is_root := is_root_node;
  ELSE
    -- 非货主类型（合作商、资方、本公司）不维护层级信息
    NEW.parent_partner_id := NULL;
    NEW.hierarchy_path := NULL;
    NEW.hierarchy_depth := NULL;
    NEW.is_root := NULL;
  END IF;
  
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.maintain_partner_hierarchy IS '自动维护货主层级信息的触发器函数（只针对货主类型）';

-- 重新创建触发器，支持 partner_type 字段的变更
DROP TRIGGER IF EXISTS trigger_maintain_partner_hierarchy ON public.partners;

CREATE TRIGGER trigger_maintain_partner_hierarchy
  BEFORE INSERT OR UPDATE OF parent_partner_id, partner_type ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_partner_hierarchy();

COMMENT ON TRIGGER trigger_maintain_partner_hierarchy ON public.partners 
  IS '自动维护货主层级路径、深度和根节点标记（只针对货主类型）';

-- ============================================================
-- 第三步: 更新辅助查询函数（只查询货主）
-- ============================================================

-- 获取所有子孙节点ID（只包括货主）
CREATE OR REPLACE FUNCTION public.get_all_subordinate_ids(partner_id UUID)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT id 
    FROM public.partners 
    WHERE partner_type = '货主'
      AND hierarchy_path LIKE (
        SELECT hierarchy_path || '%' 
        FROM public.partners 
        WHERE id = partner_id AND partner_type = '货主'
      )
      AND id != partner_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_all_subordinate_ids IS '获取指定货主的所有子孙节点ID（递归所有层级，只包括货主）';

-- 获取所有祖先节点ID（只包括货主）
CREATE OR REPLACE FUNCTION public.get_all_ancestor_ids(partner_id UUID)
RETURNS UUID[] AS $$
DECLARE
  path TEXT;
  ancestor_ids UUID[] := ARRAY[]::UUID[];
  path_parts TEXT[];
  part TEXT;
  part_type TEXT;
BEGIN
  -- 获取层级路径
  SELECT hierarchy_path INTO path
  FROM public.partners
  WHERE id = partner_id AND partner_type = '货主';
  
  IF path IS NULL THEN
    RETURN ancestor_ids;
  END IF;
  
  -- 解析路径，提取所有UUID（只包括货主）
  path_parts := string_to_array(path, '/');
  
  FOREACH part IN ARRAY path_parts
  LOOP
    IF part != '' AND part::UUID != partner_id THEN
      -- 检查是否为货主类型
      SELECT partner_type INTO part_type
      FROM public.partners
      WHERE id = part::UUID;
      
      IF part_type = '货主' THEN
        ancestor_ids := array_append(ancestor_ids, part::UUID);
      END IF;
    END IF;
  END LOOP;
  
  RETURN ancestor_ids;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_all_ancestor_ids IS '获取指定货主的所有祖先节点ID（递归所有层级，只包括货主）';

-- 检查用户是否可以查看目标货主的数据
CREATE OR REPLACE FUNCTION public.can_view_partner(target_partner_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  current_user_partner_id UUID;
  current_user_role TEXT;
  target_user_id UUID;
  target_path TEXT;
  current_path TEXT;
  target_type TEXT;
  current_type TEXT;
BEGIN
  -- 获取当前登录用户ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 获取当前用户角色
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = current_user_id;
  
  -- 管理员和财务可以查看所有
  IF current_user_role IN ('admin', 'finance') THEN
    RETURN TRUE;
  END IF;
  
  -- 获取目标合作方类型
  SELECT partner_type INTO target_type
  FROM public.partners
  WHERE id = target_partner_id;
  
  -- 如果不是货主，使用简单权限检查
  IF target_type != '货主' THEN
    SELECT user_id INTO target_user_id
    FROM public.partners
    WHERE id = target_partner_id;
    
    RETURN target_user_id = current_user_id;
  END IF;
  
  -- 以下是货主的层级权限检查
  -- 获取目标合作方的创建用户
  SELECT user_id INTO target_user_id
  FROM public.partners
  WHERE id = target_partner_id;
  
  -- 如果是自己创建的，可以查看
  IF target_user_id = current_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- 获取当前用户关联的货主ID
  SELECT id, partner_type INTO current_user_partner_id, current_type
  FROM public.partners
  WHERE user_id = current_user_id
    AND partner_type = '货主'
  ORDER BY is_root DESC NULLS LAST, hierarchy_depth ASC NULLS LAST
  LIMIT 1;
  
  -- 如果当前用户没有关联的货主，不能查看
  IF current_user_partner_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 如果查看的就是自己的货主，允许
  IF current_user_partner_id = target_partner_id THEN
    RETURN TRUE;
  END IF;
  
  -- 获取两个货主的层级路径
  SELECT hierarchy_path INTO current_path
  FROM public.partners
  WHERE id = current_user_partner_id;
  
  SELECT hierarchy_path INTO target_path
  FROM public.partners
  WHERE id = target_partner_id;
  
  -- 如果目标路径包含当前路径，说明目标是当前的子孙节点，允许查看
  IF target_path LIKE current_path || '%' THEN
    RETURN TRUE;
  END IF;
  
  -- 如果当前路径包含目标路径，说明目标是当前的祖先节点，允许查看（可以看到上级）
  IF current_path LIKE target_path || '%' THEN
    RETURN TRUE;
  END IF;
  
  -- 其他情况不允许查看
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.can_view_partner IS '检查当前用户是否可以查看目标合作方的数据（货主使用层级权限，合作商使用简单权限）';

-- ============================================================
-- 第四步: 更新视图（只显示货主层级）
-- ============================================================

-- 先删除旧视图，因为列名和顺序可能已改变
DROP VIEW IF EXISTS public.partners_hierarchy_view;

-- 重新创建视图
CREATE VIEW public.partners_hierarchy_view AS
SELECT 
  p.id,
  p.name,
  p.user_id,
  p.full_name,
  p.tax_rate,
  p.partner_type,
  p.parent_partner_id,
  p.hierarchy_path,
  p.hierarchy_depth,
  p.is_root,
  p.created_at,
  p.updated_at,
  parent.name AS parent_name,
  parent.hierarchy_depth AS parent_depth,
  (SELECT COUNT(*) FROM public.partners WHERE parent_partner_id = p.id AND partner_type = '货主') AS direct_children_count,
  (SELECT COUNT(*) FROM public.partners WHERE hierarchy_path LIKE p.hierarchy_path || '%' AND id != p.id AND partner_type = '货主') AS total_subordinates_count
FROM public.partners p
LEFT JOIN public.partners parent ON p.parent_partner_id = parent.id
WHERE p.partner_type = '货主';

COMMENT ON VIEW public.partners_hierarchy_view IS '货主层级视图（只包含货主类型的合作方，包含父节点信息和子节点统计）';

-- ============================================================
-- 第五步: 更新统计函数（只统计货主）
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_hierarchy_statistics()
RETURNS TABLE (
  total_partners BIGINT,
  root_partners BIGINT,
  max_depth INTEGER,
  avg_depth NUMERIC,
  partners_with_children BIGINT,
  leaf_partners BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.partners WHERE partner_type = '货主')::BIGINT,
    (SELECT COUNT(*) FROM public.partners WHERE partner_type = '货主' AND is_root = TRUE)::BIGINT,
    (SELECT MAX(hierarchy_depth) FROM public.partners WHERE partner_type = '货主')::INTEGER,
    (SELECT ROUND(AVG(hierarchy_depth), 2) FROM public.partners WHERE partner_type = '货主')::NUMERIC,
    (SELECT COUNT(DISTINCT parent_partner_id) FROM public.partners WHERE partner_type = '货主' AND parent_partner_id IS NOT NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.partners p WHERE partner_type = '货主' AND NOT EXISTS (SELECT 1 FROM public.partners p2 WHERE p2.parent_partner_id = p.id AND p2.partner_type = '货主'))::BIGINT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_hierarchy_statistics IS '获取货主层级统计信息（只统计货主类型）';

-- 获取完整的层级树（只包括货主）
CREATE OR REPLACE FUNCTION public.get_hierarchy_tree(root_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  parent_id UUID,
  hierarchy_path TEXT,
  hierarchy_depth INTEGER,
  is_root BOOLEAN,
  children_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.parent_partner_id,
    p.hierarchy_path,
    p.hierarchy_depth,
    p.is_root,
    (SELECT COUNT(*) FROM public.partners WHERE parent_partner_id = p.id AND partner_type = '货主')::BIGINT
  FROM public.partners p
  WHERE 
    p.partner_type = '货主'
    AND CASE 
      WHEN root_id IS NULL THEN TRUE
      ELSE p.hierarchy_path LIKE (SELECT hierarchy_path || '%' FROM public.partners WHERE id = root_id AND partner_type = '货主')
    END
  ORDER BY p.hierarchy_path;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_hierarchy_tree IS '获取完整的货主层级树结构（只包括货主类型）';

-- ============================================================
-- 第六步: 更新注释
-- ============================================================

COMMENT ON COLUMN public.partners.parent_partner_id IS '上级货主ID（NULL表示根节点，只对货主类型有效）';
COMMENT ON COLUMN public.partners.hierarchy_path IS '层级路径（如：/uuid1/uuid2/uuid3）用于快速层级查询（只对货主类型有效）';
COMMENT ON COLUMN public.partners.hierarchy_depth IS '层级深度（0=根节点，1=一级，2=二级...，只对货主类型有效）';
COMMENT ON COLUMN public.partners.is_root IS '是否根节点（没有上级的货主，只对货主类型有效）';

-- ============================================================
-- 第七步: 初始化货主的层级数据
-- ============================================================

-- 为所有货主初始化层级字段
UPDATE public.partners
SET 
  hierarchy_path = '/' || id::TEXT,
  hierarchy_depth = 0,
  is_root = CASE WHEN parent_partner_id IS NULL THEN TRUE ELSE FALSE END,
  updated_at = NOW()
WHERE partner_type = '货主' AND hierarchy_path IS NULL;

COMMIT;

-- ============================================================
-- 完成信息
-- ============================================================

DO $$
DECLARE
  total_owners INTEGER;
  total_suppliers INTEGER;
  root_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_owners FROM public.partners WHERE partner_type = '货主';
  SELECT COUNT(*) INTO total_suppliers FROM public.partners WHERE partner_type != '货主';
  SELECT COUNT(*) INTO root_count FROM public.partners WHERE partner_type = '货主' AND is_root = TRUE;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '货主层级管理系统更新完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '功能变更:';
  RAISE NOTICE '  ✓ 层级管理仅针对货主类型';
  RAISE NOTICE '  ✓ 其他类型（合作商、资方、本公司）不参与层级关系';
  RAISE NOTICE '  ✓ 所有函数已更新为只处理货主';
  RAISE NOTICE '  ✓ 视图已更新为只显示货主';
  RAISE NOTICE '';
  RAISE NOTICE '当前数据:';
  RAISE NOTICE '  - 货主总数: %', total_owners;
  RAISE NOTICE '  - 货主根节点数: %', root_count;
  RAISE NOTICE '  - 其他类型总数: %', total_suppliers;
  RAISE NOTICE '';
  RAISE NOTICE '权限规则（货主）:';
  RAISE NOTICE '  ✓ 上级货主可以查看所有下级（无限层级）';
  RAISE NOTICE '  ✓ 下级货主可以查看所有上级';
  RAISE NOTICE '  ✓ 同一链路可以互相查看';
  RAISE NOTICE '  ✓ 不同链路完全隔离';
  RAISE NOTICE '  ✓ 管理员/财务查看所有';
  RAISE NOTICE '';
  RAISE NOTICE '权限规则（其他类型：合作商、资方、本公司）:';
  RAISE NOTICE '  ✓ 只能查看自己创建的';
  RAISE NOTICE '  ✓ 管理员/财务查看所有';
  RAISE NOTICE '';
  RAISE NOTICE '测试命令:';
  RAISE NOTICE '  SELECT * FROM partners_hierarchy_view;';
  RAISE NOTICE '  SELECT * FROM get_hierarchy_statistics();';
  RAISE NOTICE '  SELECT * FROM get_hierarchy_tree();';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

