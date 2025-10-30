// 财务开票操作逻辑Hook
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useInvoiceRequestActions() {
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const { toast } = useToast();

  const handleBatchInvoice = async (selectedIds: string[]) => {
    setIsBatchProcessing(true);
    try {
      for (const id of selectedIds) {
        const { data: request } = await supabase.from('invoice_requests').select('*').eq('id', id).single();
        if (!request || request.status !== 'Approved') continue;

        const { error: statusError } = await supabase.from('invoice_requests').update({ status: 'Completed' }).eq('id', id);
        if (statusError) throw statusError;

        const { data: details } = await supabase.from('invoice_request_details').select('logistics_record_id').eq('invoice_request_id', id);
        const recordIds = details?.map(d => d.logistics_record_id) || [];

        if (recordIds.length > 0) {
          await supabase.from('logistics_records').update({ invoice_status: 'Invoiced' }).in('id', recordIds);
          await supabase.from('logistics_partner_costs').update({ invoice_status: 'Invoiced' }).in('logistics_record_id', recordIds);
        }
      }

      toast({ title: '批量开票成功', description: `已完成 ${selectedIds.length} 个开票申请` });
      return true;
    } catch (error) {
      console.error('批量开票失败:', error);
      toast({ title: '批量开票失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchCancelInvoice = async (selectedIds: string[]) => {
    setIsBatchProcessing(true);
    try {
      const { error } = await supabase.from('invoice_requests').update({ status: 'Approved' }).in('id', selectedIds).eq('status', 'Completed');
      if (error) throw error;

      toast({ title: '取消付款完成', description: `已将 ${selectedIds.length} 个申请单回滚` });
      return true;
    } catch (error) {
      console.error('取消付款失败:', error);
      toast({ title: '取消付款失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchVoid = async (selectedIds: string[]) => {
    setIsBatchProcessing(true);
    try {
      const { data, error } = await supabase.rpc('void_and_delete_invoice_requests', { p_request_ids: selectedIds });
      if (error) throw error;

      const result = data as any;
      toast({ 
        title: '作废成功', 
        description: `已删除 ${result.deleted_requests || 0} 个申请单` 
      });
      return true;
    } catch (error) {
      console.error('作废失败:', error);
      toast({ title: '作废失败', description: (error as Error).message, variant: 'destructive' });
      return false;
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return { handleBatchInvoice, handleBatchCancelInvoice, handleBatchVoid, isBatchProcessing };
}

