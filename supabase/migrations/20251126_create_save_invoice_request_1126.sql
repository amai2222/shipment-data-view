-- ==========================================
-- 创建 save_invoice_request_1126 函数
-- ==========================================
-- 创建时间: 2025-11-26
-- 功能: 为前端调用创建 save_invoice_request_1126 函数别名
-- 说明: 前端调用 save_invoice_request_1126，但数据库中只有 save_invoice_request
--       创建此函数作为别名，直接调用 save_invoice_request
-- ==========================================

BEGIN;

-- 创建 save_invoice_request_1126 函数（作为 save_invoice_request 的别名）
CREATE OR REPLACE FUNCTION public.save_invoice_request_1126(p_invoice_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- 直接调用 save_invoice_request 函数
    RETURN public.save_invoice_request(p_invoice_data);
END;
$function$;

COMMENT ON FUNCTION public.save_invoice_request_1126 IS '
保存开票申请函数（1126版本）
- 作为 save_invoice_request 的别名
- 参数和返回值与 save_invoice_request 完全相同
';

COMMIT;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ save_invoice_request_1126 函数已创建';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '函数功能: 作为 save_invoice_request 的别名';
    RAISE NOTICE '参数: p_invoice_data (jsonb)';
    RAISE NOTICE '返回值: jsonb';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

