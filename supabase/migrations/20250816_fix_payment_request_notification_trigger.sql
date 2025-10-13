-- 修复付款申请通知触发器错误
-- 问题：触发器尝试访问不存在的project_id字段
-- 解决：从关联的运单记录中获取项目信息

CREATE OR REPLACE FUNCTION public.notify_payment_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_name text;
  v_total_amount numeric;
  v_user_record record;
BEGIN
  -- ✅ 从partner_payment_items获取关联的运单记录和计算总金额
  -- payment_requests表本身没有project_id和total_amount字段
  SELECT 
    DISTINCT lr.project_name,
    SUM(lpc.payable_amount) OVER () as total_amount
  INTO v_project_name, v_total_amount
  FROM public.partner_payment_items ppi
  JOIN public.logistics_records lr ON ppi.logistics_record_id = lr.id
  LEFT JOIN public.logistics_partner_costs lpc ON ppi.logistics_record_id = lpc.logistics_record_id
  WHERE ppi.payment_request_id = NEW.id
  LIMIT 1;
  
  -- 如果没有找到，使用默认值
  v_project_name := COALESCE(v_project_name, '未知项目');
  v_total_amount := COALESCE(v_total_amount, 0);

  -- 通知所有admin和finance角色的用户
  FOR v_user_record IN 
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'finance') AND is_active = true
  LOOP
    PERFORM public.create_payment_request_notification(
      v_user_record.id,
      NEW.id,
      v_total_amount,
      v_project_name
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- 确保触发器存在并绑定到正确的表
DROP TRIGGER IF EXISTS trigger_payment_request_notification ON public.payment_requests;
CREATE TRIGGER trigger_payment_request_notification
AFTER INSERT ON public.payment_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_payment_request_created();

-- 添加注释说明
COMMENT ON FUNCTION public.notify_payment_request_created() IS '
付款申请创建通知触发器函数
修复内容：
1. 不再依赖不存在的project_id字段
2. 从payment_request_items和logistics_records获取项目信息
3. 增强容错处理
';

