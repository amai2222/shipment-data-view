// 开票申请操作逻辑Hook
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LogisticsRecord, InvoicePreviewData, FinalInvoiceData } from '@/types/invoiceRequest';

export function useInvoiceActions() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // 生成开票申请预览
  const generateInvoicePreview = async (
    records: LogisticsRecord[], 
    selectionMode: string
  ): Promise<InvoicePreviewData | null> => {
    setIsGenerating(true);
    try {
      const sheetMap = new Map<string, any>();

      for (const rec of records) {
        if (rec.invoice_status !== 'Uninvoiced') continue;
        
        const costs = Array.isArray(rec.partner_costs) ? rec.partner_costs : [];
        if (costs.length === 0) continue;

        const recMaxLevel = Math.max(...costs.map(c => c.level));
        
        for (const cost of costs) {
          const shouldInclude = costs.length === 1 || cost.level < recMaxLevel;
          
          if (shouldInclude) {
            const key = cost.partner_id;
            if (!sheetMap.has(key)) {
              sheetMap.set(key, {
                invoicing_partner_id: key,
                invoicing_partner_full_name: cost.full_name || cost.partner_name,
                invoicing_partner_tax_number: '',
                record_count: 0,
                total_invoiceable: 0,
                records: [],
                partner_costs: []
              });
            }
            
            const sheet = sheetMap.get(key);
            const existingRecord = sheet.records.find((r: any) => r.id === rec.id);
            
            if (!existingRecord) {
              const totalInvoiceableForPartner = costs
                .filter(c => c.partner_id === key && (!c.invoice_status || c.invoice_status === 'Uninvoiced'))
                .reduce((sum, c) => sum + (c.payable_amount || 0), 0);

              sheet.records.push({
                ...rec,
                total_invoiceable_for_partner: totalInvoiceableForPartner
              });
              sheet.record_count += 1;
              sheet.total_invoiceable += totalInvoiceableForPartner;
            }
          }
        }
      }

      const sheets = Array.from(sheetMap.values());
      const processedIds = records.map(r => r.id);

      return { sheets, processed_record_ids: processedIds };
    } catch (error) {
      console.error('生成开票预览失败:', error);
      toast({ title: '错误', description: '生成预览失败', variant: 'destructive' });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // 保存开票申请
  const saveInvoiceRequests = async (data: FinalInvoiceData): Promise<boolean> => {
    setIsSaving(true);
    try {
      for (const sheet of data.sheets) {
        const { error } = await supabase.rpc('create_invoice_request_for_partner_costs', {
          p_partner_costs_data: sheet.partner_costs
        });

        if (error) throw error;
      }

      toast({ 
        title: '开票申请创建成功', 
        description: `已为 ${data.sheets.length} 个合作方创建开票申请` 
      });
      
      return true;
    } catch (error) {
      console.error('保存开票申请失败:', error);
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
    generateInvoicePreview,
    saveInvoiceRequests
  };
}

