-- 刷新所有 _1126 后缀函数的 schema cache
-- 日期：2025-11-25
-- 目的：确保所有 _1126 函数都被注册到 Supabase 的 schema cache 中
-- 说明：通过查询每个函数来触发 schema cache 注册

-- ============================================================================
-- 付款相关函数
-- ============================================================================

DO $$
BEGIN
    -- 1. cancel_payment_request_1126(p_request_id text)
    BEGIN
        PERFORM public.cancel_payment_request_1126(''::text);
    EXCEPTION WHEN OTHERS THEN
        NULL; -- 忽略错误，这只是为了刷新 cache
    END;

    -- 2. rollback_payment_request_approval_1126(p_request_id text)
    BEGIN
        PERFORM public.rollback_payment_request_approval_1126(''::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 3. batch_rollback_payment_approval_1126(p_request_ids text[])
    BEGIN
        PERFORM public.batch_rollback_payment_approval_1126(ARRAY[]::text[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 4. pay_payment_request_1126(p_request_id text)
    BEGIN
        PERFORM public.pay_payment_request_1126(''::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 5. batch_pay_payment_requests_1126(p_request_ids text[])
    BEGIN
        PERFORM public.batch_pay_payment_requests_1126(ARRAY[]::text[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 6. reconcile_partner_costs_batch_1126(p_record_ids uuid[], p_reconciliation_date date DEFAULT NULL)
    BEGIN
        PERFORM public.reconcile_partner_costs_batch_1126(ARRAY[]::uuid[], NULL::date);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 7. process_payment_application_1126(p_record_ids uuid[])
    BEGIN
        PERFORM public.process_payment_application_1126(ARRAY[]::uuid[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 8. void_and_delete_payment_requests_1126(p_request_ids text[])
    BEGIN
        PERFORM public.void_and_delete_payment_requests_1126(ARRAY[]::text[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 9. void_payment_for_request_1126(p_request_id text, p_cancel_reason text DEFAULT NULL)
    BEGIN
        PERFORM public.void_payment_for_request_1126(''::text, NULL::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 10. batch_approve_payment_requests_1126(p_request_ids text[])
    BEGIN
        PERFORM public.batch_approve_payment_requests_1126(ARRAY[]::text[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- ============================================================================
-- 开票相关函数
-- ============================================================================

DO $$
BEGIN
    -- 11. approve_invoice_request_v2_1126(p_request_number text)
    BEGIN
        PERFORM public.approve_invoice_request_v2_1126(''::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 12. batch_approve_invoice_requests_1126(p_request_numbers text[])
    BEGIN
        PERFORM public.batch_approve_invoice_requests_1126(ARRAY[]::text[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 13. complete_invoice_request_v2_1126(p_request_number text, p_invoice_number text DEFAULT NULL, p_invoice_date date DEFAULT NULL)
    BEGIN
        PERFORM public.complete_invoice_request_v2_1126(''::text, NULL::text, NULL::date);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 14. batch_complete_invoice_requests_1126(p_request_numbers text[])
    BEGIN
        PERFORM public.batch_complete_invoice_requests_1126(ARRAY[]::text[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 15. cancel_invoice_request_1126(p_request_number text)
    BEGIN
        PERFORM public.cancel_invoice_request_1126(''::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 16. batch_cancel_invoice_requests_1126(p_request_numbers text[])
    BEGIN
        PERFORM public.batch_cancel_invoice_requests_1126(ARRAY[]::text[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 17. batch_rollback_invoice_approval_1126(p_request_ids uuid[])
    BEGIN
        PERFORM public.batch_rollback_invoice_approval_1126(ARRAY[]::uuid[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 18. void_and_delete_invoice_requests_1126(p_request_ids uuid[])
    BEGIN
        PERFORM public.void_and_delete_invoice_requests_1126(ARRAY[]::uuid[]);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 19. void_invoice_request_1126(p_request_id uuid, p_void_reason text DEFAULT NULL)
    BEGIN
        PERFORM public.void_invoice_request_1126('00000000-0000-0000-0000-000000000000'::uuid, NULL::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 20. save_invoice_request_1126 (如果存在，参数为 p_invoice_data jsonb)
    BEGIN
        PERFORM public.save_invoice_request_1126('{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- ============================================================================
-- 数据修改相关函数
-- ============================================================================

DO $$
BEGIN
    -- 21. batch_modify_chain_1126(p_record_ids uuid[], p_chain_name text)
    BEGIN
        PERFORM public.batch_modify_chain_1126(ARRAY[]::uuid[], ''::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 22. modify_logistics_record_chain_with_recalc_1126(p_record_id uuid, p_chain_name text)
    BEGIN
        PERFORM public.modify_logistics_record_chain_with_recalc_1126('00000000-0000-0000-0000-000000000000'::uuid, ''::text);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 23. batch_modify_partner_cost_1126(p_record_ids uuid[], p_new_amount numeric)
    BEGIN
        PERFORM public.batch_modify_partner_cost_1126(ARRAY[]::uuid[], 0::numeric);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- ============================================================================
-- 验证：查询所有 _1126 函数
-- ============================================================================

-- 显示所有已注册的 _1126 函数
DO $$
DECLARE
    v_function_name text;
    v_function_count integer := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '已注册的 _1126 函数列表：';
    RAISE NOTICE '========================================';
    
    FOR v_function_name IN
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name LIKE '%_1126'
          AND routine_type = 'FUNCTION'
        ORDER BY routine_name
    LOOP
        v_function_count := v_function_count + 1;
        RAISE NOTICE '%: %', v_function_count, v_function_name;
    END LOOP;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '总计: % 个 _1126 函数', v_function_count;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

