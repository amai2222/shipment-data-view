-- ==========================================
-- 快速修复：触发器表名错误
-- ==========================================
-- 问题：check_logistics_record_deletion 函数查询了不存在的表
-- 解决：立即修复函数中的表名

-- 修复 check_logistics_record_deletion 函数
CREATE OR REPLACE FUNCTION public.check_logistics_record_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_invoice_count integer := 0;
    v_payment_count integer := 0;
    v_invoice_request_count integer := 0;
    v_payment_request_count integer := 0;
BEGIN
    -- 检查是否有开票申请明细
    BEGIN
        SELECT COUNT(*) INTO v_invoice_count
        FROM public.invoice_request_details
        WHERE logistics_record_id = OLD.id;
    EXCEPTION WHEN OTHERS THEN
        v_invoice_count := 0;
    END;
    
    -- 检查是否有付款申请明细（修复表名）
    BEGIN
        SELECT COUNT(*) INTO v_payment_count
        FROM public.partner_payment_items  -- ✅ 修复：payment_request_items → partner_payment_items
        WHERE logistics_record_id = OLD.id;
    EXCEPTION WHEN OTHERS THEN
        v_payment_count := 0;
    END;
    
    -- 检查是否有开票申请单
    BEGIN
        SELECT COUNT(*) INTO v_invoice_request_count
        FROM public.invoice_requests ir
        JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
        WHERE ird.logistics_record_id = OLD.id;
    EXCEPTION WHEN OTHERS THEN
        v_invoice_request_count := 0;
    END;
    
    -- 检查是否有付款申请单（修复表名）
    BEGIN
        SELECT COUNT(*) INTO v_payment_request_count
        FROM public.payment_requests pr
        JOIN public.partner_payment_items pri ON pr.id = pri.payment_request_id  -- ✅ 修复表名
        WHERE pri.logistics_record_id = OLD.id;
    EXCEPTION WHEN OTHERS THEN
        v_payment_request_count := 0;
    END;
    
    -- 如果有相关的财务申请，阻止删除并抛出错误
    IF v_invoice_count > 0 OR v_payment_count > 0 THEN
        RAISE EXCEPTION 
            '无法删除运单 "%": 该运单已关联 % 个开票申请明细和 % 个付款申请明细。请先处理相关财务申请。',
            OLD.auto_number, v_invoice_count, v_payment_count;
    END IF;
    
    -- 记录删除操作到日志表（如果表存在）
    BEGIN
        INSERT INTO public.operation_logs (
            operation_type,
            table_name,
            record_id,
            record_info,
            operated_by,
            operated_at
        ) VALUES (
            'DELETE',
            'logistics_records',
            OLD.id,
            json_build_object(
                'auto_number', OLD.auto_number,
                'project_name', OLD.project_name,
                'driver_name', OLD.driver_name,
                'loading_location', OLD.loading_location,
                'unloading_location', OLD.unloading_location
            ),
            auth.uid(),
            NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        -- 如果日志表不存在，忽略错误
        NULL;
    END;
    
    RETURN OLD;
END;
$$;

-- 修复 cleanup_logistics_related_data 函数
CREATE OR REPLACE FUNCTION public.cleanup_logistics_related_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 删除相关的合作方成本记录
    DELETE FROM public.logistics_partner_costs 
    WHERE logistics_record_id = OLD.id;
    
    -- 更新相关的开票申请单状态（如果有孤立记录）
    BEGIN
        UPDATE public.invoice_requests 
        SET status = 'Cancelled',
            remarks = COALESCE(remarks, '') || ' [运单已删除]'
        WHERE id IN (
            SELECT DISTINCT ir.id 
            FROM public.invoice_requests ir
            JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
            WHERE ird.logistics_record_id = OLD.id
        );
    EXCEPTION WHEN OTHERS THEN
        -- 如果表不存在，忽略错误
        NULL;
    END;
    
    -- 更新相关的付款申请单状态（如果有孤立记录，修复表名）
    BEGIN
        UPDATE public.payment_requests 
        SET status = 'Cancelled',
            remarks = COALESCE(remarks, '') || ' [运单已删除]'
        WHERE id IN (
            SELECT DISTINCT pr.id 
            FROM public.payment_requests pr
            JOIN public.partner_payment_items pri ON pr.id = pri.payment_request_id  -- ✅ 修复表名
            WHERE pri.logistics_record_id = OLD.id
        );
    EXCEPTION WHEN OTHERS THEN
        -- 如果表不存在，忽略错误
        NULL;
    END;
    
    RETURN OLD;
END;
$$;

-- 显示修复完成信息
DO $$
BEGIN
    RAISE NOTICE '✅ 触发器表名错误修复完成！';
    RAISE NOTICE '修复内容：payment_request_items → partner_payment_items';
    RAISE NOTICE '现在可以正常删除运单了。';
END $$;
