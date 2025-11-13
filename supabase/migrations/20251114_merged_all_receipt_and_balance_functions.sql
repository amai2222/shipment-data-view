-- ============================================================================
-- 合并所有收款和余额相关功能（2025-11-14）
-- 创建时间：2025-11-14
-- 描述：合并所有20251114的SQL文件，确保所有函数都有_1114后缀
-- ============================================================================

-- ============================================================================
-- 第一部分：数据库结构扩展
-- ============================================================================

-- 1. 在logistics_records表中添加收款状态字段
ALTER TABLE public.logistics_records
ADD COLUMN IF NOT EXISTS receipt_status TEXT DEFAULT 'Unreceived'  -- 收款状态：Unreceived（未收款）、Received（已收款）
CHECK (receipt_status IN ('Unreceived', 'Received'));

COMMENT ON COLUMN public.logistics_records.receipt_status IS '收款状态：Unreceived-未收款，Received-已收款';

-- 为现有记录设置默认值
UPDATE public.logistics_records
SET receipt_status = 'Unreceived'
WHERE receipt_status IS NULL;

-- 2. 在invoice_requests表中添加收款相关字段
ALTER TABLE public.invoice_requests
ADD COLUMN IF NOT EXISTS receipt_number TEXT,  -- 收款单号
ADD COLUMN IF NOT EXISTS receipt_bank TEXT,  -- 收款银行
ADD COLUMN IF NOT EXISTS received_amount NUMERIC(15,2),  -- 收款金额
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE,  -- 收款时间
ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 收款操作人ID
ADD COLUMN IF NOT EXISTS receipt_images TEXT[] DEFAULT '{}',  -- 银行回单图片URL数组
ADD COLUMN IF NOT EXISTS total_received_amount NUMERIC(15,2) DEFAULT 0,  -- 累计收款金额（支持部分收款）
ADD COLUMN IF NOT EXISTS payment_due_date DATE,  -- 收款期限
ADD COLUMN IF NOT EXISTS overdue_days INTEGER DEFAULT 0,  -- 逾期天数
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,  -- 提醒次数
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE,  -- 最后提醒时间
ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'Unreconciled',  -- 对账状态：Unreconciled（未对账）、Reconciled（已对账）、Exception（异常）
ADD COLUMN IF NOT EXISTS reconciliation_date TIMESTAMP WITH TIME ZONE,  -- 对账日期
ADD COLUMN IF NOT EXISTS reconciliation_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 对账操作人
ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;  -- 对账备注

COMMENT ON COLUMN public.invoice_requests.receipt_number IS '收款单号';
COMMENT ON COLUMN public.invoice_requests.receipt_bank IS '收款银行';
COMMENT ON COLUMN public.invoice_requests.received_amount IS '收款金额';
COMMENT ON COLUMN public.invoice_requests.received_at IS '收款时间';
COMMENT ON COLUMN public.invoice_requests.received_by IS '收款操作人ID';
COMMENT ON COLUMN public.invoice_requests.receipt_images IS '银行回单图片URL数组';
COMMENT ON COLUMN public.invoice_requests.total_received_amount IS '累计收款金额（支持部分收款，多次收款累计）';
COMMENT ON COLUMN public.invoice_requests.payment_due_date IS '收款期限';
COMMENT ON COLUMN public.invoice_requests.overdue_days IS '逾期天数';
COMMENT ON COLUMN public.invoice_requests.reminder_count IS '提醒次数';
COMMENT ON COLUMN public.invoice_requests.last_reminder_at IS '最后提醒时间';
COMMENT ON COLUMN public.invoice_requests.reconciliation_status IS '对账状态：Unreconciled-未对账，Reconciled-已对账，Exception-异常';
COMMENT ON COLUMN public.invoice_requests.reconciliation_date IS '对账日期';
COMMENT ON COLUMN public.invoice_requests.reconciliation_by IS '对账操作人ID';
COMMENT ON COLUMN public.invoice_requests.reconciliation_notes IS '对账备注';

-- 3. 创建收款记录表（支持多次收款）
CREATE TABLE IF NOT EXISTS public.invoice_receipt_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_request_id UUID NOT NULL REFERENCES public.invoice_requests(id) ON DELETE CASCADE,
    receipt_number TEXT,  -- 收款单号
    receipt_bank TEXT,  -- 收款银行
    receipt_amount NUMERIC(15,2) NOT NULL,  -- 本次收款金额
    receipt_images TEXT[] DEFAULT '{}',  -- 银行回单图片URL数组
    receipt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),  -- 收款日期
    received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 收款操作人
    refund_amount NUMERIC(15,2) DEFAULT 0,  -- 退款金额（如有退款）
    refund_reason TEXT,  -- 退款原因
    refund_date TIMESTAMP WITH TIME ZONE,  -- 退款日期
    refunded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 退款操作人
    notes TEXT,  -- 备注
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_receipt_records_request_id ON public.invoice_receipt_records(invoice_request_id);
CREATE INDEX IF NOT EXISTS idx_invoice_receipt_records_date ON public.invoice_receipt_records(receipt_date DESC);

COMMENT ON TABLE public.invoice_receipt_records IS '开票收款记录表（支持多次收款）';
COMMENT ON COLUMN public.invoice_receipt_records.invoice_request_id IS '关联的开票申请单ID';
COMMENT ON COLUMN public.invoice_receipt_records.receipt_amount IS '本次收款金额';
COMMENT ON COLUMN public.invoice_receipt_records.refund_amount IS '退款金额（如有退款）';

-- ============================================================================
-- 第二部分：货主余额系统
-- ============================================================================

-- 1. 创建货主余额表
CREATE TABLE IF NOT EXISTS public.partner_balance (
    partner_id UUID NOT NULL PRIMARY KEY,
    balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.partner_balance IS '货主账号余额表';
COMMENT ON COLUMN public.partner_balance.partner_id IS '货主ID（合作方ID）';
COMMENT ON COLUMN public.partner_balance.balance IS '当前余额（元，2位小数）';
COMMENT ON COLUMN public.partner_balance.updated_at IS '最后更新时间';

-- 2. 创建货主余额流水表
CREATE TABLE IF NOT EXISTS public.partner_balance_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id UUID NOT NULL,
    transaction_type TEXT NOT NULL,  -- 'recharge'（充值）或 'deduct'（扣款）
    transaction_category TEXT NOT NULL,  -- 交易类别：'invoice_receipt'（开票收款）、'manual_recharge'（手动充值）、'waybill'（运单应付）、'service_fee'（服务费）、'overdue_fee'（逾期费）等
    amount NUMERIC(15,2) NOT NULL,   -- 金额（正数表示充值，负数表示扣款）
    balance_before NUMERIC(15,2) NOT NULL,  -- 交易前余额
    balance_after NUMERIC(15,2) NOT NULL,   -- 交易后余额
    reference_type TEXT,  -- 关联类型：'invoice_receipt'（开票收款）、'waybill'（运单）、'manual'（手动操作）等
    reference_id UUID,    -- 关联ID（invoice_requests.id 或 logistics_records.id）
    reference_number TEXT,  -- 关联编号（申请单号或运单号）
    description TEXT,     -- 交易描述
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_partner_balance_transactions_partner_id ON public.partner_balance_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_balance_transactions_created_at ON public.partner_balance_transactions(created_at DESC);

COMMENT ON TABLE public.partner_balance_transactions IS '货主余额流水表';
COMMENT ON COLUMN public.partner_balance_transactions.transaction_type IS '交易类型：recharge（充值）或 deduct（扣款）';
COMMENT ON COLUMN public.partner_balance_transactions.transaction_category IS '交易类别：invoice_receipt（开票收款）、manual_recharge（手动充值）、waybill（运单应付）、service_fee（服务费）、overdue_fee（逾期费）等';
COMMENT ON COLUMN public.partner_balance_transactions.amount IS '交易金额（正数表示充值，负数表示扣款）';
COMMENT ON COLUMN public.partner_balance_transactions.balance_before IS '交易前余额';
COMMENT ON COLUMN public.partner_balance_transactions.balance_after IS '交易后余额';
COMMENT ON COLUMN public.partner_balance_transactions.reference_type IS '关联类型：invoice_receipt（开票收款）、waybill（运单）、manual（手动操作）等';
COMMENT ON COLUMN public.partner_balance_transactions.reference_id IS '关联记录ID';
COMMENT ON COLUMN public.partner_balance_transactions.reference_number IS '关联编号（申请单号或运单号）';
COMMENT ON COLUMN public.partner_balance_transactions.description IS '交易描述';

-- 3. 创建余额更新函数（内部函数）
CREATE OR REPLACE FUNCTION public.update_partner_balance(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_transaction_type TEXT,  -- 'recharge' 或 'deduct'
    p_transaction_category TEXT DEFAULT NULL,  -- 交易类别（如果为NULL，会自动推断）
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_reference_number TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_current_balance NUMERIC(15,2) := 0;
    v_new_balance NUMERIC(15,2);
    v_user_id UUID;
    v_category TEXT;
BEGIN
    -- 获取当前用户ID
    v_user_id := auth.uid();
    
    -- 自动推断交易类别（如果未提供）
    IF p_transaction_category IS NULL THEN
        IF p_reference_type = 'invoice_receipt' THEN
            v_category := 'invoice_receipt';
        ELSIF p_reference_type = 'waybill' THEN
            v_category := 'waybill';
        ELSE
            v_category := 'other';
        END IF;
    ELSE
        v_category := p_transaction_category;
    END IF;
    
    -- 获取或创建余额记录
    INSERT INTO public.partner_balance (partner_id, balance, updated_at)
    VALUES (p_partner_id, 0, NOW())
    ON CONFLICT (partner_id) DO UPDATE SET updated_at = NOW()
    RETURNING balance INTO v_current_balance;
    
    -- 如果插入失败，查询现有余额
    IF v_current_balance IS NULL THEN
        SELECT balance INTO v_current_balance
        FROM public.partner_balance
        WHERE partner_id = p_partner_id;
        
        IF v_current_balance IS NULL THEN
            v_current_balance := 0;
        END IF;
    END IF;
    
    -- 计算新余额
    v_new_balance := v_current_balance + p_amount;
    
    -- 更新余额
    UPDATE public.partner_balance
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE partner_id = p_partner_id;
    
    -- 创建流水记录
    INSERT INTO public.partner_balance_transactions (
        partner_id,
        transaction_type,
        transaction_category,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        reference_number,
        description,
        created_by
    ) VALUES (
        p_partner_id,
        p_transaction_type,
        v_category,
        p_amount,
        v_current_balance,
        v_new_balance,
        p_reference_type,
        p_reference_id,
        p_reference_number,
        p_description,
        v_user_id
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'balance_before', v_current_balance,
        'balance_after', v_new_balance,
        'amount', p_amount
    );
END;
$$;

COMMENT ON FUNCTION public.update_partner_balance IS '更新货主余额（内部函数，供其他函数调用）';

-- 4. 创建触发器：自动扣减货主余额（当运单成本插入时）
CREATE OR REPLACE FUNCTION public.trigger_deduct_balance_on_cost_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_partner_type TEXT;
BEGIN
    -- 检查合作方类型（通过JOIN partners表）
    SELECT partner_type INTO v_partner_type
    FROM public.partners
    WHERE id = NEW.partner_id;
    
    -- 只处理货主类型的合作方成本
    IF v_partner_type = '货主' AND NEW.payable_amount > 0 THEN
        PERFORM public.update_partner_balance(
            p_partner_id := NEW.partner_id,
            p_amount := -NEW.payable_amount,  -- 负数表示扣款
            p_transaction_type := 'deduct',
            p_transaction_category := 'waybill',  -- 运单应付
            p_reference_type := 'waybill',
            p_reference_id := NEW.logistics_record_id,
            p_reference_number := NULL,
            p_description := format('运单应付：运单ID %s，应付金额 ¥%s', NEW.logistics_record_id, NEW.payable_amount)
        );
    END IF;
    RETURN NEW;
END;
$$;

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_deduct_balance_on_cost_insert ON public.logistics_partner_costs;

CREATE TRIGGER trigger_deduct_balance_on_cost_insert
AFTER INSERT ON public.logistics_partner_costs
FOR EACH ROW
WHEN (NEW.payable_amount > 0)
EXECUTE FUNCTION public.trigger_deduct_balance_on_cost_insert();

COMMENT ON FUNCTION public.trigger_deduct_balance_on_cost_insert IS '当运单成本插入时，自动扣减货主余额（使用logistics_partner_costs.payable_amount，仅处理货主类型）';

-- 5. 创建触发器：重新计算货主余额（当运单成本更新时）
CREATE OR REPLACE FUNCTION public.trigger_recalculate_balance_on_cost_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_amount NUMERIC(15,2) := 0;
    v_new_amount NUMERIC(15,2) := 0;
    v_diff NUMERIC(15,2);
    v_partner_type TEXT;
BEGIN
    -- 检查合作方类型（通过JOIN partners表）
    SELECT partner_type INTO v_partner_type
    FROM public.partners
    WHERE id = NEW.partner_id;
    
    -- 只处理货主类型的合作方成本
    IF v_partner_type = '货主' THEN
        v_old_amount := COALESCE(OLD.payable_amount, 0);
        v_new_amount := COALESCE(NEW.payable_amount, 0);
        v_diff := v_new_amount - v_old_amount;
        
        -- 如果金额有变化，更新余额
        IF v_diff != 0 THEN
            PERFORM public.update_partner_balance(
                p_partner_id := NEW.partner_id,
                p_amount := v_diff,  -- 正数表示增加，负数表示减少
                p_transaction_type := CASE WHEN v_diff > 0 THEN 'deduct' ELSE 'recharge' END,
                p_transaction_category := 'waybill',  -- 运单应付
                p_reference_type := 'waybill',
                p_reference_id := NEW.logistics_record_id,
                p_reference_number := NULL,
                p_description := format('运单应付调整：运单ID %s，原金额 ¥%s，新金额 ¥%s，差额 ¥%s', 
                    NEW.logistics_record_id, v_old_amount, v_new_amount, v_diff)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS trigger_recalculate_balance_on_cost_update ON public.logistics_partner_costs;

CREATE TRIGGER trigger_recalculate_balance_on_cost_update
AFTER UPDATE ON public.logistics_partner_costs
FOR EACH ROW
WHEN (OLD.payable_amount IS DISTINCT FROM NEW.payable_amount)
EXECUTE FUNCTION public.trigger_recalculate_balance_on_cost_update();

COMMENT ON FUNCTION public.trigger_recalculate_balance_on_cost_update IS '当运单成本更新时，重新计算货主余额（使用logistics_partner_costs.payable_amount，仅处理货主类型）';

-- 6. 创建查询余额函数
CREATE OR REPLACE FUNCTION public.get_partner_balance(
    p_partner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_balance NUMERIC(15,2) := 0;
BEGIN
    -- 获取或创建余额记录
    INSERT INTO public.partner_balance (partner_id, balance, updated_at)
    VALUES (p_partner_id, 0, NOW())
    ON CONFLICT (partner_id) DO NOTHING;
    
    -- 查询余额
    SELECT balance INTO v_balance
    FROM public.partner_balance
    WHERE partner_id = p_partner_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'balance', COALESCE(v_balance, 0)
    );
END;
$$;

COMMENT ON FUNCTION public.get_partner_balance IS '获取货主余额';

-- 7. 创建查询余额流水函数
CREATE OR REPLACE FUNCTION public.get_partner_balance_transactions(
    p_partner_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_transactions JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', pbt.id,
            'transaction_type', pbt.transaction_type,
            'transaction_category', pbt.transaction_category,
            'amount', pbt.amount,
            'balance_before', pbt.balance_before,
            'balance_after', pbt.balance_after,
            'reference_type', pbt.reference_type,
            'reference_id', pbt.reference_id,
            'reference_number', pbt.reference_number,
            'description', pbt.description,
            'created_at', pbt.created_at
        ) ORDER BY pbt.created_at DESC
    ) INTO v_transactions
    FROM (
        SELECT pbt.*
        FROM public.partner_balance_transactions pbt
        WHERE pbt.partner_id = p_partner_id
          AND (p_start_date IS NULL OR DATE(pbt.created_at) >= p_start_date)
          AND (p_end_date IS NULL OR DATE(pbt.created_at) <= p_end_date)
        ORDER BY pbt.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) pbt;
    
    RETURN jsonb_build_object(
        'success', true,
        'transactions', COALESCE(v_transactions, '[]'::jsonb)
    );
END;
$$;

COMMENT ON FUNCTION public.get_partner_balance_transactions IS '获取货主余额流水记录';

-- ============================================================================
-- 第三部分：手动充值和费用扣款函数
-- ============================================================================

-- 1. 手动充值函数
CREATE OR REPLACE FUNCTION public.manual_recharge_partner_balance(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以手动充值';
    END IF;

    -- 验证金额
    IF p_amount <= 0 THEN
        RAISE EXCEPTION '充值金额必须大于0';
    END IF;

    -- 验证货主是否存在且为货主类型
    IF NOT EXISTS (
        SELECT 1 FROM public.partners 
        WHERE id = p_partner_id AND partner_type = '货主'
    ) THEN
        RAISE EXCEPTION '指定的合作方不存在或不是货主类型';
    END IF;

    -- 调用余额更新函数
    v_result := public.update_partner_balance(
        p_partner_id := p_partner_id,
        p_amount := p_amount,
        p_transaction_type := 'recharge',
        p_transaction_category := 'manual_recharge',  -- 手动充值
        p_reference_type := NULL,
        p_reference_id := NULL,
        p_reference_number := NULL,
        p_description := COALESCE(p_description, format('手动充值 ¥%s', p_amount))
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', format('手动充值成功，已为货主账号充值 ¥%s', p_amount),
        'balance_after', v_result->>'balance_after'
    );
END;
$$;

COMMENT ON FUNCTION public.manual_recharge_partner_balance IS '手动为货主账号充值';

-- 2. 服务费扣款函数
CREATE OR REPLACE FUNCTION public.deduct_service_fee(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以扣减服务费';
    END IF;

    -- 验证金额
    IF p_amount <= 0 THEN
        RAISE EXCEPTION '扣款金额必须大于0';
    END IF;

    -- 验证货主是否存在且为货主类型
    IF NOT EXISTS (
        SELECT 1 FROM public.partners 
        WHERE id = p_partner_id AND partner_type = '货主'
    ) THEN
        RAISE EXCEPTION '指定的合作方不存在或不是货主类型';
    END IF;

    -- 调用余额更新函数（负数表示扣款）
    v_result := public.update_partner_balance(
        p_partner_id := p_partner_id,
        p_amount := -p_amount,  -- 负数表示扣款
        p_transaction_type := 'deduct',
        p_transaction_category := 'service_fee',  -- 服务费
        p_reference_type := NULL,
        p_reference_id := NULL,
        p_reference_number := NULL,
        p_description := COALESCE(p_description, format('服务费扣款 ¥%s', p_amount))
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', format('服务费扣款成功，已扣减 ¥%s', p_amount),
        'balance_after', v_result->>'balance_after'
    );
END;
$$;

COMMENT ON FUNCTION public.deduct_service_fee IS '扣减货主服务费';

-- 3. 逾期费扣款函数
CREATE OR REPLACE FUNCTION public.deduct_overdue_fee(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以扣减逾期费';
    END IF;

    -- 验证金额
    IF p_amount <= 0 THEN
        RAISE EXCEPTION '扣款金额必须大于0';
    END IF;

    -- 验证货主是否存在且为货主类型
    IF NOT EXISTS (
        SELECT 1 FROM public.partners 
        WHERE id = p_partner_id AND partner_type = '货主'
    ) THEN
        RAISE EXCEPTION '指定的合作方不存在或不是货主类型';
    END IF;

    -- 调用余额更新函数（负数表示扣款）
    v_result := public.update_partner_balance(
        p_partner_id := p_partner_id,
        p_amount := -p_amount,  -- 负数表示扣款
        p_transaction_type := 'deduct',
        p_transaction_category := 'overdue_fee',  -- 逾期费
        p_reference_type := NULL,
        p_reference_id := NULL,
        p_reference_number := NULL,
        p_description := COALESCE(p_description, format('逾期费扣款 ¥%s', p_amount))
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', format('逾期费扣款成功，已扣减 ¥%s', p_amount),
        'balance_after', v_result->>'balance_after'
    );
END;
$$;

COMMENT ON FUNCTION public.deduct_overdue_fee IS '扣减货主逾期费';

-- 4. 通用费用扣款函数（支持自定义类别）
CREATE OR REPLACE FUNCTION public.deduct_partner_fee(
    p_partner_id UUID,
    p_amount NUMERIC,
    p_transaction_category TEXT DEFAULT 'other',  -- 费用类别：'service_fee'、'overdue_fee' 或其他自定义类别
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以扣减费用';
    END IF;

    -- 验证金额
    IF p_amount <= 0 THEN
        RAISE EXCEPTION '扣款金额必须大于0';
    END IF;

    -- 验证货主是否存在且为货主类型
    IF NOT EXISTS (
        SELECT 1 FROM public.partners 
        WHERE id = p_partner_id AND partner_type = '货主'
    ) THEN
        RAISE EXCEPTION '指定的合作方不存在或不是货主类型';
    END IF;

    -- 调用余额更新函数（负数表示扣款）
    v_result := public.update_partner_balance(
        p_partner_id := p_partner_id,
        p_amount := -p_amount,  -- 负数表示扣款
        p_transaction_type := 'deduct',
        p_transaction_category := p_transaction_category,
        p_reference_type := NULL,
        p_reference_id := NULL,
        p_reference_number := NULL,
        p_description := COALESCE(p_description, format('费用扣款 ¥%s', p_amount))
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', format('费用扣款成功，已扣减 ¥%s', p_amount),
        'balance_after', v_result->>'balance_after'
    );
END;
$$;

COMMENT ON FUNCTION public.deduct_partner_fee IS '通用费用扣款函数（支持自定义类别）';

-- ============================================================================
-- 第四部分：收款相关函数（_1114版本）
-- ============================================================================

-- 1. 收款函数（支持部分收款和金额校验）
CREATE OR REPLACE FUNCTION public.receive_invoice_payment_1114(
    p_request_number TEXT,
    p_received_amount NUMERIC,
    p_receipt_number TEXT DEFAULT NULL,
    p_receipt_bank TEXT DEFAULT NULL,
    p_receipt_images TEXT[] DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_record_ids UUID[];
    v_updated_count INTEGER := 0;
    v_user_id UUID;
    v_total_received NUMERIC(15,2) := 0;
    v_remaining_amount NUMERIC(15,2) := 0;
    v_receipt_record_id UUID;
    v_is_full_payment BOOLEAN := false;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以登记收款';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 获取申请信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    -- 只能对已开票状态的申请单进行收款
    IF v_request.status != 'Completed' AND v_request.status != 'Received' THEN
        RAISE EXCEPTION '只能对已开票或部分收款的申请单进行收款，当前状态: %', v_request.status;
    END IF;

    -- 获取开票金额和累计收款金额
    v_total_received := COALESCE(v_request.total_received_amount, 0);
    v_remaining_amount := COALESCE(v_request.total_amount, 0) - v_total_received;

    -- 金额校验
    IF p_received_amount <= 0 THEN
        RAISE EXCEPTION '收款金额必须大于0';
    END IF;

    IF p_received_amount > v_remaining_amount THEN
        RAISE EXCEPTION '收款金额超过未收款金额。开票金额：¥%s，已收款：¥%s，未收款：¥%s，本次收款：¥%s', 
            v_request.total_amount, v_total_received, v_remaining_amount, p_received_amount;
    END IF;

    -- 判断是否全额收款
    v_is_full_payment := (v_total_received + p_received_amount) >= COALESCE(v_request.total_amount, 0);

    -- 获取关联的运单ID
    SELECT ARRAY_AGG(DISTINCT logistics_record_id)
    INTO v_record_ids
    FROM public.invoice_request_details
    WHERE invoice_request_id = v_request.id;

    -- 1. 创建收款记录
    INSERT INTO public.invoice_receipt_records (
        invoice_request_id,
        receipt_number,
        receipt_bank,
        receipt_amount,
        receipt_images,
        receipt_date,
        received_by,
        notes
    ) VALUES (
        v_request.id,
        p_receipt_number,
        p_receipt_bank,
        p_received_amount,
        COALESCE(p_receipt_images, ARRAY[]::TEXT[]),
        NOW(),
        v_user_id,
        p_notes
    ) RETURNING id INTO v_receipt_record_id;

    -- 2. 更新申请单累计收款金额和状态
    UPDATE public.invoice_requests 
    SET 
        status = CASE 
            WHEN v_is_full_payment THEN 'Received'  -- 全额收款
            ELSE 'Completed'  -- 部分收款，保持已开票状态
        END,
        receipt_number = COALESCE(p_receipt_number, receipt_number),
        receipt_bank = COALESCE(p_receipt_bank, receipt_bank),
        received_amount = v_total_received + p_received_amount,
        total_received_amount = v_total_received + p_received_amount,
        received_at = CASE 
            WHEN v_is_full_payment THEN NOW()
            ELSE received_at
        END,
        received_by = CASE 
            WHEN v_is_full_payment THEN v_user_id
            ELSE received_by
        END,
        receipt_images = CASE 
            WHEN v_is_full_payment THEN COALESCE(p_receipt_images, ARRAY[]::TEXT[])
            ELSE receipt_images
        END,
        updated_at = NOW()
    WHERE request_number = p_request_number;

    -- 3. 更新运单收款状态（仅在全额收款时更新）
    IF v_is_full_payment AND v_record_ids IS NOT NULL AND array_length(v_record_ids, 1) > 0 THEN
        UPDATE public.logistics_records
        SET 
            receipt_status = 'Received',
            updated_at = NOW()
        WHERE id = ANY(v_record_ids)
          AND receipt_status = 'Unreceived';
        
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    END IF;

    -- 4. 给货主账号充值（正数）
    IF v_request.invoicing_partner_id IS NOT NULL THEN
        PERFORM public.update_partner_balance(
            p_partner_id := v_request.invoicing_partner_id,
            p_amount := p_received_amount,
            p_transaction_type := 'recharge',
            p_transaction_category := 'invoice_receipt',
            p_reference_type := 'invoice_receipt',
            p_reference_id := v_request.id,
            p_reference_number := p_request_number,
            p_description := format('开票收款：申请单 %s，本次收款金额 ¥%s（累计收款 ¥%s / 开票金额 ¥%s）', 
                p_request_number, p_received_amount, v_total_received + p_received_amount, v_request.total_amount)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', CASE 
            WHEN v_is_full_payment THEN 
                format('收款登记成功（全额收款），已更新 %s 条运单状态为已收款，已为货主账号充值 ¥%s', v_updated_count, p_received_amount)
            ELSE 
                format('收款登记成功（部分收款），本次收款 ¥%s，累计收款 ¥%s / 开票金额 ¥%s，已为货主账号充值 ¥%s', 
                    p_received_amount, v_total_received + p_received_amount, v_request.total_amount, p_received_amount)
        END,
        'updated_count', v_updated_count,
        'is_full_payment', v_is_full_payment,
        'total_received', v_total_received + p_received_amount,
        'remaining_amount', COALESCE(v_request.total_amount, 0) - (v_total_received + p_received_amount),
        'receipt_record_id', v_receipt_record_id
    );
END;
$$;

COMMENT ON FUNCTION public.receive_invoice_payment_1114 IS '登记开票申请单收款，支持部分收款和多次收款，更新申请单状态和运单收款状态（不更新开票状态）（_1114版本）';

-- 2. 退款函数
CREATE OR REPLACE FUNCTION public.refund_invoice_receipt_1114(
    p_request_number TEXT,
    p_refund_amount NUMERIC,
    p_receipt_record_id UUID DEFAULT NULL,
    p_refund_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_user_id UUID;
    v_current_received NUMERIC(15,2);
    v_new_received NUMERIC(15,2);
    v_refund_record_id UUID;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以处理退款';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 获取申请单信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    -- 检查申请单状态
    IF v_request.status != 'Received' AND COALESCE(v_request.total_received_amount, 0) <= 0 THEN
        RAISE EXCEPTION '该申请单没有收款记录，无法退款';
    END IF;

    -- 获取当前累计收款金额
    v_current_received := COALESCE(v_request.total_received_amount, 0);

    -- 校验退款金额
    IF p_refund_amount <= 0 THEN
        RAISE EXCEPTION '退款金额必须大于0';
    END IF;

    IF p_refund_amount > v_current_received THEN
        RAISE EXCEPTION '退款金额不能超过已收款金额。已收款：¥%s，退款金额：¥%s', 
            v_current_received, p_refund_amount;
    END IF;

    -- 计算新的累计收款金额
    v_new_received := v_current_received - p_refund_amount;

    -- 创建退款记录
    INSERT INTO public.invoice_receipt_records (
        invoice_request_id,
        receipt_number,
        receipt_bank,
        receipt_amount,
        receipt_images,
        receipt_date,
        received_by,
        notes
    ) VALUES (
        v_request.id,
        'REFUND-' || p_request_number,
        NULL,
        -p_refund_amount,
        ARRAY[]::TEXT[],
        NOW(),
        v_user_id,
        COALESCE(p_refund_reason, '退款')
    ) RETURNING id INTO v_refund_record_id;

    -- 更新申请单累计收款金额和状态
    UPDATE public.invoice_requests
    SET 
        status = CASE 
            WHEN v_new_received = 0 THEN 'Completed'
            WHEN v_new_received < v_request.total_amount THEN 'Completed'
            ELSE 'Received'
        END,
        total_received_amount = v_new_received,
        received_amount = v_new_received,
        updated_at = NOW()
    WHERE request_number = p_request_number;

    -- 如果全额退款，恢复运单收款状态
    IF v_new_received = 0 THEN
        UPDATE public.logistics_records
        SET 
            receipt_status = 'Unreceived',
            updated_at = NOW()
        WHERE id IN (
            SELECT logistics_record_id 
            FROM public.invoice_request_details 
            WHERE invoice_request_id = v_request.id
        );
    END IF;

    -- 扣减货主余额（负数）
    IF v_request.invoicing_partner_id IS NOT NULL THEN
        PERFORM public.update_partner_balance(
            p_partner_id := v_request.invoicing_partner_id,
            p_amount := -p_refund_amount,
            p_transaction_type := 'deduct',
            p_transaction_category := 'refund',
            p_reference_type := 'invoice_receipt',
            p_reference_id := v_request.id,
            p_reference_number := p_request_number,
            p_description := format('开票退款：申请单 %s，退款金额 ¥%s，原因：%s', 
                p_request_number, p_refund_amount, COALESCE(p_refund_reason, '退款'))
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('退款成功，退款金额 ¥%s，剩余收款金额 ¥%s', p_refund_amount, v_new_received),
        'refund_amount', p_refund_amount,
        'remaining_received', v_new_received,
        'refund_record_id', v_refund_record_id
    );
END;
$$;

COMMENT ON FUNCTION public.refund_invoice_receipt_1114 IS '处理开票申请单退款，扣减累计收款金额和货主余额（_1114版本）';

-- 3. 对账函数
CREATE OR REPLACE FUNCTION public.reconcile_invoice_receipt_1114(
    p_request_number TEXT,
    p_reconciliation_status TEXT DEFAULT 'Reconciled',
    p_reconciliation_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request record;
    v_user_id UUID;
BEGIN
    -- 检查权限
    IF NOT public.is_finance_or_admin() THEN
        RAISE EXCEPTION '权限不足：只有财务人员或管理员可以对账';
    END IF;

    -- 获取当前用户ID
    v_user_id := auth.uid();

    -- 获取申请单信息
    SELECT * INTO v_request
    FROM public.invoice_requests
    WHERE request_number = p_request_number;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '开票申请不存在: %', p_request_number;
    END IF;

    -- 校验对账状态
    IF p_reconciliation_status NOT IN ('Reconciled', 'Exception') THEN
        RAISE EXCEPTION '对账状态必须是 Reconciled 或 Exception';
    END IF;

    -- 更新对账信息
    UPDATE public.invoice_requests
    SET 
        reconciliation_status = p_reconciliation_status,
        reconciliation_date = NOW(),
        reconciliation_by = v_user_id,
        reconciliation_notes = p_reconciliation_notes,
        updated_at = NOW()
    WHERE request_number = p_request_number;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('对账完成，状态：%s', 
            CASE p_reconciliation_status 
                WHEN 'Reconciled' THEN '已对账'
                WHEN 'Exception' THEN '异常'
            END)
    );
END;
$$;

COMMENT ON FUNCTION public.reconcile_invoice_receipt_1114 IS '对账开票申请单收款记录（_1114版本）';

-- 4. 收款提醒函数（集成通知系统）
CREATE OR REPLACE FUNCTION public.send_receipt_reminders_1114(
    p_days_before_due INTEGER DEFAULT 3,
    p_overdue_reminder_interval INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_overdue_request RECORD;
    v_due_soon_request RECORD;
    v_reminder_count INTEGER := 0;
    v_overdue_count INTEGER := 0;
    v_is_overdue BOOLEAN;
    v_days_overdue INTEGER;
BEGIN
    -- 查找逾期未收款申请单
    FOR v_overdue_request IN
        SELECT ir.*, 
               CURRENT_DATE - ir.payment_due_date as days_overdue
        FROM public.invoice_requests ir
        WHERE ir.status = 'Completed'
          AND COALESCE(ir.total_received_amount, 0) < ir.total_amount
          AND ir.payment_due_date IS NOT NULL
          AND ir.payment_due_date < CURRENT_DATE
          AND (
              ir.last_reminder_at IS NULL 
              OR ir.last_reminder_at < CURRENT_DATE - (p_overdue_reminder_interval || ' days')::INTERVAL
          )
    LOOP
        v_is_overdue := true;
        v_days_overdue := v_overdue_request.days_overdue;
        
        -- 更新提醒记录
        UPDATE public.invoice_requests
        SET 
            reminder_count = reminder_count + 1,
            last_reminder_at = NOW(),
            overdue_days = v_days_overdue,
            updated_at = NOW()
        WHERE id = v_overdue_request.id;
        
        -- 为财务人员创建通知
        INSERT INTO public.notifications (
            user_id,
            type,
            category,
            title,
            message,
            link,
            related_id,
            is_read,
            created_at
        )
        SELECT
            u.id,
            'warning',
            'finance',
            format('收款逾期提醒：申请单 %s', v_overdue_request.request_number),
            format('申请单 %s 已逾期 %s 天，未收款金额：¥%s。请及时跟进收款。',
                v_overdue_request.request_number,
                COALESCE(v_days_overdue, 0),
                v_overdue_request.total_amount - COALESCE(v_overdue_request.total_received_amount, 0) - COALESCE(v_overdue_request.received_amount, 0)),
            format('/finance/payment-invoice?requestNumber=%s', v_overdue_request.request_number),
            v_overdue_request.id,
            false,
            NOW()
        FROM auth.users u
        WHERE (u.raw_user_meta_data->>'role')::text IN ('admin', 'finance')
           OR EXISTS (
               SELECT 1
               FROM public.user_permissions up
               WHERE up.user_id = u.id
                 AND up.permission_key = 'finance.payment_invoice'
           );
        
        v_overdue_count := v_overdue_count + 1;
    END LOOP;

    -- 查找即将到期申请单
    FOR v_due_soon_request IN
        SELECT ir.*
        FROM public.invoice_requests ir
        WHERE ir.status = 'Completed'
          AND COALESCE(ir.total_received_amount, 0) < ir.total_amount
          AND ir.payment_due_date IS NOT NULL
          AND ir.payment_due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + (p_days_before_due || ' days')::INTERVAL)
          AND (
              ir.last_reminder_at IS NULL 
              OR ir.last_reminder_at < CURRENT_DATE - INTERVAL '1 day'
          )
    LOOP
        v_is_overdue := false;
        
        -- 更新提醒记录
        UPDATE public.invoice_requests
        SET 
            reminder_count = reminder_count + 1,
            last_reminder_at = NOW(),
            updated_at = NOW()
        WHERE id = v_due_soon_request.id;
        
        -- 为财务人员创建通知
        INSERT INTO public.notifications (
            user_id,
            type,
            category,
            title,
            message,
            link,
            related_id,
            is_read,
            created_at
        )
        SELECT
            u.id,
            'info',
            'finance',
            format('收款即将到期提醒：申请单 %s', v_due_soon_request.request_number),
            format('申请单 %s 将在 %s 天后到期，未收款金额：¥%s。请及时跟进收款。',
                v_due_soon_request.request_number,
                (v_due_soon_request.payment_due_date - CURRENT_DATE),
                v_due_soon_request.total_amount - COALESCE(v_due_soon_request.total_received_amount, 0) - COALESCE(v_due_soon_request.received_amount, 0)),
            format('/finance/payment-invoice?requestNumber=%s', v_due_soon_request.request_number),
            v_due_soon_request.id,
            false,
            NOW()
        FROM auth.users u
        WHERE (u.raw_user_meta_data->>'role')::text IN ('admin', 'finance')
           OR EXISTS (
               SELECT 1
               FROM public.user_permissions up
               WHERE up.user_id = u.id
                 AND up.permission_key = 'finance.payment_invoice'
           );
        
        v_reminder_count := v_reminder_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'overdue_reminders', v_overdue_count,
        'due_soon_reminders', v_reminder_count,
        'total_reminders', v_overdue_count + v_reminder_count,
        'message', format('已发送 %s 条逾期提醒，%s 条到期提醒', v_overdue_count, v_reminder_count)
    );
END;
$$;

COMMENT ON FUNCTION public.send_receipt_reminders_1114 IS '发送收款提醒（逾期提醒和到期前提醒），集成通知系统（_1114版本）';

-- 5. 收款统计函数
CREATE OR REPLACE FUNCTION public.get_receipt_statistics_1114(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_stats JSONB;
BEGIN
    WITH stats AS (
        SELECT 
            COALESCE(SUM(total_amount), 0) AS total_invoiced,
            COALESCE(SUM(total_received_amount), 0) AS total_received,
            COALESCE(SUM(total_amount - COALESCE(total_received_amount, 0)), 0) AS total_unreceived,
            COUNT(*) FILTER (WHERE payment_due_date < CURRENT_DATE AND status = 'Completed' AND COALESCE(total_received_amount, 0) < total_amount) AS overdue_count,
            COALESCE(SUM(total_amount - COALESCE(total_received_amount, 0)) FILTER (WHERE payment_due_date < CURRENT_DATE AND status = 'Completed' AND COALESCE(total_received_amount, 0) < total_amount), 0) AS overdue_amount
        FROM public.invoice_requests
        WHERE (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
          AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
          AND (p_partner_id IS NULL OR invoicing_partner_id = p_partner_id)
    )
    SELECT jsonb_build_object(
        'total_invoiced', stats.total_invoiced,
        'total_received', stats.total_received,
        'total_unreceived', stats.total_unreceived,
        'receipt_rate', CASE 
            WHEN stats.total_invoiced > 0 THEN 
                ROUND((stats.total_received / stats.total_invoiced * 100)::numeric, 2)
            ELSE 0 
        END,
        'overdue_amount', stats.overdue_amount,
        'overdue_count', stats.overdue_count
    ) INTO v_stats
    FROM stats;

    RETURN jsonb_build_object('success', true, 'statistics', v_stats);
END;
$$;

COMMENT ON FUNCTION public.get_receipt_statistics_1114 IS '获取收款统计信息（_1114版本）';

-- 6. 收款详情报表函数
CREATE OR REPLACE FUNCTION public.get_receipt_details_report_1114(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_partner_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_page_number INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_records JSONB;
    v_total_count INTEGER;
    v_offset INTEGER;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 获取总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.invoice_requests ir
    WHERE (p_start_date IS NULL OR DATE(ir.created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(ir.created_at) <= p_end_date)
      AND (p_partner_id IS NULL OR ir.invoicing_partner_id = p_partner_id)
      AND (p_status IS NULL OR ir.status = p_status);
    
    -- 获取详情记录
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', ir.id,
            'request_number', ir.request_number,
            'invoicing_partner_id', ir.invoicing_partner_id,
            'invoicing_partner_full_name', ir.invoicing_partner_full_name,
            'total_amount', ir.total_amount,
            'total_received_amount', COALESCE(ir.total_received_amount, 0),
            'remaining_amount', ir.total_amount - COALESCE(ir.total_received_amount, 0),
            'payment_due_date', ir.payment_due_date,
            'overdue_days', COALESCE(ir.overdue_days, 0),
            'status', ir.status,
            'reconciliation_status', COALESCE(ir.reconciliation_status, 'Unreconciled'),
            'created_at', ir.created_at
        ) ORDER BY ir.created_at DESC
    ) INTO v_records
    FROM public.invoice_requests ir
    WHERE (p_start_date IS NULL OR DATE(ir.created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(ir.created_at) <= p_end_date)
      AND (p_partner_id IS NULL OR ir.invoicing_partner_id = p_partner_id)
      AND (p_status IS NULL OR ir.status = p_status)
    ORDER BY ir.created_at DESC
    LIMIT p_page_size OFFSET v_offset;
    
    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', p_page_number,
        'page_size', p_page_size,
        'total_pages', CEIL(v_total_count::NUMERIC / p_page_size)
    );
END;
$$;

COMMENT ON FUNCTION public.get_receipt_details_report_1114 IS '获取收款详情报表（_1114版本）';

-- 7. 查询收款记录函数
CREATE OR REPLACE FUNCTION public.get_receipt_records_1114(
    p_request_number TEXT DEFAULT NULL,
    p_invoice_request_id UUID DEFAULT NULL,
    p_page_number INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_request_id UUID;
    v_records JSONB;
    v_total_count INTEGER;
    v_offset INTEGER;
BEGIN
    v_offset := (p_page_number - 1) * p_page_size;
    
    -- 如果提供了申请单号，先获取ID
    IF p_request_number IS NOT NULL THEN
        SELECT id INTO v_request_id
        FROM public.invoice_requests
        WHERE request_number = p_request_number;
        
        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', '开票申请不存在');
        END IF;
    ELSIF p_invoice_request_id IS NOT NULL THEN
        v_request_id := p_invoice_request_id;
    ELSE
        RETURN jsonb_build_object('success', false, 'message', '必须提供申请单号或申请单ID');
    END IF;

    -- 获取总数
    SELECT COUNT(*) INTO v_total_count
    FROM public.invoice_receipt_records
    WHERE invoice_request_id = v_request_id;

    -- 查询收款记录
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', irr.id,
            'receipt_number', irr.receipt_number,
            'receipt_bank', irr.receipt_bank,
            'receipt_amount', irr.receipt_amount,
            'receipt_images', irr.receipt_images,
            'receipt_date', irr.receipt_date,
            'received_by', irr.received_by,
            'received_by_name', (SELECT full_name FROM public.profiles WHERE id = irr.received_by),
            'notes', irr.notes,
            'created_at', irr.created_at
        ) ORDER BY irr.receipt_date DESC
    ) INTO v_records
    FROM public.invoice_receipt_records irr
    WHERE irr.invoice_request_id = v_request_id
    ORDER BY irr.receipt_date DESC
    LIMIT p_page_size OFFSET v_offset;

    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', p_page_number,
        'page_size', p_page_size,
        'total_pages', CEIL(v_total_count::NUMERIC / p_page_size)
    );
END;
$$;

COMMENT ON FUNCTION public.get_receipt_records_1114 IS '查询收款记录列表（支持多次收款）（_1114版本）';

-- ============================================================================
-- 第五部分：更新 get_invoice_requests_filtered 函数（_1114版本）
-- ============================================================================

-- 更新函数，添加收款相关字段和支持p_invoicing_partner_id、分页参数
CREATE OR REPLACE FUNCTION public.get_invoice_requests_filtered_1114(
    p_request_number TEXT DEFAULT NULL,
    p_waybill_number TEXT DEFAULT NULL,
    p_driver_name TEXT DEFAULT NULL,
    p_loading_date DATE DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_license_plate TEXT DEFAULT NULL,
    p_phone_number TEXT DEFAULT NULL,
    p_platform_name TEXT DEFAULT NULL,
    p_invoicing_partner_id UUID DEFAULT NULL,  -- ✅ 新增：开票方（货主）ID筛选
    p_page_number INTEGER DEFAULT 1,  -- ✅ 新增：页码（从1开始）
    p_page_size INTEGER DEFAULT 20,  -- ✅ 新增：每页数量
    p_limit INTEGER DEFAULT NULL,  -- 兼容旧参数（如果提供则使用）
    p_offset INTEGER DEFAULT NULL  -- 兼容旧参数（如果提供则使用）
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_where_clause TEXT := '';
    v_where_conditions TEXT[] := ARRAY[]::TEXT[];
    v_limit INTEGER;
    v_offset INTEGER;
    v_records JSONB;
    v_total_count BIGINT;
BEGIN
    -- 计算分页参数（优先使用p_page_number和p_page_size，兼容p_limit和p_offset）
    IF p_limit IS NOT NULL AND p_offset IS NOT NULL THEN
        v_limit := p_limit;
        v_offset := p_offset;
    ELSE
        v_limit := p_page_size;
        v_offset := (p_page_number - 1) * p_page_size;
    END IF;
    
    -- 构建WHERE条件
    IF p_invoicing_partner_id IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.invoicing_partner_id = %L::uuid', p_invoicing_partner_id::text));
    END IF;
    
    IF p_request_number IS NOT NULL AND p_request_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.request_number = %L', p_request_number));
    END IF;

    IF p_waybill_number IS NOT NULL AND p_waybill_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND (lr.auto_number = %L OR %L = ANY(lr.external_tracking_numbers)))', 
                p_waybill_number, p_waybill_number));
    END IF;

    IF p_driver_name IS NOT NULL AND p_driver_name != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.driver_name = %L)', 
                p_driver_name));
    END IF;

    IF p_loading_date IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.loading_date::date = %L::date)', 
                p_loading_date));
    END IF;

    IF p_status IS NOT NULL AND p_status != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('ir.status = %L', p_status));
    END IF;

    IF p_project_id IS NOT NULL THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.project_id = %L::uuid)', 
                p_project_id::text));
    END IF;

    IF p_license_plate IS NOT NULL AND p_license_plate != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.license_plate = %L)', 
                p_license_plate));
    END IF;

    IF p_phone_number IS NOT NULL AND p_phone_number != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND lr.driver_phone = %L)', 
                p_phone_number));
    END IF;

    IF p_platform_name IS NOT NULL AND p_platform_name != '' THEN
        v_where_conditions := array_append(v_where_conditions, 
            format('EXISTS (SELECT 1 FROM invoice_request_details ird INNER JOIN logistics_records lr ON ird.logistics_record_id = lr.id WHERE ird.invoice_request_id = ir.id AND %L = ANY(lr.external_tracking_numbers))', 
                p_platform_name));
    END IF;

    -- 构建WHERE子句
    IF array_length(v_where_conditions, 1) > 0 THEN
        v_where_clause := 'WHERE ' || array_to_string(v_where_conditions, ' AND ');
    END IF;

    -- 获取总数
    EXECUTE format('
        SELECT COUNT(*)::BIGINT
        FROM invoice_requests ir
        %s
    ', v_where_clause) INTO v_total_count;

    -- 执行查询并返回结果
    EXECUTE format('
        WITH filtered_requests AS (
            SELECT 
                ir.id,
                ir.created_at,
                ir.request_number,
                ir.invoicing_partner_id,
                ir.partner_id,
                ir.partner_name,
                ir.partner_full_name,
                ir.invoicing_partner_full_name,
                ir.invoicing_partner_tax_number,
                ir.tax_number,
                ir.invoice_number,
                ir.total_amount,
                COALESCE(ir.total_received_amount, 0) AS total_received_amount,
                ir.payment_due_date,
                COALESCE(ir.overdue_days, 0) AS overdue_days,
                COALESCE(ir.reminder_count, 0) AS reminder_count,
                COALESCE(ir.reconciliation_status, ''Unreconciled'') AS reconciliation_status,
                ir.record_count,
                ir.status,
                ir.created_by,
                ir.remarks
            FROM invoice_requests ir
            %s
            ORDER BY ir.created_at DESC
            LIMIT %s OFFSET %s
        ),
        request_stats AS (
            SELECT 
                fr.id,
                COALESCE(
                    CASE 
                        WHEN MIN(lr.loading_date) = MAX(lr.loading_date) THEN 
                            TO_CHAR(MIN(lr.loading_date) AT TIME ZONE ''UTC'', ''YYYY-MM-DD'')
                        ELSE 
                            TO_CHAR(MIN(lr.loading_date) AT TIME ZONE ''UTC'', ''YYYY-MM-DD'') || '' ~ '' || 
                            TO_CHAR(MAX(lr.loading_date) AT TIME ZONE ''UTC'', ''YYYY-MM-DD'')
                    END,
                    ''''-'''' 
                ) AS loading_date_range,
                COALESCE(SUM(
                    CASE 
                        WHEN p.partner_type = ''货主'' THEN lpc.payable_amount 
                        ELSE 0 
                    END
                ), 0) AS total_payable_cost
            FROM filtered_requests fr
            LEFT JOIN invoice_request_details ird ON ird.invoice_request_id = fr.id
            LEFT JOIN logistics_records lr ON ird.logistics_record_id = lr.id
            LEFT JOIN logistics_partner_costs lpc ON lpc.logistics_record_id = lr.id
            LEFT JOIN partners p ON p.id = lpc.partner_id
            GROUP BY fr.id
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                ''id'', fr.id,
                ''created_at'', fr.created_at,
                ''request_number'', fr.request_number,
                ''invoicing_partner_id'', fr.invoicing_partner_id,
                ''partner_id'', fr.partner_id,
                ''partner_name'', fr.partner_name,
                ''partner_full_name'', fr.partner_full_name,
                ''invoicing_partner_full_name'', fr.invoicing_partner_full_name,
                ''invoicing_partner_tax_number'', fr.invoicing_partner_tax_number,
                ''tax_number'', fr.tax_number,
                ''invoice_number'', fr.invoice_number,
                ''total_amount'', fr.total_amount,
                ''total_received_amount'', fr.total_received_amount,
                ''payment_due_date'', fr.payment_due_date,
                ''overdue_days'', fr.overdue_days,
                ''reminder_count'', fr.reminder_count,
                ''reconciliation_status'', fr.reconciliation_status,
                ''record_count'', fr.record_count,
                ''status'', fr.status,
                ''created_by'', fr.created_by,
                ''remarks'', fr.remarks,
                ''loading_date_range'', COALESCE(rs.loading_date_range, ''''-''''),
                ''total_payable_cost'', COALESCE(rs.total_payable_cost, 0)
            )
        )
        FROM filtered_requests fr
        LEFT JOIN request_stats rs ON rs.id = fr.id
    ', v_where_clause, v_limit, v_offset) INTO v_records;

    RETURN jsonb_build_object(
        'success', true,
        'records', COALESCE(v_records, '[]'::jsonb),
        'total_count', v_total_count,
        'page_number', p_page_number,
        'page_size', p_page_size,
        'total_pages', CEIL(v_total_count::NUMERIC / p_page_size)
    );
END;
$$;

COMMENT ON FUNCTION public.get_invoice_requests_filtered_1114 IS '
开票申请单筛选查询函数（已添加收款相关字段，支持p_invoicing_partner_id和分页参数）
- 新增字段：
  1. total_received_amount: 累计收款金额（支持部分收款）
  2. payment_due_date: 收款期限
  3. overdue_days: 逾期天数
  4. reminder_count: 提醒次数
  5. reconciliation_status: 对账状态
- 新增参数：
  1. p_invoicing_partner_id: 开票方（货主）ID筛选
  2. p_page_number: 页码（从1开始）
  3. p_page_size: 每页数量
- 原有字段：
  1. loading_date_range: 运单装货日期范围
  2. total_payable_cost: 司机应收合计
';

