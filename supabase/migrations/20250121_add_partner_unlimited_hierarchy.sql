-- ==========================================
-- 合作方无限层级管理系统
-- ==========================================
-- 创建时间: 2025-01-21
-- 功能: 
--   1. 支持无限层级的合作方结构
--   2. 自动维护层级路径和深度
--   3. RLS权限：上级可以看下级，不同合作方数据隔离
--   4. 不修改现有函数
-- ==========================================

BEGIN;

-- ============================================================
-- 第一步: 添加层级管理字段
-- ============================================================

-- 添加上级合作方字段
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS parent_partner_id UUID 
  REFERENCES public.partners(id) ON DELETE SET NULL;

-- 添加层级路径字段（用于快速查询层级关系）
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS hierarchy_path TEXT;

-- 添加层级深度字段（0=根节点, 1=一级子节点, 2=二级子节点...）
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS hierarchy_depth INTEGER DEFAULT 0;

-- 添加是否根节点标记
ALTER TABLE public.partners 
  ADD COLUMN IF NOT EXISTS is_root BOOLEAN DEFAULT TRUE;

-- 添加更新时间字段（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'partners' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.partners ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- 添加注释
COMMENT ON COLUMN public.partners.parent_partner_id IS '上级合作方ID（NULL表示根节点）';
COMMENT ON COLUMN public.partners.hierarchy_path IS '层级路径（如：/uuid1/uuid2/uuid3）用于快速层级查询';
COMMENT ON COLUMN public.partners.hierarchy_depth IS '层级深度（0=根节点，1=一级，2=二级...）';
COMMENT ON COLUMN public.partners.is_root IS '是否根节点（没有上级的合作方）';

-- ============================================================
-- 第二步: 创建索引
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_partners_parent_partner_id 
  ON public.partners(parent_partner_id);

CREATE INDEX IF NOT EXISTS idx_partners_hierarchy_path 
  ON public.partners USING btree(hierarchy_path);

CREATE INDEX IF NOT EXISTS idx_partners_hierarchy_depth 
  ON public.partners(hierarchy_depth);

CREATE INDEX IF NOT EXISTS idx_partners_is_root 
  ON public.partners(is_root) WHERE is_root = TRUE;

-- ============================================================
-- 第三步: 创建层级计算函数
-- ============================================================

-- 计算层级路径
CREATE OR REPLACE FUNCTION public.calculate_hierarchy_path(partner_id UUID)
RETURNS TEXT AS $$
DECLARE
  path TEXT := '';
  current_id UUID := partner_id;
  parent_id UUID;
  depth_counter INTEGER := 0;
  max_depth INTEGER := 100;  -- 防止无限循环
BEGIN
  -- 向上遍历构建路径
  WHILE current_id IS NOT NULL AND depth_counter < max_depth LOOP
    path := '/' || current_id::TEXT || path;
    
    -- 获取父节点
    SELECT parent_partner_id INTO parent_id
    FROM public.partners
    WHERE id = current_id;
    
    current_id := parent_id;
    depth_counter := depth_counter + 1;
  END LOOP;
  
  IF depth_counter >= max_depth THEN
    RAISE WARNING '合作方 % 的层级深度超过 % 层，可能存在循环引用', partner_id, max_depth;
  END IF;
  
  RETURN path;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_hierarchy_path IS '计算合作方的完整层级路径';

-- 计算层级深度
CREATE OR REPLACE FUNCTION public.calculate_hierarchy_depth(partner_id UUID)
RETURNS INTEGER AS $$
DECLARE
  depth INTEGER := 0;
  current_id UUID := partner_id;
  parent_id UUID;
  depth_counter INTEGER := 0;
  max_depth INTEGER := 100;
BEGIN
  -- 向上遍历计算深度
  WHILE current_id IS NOT NULL AND depth_counter < max_depth LOOP
    SELECT parent_partner_id INTO parent_id
    FROM public.partners
    WHERE id = current_id;
    
    IF parent_id IS NOT NULL THEN
      depth := depth + 1;
      current_id := parent_id;
    ELSE
      current_id := NULL;
    END IF;
    
    depth_counter := depth_counter + 1;
  END LOOP;
  
  RETURN depth;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calculate_hierarchy_depth IS '计算合作方的层级深度';

-- ============================================================
-- 第四步: 创建触发器函数（自动维护层级信息）
-- ============================================================

CREATE OR REPLACE FUNCTION public.maintain_partner_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  new_path TEXT;
  new_depth INTEGER;
  is_root_node BOOLEAN;
BEGIN
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
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.maintain_partner_hierarchy IS '自动维护合作方层级信息的触发器函数';

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_maintain_partner_hierarchy ON public.partners;

CREATE TRIGGER trigger_maintain_partner_hierarchy
  BEFORE INSERT OR UPDATE OF parent_partner_id ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_partner_hierarchy();

COMMENT ON TRIGGER trigger_maintain_partner_hierarchy ON public.partners 
  IS '自动维护合作方层级路径、深度和根节点标记';

-- ============================================================
-- 第五步: 创建辅助查询函数
-- ============================================================

-- 获取所有子孙节点ID（包括所有层级）
CREATE OR REPLACE FUNCTION public.get_all_subordinate_ids(partner_id UUID)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT id 
    FROM public.partners 
    WHERE hierarchy_path LIKE (
      SELECT hierarchy_path || '%' 
      FROM public.partners 
      WHERE id = partner_id
    )
    AND id != partner_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_all_subordinate_ids IS '获取指定合作方的所有子孙节点ID（递归所有层级）';

-- 获取所有祖先节点ID
CREATE OR REPLACE FUNCTION public.get_all_ancestor_ids(partner_id UUID)
RETURNS UUID[] AS $$
DECLARE
  path TEXT;
  ancestor_ids UUID[] := ARRAY[]::UUID[];
  path_parts TEXT[];
  part TEXT;
BEGIN
  -- 获取层级路径
  SELECT hierarchy_path INTO path
  FROM public.partners
  WHERE id = partner_id;
  
  IF path IS NULL THEN
    RETURN ancestor_ids;
  END IF;
  
  -- 解析路径，提取所有UUID
  path_parts := string_to_array(path, '/');
  
  FOREACH part IN ARRAY path_parts
  LOOP
    IF part != '' AND part::UUID != partner_id THEN
      ancestor_ids := array_append(ancestor_ids, part::UUID);
    END IF;
  END LOOP;
  
  RETURN ancestor_ids;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_all_ancestor_ids IS '获取指定合作方的所有祖先节点ID（递归所有层级）';

-- 检查用户是否可以查看目标合作方的数据
CREATE OR REPLACE FUNCTION public.can_view_partner(target_partner_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  current_user_partner_id UUID;
  current_user_role TEXT;
  target_user_id UUID;
  target_path TEXT;
  current_path TEXT;
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
  
  -- 获取目标合作方的创建用户
  SELECT user_id INTO target_user_id
  FROM public.partners
  WHERE id = target_partner_id;
  
  -- 如果是自己创建的，可以查看
  IF target_user_id = current_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- 获取当前用户关联的合作方ID（用户可能关联多个，取第一个）
  SELECT id INTO current_user_partner_id
  FROM public.partners
  WHERE user_id = current_user_id
  ORDER BY is_root DESC, hierarchy_depth ASC
  LIMIT 1;
  
  -- 如果当前用户没有关联的合作方，不能查看
  IF current_user_partner_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- 如果查看的就是自己的合作方，允许
  IF current_user_partner_id = target_partner_id THEN
    RETURN TRUE;
  END IF;
  
  -- 获取两个合作方的层级路径
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

COMMENT ON FUNCTION public.can_view_partner IS '检查当前用户是否可以查看目标合作方的数据';

-- ============================================================
-- 第六步: 创建视图
-- ============================================================

CREATE OR REPLACE VIEW public.partners_hierarchy_view AS
SELECT 
  p.id,
  p.name,
  p.user_id,
  p.full_name,
  p.tax_rate,
  p.parent_partner_id,
  p.hierarchy_path,
  p.hierarchy_depth,
  p.is_root,
  p.created_at,
  p.updated_at,
  parent.name AS parent_name,
  parent.hierarchy_depth AS parent_depth,
  (SELECT COUNT(*) FROM public.partners WHERE parent_partner_id = p.id) AS direct_children_count,
  (SELECT COUNT(*) FROM public.partners WHERE hierarchy_path LIKE p.hierarchy_path || '%' AND id != p.id) AS total_subordinates_count
FROM public.partners p
LEFT JOIN public.partners parent ON p.parent_partner_id = parent.id;

COMMENT ON VIEW public.partners_hierarchy_view IS '合作方层级视图（包含父节点信息和子节点统计）';

-- ============================================================
-- 第七步: 配置 RLS 策略
-- ============================================================

-- 启用 RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "partners_hierarchy_select" ON public.partners;
DROP POLICY IF EXISTS "partners_hierarchy_insert" ON public.partners;
DROP POLICY IF EXISTS "partners_hierarchy_update" ON public.partners;
DROP POLICY IF EXISTS "partners_hierarchy_delete" ON public.partners;

-- 策略1: SELECT - 上级可以看下级，下级可以看上级
CREATE POLICY "partners_hierarchy_select"
  ON public.partners
  FOR SELECT
  USING (
    -- 管理员和财务可以看所有
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'finance')
    )
    OR
    -- 使用权限函数判断
    public.can_view_partner(id)
  );

COMMENT ON POLICY "partners_hierarchy_select" ON public.partners 
  IS 'SELECT策略：管理员/财务查看全部，上级可以看下级，同链路可以互相看';

-- 策略2: INSERT - 只有管理员、财务和操作员可以创建
CREATE POLICY "partners_hierarchy_insert"
  ON public.partners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'finance', 'operator')
    )
  );

COMMENT ON POLICY "partners_hierarchy_insert" ON public.partners 
  IS 'INSERT策略：只有管理员、财务和操作员可以创建';

-- 策略3: UPDATE - 管理员/财务可以更新所有，用户可以更新自己的
CREATE POLICY "partners_hierarchy_update"
  ON public.partners
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'finance')
    )
    OR
    user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'finance')
    )
    OR
    user_id = auth.uid()
  );

COMMENT ON POLICY "partners_hierarchy_update" ON public.partners 
  IS 'UPDATE策略：管理员/财务更新全部，用户更新自己的';

-- 策略4: DELETE - 只有管理员和财务可以删除
CREATE POLICY "partners_hierarchy_delete"
  ON public.partners
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'finance')
    )
  );

COMMENT ON POLICY "partners_hierarchy_delete" ON public.partners 
  IS 'DELETE策略：只有管理员和财务可以删除';

-- ============================================================
-- 第八步: 创建统计和查询函数
-- ============================================================

-- 获取层级统计信息
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
    (SELECT COUNT(*) FROM public.partners)::BIGINT,
    (SELECT COUNT(*) FROM public.partners WHERE is_root = TRUE)::BIGINT,
    (SELECT MAX(hierarchy_depth) FROM public.partners)::INTEGER,
    (SELECT ROUND(AVG(hierarchy_depth), 2) FROM public.partners)::NUMERIC,
    (SELECT COUNT(DISTINCT parent_partner_id) FROM public.partners WHERE parent_partner_id IS NOT NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.partners WHERE NOT EXISTS (SELECT 1 FROM public.partners p2 WHERE p2.parent_partner_id = partners.id))::BIGINT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_hierarchy_statistics IS '获取合作方层级统计信息';

-- 获取完整的层级树（从根节点开始）
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
    (SELECT COUNT(*) FROM public.partners WHERE parent_partner_id = p.id)::BIGINT
  FROM public.partners p
  WHERE 
    CASE 
      WHEN root_id IS NULL THEN TRUE
      ELSE p.hierarchy_path LIKE (SELECT hierarchy_path || '%' FROM public.partners WHERE id = root_id)
    END
  ORDER BY p.hierarchy_path;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_hierarchy_tree IS '获取完整的层级树结构';

-- ============================================================
-- 第九步: 初始化现有数据
-- ============================================================

-- 初始化层级字段（但不设置为根节点）
-- 用户需要手动通过UI或SQL设置哪些合作方是根节点
UPDATE public.partners
SET 
  hierarchy_path = '/' || id::TEXT,
  hierarchy_depth = 0,
  is_root = FALSE,  -- 默认不是根节点，需要用户手动设置
  updated_at = NOW()
WHERE hierarchy_path IS NULL;

-- 说明：初始化后所有合作方都是独立的（parent_partner_id = NULL）
-- 但不自动标记为根节点，需要用户通过以下方式设置：
-- 方式1: 在前端UI点击"设置为根节点"按钮
-- 方式2: 执行 SQL: UPDATE partners SET is_root = TRUE WHERE id = '...';
-- 方式3: 执行 SQL: UPDATE partners SET parent_partner_id = NULL WHERE id = '...'; (触发器会自动设置is_root=TRUE)

COMMIT;

-- ============================================================
-- 完成信息
-- ============================================================

DO $$
DECLARE
  total_count INTEGER;
  root_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.partners;
  SELECT COUNT(*) INTO root_count FROM public.partners WHERE is_root = TRUE;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '合作方无限层级管理系统安装完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '添加的字段:';
  RAISE NOTICE '  - parent_partner_id   (上级合作方)';
  RAISE NOTICE '  - hierarchy_path      (层级路径)';
  RAISE NOTICE '  - hierarchy_depth     (层级深度)';
  RAISE NOTICE '  - is_root             (是否根节点)';
  RAISE NOTICE '';
  RAISE NOTICE '创建的对象:';
  RAISE NOTICE '  - 函数: calculate_hierarchy_path()';
  RAISE NOTICE '  - 函数: calculate_hierarchy_depth()';
  RAISE NOTICE '  - 函数: get_all_subordinate_ids()';
  RAISE NOTICE '  - 函数: get_all_ancestor_ids()';
  RAISE NOTICE '  - 函数: can_view_partner()';
  RAISE NOTICE '  - 函数: get_hierarchy_statistics()';
  RAISE NOTICE '  - 函数: get_hierarchy_tree()';
  RAISE NOTICE '  - 视图: partners_hierarchy_view';
  RAISE NOTICE '  - 触发器: trigger_maintain_partner_hierarchy';
  RAISE NOTICE '  - RLS 策略: 4 个';
  RAISE NOTICE '';
  RAISE NOTICE '当前数据:';
  RAISE NOTICE '  - 总合作方数: %', total_count;
  RAISE NOTICE '  - 根节点数: %', root_count;
  RAISE NOTICE '';
  RAISE NOTICE '权限规则:';
  RAISE NOTICE '  ✓ 上级可以查看所有下级（无限层级）';
  RAISE NOTICE '  ✓ 下级可以查看所有上级';
  RAISE NOTICE '  ✓ 同一链路可以互相查看';
  RAISE NOTICE '  ✓ 不同链路完全隔离';
  RAISE NOTICE '  ✓ 管理员/财务查看所有';
  RAISE NOTICE '';
  RAISE NOTICE '测试命令:';
  RAISE NOTICE '  SELECT * FROM partners_hierarchy_view;';
  RAISE NOTICE '  SELECT * FROM get_hierarchy_statistics();';
  RAISE NOTICE '  SELECT * FROM get_hierarchy_tree();';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

