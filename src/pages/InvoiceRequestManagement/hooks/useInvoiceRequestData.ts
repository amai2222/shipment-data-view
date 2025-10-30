// 财务开票数据管理Hook
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useInvoiceRequestData() {
  const [invoiceRequests, setInvoiceRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const { toast } = useToast();

  const loadInvoiceRequests = useCallback(async (filters: any, currentPage: number, pageSize: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_invoice_requests_filtered', {
        p_request_number: filters.requestNumber || null,
        p_waybill_number: filters.waybillNumber || null,
        p_driver_name: filters.driverName || null,
        p_loading_date: filters.loadingDate || null,
        p_status: filters.status || null,
        p_project_id: filters.projectId || null,
        p_license_plate: filters.licensePlate || null,
        p_phone_number: filters.phoneNumber || null,
        p_platform_name: filters.platformName || null,
        p_limit: pageSize,
        p_offset: (currentPage - 1) * pageSize
      });

      if (error) throw error;

      const requestsData = (data as any[]) || [];
      setInvoiceRequests(requestsData);

      if (requestsData.length > 0) {
        const total = requestsData[0].total_count || 0;
        setTotalCount(total);
        setTotalPages(Math.ceil(total / pageSize));
      } else {
        setTotalCount(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('加载开票申请失败:', error);
      toast({ title: '错误', description: '加载失败', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    invoiceRequests,
    loading,
    totalCount,
    totalPages,
    loadInvoiceRequests,
    setInvoiceRequests
  };
}

