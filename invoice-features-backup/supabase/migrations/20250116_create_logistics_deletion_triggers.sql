-- 创建运单删除触发器，自动处理相关记录
-- 文件: supabase/migrations/20250116_create_logistics_deletion_triggers.sql

-- 1. 创建运单删除前的检查函数
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
    SELECT COUNT(*) INTO v_invoice_count
    FROM public.invoice_request_details
    WHERE logistics_record_id = OLD.id;
    
    -- 检查是否有付款申请明细
    SELECT COUNT(*) INTO v_payment_count
    FROM public.payment_request_items
    WHERE logistics_record_id = OLD.id;
    
    -- 检查是否有开票申请单
    SELECT COUNT(*) INTO v_invoice_request_count
    FROM public.invoice_requests ir
    JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
    WHERE ird.logistics_record_id = OLD.id;
    
    -- 检查是否有付款申请单
    SELECT COUNT(*) INTO v_payment_request_count
    FROM public.payment_requests pr
    JOIN public.payment_request_items pri ON pr.id = pri.payment_request_id
    WHERE pri.logistics_record_id = OLD.id;
    
    -- 如果有相关的财务申请，阻止删除并抛出错误
    IF v_invoice_count > 0 OR v_payment_count > 0 THEN
        RAISE EXCEPTION 
            '无法删除运单 "%": 该运单已关联 % 个开票申请明细和 % 个付款申请明细。请先处理相关财务申请。',
            OLD.auto_number, v_invoice_count, v_payment_count;
    END IF;
    
    -- 记录删除操作到日志表（可选）
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
    
    RETURN OLD;
END;
$$;

-- 2. 创建运单删除后的清理函数
CREATE OR REPLACE FUNCTION public.cleanup_logistics_related_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- 删除相关的合作方成本记录（这些应该通过外键CASCADE自动删除，但为了确保）
    DELETE FROM public.logistics_partner_costs 
    WHERE logistics_record_id = OLD.id;
    
    -- 更新相关的开票申请单状态（如果有孤立记录）
    UPDATE public.invoice_requests 
    SET status = 'Cancelled',
        remarks = COALESCE(remarks, '') || ' [运单已删除]'
    WHERE id IN (
        SELECT DISTINCT ir.id 
        FROM public.invoice_requests ir
        JOIN public.invoice_request_details ird ON ir.id = ird.invoice_request_id
        WHERE ird.logistics_record_id = OLD.id
    );
    
    -- 更新相关的付款申请单状态（如果有孤立记录）
    UPDATE public.payment_requests 
    SET status = 'Cancelled',
        remarks = COALESCE(remarks, '') || ' [运单已删除]'
    WHERE id IN (
        SELECT DISTINCT pr.id 
        FROM public.payment_requests pr
        JOIN public.payment_request_items pri ON pr.id = pri.payment_request_id
        WHERE pri.logistics_record_id = OLD.id
    );
    
    RETURN OLD;
END;
$$;

-- 3. 创建操作日志表（如果不存在）
CREATE TABLE IF NOT EXISTS public.operation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    operation_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    table_name TEXT NOT NULL,
    record_id UUID,
    record_info JSONB,
    operated_by UUID REFERENCES public.profiles(id),
    operated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. 为操作日志表创建索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_table_record 
ON public.operation_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operated_by 
ON public.operation_logs(operated_by);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operated_at 
ON public.operation_logs(operated_at);

-- 5. 创建触发器
-- 删除前检查触发器
DROP TRIGGER IF EXISTS check_logistics_deletion_trigger ON public.logistics_records;
CREATE TRIGGER check_logistics_deletion_trigger
    BEFORE DELETE ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.check_logistics_record_deletion();

-- 删除后清理触发器
DROP TRIGGER IF EXISTS cleanup_logistics_related_trigger ON public.logistics_records;
CREATE TRIGGER cleanup_logistics_related_trigger
    AFTER DELETE ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_logistics_related_data();

-- 6. 创建新的安全删除运单函数（不修改原有函数）
CREATE OR REPLACE FUNCTION public.safe_delete_logistics_records_v2(
    p_record_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_record_id UUID;
    v_auto_number TEXT;
    v_deleted_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_failed_records TEXT[] := '{}';
    v_result JSON;
BEGIN
    -- 检查权限
    IF NOT public.is_admin_or_operator() THEN
        RAISE EXCEPTION '权限不足：只有管理员或操作员可以删除运单';
    END IF;
    
    -- 逐个删除运单记录
    FOREACH v_record_id IN ARRAY p_record_ids
    LOOP
        BEGIN
            -- 获取运单号用于错误报告
            SELECT auto_number INTO v_auto_number
            FROM public.logistics_records
            WHERE id = v_record_id;
            
            -- 删除运单记录（触发器会自动处理相关数据）
            DELETE FROM public.logistics_records 
            WHERE id = v_record_id;
            
            v_deleted_count := v_deleted_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_failed_count := v_failed_count + 1;
            v_failed_records := v_failed_records || v_auto_number;
            
            -- 记录错误但不中断整个操作
            INSERT INTO public.operation_logs (
                operation_type,
                table_name,
                record_id,
                record_info,
                operated_by,
                operated_at
            ) VALUES (
                'DELETE_FAILED',
                'logistics_records',
                v_record_id,
                json_build_object(
                    'auto_number', v_auto_number,
                    'error_message', SQLERRM
                ),
                auth.uid(),
                NOW()
            );
        END;
    END LOOP;
    
    -- 返回结果
    v_result := json_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'failed_count', v_failed_count,
        'failed_records', v_failed_records,
        'message', format('成功删除 %s 条运单记录，%s 条删除失败', v_deleted_count, v_failed_count)
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '批量删除运单失败: ' || SQLERRM
    );
END;
$$;

-- 7. 创建新的按项目删除运单函数（不修改原有函数）
CREATE OR REPLACE FUNCTION public.safe_delete_logistics_records_by_project_v2(
    p_project_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_record_ids UUID[];
    v_result JSON;
BEGIN
    -- 检查权限
    IF NOT public.is_admin_or_operator() THEN
        RAISE EXCEPTION '权限不足：只有管理员或操作员可以删除运单';
    END IF;
    
    -- 获取项目下的所有运单ID
    SELECT ARRAY_AGG(id) INTO v_record_ids
    FROM public.logistics_records
    WHERE project_name = p_project_name;
    
    -- 如果没有运单记录
    IF v_record_ids IS NULL OR array_length(v_record_ids, 1) = 0 THEN
        RETURN json_build_object(
            'success', true,
            'deleted_count', 0,
            'message', '该项目下没有运单记录'
        );
    END IF;
    
    -- 调用新的批量删除函数
    SELECT public.safe_delete_logistics_records_v2(v_record_ids) INTO v_result;
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'message', '按项目删除运单失败: ' || SQLERRM
    );
END;
$$;

-- 8. 添加函数注释
COMMENT ON FUNCTION public.check_logistics_record_deletion() IS '运单删除前检查函数：确保没有关联的财务申请';
COMMENT ON FUNCTION public.cleanup_logistics_related_data() IS '运单删除后清理函数：处理相关数据';
COMMENT ON FUNCTION public.safe_delete_logistics_records_v2(UUID[]) IS '新的安全批量删除运单函数：带错误处理和触发器支持';
COMMENT ON FUNCTION public.safe_delete_logistics_records_by_project_v2(TEXT) IS '新的按项目安全删除运单函数：带错误处理和触发器支持';

-- 9. 启用RLS
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;

-- 10. 创建RLS策略
CREATE POLICY "operation_logs_select_policy" ON public.operation_logs
    FOR SELECT USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'finance', 'operator')
        )
    );

CREATE POLICY "operation_logs_insert_policy" ON public.operation_logs
    FOR INSERT WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'finance', 'operator')
        )
    );
