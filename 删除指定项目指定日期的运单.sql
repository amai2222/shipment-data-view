-- ============================================================================
-- 安全删除指定项目指定日期范围的运单
-- 
-- 功能：安全删除指定项目、指定装货日期范围的所有运单记录
-- 特点：
--   1. 使用变量，方便修改项目名称和日期范围
--   2. 支持多种日期筛选方式：
--      - 单个日期：p_start_date 和 p_end_date 设为相同值
--      - 日期范围：p_start_date <= 装货日期 <= p_end_date
--      - 大于等于：只设置 p_start_date，p_end_date 设为 NULL
--      - 小于等于：只设置 p_end_date，p_start_date 设为 NULL
--   3. 包含安全检查（检查付款/发票状态、关联数据）
--   4. 事务性删除（先删除关联数据，再删除主记录）
--   5. 删除后验证
--
-- 使用方法：
--   1. 修改下面的 p_project_name 变量为要删除的项目名称
--   2. 修改 p_start_date 和 p_end_date 变量设置日期范围
--      - 删除大于等于某个日期：设置 p_start_date，p_end_date 设为 NULL
--      - 删除小于等于某个日期：设置 p_end_date，p_start_date 设为 NULL
--      - 删除日期范围：同时设置 p_start_date 和 p_end_date
--      - 删除单个日期：p_start_date 和 p_end_date 设为相同值
--   3. 执行整个脚本
-- ============================================================================

DO $$
DECLARE
    -- ========== 请在这里修改要删除的项目和日期范围 ==========
    p_project_name TEXT := '天兴芦花';  -- 修改为要删除的项目名称
    p_start_date DATE := '2025-11-29';  -- 开始日期（大于等于，格式：YYYY-MM-DD），设为 NULL 表示不限制开始日期
    p_end_date DATE := NULL;  -- 结束日期（小于等于，格式：YYYY-MM-DD），设为 NULL 表示不限制结束日期
    -- ===================================================
    
    -- 内部变量
    v_project_id UUID;
    v_target_record_ids UUID[];
    v_target_count INTEGER;
    v_deleted_count INTEGER;
    v_has_payment_requests BOOLEAN;
    v_has_invoice_requests BOOLEAN;
    v_payment_request_count INTEGER;
    v_invoice_request_count INTEGER;
    v_deleted_costs_count INTEGER;
BEGIN
    -- ========== 第1步：预查询 - 查看将要删除的记录 ==========
    RAISE NOTICE '========== 预查询：查找符合条件的运单 ==========';
    
    -- 查找项目ID
    SELECT id INTO v_project_id
    FROM public.projects
    WHERE name = p_project_name;
    
    IF v_project_id IS NULL THEN
        RAISE EXCEPTION '错误：找不到项目 "%"', p_project_name;
    END IF;
    
    RAISE NOTICE '项目ID: %', v_project_id;
    
    -- 构建日期筛选条件
    -- 查找符合条件的运单ID
    SELECT array_agg(id), count(*)
    INTO v_target_record_ids, v_target_count
    FROM public.logistics_records
    WHERE project_id = v_project_id
      AND (p_start_date IS NULL OR loading_date::date >= p_start_date)
      AND (p_end_date IS NULL OR loading_date::date <= p_end_date);
    
    IF v_target_record_ids IS NULL OR array_length(v_target_record_ids, 1) = 0 THEN
        RAISE NOTICE '未找到符合条件的运单记录';
        RAISE NOTICE '项目: %', p_project_name;
        IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
            RAISE NOTICE '日期范围: % 至 %', p_start_date, p_end_date;
        ELSIF p_start_date IS NOT NULL THEN
            RAISE NOTICE '日期条件: >= %', p_start_date;
        ELSIF p_end_date IS NOT NULL THEN
            RAISE NOTICE '日期条件: <= %', p_end_date;
        ELSE
            RAISE NOTICE '日期条件: 无限制（将删除该项目所有运单）';
        END IF;
        RETURN;
    END IF;
    
    RAISE NOTICE '找到 % 条符合条件的运单记录', v_target_count;
    RAISE NOTICE '运单ID列表: %', v_target_record_ids;
    
    -- ========== 第2步：安全检查 ==========
    RAISE NOTICE '========== 安全检查 ==========';
    
    -- 检查是否有关联的付款申请（只检查未完成的申请：pending 或 processing）
    SELECT EXISTS(
        SELECT 1
        FROM public.payment_requests
        WHERE logistics_record_ids && v_target_record_ids
          AND status IN ('pending', 'processing')
    ) INTO v_has_payment_requests;
    
    IF v_has_payment_requests THEN
        SELECT count(*) INTO v_payment_request_count
        FROM public.payment_requests
        WHERE logistics_record_ids && v_target_record_ids
          AND status IN ('pending', 'processing');
        
        RAISE EXCEPTION '安全阻止：有 % 条未完成付款的申请关联到这些运单，无法删除！请先处理付款申请。', v_payment_request_count;
    END IF;
    
    -- 检查是否有关联的开票申请（通过 invoice_request_details 表关联，只检查未完成的申请）
    SELECT EXISTS(
        SELECT 1
        FROM public.invoice_requests ir
        INNER JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
        WHERE ird.logistics_record_id = ANY(v_target_record_ids)
          AND ir.status IN ('Pending', 'Processing', 'Approved')
    ) INTO v_has_invoice_requests;
    
    IF v_has_invoice_requests THEN
        SELECT count(DISTINCT ir.id) INTO v_invoice_request_count
        FROM public.invoice_requests ir
        INNER JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
        WHERE ird.logistics_record_id = ANY(v_target_record_ids)
          AND ir.status IN ('Pending', 'Processing', 'Approved');
        
        RAISE EXCEPTION '安全阻止：有 % 条未完成开票的申请关联到这些运单，无法删除！请先处理开票申请。', v_invoice_request_count;
    END IF;
    
    RAISE NOTICE '安全检查通过：没有未完成的付款或开票申请';
    
    -- ========== 第3步：删除关联数据 ==========
    RAISE NOTICE '========== 开始删除关联数据 ==========';
    
    -- 注意：external_tracking_numbers 是 logistics_records 表的列（text[]类型），
    -- 不是独立表，删除主记录时会自动删除，无需单独处理
    
    -- 删除合作方成本记录
    WITH deleted AS (
        DELETE FROM public.logistics_partner_costs
        WHERE logistics_record_id = ANY(v_target_record_ids)
        RETURNING 1
    )
    SELECT count(*) INTO v_deleted_costs_count FROM deleted;
    
    RAISE NOTICE '已删除 % 条合作方成本记录', v_deleted_costs_count;
    
    -- ========== 第4步：删除主运单记录 ==========
    RAISE NOTICE '========== 开始删除运单记录 ==========';
    
    WITH deleted AS (
        DELETE FROM public.logistics_records
        WHERE id = ANY(v_target_record_ids)
        RETURNING 1
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;
    
    RAISE NOTICE '已删除 % 条运单记录', v_deleted_count;
    
    -- ========== 第5步：删除后验证 ==========
    RAISE NOTICE '========== 删除后验证 ==========';
    
    SELECT count(*) INTO v_target_count
    FROM public.logistics_records
    WHERE project_id = v_project_id
      AND (p_start_date IS NULL OR loading_date::date >= p_start_date)
      AND (p_end_date IS NULL OR loading_date::date <= p_end_date);
    
    IF v_target_count > 0 THEN
        RAISE WARNING '警告：仍有 % 条记录未删除，请检查！', v_target_count;
    ELSE
        RAISE NOTICE '验证通过：所有符合条件的运单记录已成功删除';
    END IF;
    
    -- ========== 第6步：输出删除摘要 ==========
    RAISE NOTICE '========== 删除摘要 ==========';
    RAISE NOTICE '项目名称: %', p_project_name;
    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
        RAISE NOTICE '日期范围: % 至 %', p_start_date, p_end_date;
    ELSIF p_start_date IS NOT NULL THEN
        RAISE NOTICE '日期条件: >= %', p_start_date;
    ELSIF p_end_date IS NOT NULL THEN
        RAISE NOTICE '日期条件: <= %', p_end_date;
    ELSE
        RAISE NOTICE '日期条件: 无限制（已删除该项目所有运单）';
    END IF;
    RAISE NOTICE '删除的运单记录数: %', v_deleted_count;
    RAISE NOTICE '删除的合作方成本记录数: %', v_deleted_costs_count;
    RAISE NOTICE '注意：external_tracking_numbers 是运单表的列，已随主记录删除';
    RAISE NOTICE '========== 删除完成 ==========';
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '删除过程中发生错误: %', SQLERRM;
END $$;

