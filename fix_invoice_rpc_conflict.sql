-- 修复开票申请RPC函数冲突 - 通过重命名避免冲突
-- 请在Supabase SQL编辑器中执行以下命令

-- 创建新的重命名函数，避免与现有函数冲突
CREATE OR REPLACE FUNCTION public.get_invoice_request_data_latest(
    p_project_id uuid DEFAULT NULL::uuid,
    p_start_date date DEFAULT NULL::date,
    p_end_date date DEFAULT NULL::date,
    p_partner_id uuid DEFAULT NULL::uuid,
    p_invoice_status_array text[] DEFAULT NULL::text[],
    p_page_size integer DEFAULT 50,
    p_page_number integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN public.get_invoice_request_data(
        p_project_id,
        p_start_date,
        p_end_date,
        p_partner_id,
        p_invoice_status_array,
        p_page_size,
        p_page_number
    );
END;
$function$;
