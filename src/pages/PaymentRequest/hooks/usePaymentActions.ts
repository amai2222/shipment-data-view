// 付款申请操作逻辑Hook
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LogisticsRecord, PaymentPreviewData, FinalPaymentData } from '../types';

export function usePaymentActions() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const generatePaymentPreview = async (
    records: LogisticsRecord[]
  ): Promise<PaymentPreviewData | null> => {
    setIsGenerating(true);
    try {
      const sheetMap = new Map<string, any>();

      for (const rec of records) {
        if (rec.payment_status !== 'Unpaid') continue;
        
        const costs = Array.isArray(rec.partner_costs) ? rec.partner_costs : [];
        if (costs.length === 0) continue;

        const recMaxLevel = Math.max(...costs.map(c => c.level));
        
        for (const cost of costs) {
          const shouldInclude = costs.length === 1 || cost.level < recMaxLevel;
          
          if (shouldInclude) {
            const key = cost.partner_id;
            if (!sheetMap.has(key)) {
              sheetMap.set(key, {
                paying_partner_id: key,
                paying_partner_full_name: cost.full_name || cost.partner_name,
                paying_partner_bank_account: cost.bank_account || '',
                paying_partner_bank_name: cost.bank_name || '',
                paying_partner_branch_name: cost.branch_name || '',
                record_count: 0,
                total_payable: 0,
                header_company_name: rec.project_name,
                records: []
              });
            }
            
            const sheet = sheetMap.get(key);
            if (!sheet.records.some((r: any) => r.record.id === rec.id)) {
              sheet.record_count += 1;
            }
            sheet.records.push({ record: rec, payable_amount: cost.payable_amount });
            sheet.total_payable += Number(cost.payable_amount || 0);
          }
        }
      }

      const sheets = Array.from(sheetMap.values());
      const finalRecordIds = new Set<string>();
      sheets.forEach(sheet => {
        sheet.records.forEach((item: any) => finalRecordIds.add(item.record.id));
      });

      return { sheets, processed_record_ids: Array.from(finalRecordIds) };
    } catch (error) {
      console.error('生成付款预览失败:', error);
      toast({ title: '错误', description: '生成预览失败', variant: 'destructive' });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const savePaymentRequests = async (data: FinalPaymentData): Promise<boolean> => {
    setIsSaving(true);
    try {
      const recordIds = data.all_record_ids;
      
      const { error: statusError } = await supabase
        .from('logistics_records')
        .update({ payment_status: 'Processing' })
        .in('id', recordIds);

      if (statusError) throw statusError;

      for (const sheet of data.sheets) {
        const sheetRecordIds = sheet.records.map((item: any) => item.record.id);
        
        const { error: requestError } = await supabase
          .from('payment_requests')
          .insert({
            logistics_record_ids: sheetRecordIds,
            status: 'Pending',
            notes: `${sheet.paying_partner_full_name} - ${sheet.record_count}条运单`
          });

        if (requestError) throw requestError;

        const { error: costsError } = await supabase
          .from('logistics_partner_costs')
          .update({ payment_status: 'Processing' })
          .in('logistics_record_id', sheetRecordIds)
          .eq('partner_id', sheet.paying_partner_id);

        if (costsError) throw costsError;
      }

      toast({ 
        title: '付款申请创建成功', 
        description: `已为 ${data.sheets.length} 个合作方创建付款申请` 
      });
      
      return true;
    } catch (error) {
      console.error('保存付款申请失败:', error);
      toast({ 
        title: '保存失败', 
        description: (error as Error).message, 
        variant: 'destructive' 
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isGenerating,
    isSaving,
    generatePaymentPreview,
    savePaymentRequests
  };
}

