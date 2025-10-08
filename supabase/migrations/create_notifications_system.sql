-- 创建通知系统
-- 包含通知表、自动通知触发器、通知生成函数

-- ============================================
-- 1. 创建通知表
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('info', 'warning', 'success', 'error')),
  category text NOT NULL CHECK (category IN ('system', 'business', 'finance', 'contract')),
  title text NOT NULL,
  message text NOT NULL,
  link text, -- 可选的跳转链接
  related_id uuid, -- 关联的记录ID（如项目ID、申请单ID等）
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read, created_at DESC);

-- 启用RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS策略：用户只能看到自己的通知
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- ============================================
-- 2. 创建通知生成函数
-- ============================================

-- 生成付款申请通知
CREATE OR REPLACE FUNCTION public.create_payment_request_notification(
  p_user_id uuid,
  p_request_id uuid,
  p_amount numeric,
  p_project_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    category,
    title,
    message,
    link,
    related_id
  ) VALUES (
    p_user_id,
    'warning',
    'finance',
    '新的付款申请',
    format('项目"%s"有新的付款申请，金额¥%s', p_project_name, p_amount::text),
    '/m/payment-requests-management',
    p_request_id
  );
END;
$$;

-- 生成合同到期提醒
CREATE OR REPLACE FUNCTION public.create_contract_expiry_notification(
  p_user_id uuid,
  p_contract_id uuid,
  p_contract_number text,
  p_days_until_expiry integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    category,
    title,
    message,
    link,
    related_id
  ) VALUES (
    p_user_id,
    'warning',
    'contract',
    '合同即将到期',
    format('合同"%s"将于%s天后到期，请及时处理', p_contract_number, p_days_until_expiry::text),
    '/m/contracts',
    p_contract_id
  );
END;
$$;

-- 生成项目完成通知
CREATE OR REPLACE FUNCTION public.create_project_completion_notification(
  p_user_id uuid,
  p_project_id uuid,
  p_project_name text,
  p_total_tonnage numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    category,
    title,
    message,
    link,
    related_id
  ) VALUES (
    p_user_id,
    'success',
    'business',
    '项目已完成',
    format('项目"%s"已顺利完成，总运量达到%s吨', p_project_name, p_total_tonnage::text),
    format('/m/projects/detail/%s', p_project_id::text),
    p_project_id
  );
END;
$$;

-- ============================================
-- 3. 创建自动通知触发器
-- ============================================

-- 付款申请创建时通知管理员和财务
CREATE OR REPLACE FUNCTION public.notify_payment_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_name text;
  v_user_record record;
BEGIN
  -- 获取项目名称
  SELECT name INTO v_project_name
  FROM public.projects
  WHERE id = NEW.project_id;

  -- 通知所有admin和finance角色的用户
  FOR v_user_record IN 
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'finance') AND is_active = true
  LOOP
    PERFORM public.create_payment_request_notification(
      v_user_record.id,
      NEW.id,
      NEW.total_amount,
      COALESCE(v_project_name, '未知项目')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 绑定触发器
DROP TRIGGER IF EXISTS trigger_payment_request_notification ON public.payment_requests;
CREATE TRIGGER trigger_payment_request_notification
AFTER INSERT ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_payment_request_created();

-- ============================================
-- 4. 定时任务：检查即将到期的合同
-- ============================================

-- 创建检查合同到期的函数
CREATE OR REPLACE FUNCTION public.check_expiring_contracts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract record;
  v_user_record record;
  v_days_until_expiry integer;
BEGIN
  -- 查找30天内到期的合同
  FOR v_contract IN 
    SELECT id, contract_number, end_date, responsible_person
    FROM public.contracts
    WHERE status = 'active'
    AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  LOOP
    v_days_until_expiry := (v_contract.end_date - CURRENT_DATE);
    
    -- 通知负责人和管理员
    FOR v_user_record IN 
      SELECT id FROM public.profiles 
      WHERE (role = 'admin' OR full_name = v_contract.responsible_person)
      AND is_active = true
    LOOP
      -- 检查是否已经发送过通知（避免重复）
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_user_record.id
        AND related_id = v_contract.id
        AND created_at > CURRENT_DATE - INTERVAL '7 days'
      ) THEN
        PERFORM public.create_contract_expiry_notification(
          v_user_record.id,
          v_contract.id,
          v_contract.contract_number,
          v_days_until_expiry
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================
-- 5. 通知查询函数
-- ============================================

-- 获取用户的通知列表
CREATE OR REPLACE FUNCTION public.get_user_notifications(
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_is_read boolean DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  type text,
  category text,
  title text,
  message text,
  link text,
  related_id uuid,
  is_read boolean,
  created_at timestamptz,
  read_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.type,
    n.category,
    n.title,
    n.message,
    n.link,
    n.related_id,
    n.is_read,
    n.created_at,
    n.read_at
  FROM public.notifications n
  WHERE n.user_id = p_user_id
  AND (p_is_read IS NULL OR n.is_read = p_is_read)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 获取未读通知数量
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_count
  FROM public.notifications
  WHERE user_id = p_user_id AND is_read = false;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- 标记通知为已读
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true, read_at = now()
  WHERE id = p_notification_id AND user_id = p_user_id;
END;
$$;

-- 标记所有通知为已读
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true, read_at = now()
  WHERE user_id = p_user_id AND is_read = false;
END;
$$;

-- 删除通知
CREATE OR REPLACE FUNCTION public.delete_notification(p_notification_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE id = p_notification_id AND user_id = p_user_id;
END;
$$;

-- ============================================
-- 6. 批量创建示例通知（可选）
-- ============================================

COMMENT ON TABLE public.notifications IS '系统通知表';
COMMENT ON FUNCTION public.get_user_notifications IS '获取用户通知列表';
COMMENT ON FUNCTION public.get_unread_notification_count IS '获取未读通知数量';
COMMENT ON FUNCTION public.check_expiring_contracts IS '检查即将到期的合同并生成通知';

