-- 删除开票申请单的Processing状态，简化状态流程
-- 目标：Pending (待审核) → Approved (已审批) → Completed (已完成)
-- 变更：Processing (处理中) → Approved (已审批)

BEGIN;

-- 1. 将所有Processing状态的开票申请单改为Approved
UPDATE public.invoice_requests
SET 
    status = 'Approved',
    updated_at = NOW()
WHERE status = 'Processing';

-- 2. 记录迁移日志
DO $$
DECLARE
    v_affected_count integer;
BEGIN
    GET DIAGNOSTICS v_affected_count = ROW_COUNT;
    RAISE NOTICE '已将 % 个开票申请单的状态从 Processing 更新为 Approved', v_affected_count;
END $$;

COMMIT;

-- 说明：
-- 此迁移脚本将开票申请的状态流程简化为：
-- 1. Pending (待审核) - 业务员提交申请后的初始状态
-- 2. Approved (已审批) - 开票审核页面点击"审核"按钮后的状态
-- 3. Completed (已完成) - 财务开票页面点击"开票"按钮后的状态
-- 4. Rejected (已拒绝) - 审核不通过
-- 5. Voided (已作废) - 申请单作废
--
-- 删除了 Processing (处理中) 状态，使流程更加清晰简洁

