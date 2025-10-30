-- 合作方名称双向同步解决方案（修复版）
-- 创建时间: 2025-01-22
-- 功能: 实现partners表和partner_bank_details表之间full_name字段的双向同步

-- ============================================================
-- 第一步: 检查当前状态
-- ============================================================

-- 检查现有触发器
SELECT 
    '现有触发器检查' as step,
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
AND event_object_table IN ('partners', 'partner_bank_details')
ORDER BY event_object_table, trigger_name;

-- 检查数据不一致情况
SELECT 
    '数据不一致检查' as step,
    p.id,
    p.name,
    p.full_name as partners_full_name,
    pbd.full_name as bank_full_name,
    CASE 
        WHEN p.full_name IS DISTINCT FROM pbd.full_name THEN '不一致'
        ELSE '一致'
    END as status
FROM public.partners p
LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
WHERE pbd.partner_id IS NOT NULL
ORDER BY p.name;

-- ============================================================
-- 第二步: 创建双向同步触发器函数
-- ============================================================

-- 2.1 创建partners表更新时同步到partner_bank_details的函数
CREATE OR REPLACE FUNCTION public.sync_partner_to_bank_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 当partners表的full_name更新时，同步到partner_bank_details
    IF TG_OP = 'UPDATE' AND OLD.full_name IS DISTINCT FROM NEW.full_name THEN
        -- 更新partner_bank_details表的full_name
        UPDATE public.partner_bank_details 
        SET full_name = NEW.full_name,
            updated_at = NOW()
        WHERE partner_bank_details.partner_id = NEW.id;
        
        RAISE NOTICE '已同步partners.full_name到partner_bank_details: % -> %', OLD.full_name, NEW.full_name;
    ELSIF TG_OP = 'INSERT' AND NEW.full_name IS NOT NULL THEN
        -- 新增合作方时，如果full_name不为空，同步到partner_bank_details
        UPDATE public.partner_bank_details 
        SET full_name = NEW.full_name,
            updated_at = NOW()
        WHERE partner_bank_details.partner_id = NEW.id;
        
        RAISE NOTICE '已同步新增partners.full_name到partner_bank_details: %', NEW.full_name;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2.2 创建partner_bank_details表更新时同步到partners的函数
CREATE OR REPLACE FUNCTION public.sync_bank_details_to_partner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 当partner_bank_details表的full_name更新时，同步到partners
    IF TG_OP = 'UPDATE' AND OLD.full_name IS DISTINCT FROM NEW.full_name THEN
        -- 更新partners表的full_name
        UPDATE public.partners 
        SET full_name = NEW.full_name
        WHERE partners.id = NEW.partner_id;
        
        RAISE NOTICE '已同步partner_bank_details.full_name到partners: % -> %', OLD.full_name, NEW.full_name;
    ELSIF TG_OP = 'INSERT' AND NEW.full_name IS NOT NULL THEN
        -- 新增银行详情时，如果full_name不为空，同步到partners
        UPDATE public.partners 
        SET full_name = NEW.full_name
        WHERE partners.id = NEW.partner_id;
        
        RAISE NOTICE '已同步新增partner_bank_details.full_name到partners: %', NEW.full_name;
    END IF;
    
    RETURN NEW;
END;
$$;

-- ============================================================
-- 第三步: 创建触发器
-- ============================================================

-- 3.1 删除可能存在的旧触发器
DROP TRIGGER IF EXISTS trigger_sync_partner_to_bank_details ON public.partners;
DROP TRIGGER IF EXISTS trigger_sync_bank_details_to_partner ON public.partner_bank_details;

-- 3.2 创建partners表的触发器
CREATE TRIGGER trigger_sync_partner_to_bank_details
    AFTER INSERT OR UPDATE OF full_name ON public.partners
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_partner_to_bank_details();

-- 3.3 创建partner_bank_details表的触发器
CREATE TRIGGER trigger_sync_bank_details_to_partner
    AFTER INSERT OR UPDATE OF full_name ON public.partner_bank_details
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_bank_details_to_partner();

-- ============================================================
-- 第四步: 创建数据一致性检查函数
-- ============================================================

-- 4.1 创建数据一致性检查函数
CREATE OR REPLACE FUNCTION public.check_partner_name_consistency()
RETURNS TABLE (
    partner_id UUID,
    partner_name TEXT,
    partners_full_name TEXT,
    bank_details_full_name TEXT,
    is_consistent BOOLEAN,
    issue_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.full_name,
        pbd.full_name,
        (p.full_name = pbd.full_name OR (p.full_name IS NULL AND pbd.full_name IS NULL)),
        CASE 
            WHEN p.full_name IS DISTINCT FROM pbd.full_name THEN 'partners.full_name与partner_bank_details.full_name不一致'
            WHEN p.name IS NULL OR p.name = '' THEN 'partners.name为空'
            ELSE '数据一致'
        END
    FROM public.partners p
    LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
    WHERE pbd.partner_id IS NOT NULL; -- 只检查有银行详情的合作方
END;
$$;

-- ============================================================
-- 第五步: 创建简化的数据修复函数
-- ============================================================

-- 5.1 创建简化的数据修复函数
CREATE OR REPLACE FUNCTION public.fix_partner_name_consistency_simple()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_total_count INTEGER := 0;
BEGIN
    -- 统计总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.partners p
    JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id;
    
    -- 修复partners.full_name不为空但partner_bank_details.full_name为空或不一致的情况
    UPDATE public.partner_bank_details 
    SET full_name = p.full_name,
        updated_at = NOW()
    FROM public.partners p
    WHERE partner_bank_details.partner_id = p.id
    AND p.full_name IS NOT NULL 
    AND p.full_name != ''
    AND (partner_bank_details.full_name IS NULL 
         OR partner_bank_details.full_name != p.full_name);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RETURN '已修复 ' || v_updated_count || ' 条记录，总计 ' || v_total_count || ' 条记录';
END;
$$;

-- ============================================================
-- 第六步: 创建手动同步函数
-- ============================================================

-- 6.1 创建手动同步单个合作方的函数
CREATE OR REPLACE FUNCTION public.sync_partner_names_manual(p_partner_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_partners_full_name TEXT;
    v_bank_full_name TEXT;
    v_result JSON;
BEGIN
    -- 获取两个表的full_name
    SELECT p.full_name, pbd.full_name
    INTO v_partners_full_name, v_bank_full_name
    FROM public.partners p
    LEFT JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
    WHERE p.id = p_partner_id;
    
    IF v_partners_full_name IS NULL AND v_bank_full_name IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'message', '合作方不存在或两个表的full_name都为空'
        );
    END IF;
    
    -- 优先使用partners表的full_name
    IF v_partners_full_name IS NOT NULL AND v_partners_full_name != '' THEN
        -- 更新partner_bank_details
        UPDATE public.partner_bank_details 
        SET full_name = v_partners_full_name,
            updated_at = NOW()
        WHERE partner_bank_details.partner_id = p_partner_id;
        
        v_result := json_build_object(
            'success', true,
            'message', '已同步partners.full_name到partner_bank_details',
            'partners_full_name', v_partners_full_name,
            'bank_full_name', v_partners_full_name
        );
    ELSIF v_bank_full_name IS NOT NULL AND v_bank_full_name != '' THEN
        -- 更新partners
        UPDATE public.partners 
        SET full_name = v_bank_full_name
        WHERE partners.id = p_partner_id;
        
        v_result := json_build_object(
            'success', true,
            'message', '已同步partner_bank_details.full_name到partners',
            'partners_full_name', v_bank_full_name,
            'bank_full_name', v_bank_full_name
        );
    END IF;
    
    RETURN v_result;
END;
$$;

-- 6.2 创建批量同步所有合作方的函数
CREATE OR REPLACE FUNCTION public.sync_all_partner_names()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_count INTEGER := 0;
    v_updated_count INTEGER := 0;
    v_result JSON;
BEGIN
    -- 统计总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.partners p
    JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id;
    
    -- 批量同步：优先使用partners表的full_name
    UPDATE public.partner_bank_details 
    SET full_name = p.full_name,
        updated_at = NOW()
    FROM public.partners p
    WHERE partner_bank_details.partner_id = p.id
    AND p.full_name IS NOT NULL 
    AND p.full_name != ''
    AND (partner_bank_details.full_name IS NULL 
         OR partner_bank_details.full_name != p.full_name);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    v_result := json_build_object(
        'success', true,
        'message', '批量同步完成',
        'total_count', v_total_count,
        'updated_count', v_updated_count
    );
    
    RETURN v_result;
END;
$$;

-- ============================================================
-- 第七步: 执行初始数据修复
-- ============================================================

-- 7.1 检查数据一致性
SELECT 
    '数据一致性检查结果' as step,
    COUNT(*) as total_records,
    COUNT(CASE WHEN is_consistent THEN 1 END) as consistent_count,
    COUNT(CASE WHEN NOT is_consistent THEN 1 END) as inconsistent_count
FROM public.check_partner_name_consistency();

-- 7.2 显示不一致的记录
SELECT 
    '不一致记录详情' as step,
    partner_id,
    partner_name,
    partners_full_name,
    bank_details_full_name,
    issue_description
FROM public.check_partner_name_consistency()
WHERE NOT is_consistent;

-- 7.3 执行数据修复
SELECT 
    '数据修复结果' as step,
    public.fix_partner_name_consistency_simple() as result;

-- ============================================================
-- 第八步: 测试触发器
-- ============================================================

-- 8.1 测试partners表更新触发
-- 选择一个有银行详情的合作方进行测试
DO $$
DECLARE
    v_test_partner_id UUID;
    v_old_name TEXT;
    v_new_name TEXT;
BEGIN
    -- 获取一个测试合作方
    SELECT p.id, p.full_name
    INTO v_test_partner_id, v_old_name
    FROM public.partners p
    JOIN public.partner_bank_details pbd ON p.id = pbd.partner_id
    LIMIT 1;
    
    IF v_test_partner_id IS NOT NULL THEN
        v_new_name := COALESCE(v_old_name, '测试名称') || '_测试_' || EXTRACT(EPOCH FROM NOW())::TEXT;
        
        -- 更新partners表的full_name
        UPDATE public.partners 
        SET full_name = v_new_name
        WHERE partners.id = v_test_partner_id;
        
        RAISE NOTICE '测试完成：partners.full_name已更新为: %', v_new_name;
    ELSE
        RAISE NOTICE '没有找到测试合作方';
    END IF;
END;
$$;

-- ============================================================
-- 第九步: 添加注释和完成
-- ============================================================

-- 添加函数注释
COMMENT ON FUNCTION public.sync_partner_to_bank_details IS 'partners表更新时同步full_name到partner_bank_details表';
COMMENT ON FUNCTION public.sync_bank_details_to_partner IS 'partner_bank_details表更新时同步full_name到partners表';
COMMENT ON FUNCTION public.check_partner_name_consistency IS '检查partners和partner_bank_details表full_name字段一致性';
COMMENT ON FUNCTION public.fix_partner_name_consistency_simple IS '修复partners和partner_bank_details表full_name字段不一致问题（简化版）';
COMMENT ON FUNCTION public.sync_partner_names_manual IS '手动同步单个合作方的full_name字段';
COMMENT ON FUNCTION public.sync_all_partner_names IS '批量同步所有合作方的full_name字段';

-- 添加触发器注释
COMMENT ON TRIGGER trigger_sync_partner_to_bank_details ON public.partners 
    IS 'partners表full_name字段更新时自动同步到partner_bank_details表';
COMMENT ON TRIGGER trigger_sync_bank_details_to_partner ON public.partner_bank_details 
    IS 'partner_bank_details表full_name字段更新时自动同步到partners表';

-- ============================================================
-- 第十步: 使用说明
-- ============================================================

SELECT 
    '=== 合作方名称双向同步方案完成 ===' as summary,
    '✅ 已创建双向同步触发器' as feature_1,
    '✅ 已创建数据一致性检查函数' as feature_2,
    '✅ 已创建数据修复函数' as feature_3,
    '✅ 已创建手动同步函数' as feature_4,
    '✅ 已执行初始数据修复' as feature_5;

SELECT 
    '=== 使用方法 ===' as usage,
    '1. 自动同步：修改任一表的full_name会自动同步到另一表' as usage_1,
    '2. 检查一致性：SELECT * FROM check_partner_name_consistency()' as usage_2,
    '3. 修复数据：SELECT fix_partner_name_consistency_simple()' as usage_3,
    '4. 手动同步：SELECT sync_partner_names_manual(''合作方ID'')' as usage_4,
    '5. 批量同步：SELECT sync_all_partner_names()' as usage_5;
