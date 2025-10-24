    -- ==========================================
    -- 付款功能完整修复 - 合并版本
    -- ==========================================
    -- 创建时间: 2025-01-22
    -- 功能: 合并所有付款相关功能的修复
    -- 包含: updated_at列添加、SQL FROM子句修复、付款状态管理
    -- ==========================================

    BEGIN;

    -- ============================================================
    -- 第一部分: 为 logistics_records 表添加 updated_at 列
    -- ============================================================

-- 添加 updated_at 列
ALTER TABLE public.logistics_records 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 为现有记录设置 updated_at 值
UPDATE public.logistics_records 
SET updated_at = NOW() 
WHERE updated_at IS NULL;

-- 为 payment_requests 表添加 updated_at 列
ALTER TABLE public.payment_requests 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 为现有记录设置 updated_at 值
UPDATE public.payment_requests 
SET updated_at = NOW() 
WHERE updated_at IS NULL;

    -- 创建触发器函数，自动更新 updated_at
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_logistics_records_updated_at ON public.logistics_records;
CREATE TRIGGER update_logistics_records_updated_at
    BEFORE UPDATE ON public.logistics_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 为 payment_requests 表创建触发器
DROP TRIGGER IF EXISTS update_payment_requests_updated_at ON public.payment_requests;
CREATE TRIGGER update_payment_requests_updated_at
    BEFORE UPDATE ON public.payment_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

    -- 添加注释
    COMMENT ON COLUMN public.logistics_records.updated_at IS '记录最后更新时间，自动维护';
    COMMENT ON COLUMN public.payment_requests.updated_at IS '付款申请单最后更新时间，自动维护';
    COMMENT ON FUNCTION public.update_updated_at_column IS '自动更新 updated_at 列的触发器函数';

-- ============================================================
-- 第二部分: 修复取消付款状态函数
-- ============================================================

-- 先删除现有函数（如果存在）
DROP FUNCTION IF EXISTS public.cancel_payment_status_for_waybills(UUID[], UUID);
DROP FUNCTION IF EXISTS public.cancel_payment_status_for_waybills(UUID[]);
DROP FUNCTION IF EXISTS public.update_payment_status_for_waybills(UUID[], TEXT, UUID);
DROP FUNCTION IF EXISTS public.update_payment_status_for_waybills(UUID[], TEXT);
DROP FUNCTION IF EXISTS public.update_payment_status_for_waybills(UUID[]);
DROP FUNCTION IF EXISTS public.generate_payment_request_pdf_data(UUID[]);
DROP FUNCTION IF EXISTS public.generate_payment_request_pdf_data(TEXT[]);

CREATE OR REPLACE FUNCTION public.cancel_payment_status_for_waybills(
        p_record_ids UUID[],
        p_user_id UUID DEFAULT auth.uid()
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        v_updated_count INTEGER := 0;
        v_partner_updated_count INTEGER := 0;
        v_result JSONB;
    BEGIN
        -- 检查权限
        IF NOT public.is_finance_or_admin() THEN
            RAISE EXCEPTION '权限不足：只有财务或管理员可以取消付款状态';
        END IF;

        -- 记录操作日志
        RAISE NOTICE '开始取消付款状态: 运单数量=%', array_length(p_record_ids, 1);

        -- 更新 logistics_records 表的付款状态
        UPDATE public.logistics_records
        SET
            payment_status = 'Unpaid',
            payment_completed_at = NULL
        WHERE id = ANY(p_record_ids)
        AND payment_status = 'Paid';  -- 只处理已付款的运单

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        RAISE NOTICE '已取消 % 条运单的付款状态', v_updated_count;

        -- 更新 logistics_partner_costs 表中对应运单的合作方（货主除外）的付款状态
        UPDATE public.logistics_partner_costs lpc
        SET 
            payment_status = 'Unpaid',
            payment_completed_at = NULL
        FROM public.logistics_records lr,
            public.partners p
        WHERE lpc.logistics_record_id = lr.id
        AND lpc.partner_id = p.id
        AND lr.id = ANY(p_record_ids)
        AND (p.partner_type IS NULL OR p.partner_type != '货主')  -- 货主除外，处理NULL值
        AND lpc.payment_status = 'Paid';  -- 只处理已付款的合作方成本

        GET DIAGNOSTICS v_partner_updated_count = ROW_COUNT;
        RAISE NOTICE '已取消 % 条合作方成本记录的付款状态', v_partner_updated_count;

        -- 构建返回结果
        v_result := jsonb_build_object(
            'success', true,
            'message', '付款状态取消成功',
            'updated_waybills', v_updated_count,
            'updated_partner_costs', v_partner_updated_count,
            'record_ids', p_record_ids
        );

        RETURN v_result;
    END;
    $$;

-- ============================================================
-- 第三部分: 修复设置付款状态函数
-- ============================================================

-- 先删除现有函数（如果存在）
DROP FUNCTION IF EXISTS public.set_payment_status_for_waybills(UUID[], TEXT, UUID);
DROP FUNCTION IF EXISTS public.set_payment_status_for_waybills(UUID[], TEXT);
DROP FUNCTION IF EXISTS public.set_payment_status_for_waybills(UUID[]);

CREATE OR REPLACE FUNCTION public.set_payment_status_for_waybills(
        p_record_ids UUID[],
        p_payment_status TEXT,
        p_user_id UUID DEFAULT auth.uid()
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        v_updated_count INTEGER := 0;
        v_partner_updated_count INTEGER := 0;
        v_result JSONB;
    BEGIN
        -- 检查权限
        IF NOT public.is_finance_or_admin() THEN
            RAISE EXCEPTION '权限不足：只有财务或管理员可以更新付款状态';
        END IF;

        -- 记录操作日志
        RAISE NOTICE '开始更新付款状态: 运单数量=%', array_length(p_record_ids, 1);

        -- 更新 logistics_records 表的付款状态
        UPDATE public.logistics_records
        SET 
            payment_status = p_payment_status,
            payment_completed_at = CASE 
                WHEN p_payment_status = 'Paid' THEN NOW()
                ELSE NULL
            END,
            updated_at = NOW()
        WHERE id = ANY(p_record_ids)
        AND payment_status != p_payment_status;

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        RAISE NOTICE '已更新 % 条运单的付款状态', v_updated_count;

        -- 更新 logistics_partner_costs 表中对应运单的合作方（货主除外）的付款状态
        UPDATE public.logistics_partner_costs lpc
        SET 
            payment_status = p_payment_status,
            payment_completed_at = CASE 
                WHEN p_payment_status = 'Paid' THEN NOW()
                ELSE NULL
            END,
            updated_at = NOW()
        FROM public.logistics_records lr,
            public.partners p
        WHERE lpc.logistics_record_id = lr.id
        AND lpc.partner_id = p.id
        AND lr.id = ANY(p_record_ids)
        AND (p.partner_type IS NULL OR p.partner_type != '货主')  -- 货主除外，处理NULL值
        AND lpc.payment_status != p_payment_status;

        GET DIAGNOSTICS v_partner_updated_count = ROW_COUNT;
        RAISE NOTICE '已更新 % 条合作方成本记录的付款状态', v_partner_updated_count;

        -- 构建返回结果
        v_result := jsonb_build_object(
            'success', true,
            'message', '付款状态更新成功',
            'updated_waybills', v_updated_count,
            'updated_partner_costs', v_partner_updated_count,
            'record_ids', p_record_ids
        );

        RETURN v_result;
    END;
    $$;

-- ============================================================
-- 第四部分: 修复回滚付款状态函数
-- ============================================================

-- 先删除现有函数（如果存在）
DROP FUNCTION IF EXISTS public.rollback_payment_status_for_waybills(UUID[]);
DROP FUNCTION IF EXISTS public.rollback_payment_status_for_waybills(UUID[], TEXT);
DROP FUNCTION IF EXISTS public.rollback_payment_status_for_waybills(UUID[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.rollback_payment_status_for_waybills(
        p_record_ids UUID[]
    )
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        v_waybill_updated_count INTEGER := 0;
        v_partner_updated_count INTEGER := 0;
        v_total_updated INTEGER := 0;
    BEGIN
        -- 1. 回滚 logistics_records 表的付款状态
        UPDATE public.logistics_records
        SET 
            payment_status = 'Unpaid',
            payment_completed_at = NULL,
            updated_at = NOW()
        WHERE id = ANY(p_record_ids)
        AND payment_status != 'Unpaid';

        GET DIAGNOSTICS v_waybill_updated_count = ROW_COUNT;
        RAISE NOTICE '已回滚 % 条运单的付款状态', v_waybill_updated_count;

        -- 2. 回滚 logistics_partner_costs 表的付款状态（货主除外）
        UPDATE public.logistics_partner_costs lpc
        SET 
            payment_status = 'Unpaid',
            payment_completed_at = NULL,
            payment_request_id = NULL,
            payment_applied_at = NULL,
            updated_at = NOW()
        FROM public.logistics_records lr,
            public.partners p
        WHERE lpc.logistics_record_id = lr.id
        AND lpc.partner_id = p.id
        AND lr.id = ANY(p_record_ids)
        AND (p.partner_type IS NULL OR p.partner_type != '货主')  -- 货主除外
        AND lpc.payment_status != 'Unpaid';

        GET DIAGNOSTICS v_partner_updated_count = ROW_COUNT;
        RAISE NOTICE '已回滚 % 条合作方成本记录的付款状态', v_partner_updated_count;

        v_total_updated := v_waybill_updated_count + v_partner_updated_count;
        RAISE NOTICE '回滚完成: 运单=% + 合作方成本=% = 总计=%', v_waybill_updated_count, v_partner_updated_count, v_total_updated;

        RETURN v_total_updated;
    END;
    $$;

-- ============================================================
-- 第五部分: 创建付款申请单作废函数
-- ============================================================

-- 先删除现有函数（如果存在）
DROP FUNCTION IF EXISTS public.cancel_payment_requests_by_ids(TEXT[]);
DROP FUNCTION IF EXISTS public.cancel_payment_requests_by_ids(TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.cancel_payment_requests_by_ids(TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.cancel_payment_requests_by_ids(
        p_request_ids TEXT[]
    )
    RETURNS INTEGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        v_request_id TEXT;
        v_affected_count INTEGER := 0;
        v_total_affected INTEGER := 0;
        v_logistics_record_ids UUID[];
        v_waybill_count INTEGER := 0;
    BEGIN
        -- 检查权限
        IF NOT public.is_finance_or_admin() THEN
            RAISE EXCEPTION '权限不足：只有财务或管理员可以作废付款申请单';
        END IF;

        -- 记录操作开始
        RAISE NOTICE '开始作废付款申请单: 申请单数量=%', array_length(p_request_ids, 1);

        -- 遍历每个申请单ID
        FOREACH v_request_id IN ARRAY p_request_ids
        LOOP
            -- 获取该申请单关联的运单ID
            SELECT logistics_record_ids INTO v_logistics_record_ids
            FROM public.payment_requests
            WHERE request_id = v_request_id;

            IF v_logistics_record_ids IS NOT NULL THEN
                -- 回滚运单状态
                PERFORM public.rollback_payment_status_for_waybills(v_logistics_record_ids);
                v_waybill_count := v_waybill_count + array_length(v_logistics_record_ids, 1);
            END IF;
            
            -- 删除申请单
            DELETE FROM public.payment_requests
            WHERE request_id = v_request_id;

            GET DIAGNOSTICS v_affected_count = ROW_COUNT;
            v_total_affected := v_total_affected + v_affected_count;
            
            RAISE NOTICE '已作废申请单: % (运单数: %)', v_request_id, array_length(v_logistics_record_ids, 1);
        END LOOP;

        RAISE NOTICE '作废完成: 申请单数=%, 运单数=%', v_total_affected, v_waybill_count;

        RETURN v_total_affected;
    END;
    $$;

-- ============================================================
-- 第六部分: 创建增强版付款申请单作废函数（支持状态检查）
-- ============================================================

-- 先删除现有函数（如果存在）
DROP FUNCTION IF EXISTS public.void_payment_requests_by_ids(TEXT[]);
DROP FUNCTION IF EXISTS public.void_payment_requests_by_ids(TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.void_payment_requests_by_ids(TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.void_payment_requests_by_ids(
        p_request_ids TEXT[]
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        v_request_id TEXT;
        v_request record;
        v_affected_count INTEGER := 0;
        v_total_affected INTEGER := 0;
        v_logistics_record_ids UUID[];
        v_waybill_count INTEGER := 0;
        v_eligible_requests TEXT[] := '{}';
        v_paid_requests TEXT[] := '{}';
        v_result JSONB;
    BEGIN
        -- 检查权限
        IF NOT public.is_finance_or_admin() THEN
            RAISE EXCEPTION '权限不足：只有财务或管理员可以作废付款申请单';
        END IF;

        -- 记录操作开始
        RAISE NOTICE '开始作废付款申请单: 申请单数量=%', array_length(p_request_ids, 1);

        -- 遍历每个申请单ID，分类处理
        FOREACH v_request_id IN ARRAY p_request_ids
        LOOP
            -- 获取该申请单信息
            DECLARE
                v_request record;
            BEGIN
                SELECT * INTO v_request
                FROM public.payment_requests
                WHERE request_id = v_request_id;

                IF FOUND THEN
                    CASE v_request.status
                        WHEN 'Paid' THEN
                            -- 已付款的申请单，记录但不处理
                            v_paid_requests := array_append(v_paid_requests, v_request_id);
                            RAISE NOTICE '申请单 % 已付款，跳过作废', v_request_id;
                        WHEN 'Pending', 'Approved' THEN
                            -- 可作废的申请单
                            v_eligible_requests := array_append(v_eligible_requests, v_request_id);
                            
                            -- 获取该申请单关联的运单ID
                            SELECT logistics_record_ids INTO v_logistics_record_ids
                            FROM public.payment_requests
                            WHERE request_id = v_request_id;

                            IF v_logistics_record_ids IS NOT NULL THEN
                                -- 回滚运单状态
                                PERFORM public.rollback_payment_status_for_waybills(v_logistics_record_ids);
                                v_waybill_count := v_waybill_count + array_length(v_logistics_record_ids, 1);
                            END IF;
                            
                            -- 更新申请单状态为已取消
                            UPDATE public.payment_requests
                            SET 
                                status = 'Cancelled',
                                updated_at = NOW(),
                                notes = COALESCE(notes, '') || ' [已作废]'
                            WHERE request_id = v_request_id;

                            GET DIAGNOSTICS v_affected_count = ROW_COUNT;
                            v_total_affected := v_total_affected + v_affected_count;
                            
                            RAISE NOTICE '已作废申请单: % (运单数: %)', v_request_id, array_length(v_logistics_record_ids, 1);
                        ELSE
                            RAISE NOTICE '申请单 % 状态为 %，跳过处理', v_request_id, v_request.status;
                    END CASE;
                ELSE
                    RAISE NOTICE '申请单 % 不存在', v_request_id;
                END IF;
            END;
        END LOOP;

        RAISE NOTICE '作废完成: 可作废申请单数=%, 已付款申请单数=%, 运单数=%', 
            array_length(v_eligible_requests, 1), array_length(v_paid_requests, 1), v_waybill_count;

        -- 构建返回结果
        v_result := jsonb_build_object(
            'success', true,
            'cancelled_requests', array_length(v_eligible_requests, 1),
            'paid_requests_skipped', array_length(v_paid_requests, 1),
            'waybill_count', v_waybill_count,
            'eligible_request_ids', v_eligible_requests,
            'paid_request_ids', v_paid_requests
        );

        RETURN v_result;
    END;
    $$;

-- ============================================================
-- 第七部分: 创建付款状态回滚检查函数
-- ============================================================

-- 先删除现有函数（如果存在）
DROP FUNCTION IF EXISTS public.check_payment_rollback_eligibility(TEXT[]);
DROP FUNCTION IF EXISTS public.check_payment_rollback_eligibility(TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.check_payment_rollback_eligibility(TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.check_payment_rollback_eligibility(
        p_request_ids TEXT[]
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        v_request_id TEXT;
        v_request record;
        v_eligible_count INTEGER := 0;
        v_paid_count INTEGER := 0;
        v_other_count INTEGER := 0;
        v_result JSONB;
    BEGIN
        -- 遍历每个申请单ID，检查状态
        FOREACH v_request_id IN ARRAY p_request_ids
        LOOP
            SELECT * INTO v_request
            FROM public.payment_requests
            WHERE request_id = v_request_id;

            IF FOUND THEN
                CASE v_request.status
                    WHEN 'Pending', 'Approved' THEN
                        v_eligible_count := v_eligible_count + 1;
                    WHEN 'Paid' THEN
                        v_paid_count := v_paid_count + 1;
                    ELSE
                        v_other_count := v_other_count + 1;
                END CASE;
            END IF;
        END LOOP;

        -- 构建返回结果
        v_result := jsonb_build_object(
            'eligible_count', v_eligible_count,
            'paid_count', v_paid_count,
            'other_count', v_other_count,
            'total_count', array_length(p_request_ids, 1)
        );

        RETURN v_result;
    END;
    $$;

-- ============================================================
-- 第八部分: 创建带回滚的付款申请单作废函数
-- ============================================================

-- 先删除现有函数（如果存在）
DROP FUNCTION IF EXISTS public.void_payment_request_with_rollback(TEXT);
DROP FUNCTION IF EXISTS public.void_payment_request_with_rollback(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.void_payment_request_with_rollback(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.void_payment_request_with_rollback(
        p_request_id TEXT
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
        v_request record;
        v_logistics_record_ids UUID[];
        v_waybill_count INTEGER := 0;
        v_result JSONB;
    BEGIN
        -- 检查权限
        IF NOT public.is_finance_or_admin() THEN
            RAISE EXCEPTION '权限不足：只有财务或管理员可以作废付款申请单';
        END IF;

        -- 获取申请单信息
        SELECT * INTO v_request
        FROM public.payment_requests
        WHERE request_id = p_request_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION '申请单 % 不存在', p_request_id;
        END IF;

        -- 检查状态
        IF v_request.status = 'Paid' THEN
            RAISE EXCEPTION '申请单 % 已付款，无法作废', p_request_id;
        END IF;

        -- 获取关联运单ID
        SELECT logistics_record_ids INTO v_logistics_record_ids
        FROM public.payment_requests
        WHERE request_id = p_request_id;

        -- 回滚运单状态
        IF v_logistics_record_ids IS NOT NULL THEN
            PERFORM public.rollback_payment_status_for_waybills(v_logistics_record_ids);
            v_waybill_count := array_length(v_logistics_record_ids, 1);
        END IF;

        -- 更新申请单状态
        UPDATE public.payment_requests
        SET 
            status = 'Cancelled',
            updated_at = NOW(),
            notes = COALESCE(notes, '') || ' [已作废]'
        WHERE request_id = p_request_id;

        -- 构建返回结果
        v_result := jsonb_build_object(
            'success', true,
            'request_id', p_request_id,
            'waybill_count', v_waybill_count,
            'message', '申请单已成功作废'
        );

        RETURN v_result;
    END;
    $$;

-- 添加函数注释
COMMENT ON FUNCTION public.cancel_payment_status_for_waybills IS '取消运单付款状态函数';
COMMENT ON FUNCTION public.update_updated_at_column IS '自动更新 updated_at 列的触发器函数';
    COMMENT ON FUNCTION public.set_payment_status_for_waybills IS '设置运单付款状态函数';
    COMMENT ON FUNCTION public.rollback_payment_status_for_waybills IS '回滚运单付款状态函数';
    COMMENT ON FUNCTION public.cancel_payment_requests_by_ids IS '作废付款申请单函数（简单版）';
    COMMENT ON FUNCTION public.void_payment_requests_by_ids IS '作废付款申请单函数（增强版，支持状态检查）';
    COMMENT ON FUNCTION public.check_payment_rollback_eligibility IS '检查付款申请单回滚资格函数';
    COMMENT ON FUNCTION public.void_payment_request_with_rollback IS '带回滚的付款申请单作废函数';

    COMMIT;
