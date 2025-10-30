// 付款申请列表操作Hook
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function usePaymentRequestActions() {
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handlePayment = async (req: any) => {
    setExportingId(req.id);
    try {
      const { data, error } = await supabase.rpc('set_payment_status_for_waybills', {
        p_record_ids: req.logistics_record_ids,
        p_payment_status: 'Paid'
      });

      if (error) throw error;

      const result = data as any;
      toast({
        title: '付款成功',
        description: `已更新 ${result?.updated_waybills || 0} 条运单`
      });
      return true;
    } catch (error) {
      toast({ title: '付款失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    } finally {
      setExportingId(null);
    }
  };

  const handleCancelPayment = async (req: any) => {
    setExportingId(req.id);
    try {
      const { error } = await supabase.rpc('void_payment_for_request', {
        p_request_id: req.request_id,
        p_cancel_reason: '手动取消付款'
      });

      if (error) throw error;

      toast({ title: '取消付款成功' });
      return true;
    } catch (error) {
      toast({ title: '取消付款失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    } finally {
      setExportingId(null);
    }
  };

  const handleRollbackApproval = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc('rollback_payment_request_approval', {
        p_request_id: requestId
      });

      if (error) throw error;

      toast({ title: '审批回滚成功' });
      return true;
    } catch (error) {
      toast({ title: '审批回滚失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    }
  };

  return {
    exportingId,
    handlePayment,
    handleCancelPayment,
    handleRollbackApproval
  };
}

